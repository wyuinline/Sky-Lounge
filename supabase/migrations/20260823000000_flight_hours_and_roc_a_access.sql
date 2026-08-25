-- ============================================================================
-- Three fixes from the comprehensive review.
--
-- 1. uavs.flight_hours was a stored total that nothing ever incremented, so it
--    sat at 0 forever and the hours-based maintenance interval could never
--    trigger. Derived from logged flights instead, so it cannot go stale.
-- 2. maintenance_records.flight_hours_at_service was never written, so hours
--    since service was meaningless. Stamped by a trigger rather than by one
--    code path that can be forgotten.
-- 3. ROC-A certificates were readable by every authenticated user, including
--    read_only, despite the pilot records they belong to being restricted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Flight hours: baseline + logged
--
-- The column becomes the airframe's hours when it entered the system, so an
-- imported aircraft that already had 150 hours keeps them. Everything flown
-- since is summed from flight_logs.
-- ---------------------------------------------------------------------------

alter table uavs rename column flight_hours to baseline_flight_hours;

alter table uavs
  alter column baseline_flight_hours set default 0,
  alter column baseline_flight_hours set not null;

comment on column uavs.baseline_flight_hours is
  'Airframe hours when it was entered into this system. Total hours are '
  'derived as this plus everything logged since — see uav_fleet_status.';

-- ---------------------------------------------------------------------------
-- 2. Stamp hours at service
--
-- A trigger rather than application code: completion can happen from more than
-- one path, and a snapshot that is only written by one of them is how the
-- original bug happened. Only stamped if not already set, so a correction
-- entered by hand is preserved.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_flight_hours_at_service()
returns trigger
language plpgsql
as $$
declare
  total numeric;
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.flight_hours_at_service is null then

    select u.baseline_flight_hours
           + coalesce((
               select sum(fl.duration_minutes) / 60.0
               from flight_logs fl
               where fl.uav_id = u.id
             ), 0)
      into total
      from uavs u
     where u.id = new.uav_id;

    new.flight_hours_at_service := total;
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_records_stamp_hours on maintenance_records;
create trigger maintenance_records_stamp_hours
  before update on maintenance_records
  for each row execute function public.stamp_flight_hours_at_service();

-- ---------------------------------------------------------------------------
-- Single fleet status view
--
-- Replaces uav_maintenance_status. One view rather than two so the total-hours
-- calculation exists in exactly one place and cannot drift between the page
-- and the reminder scan.
--
-- Where an airframe has no completed service on record, hours since service is
-- measured from its baseline — i.e. it is assumed serviced when it entered the
-- system. An imported airframe should therefore carry a baseline service
-- record, otherwise pre-existing hours are not counted against its interval.
-- ---------------------------------------------------------------------------

drop view if exists uav_maintenance_status;

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
  end                                                     as hours_until_service
from uavs u
left join logged l on l.uav_id = u.id
left join lateral (
  select m.completed_date, m.flight_hours_at_service
  from maintenance_records m
  where m.uav_id = u.id
    and m.status = 'completed'
  order by m.completed_date desc nulls last, m.created_at desc
  limit 1
) last_service on true;

-- ---------------------------------------------------------------------------
-- 3. ROC-A access
--
-- These are personal credential documents. The pilots table restricts records
-- to admins, ops managers, auditors and the pilot themselves; the certificates
-- attached to those records were readable by anyone signed in, which
-- contradicted that. Aligned here.
-- ---------------------------------------------------------------------------

drop policy if exists documents_select on documents;
create policy documents_select on documents for select to authenticated
  using (
    case
      -- Personal credentials: the responsible roles, or the pilot concerned.
      when category = 'roc_a' then
        public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor')
        or pilot_id in (select id from pilots where profile_id = auth.uid())
      when public.is_restricted_document_category(category) then
        public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor')
      else true
    end
  );

-- The object key is '<pilot_id>/<uuid>-<name>', so the owning pilot can be
-- recovered from the first path segment.
drop policy if exists documents_storage_read on storage.objects;
create policy documents_storage_read on storage.objects for select to authenticated
  using (
    bucket_id not in ('regulatory-documents', 'incident-reports', 'roc-a-certificates')
    or public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor')
    or (
      bucket_id = 'roc-a-certificates'
      and (storage.foldername(name))[1] in (
        select p.id::text from pilots p where p.profile_id = auth.uid()
      )
    )
  );

-- The ROC-A tick must stay visible to everyone who can see the pilot list,
-- even though the document itself is now restricted. This returns only a
-- boolean — whether a certificate is on file — never the document.
create or replace function public.pilot_has_roc_a(p_pilot_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from documents d
    where d.pilot_id = p_pilot_id
      and d.category = 'roc_a'
  );
$$;

create or replace view pilot_certificate_status
with (security_invoker = true)
as
select
  p.id,
  p.full_name,
  p.certificate_number,
  p.certificate_type,
  p.certificate_issued,
  p.certificate_expires,
  p.last_recency_activity,
  p.flight_hours,
  p.notes,
  p.profile_id,
  (p.last_recency_activity + interval '24 months')::date as recency_due,
  public.pilot_has_roc_a(p.id)                           as has_roc_a
from pilots p;
