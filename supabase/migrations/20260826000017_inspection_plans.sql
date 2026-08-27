-- ============================================================================
-- Named inspection plans.
--
-- A single "maintenance every N hours" figure per airframe is the wrong shape
-- for how aircraft are actually maintained. A Matrice has a propeller check
-- every 50 hours, a motor inspection every 200, a battery bay clean every six
-- months and an annual airframe inspection — each with its own clock, and each
-- falling due independently of the others.
--
-- So a plan is a named list of items, each with up to three intervals: hours,
-- cycles, and calendar months. Whichever falls first is the due point, which
-- is how every manufacturer's maintenance schedule is written.
--
-- Everything about "when is this next due" is derived. Nothing is stored that
-- a completion record and an interval can answer between them, because a
-- stored due date is a date that silently goes stale the moment a flight is
-- logged or a completion is corrected.
-- ============================================================================

create table if not exists inspection_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Null applies the plan to every aircraft; a model name scopes it. Kept as
  -- text to match uavs.model, which is free text rather than a lookup.
  applies_to_model text,
  description text,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inspection_plans_name_not_blank check (btrim(name) <> '')
);

comment on table inspection_plans is
  'A named maintenance schedule: propeller checks, motor inspections, annuals. Applied to a model or to the whole fleet.';

create table if not exists inspection_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references inspection_plans(id) on delete cascade,
  name text not null,
  description text,
  -- At least one interval, and any combination: whichever falls first wins.
  interval_hours numeric(8, 1),
  interval_cycles integer,
  interval_months integer,
  -- A critical item grounds the aircraft when overdue rather than merely
  -- flagging it. An overdue annual is not the same as a late cosmetic check.
  is_critical boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint inspection_plan_items_name_not_blank check (btrim(name) <> ''),
  constraint inspection_plan_items_has_an_interval check (
    interval_hours is not null or interval_cycles is not null or interval_months is not null
  ),
  constraint inspection_plan_items_intervals_positive check (
    (interval_hours is null or interval_hours > 0)
    and (interval_cycles is null or interval_cycles > 0)
    and (interval_months is null or interval_months > 0)
  )
);

comment on constraint inspection_plan_items_has_an_interval on inspection_plan_items is
  'An item with no interval can never fall due, which makes it a note rather than a plan item.';

create index if not exists inspection_plan_items_plan_idx
  on inspection_plan_items (plan_id, sort_order);

-- Which aircraft a plan actually covers. A model match is the usual case, but
-- one airframe fitted with a different payload may need a plan of its own.
create table if not exists uav_inspection_plans (
  uav_id uuid not null references uavs(id) on delete cascade,
  plan_id uuid not null references inspection_plans(id) on delete cascade,
  assigned_on date not null default current_date,
  primary key (uav_id, plan_id)
);

-- A maintenance record can now say which plan item it satisfied. Nullable, so
-- an unscheduled repair is still a maintenance record and belongs to no plan.
--
-- cycles_at_service is the counterpart to the existing flight_hours_at_service:
-- without it a cycles-based interval has no reset point, and the only way to
-- express one would be a recurring count over the whole life of the airframe —
-- which says nothing about when the item was last actually done.
alter table maintenance_records
  add column if not exists plan_item_id uuid references inspection_plan_items(id) on delete set null,
  add column if not exists cycles_at_service integer;

create index if not exists maintenance_records_plan_item_idx
  on maintenance_records (uav_id, plan_item_id, completed_date desc)
  where status = 'completed';

comment on column maintenance_records.plan_item_id is
  'The plan item this record satisfied. Null for unscheduled repairs, which belong to no schedule.';

-- ---------------------------------------------------------------------------
-- Derived status
-- ---------------------------------------------------------------------------

/*
 * For every aircraft and every item on its plans: what was last done, and when
 * the next one falls due on each clock.
 *
 * The three clocks are computed side by side and the soonest is reported as
 * the due point, which is what "whichever falls first" means in practice. An
 * item never yet completed is due from the aircraft's baseline — the day it
 * entered service, at its baseline hours — rather than reading as never due.
 */
