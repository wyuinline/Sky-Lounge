-- PostgREST can only embed a related resource across a real foreign key, and a
-- view has none, so the assigned pilot's name has to come from the view itself
-- rather than from an embedded select on the fleet page.
--
-- Appended at the end of the column list: CREATE OR REPLACE VIEW permits
-- adding columns but not reordering or removing existing ones.

create or replace view uav_fleet_status
with (security_invoker = true)
as
with logged as (
  select uav_id, coalesce(sum(duration_minutes), 0) / 60.0 as hours
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
