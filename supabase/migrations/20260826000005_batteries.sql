-- ============================================================================
-- Batteries as tracked assets.
--
-- uavs.battery_cycles has existed since the first migration and nothing has
-- ever maintained it — the same stale-column pattern already removed from
-- flight hours, compliance statuses and training status. It is dropped here
-- rather than left to keep lying.
--
-- A battery is the most failure-prone and most closely regulated consumable on
-- the aircraft, and it is not a property of an airframe: packs move between
-- aircraft, are bought and retired on their own schedule, and carry their own
-- cycle count. So they get their own table, and cycles are derived from actual
-- recorded use exactly the way flight hours are.
-- ============================================================================

create type battery_status as enum ('serviceable', 'monitor', 'retired');

comment on type battery_status is
  'serviceable — cleared for use. monitor — still flying but showing age or '
  'cycles near the limit. retired — out of service, kept for its history.';

create table batteries (
  id uuid primary key default gen_random_uuid(),
  -- The asset tag written on the pack, as drone_id is for airframes.
  battery_id text not null unique,
  model text,
  manufacturer text,
  serial_number text,
  capacity_mah integer check (capacity_mah is null or capacity_mah > 0),
  cell_count integer check (cell_count is null or cell_count > 0),
  purchased_date date,
  -- Cycles already on the pack when it was first recorded here, so a battery
  -- bought before the portal existed does not start from an honest-looking
  -- zero. Total cycles are this plus everything logged since.
  baseline_cycles integer not null default 0 check (baseline_cycles >= 0),
  -- Manufacturer's rated life. Null means no limit is known, in which case the
  -- portal reports usage but never claims the pack is due for retirement.
  cycle_limit integer check (cycle_limit is null or cycle_limit > 0),
  status battery_status not null default 'serviceable',
  location_site text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger batteries_set_updated_at
  before update on batteries
  for each row execute function public.set_updated_at();

create index idx_batteries_status on batteries (status);

-- ---------------------------------------------------------------------------
-- Which packs flew on which flight
--
-- Many-to-many: a Matrice flies on two packs at once, and a pack flies many
-- times. Recording it per flight is what makes the cycle count derivable
-- instead of a number someone remembers to increment.
-- ---------------------------------------------------------------------------

create table flight_battery_usage (
  id uuid primary key default gen_random_uuid(),
  flight_log_id uuid not null references flight_logs (id) on delete cascade,
  battery_id uuid not null references batteries (id) on delete restrict,
  -- Normally one. A pack swapped mid-mission and reflown counts twice.
  cycles integer not null default 1 check (cycles > 0),
  created_at timestamptz not null default now(),
  unique (flight_log_id, battery_id)
);

create index idx_flight_battery_usage_battery on flight_battery_usage (battery_id);
create index idx_flight_battery_usage_flight on flight_battery_usage (flight_log_id);

-- ---------------------------------------------------------------------------
-- Derived state
-- ---------------------------------------------------------------------------

create or replace view battery_status_view
with (security_invoker = true) as
with logged as (
  select battery_id, coalesce(sum(cycles), 0)::integer as cycles
  from flight_battery_usage
  group by battery_id
),
last_flight as (
  select u.battery_id, max(f.flight_date) as last_used
  from flight_battery_usage u
  join flight_logs f on f.id = u.flight_log_id
  group by u.battery_id
)
select
  b.id,
  b.battery_id,
  b.model,
  b.manufacturer,
  b.serial_number,
  b.capacity_mah,
  b.cell_count,
  b.purchased_date,
  b.baseline_cycles,
  b.cycle_limit,
  b.status,
  b.location_site,
  b.notes,
  b.created_at,
  b.baseline_cycles + coalesce(l.cycles, 0)              as total_cycles,
  case
    when b.cycle_limit is null then null
    else b.cycle_limit - (b.baseline_cycles + coalesce(l.cycles, 0))
  end                                                    as cycles_remaining,
  lf.last_used                                           as last_used_on,
  case
    when b.purchased_date is null then null
    else (extract(year from age(current_date, b.purchased_date)) * 12
        + extract(month from age(current_date, b.purchased_date)))::integer
  end                                                    as age_months
from batteries b
left join logged l on l.battery_id = b.id
left join last_flight lf on lf.battery_id = b.id;

comment on view battery_status_view is
  'Batteries with derived cycle count, remaining life and age. Never stored — '
  'a cycle count that has to be incremented by hand is one that will be wrong.';

-- ---------------------------------------------------------------------------
-- Access
--
-- Batteries belong to the fleet: whoever manages airframes manages the packs
-- that fly on them, and anyone who can see the fleet can see them.
-- ---------------------------------------------------------------------------

alter table batteries enable row level security;
alter table flight_battery_usage enable row level security;

create policy batteries_select on batteries for select to authenticated
  using (public.can_read_all('fleet'));

create policy batteries_manage on batteries for all to authenticated
  using (public.can_manage('fleet'))
  with check (public.can_manage('fleet'));

-- Usage is part of filing a flight log, so it follows the logs permission
-- rather than the fleet one — a pilot who may file a log may say what it flew
-- on, without being able to add or retire a pack.
create policy flight_battery_usage_select on flight_battery_usage for select to authenticated
  using (public.can_read_all('logs') or public.can_read_own('logs'));

create policy flight_battery_usage_write on flight_battery_usage for all to authenticated
  using (public.can_create('logs') or public.can_manage('logs'))
  with check (public.can_create('logs') or public.can_manage('logs'));

-- ---------------------------------------------------------------------------
-- Remove the column that never worked
-- ---------------------------------------------------------------------------

alter table uavs drop column if exists battery_cycles;