create or replace view inspection_plan_status
with (security_invoker = true)
as
with airframe as (
  select
    f.uav_id,
    f.drone_id,
    f.model,
    f.status,
    f.flight_hours,
    -- Cycles are flights: one takeoff and landing is one cycle, which is how
    -- airframe and battery life are both counted.
    coalesce(c.cycles, 0) as cycles,
    coalesce(u.purchased_date, current_date) as in_service_on,
    u.baseline_flight_hours
  from uav_fleet_status f
  join uavs u on u.id = f.uav_id
  left join (
    select uav_id, count(*) as cycles from flight_logs group by uav_id
  ) c on c.uav_id = f.uav_id
),
applicable as (
  -- A plan reaches an aircraft two ways: assigned to it directly, or matching
  -- its model. Distinct, so a plan that does both is not counted twice.
  select distinct a.uav_id, p.id as plan_id
  from airframe a
  join inspection_plans p on p.active
  left join uav_inspection_plans link on link.uav_id = a.uav_id and link.plan_id = p.id
  where link.plan_id is not null
     or (p.applies_to_model is not null and p.applies_to_model = a.model)
),
last_done as (
  select distinct on (m.uav_id, m.plan_item_id)
    m.uav_id,
    m.plan_item_id,
    m.completed_date,
    m.flight_hours_at_service,
    m.cycles_at_service
  from maintenance_records m
  where m.status = 'completed' and m.plan_item_id is not null
  order by m.uav_id, m.plan_item_id, m.completed_date desc
)
select
  a.uav_id,
  a.drone_id,
  a.model,
  p.id                                       as plan_id,
  p.name                                     as plan_name,
  i.id                                       as item_id,
  i.name                                     as item_name,
  i.description                              as item_description,
  i.is_critical,
  i.sort_order,
  i.interval_hours,
  i.interval_cycles,
  i.interval_months,
  d.completed_date                           as last_completed_on,
  d.flight_hours_at_service                  as last_completed_at_hours,
  d.cycles_at_service                        as last_completed_at_cycles,
  a.flight_hours                             as current_hours,
  a.cycles                                   as current_cycles,

  -- Hours remaining on the hours clock, negative when overdue.
  case when i.interval_hours is null then null else
    (coalesce(d.flight_hours_at_service, a.baseline_flight_hours) + i.interval_hours)
      - a.flight_hours
  end                                        as hours_remaining,

  -- Calendar days remaining, from the last completion or from entry into
  -- service when the item has never been done.
  case when i.interval_months is null then null else
    (coalesce(d.completed_date, a.in_service_on)
      + make_interval(months => i.interval_months))::date - current_date
  end                                        as days_remaining,

  case when i.interval_months is null then null else
    (coalesce(d.completed_date, a.in_service_on)
      + make_interval(months => i.interval_months))::date
  end                                        as due_date,

  -- Cycles remaining, measured from the last completion the same way hours
  -- are. An item never done counts from zero, the airframe's first flight.
  case when i.interval_cycles is null then null else
    (coalesce(d.cycles_at_service, 0) + i.interval_cycles) - a.cycles
  end                                        as cycles_remaining,

  -- Whichever clock runs out first. The three are compared as "already past or
  -- not" rather than converted into one another, because an hour is not a day
  -- and averaging them would invent a due date nobody chose.
  (
    (i.interval_hours is not null
      and (coalesce(d.flight_hours_at_service, a.baseline_flight_hours) + i.interval_hours)
            <= a.flight_hours)
    or (i.interval_months is not null
      and (coalesce(d.completed_date, a.in_service_on)
            + make_interval(months => i.interval_months))::date <= current_date)
    or (i.interval_cycles is not null
      and (coalesce(d.cycles_at_service, 0) + i.interval_cycles) <= a.cycles)
  )                                          as is_due
from airframe a
join applicable ap on ap.uav_id = a.uav_id
join inspection_plans p on p.id = ap.plan_id
join inspection_plan_items i on i.plan_id = p.id
left join last_done d on d.uav_id = a.uav_id and d.plan_item_id = i.id
where a.status <> 'retired';

comment on view inspection_plan_status is
  'Every aircraft against every item on its plans, with the next due point derived on each clock. Nothing here is stored.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table inspection_plans enable row level security;
alter table inspection_plan_items enable row level security;
alter table uav_inspection_plans enable row level security;

create policy "inspection plans readable"
  on inspection_plans for select to authenticated
  using (public.can_read_all('maintenance'));

create policy "inspection plans writable by maintenance managers"
  on inspection_plans for all to authenticated
  using (public.can_manage('maintenance'))
  with check (public.can_manage('maintenance'));

create policy "plan items readable"
  on inspection_plan_items for select to authenticated
  using (public.can_read_all('maintenance'));

create policy "plan items writable by maintenance managers"
  on inspection_plan_items for all to authenticated
  using (public.can_manage('maintenance'))
  with check (public.can_manage('maintenance'));

create policy "plan assignments readable"
  on uav_inspection_plans for select to authenticated
  using (public.can_read_all('maintenance'));

create policy "plan assignments writable by maintenance managers"
  on uav_inspection_plans for all to authenticated
  using (public.can_manage('maintenance'))
  with check (public.can_manage('maintenance'));
