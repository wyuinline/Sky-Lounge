-- ============================================================================
-- Components and equipment.
--
-- The fleet has been two tables — airframes and, since Phase 1, batteries.
-- Everything else that wears out has been invisible: motors, propellers, ESCs,
-- gimbals, payloads, RTK base stations. "Replace props every 200 hours" is not
-- a rule the portal could express, let alone enforce.
--
-- The important part is that a component's hours are not its own. A propeller
-- accrues hours from whichever airframe it is fitted to, for as long as it is
-- fitted — so hours are derived by intersecting installation periods with the
-- flights flown in them, rather than counted on the component itself.
-- ============================================================================

create type component_category as enum (
  'motor',
  'propeller',
  'esc',
  'gimbal',
  'camera',
  'payload',
  'rtk_base',
  'controller',
  'antenna',
  'charger',
  'case',
  'other'
);

create type component_status as enum ('in_service', 'spare', 'maintenance', 'retired');

create table components (
  id uuid primary key default gen_random_uuid(),
  -- The asset tag, as drone_id and battery_id are.
  component_id text not null unique,
  category component_category not null,
  name text not null,
  manufacturer text,
  model text,
  serial_number text,
  purchased_date date,
  -- Hours already on the part when it was first recorded here.
  baseline_hours numeric not null default 0 check (baseline_hours >= 0),
  -- Null means the part has no hours-based service life; the portal then
  -- reports its usage without claiming anything is due.
  service_interval_hours integer
    check (service_interval_hours is null or service_interval_hours > 0),
  status component_status not null default 'spare',
  location_site text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger components_set_updated_at
  before update on components
  for each row execute function public.set_updated_at();

create index idx_components_category on components (category);
create index idx_components_status on components (status);

-- ---------------------------------------------------------------------------
-- Fitted to what, and when
-- ---------------------------------------------------------------------------

create table component_installations (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references components (id) on delete cascade,
  uav_id uuid not null references uavs (id) on delete restrict,
  installed_on date not null default current_date,
  removed_on date,
  installed_by uuid references profiles (id),
  notes text,
  created_at timestamptz not null default now(),
  constraint component_installations_dates_ordered
    check (removed_on is null or removed_on >= installed_on)
);

-- A part is fitted to at most one airframe at a time. Without this a
-- mistakenly unclosed installation would double-count every hour flown.
create unique index idx_component_one_open_installation
  on component_installations (component_id)
  where removed_on is null;

create index idx_component_installations_uav on component_installations (uav_id);
create index idx_component_installations_component on component_installations (component_id);

-- ---------------------------------------------------------------------------
-- Derived hours
--
-- For each installation period, the hours flown by that airframe between
-- fitting and removal. An open installation runs to today. Flights before a
-- part was fitted, or after it came off, correctly contribute nothing.
-- ---------------------------------------------------------------------------

create or replace view component_status_view
with (security_invoker = true) as
with installed_hours as (
  select
    i.component_id,
    coalesce(sum(f.effective_duration_minutes), 0) / 60.0 as hours
  from component_installations i
  left join flight_logs f
    on f.uav_id = i.uav_id
   and f.flight_date >= i.installed_on
   and (i.removed_on is null or f.flight_date <= i.removed_on)
  group by i.component_id
),
current_fit as (
  select distinct on (i.component_id)
    i.component_id,
    i.uav_id,
    i.installed_on,
    u.drone_id
  from component_installations i
  join uavs u on u.id = i.uav_id
  where i.removed_on is null
  order by i.component_id, i.installed_on desc
)
select
  c.id,
  c.component_id,
  c.category,
  c.name,
  c.manufacturer,
  c.model,
  c.serial_number,
  c.purchased_date,
  c.baseline_hours,
  c.service_interval_hours,
  c.status,
  c.location_site,
  c.notes,
  c.created_at,
  c.baseline_hours + coalesce(h.hours, 0)                    as total_hours,
  case
    when c.service_interval_hours is null then null
    else c.service_interval_hours - (c.baseline_hours + coalesce(h.hours, 0))
  end                                                        as hours_until_service,
  cf.uav_id                                                  as fitted_to_uav_id,
  cf.drone_id                                                as fitted_to,
  cf.installed_on                                            as fitted_on
from components c
left join installed_hours h on h.component_id = c.id
left join current_fit cf on cf.component_id = c.id;

comment on view component_status_view is
  'Components with hours derived from the airframes they were fitted to, for '
  'the periods they were fitted. Never counted on the component itself.';

-- ---------------------------------------------------------------------------
-- Access — components are fleet equipment
-- ---------------------------------------------------------------------------

alter table components enable row level security;
alter table component_installations enable row level security;

create policy components_select on components for select to authenticated
  using (public.can_read_all('fleet'));

create policy components_manage on components for all to authenticated
  using (public.can_manage('fleet'))
  with check (public.can_manage('fleet'));

create policy component_installations_select on component_installations
  for select to authenticated using (public.can_read_all('fleet'));

create policy component_installations_manage on component_installations
  for all to authenticated
  using (public.can_manage('fleet'))
  with check (public.can_manage('fleet'));
