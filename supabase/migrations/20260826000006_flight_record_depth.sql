-- ============================================================================
-- What a flight log has to say to be worth anything.
--
-- Until now a log held a date, a duration in minutes, free-text weather and an
-- outcome. That cannot answer the questions a Transport Canada review actually
-- asks: when did it fly, where, in what airspace, and was it night, beyond
-- line of sight, or over people. Those are precisely the distinctions that
-- decide which rules a flight was operating under.
-- ============================================================================

create type airspace_class as enum ('uncontrolled', 'controlled', 'restricted', 'advisory');

comment on type airspace_class is
  'Uncontrolled (Class G) needs no authorisation. Controlled requires a NAV '
  'Drone authorisation, whose reference is recorded on the flight request.';

create type crew_role as enum ('visual_observer', 'payload_operator', 'trainee');

comment on type crew_role is
  'Additional crew beyond the pilot in command, who remains flight_logs.pilot_id. '
  'A flight with a visual observer is what makes EVLOS operations lawful, so the '
  'observer has to be named on the record, not remembered.';

alter table flight_logs
  add column if not exists takeoff_at timestamptz,
  add column if not exists landing_at timestamptz,
  add column if not exists location_name text,
  add column if not exists latitude numeric(9, 6)
    check (latitude is null or (latitude between -90 and 90)),
  add column if not exists longitude numeric(9, 6)
    check (longitude is null or (longitude between -180 and 180)),
  add column if not exists airspace airspace_class,
  add column if not exists max_altitude_m numeric(6, 1)
    check (max_altitude_m is null or max_altitude_m >= 0),
  add column if not exists is_night boolean not null default false,
  add column if not exists is_bvlos boolean not null default false,
  add column if not exists is_over_people boolean not null default false,
  add column if not exists is_sheltered boolean not null default false,
  add column if not exists sfoc_reference text;

alter table flight_logs
  drop constraint if exists flight_logs_landing_after_takeoff,
  add constraint flight_logs_landing_after_takeoff
    check (
      takeoff_at is null
      or landing_at is null
      or landing_at > takeoff_at
    );

comment on column flight_logs.sfoc_reference is
  'Special Flight Operations Certificate reference, where the operation needed '
  'one. Its presence on a flight is the evidence that it was authorised.';

-- ---------------------------------------------------------------------------
-- Duration, without two sources of truth
--
-- Flight hours across the whole portal are summed from duration_minutes, and
-- that cannot simply be replaced — but a flight with recorded takeoff and
-- landing times should not still be counted from a number someone typed.
--
-- A stored generated column resolves it: Postgres maintains it on every write,
-- so correcting the times corrects the hours, and there is no second value to
-- fall out of step. Computing it in application code at insert time would have
-- reintroduced exactly the staleness this codebase keeps removing.
-- ---------------------------------------------------------------------------

alter table flight_logs
  add column if not exists effective_duration_minutes integer
  generated always as (
    case
      when takeoff_at is not null and landing_at is not null
        then greatest(0, (extract(epoch from (landing_at - takeoff_at)) / 60)::integer)
      else duration_minutes
    end
  ) stored;

comment on column flight_logs.effective_duration_minutes is
  'Derived: the gap between takeoff and landing when both are recorded, and '
  'the manually entered duration otherwise. Every flight-hour figure in the '
  'portal reads this, never duration_minutes directly.';

-- ---------------------------------------------------------------------------
-- Crew beyond the pilot in command
-- ---------------------------------------------------------------------------

create table flight_crew (
  id uuid primary key default gen_random_uuid(),
  flight_log_id uuid not null references flight_logs (id) on delete cascade,
  pilot_id uuid not null references pilots (id) on delete restrict,
  role crew_role not null,
  created_at timestamptz not null default now(),
  unique (flight_log_id, pilot_id, role)
);

create index idx_flight_crew_flight on flight_crew (flight_log_id);
create index idx_flight_crew_pilot on flight_crew (pilot_id);

alter table flight_crew enable row level security;

create policy flight_crew_select on flight_crew for select to authenticated
  using (
    public.can_read_all('logs')
    or (
      public.can_read_own('logs')
      and exists (
        select 1 from pilots p
        where p.id = flight_crew.pilot_id and p.profile_id = auth.uid()
      )
    )
  );

create policy flight_crew_write on flight_crew for all to authenticated
  using (public.can_create('logs') or public.can_manage('logs'))
  with check (public.can_create('logs') or public.can_manage('logs'));

-- ---------------------------------------------------------------------------
-- Fleet hours now read the derived duration
-- ---------------------------------------------------------------------------

create or replace view uav_fleet_status
with (security_invoker = true)
as
with logged as (
  select uav_id, coalesce(sum(effective_duration_minutes), 0) / 60.0 as hours
  from flight_logs
  group by uav_id
)
select
  u.id                                as uav_id,
  u.id,
  u.drone_id,
  u.registration_number,
  u.serial_number,
  u.model,
  u.manufacturer,
  u.weight_kg,
  u.purchased_date,
  u.location_site,
  u.notes,
  u.status,
  u.assigned_pilot_id,
  u.next_inspection_date,
  u.maintenance_interval_hours,
  u.baseline_flight_hours,
  u.baseline_flight_hours + coalesce(l.hours, 0)          as flight_hours,
  last_service.completed_date                             as last_maintenance_date,
  last_service.flight_hours_at_service,
  (u.baseline_flight_hours + coalesce(l.hours, 0))
    - coalesce(last_service.flight_hours_at_service, u.baseline_flight_hours)
                                                          as hours_since_service,
  case
    when u.maintenance_interval_hours is null then null
    else u.maintenance_interval_hours
         - ((u.baseline_flight_hours + coalesce(l.hours, 0))
            - coalesce(last_service.flight_hours_at_service, u.baseline_flight_hours))
  end                                                     as hours_until_service,
  assigned.full_name                                      as assigned_pilot_name
from uavs u
left join logged l on l.uav_id = u.id
left join profiles assigned on assigned.id = u.assigned_pilot_id
left join lateral (
  select m.completed_date, m.flight_hours_at_service
  from maintenance_records m
  where m.uav_id = u.id
    and m.status = 'completed'
  order by m.completed_date desc nulls last, m.created_at desc
  limit 1
) last_service on true;
