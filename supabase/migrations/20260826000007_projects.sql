-- ============================================================================
-- Clients, projects and sites.
--
-- The portal can say an airframe flew 41 hours. It cannot say which jobs those
-- hours served, which client they were billed to, or what a survey cost to
-- fly — because a flight belongs to an aircraft and a pilot and nothing else.
--
-- For a geotechnical and survey firm that is the commercially interesting
-- omission, and neither competitor models project economics well, so this is a
-- wedge rather than only parity.
-- ============================================================================

create type project_status as enum ('planned', 'active', 'on_hold', 'complete', 'cancelled');

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  contact_email text,
  -- A former client's projects stay for the flight history; they simply stop
  -- being offered when raising new work.
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on clients
  for each row execute function public.set_updated_at();

create table projects (
  id uuid primary key default gen_random_uuid(),
  -- The job number the rest of the business already uses.
  project_code text not null unique,
  name text not null,
  client_id uuid references clients (id) on delete restrict,
  site_name text,
  latitude numeric(9, 6) check (latitude is null or (latitude between -90 and 90)),
  longitude numeric(9, 6) check (longitude is null or (longitude between -180 and 180)),
  status project_status not null default 'planned',
  start_date date,
  end_date date,
  -- Optional. Where it is set the portal reports an estimated flying cost;
  -- where it is not, it reports hours and says nothing about money rather than
  -- inventing a figure.
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates_ordered
    check (start_date is null or end_date is null or end_date >= start_date)
);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function public.set_updated_at();

create index idx_projects_client on projects (client_id);
create index idx_projects_status on projects (status);

comment on column projects.hourly_rate is
  'Optional flying rate. Drives an estimated cost on the project summary; '
  'absent means the portal reports utilisation only.';

-- ---------------------------------------------------------------------------
-- Flights belong to jobs
-- ---------------------------------------------------------------------------

alter table flight_logs
  add column if not exists project_id uuid references projects (id) on delete set null;

alter table flight_requests
  add column if not exists project_id uuid references projects (id) on delete set null;

create index if not exists idx_flight_logs_project on flight_logs (project_id);
create index if not exists idx_flight_requests_project on flight_requests (project_id);

-- ---------------------------------------------------------------------------
-- Derived utilisation
--
-- Hours read effective_duration_minutes, so a project's figures inherit the
-- same correction as everything else: recording precise takeoff and landing
-- times improves the job's numbers with no separate step.
-- ---------------------------------------------------------------------------

create or replace view project_summary
with (security_invoker = true) as
with flights as (
  select
    project_id,
    count(*)                                                   as flight_count,
    coalesce(sum(effective_duration_minutes), 0) / 60.0        as hours,
    min(flight_date)                                           as first_flight,
    max(flight_date)                                           as last_flight,
    count(distinct pilot_id)                                   as pilots_used,
    count(distinct uav_id)                                     as aircraft_used
  from flight_logs
  where project_id is not null
  group by project_id
)
select
  p.id,
  p.project_code,
  p.name,
  p.client_id,
  c.name                                                       as client_name,
  p.site_name,
  p.latitude,
  p.longitude,
  p.status,
  p.start_date,
  p.end_date,
  p.hourly_rate,
  p.notes,
  p.created_at,
  coalesce(f.flight_count, 0)                                  as flight_count,
  coalesce(f.hours, 0)                                         as flight_hours,
  f.first_flight,
  f.last_flight,
  coalesce(f.pilots_used, 0)                                   as pilots_used,
  coalesce(f.aircraft_used, 0)                                 as aircraft_used,
  case
    when p.hourly_rate is null then null
    else round((coalesce(f.hours, 0) * p.hourly_rate)::numeric, 2)
  end                                                          as estimated_cost
from projects p
left join clients c on c.id = p.client_id
left join flights f on f.project_id = p.id;

comment on view project_summary is
  'Projects with derived flight count, hours and optional estimated cost. '
  'Hours come from effective_duration_minutes, so they improve automatically '
  'as flights are logged with real takeoff and landing times.';

-- ---------------------------------------------------------------------------
-- Access
--
-- Projects are operational scheduling data, not a restricted record: anyone
-- who can see flight requests can see which job a flight served. Changing them
-- follows the same permission as approving work.
-- ---------------------------------------------------------------------------

alter table clients enable row level security;
alter table projects enable row level security;

create policy clients_select on clients for select to authenticated
  using (public.can_read_all('requests') or public.can_read_own('requests'));

create policy clients_manage on clients for all to authenticated
  using (public.can_manage('requests'))
  with check (public.can_manage('requests'));

create policy projects_select on projects for select to authenticated
  using (public.can_read_all('requests') or public.can_read_own('requests'));

create policy projects_manage on projects for all to authenticated
  using (public.can_manage('requests'))
  with check (public.can_manage('requests'));
