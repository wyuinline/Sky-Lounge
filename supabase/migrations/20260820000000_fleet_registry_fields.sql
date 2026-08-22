-- ============================================================================
-- Align the fleet registry with the operational spreadsheet it replaces, and
-- move maintenance intervals onto flight hours.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Status vocabulary
--
-- The team says "Airworthy", not "Active". 'maintenance' is kept as a separate
-- state on purpose: an airframe being worked on is not the same as one
-- grounded for cause, and the maintenance workflow needs to tell them apart.
-- ---------------------------------------------------------------------------

alter type uav_status rename value 'active' to 'airworthy';

-- The trigger referenced the old value; a stale reference here would silently
-- stop returning airframes to service.
create or replace function public.sync_uav_after_maintenance()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update uavs
      set status = case when status = 'maintenance' then 'airworthy' else status end,
          next_inspection_date = coalesce(new.next_service_date, next_inspection_date)
      where id = new.uav_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Registry fields from the spreadsheet
--
-- registration_number and weight_kg are regulatory: Transport Canada requires
-- registration for airframes between 250 g and 25 kg, so the number is the
-- legal identifier for the aircraft and must be unique.
-- ---------------------------------------------------------------------------

alter table uavs
  add column if not exists registration_number text,
  add column if not exists serial_number text,
  add column if not exists weight_kg numeric(6, 3),
  add column if not exists purchased_date date,
  add column if not exists location_site text,
  add column if not exists notes text,
  add column if not exists maintenance_interval_hours integer;

-- Partial unique indexes: uniqueness matters, but airframes may legitimately
-- be entered before their registration or serial is to hand.
create unique index if not exists idx_uavs_registration_number
  on uavs (registration_number)
  where registration_number is not null;

create unique index if not exists idx_uavs_serial_number
  on uavs (serial_number)
  where serial_number is not null;

alter table uavs
  drop constraint if exists uavs_weight_kg_positive,
  add constraint uavs_weight_kg_positive
    check (weight_kg is null or weight_kg > 0);

alter table uavs
  drop constraint if exists uavs_maintenance_interval_positive,
  add constraint uavs_maintenance_interval_positive
    check (maintenance_interval_hours is null or maintenance_interval_hours > 0);

comment on column uavs.weight_kg is
  'Take-off weight. 250 g to 25 kg requires Transport Canada registration.';
comment on column uavs.maintenance_interval_hours is
  'Flight hours between scheduled maintenance. Next service is derived from '
  'hours flown since the last completed service, not from a stored due date.';

-- ---------------------------------------------------------------------------
-- 3. Hours-based maintenance
--
-- To know how many hours an airframe has flown since its last service, the
-- airframe's total hours at the moment of service must be recorded. Without
-- this the interval cannot be computed at all.
--
-- "Last Maintenance" is deliberately NOT stored on uavs: it is derivable from
-- completed maintenance records, and a denormalised copy that nothing updates
-- is exactly the stale-column pattern already removed from this schema.
-- ---------------------------------------------------------------------------

alter table maintenance_records
  add column if not exists flight_hours_at_service numeric;

comment on column maintenance_records.flight_hours_at_service is
  'Airframe total flight hours when this work was completed. Used to derive '
  'hours flown since the last service.';

-- Convenience view: current hours since last service, per airframe.
create or replace view uav_maintenance_status
with (security_invoker = true)
as
select
  u.id                            as uav_id,
  u.drone_id,
  u.flight_hours,
  u.maintenance_interval_hours,
  last_service.completed_date     as last_maintenance_date,
  last_service.flight_hours_at_service,
  u.flight_hours - coalesce(last_service.flight_hours_at_service, 0)
                                  as hours_since_service,
  case
    when u.maintenance_interval_hours is null then null
    else u.maintenance_interval_hours
         - (u.flight_hours - coalesce(last_service.flight_hours_at_service, 0))
  end                             as hours_until_service
from uavs u
left join lateral (
  select m.completed_date, m.flight_hours_at_service
  from maintenance_records m
  where m.uav_id = u.id
    and m.status = 'completed'
  order by m.completed_date desc nulls last, m.created_at desc
  limit 1
) last_service on true;
