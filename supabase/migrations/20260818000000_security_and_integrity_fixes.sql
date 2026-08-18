-- ============================================================================
-- Security and data-integrity fixes from the code review.
-- Safe to run once against an existing database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CRITICAL — privilege escalation via profiles_self_update
--
-- profiles_self_update lets a user update their own row. RLS policies for a
-- command are OR'd together, so it also let them set their own `role` and
-- become uav_admin. Postgres policies cannot restrict individual columns, so
-- the column-level rule is enforced with a trigger instead.
--
-- auth.uid() is null for service-role/back-office connections, which are
-- deliberately still allowed to reassign roles.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_role_change_is_admin_only()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.current_user_role() is distinct from 'uav_admin' then
    raise exception 'Only administrators can change a user role'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_change on public.profiles;
create trigger profiles_enforce_role_change
  before update on public.profiles
  for each row execute function public.enforce_role_change_is_admin_only();

-- ---------------------------------------------------------------------------
-- 2 & 3. HIGH — maintenance completion could un-ground an aircraft and wipe
-- its inspection date.
--
--   * Only return a UAV to service if it was actually in 'maintenance'. A
--     'grounded' airframe stays grounded until a human clears it, so closing
--     an unrelated battery or firmware job can no longer put a crashed
--     aircraft back on the flight line.
--   * next_service_date is optional on the maintenance form; only overwrite
--     the UAV's inspection date when a real date was supplied.
-- ---------------------------------------------------------------------------

create or replace function public.sync_uav_after_maintenance()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update uavs
      set status = case when status = 'maintenance' then 'active' else status end,
          next_inspection_date = coalesce(new.next_service_date, next_inspection_date)
      where id = new.uav_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. MEDIUM — anyone could file an incident against any pilot, untraceably.
--
-- Record who filed non-anonymous reports, and stop ordinary users attributing
-- an incident to a pilot who is not them. Anonymous reports keep both columns
-- null so they remain genuinely anonymous.
-- ---------------------------------------------------------------------------

alter table incidents
  add column if not exists reported_by uuid references profiles (id);

drop policy if exists incidents_insert on incidents;
create policy incidents_insert on incidents for insert to authenticated
  with check (
    pilot_id is null
    or public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor', 'maintenance_team')
    or pilot_id in (select id from pilots where profile_id = auth.uid())
  );

-- Let a reporter see the report they filed, alongside the existing rules.
drop policy if exists incidents_select on incidents;
create policy incidents_select on incidents for select to authenticated
  using (
    public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor', 'maintenance_team')
    or pilot_id in (select id from pilots where profile_id = auth.uid())
    or reported_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 6. MEDIUM — a pilot could submit a flight request as another pilot.
-- ---------------------------------------------------------------------------

drop policy if exists flight_requests_insert on flight_requests;
create policy flight_requests_insert on flight_requests for insert to authenticated
  with check (
    public.current_user_role() in ('uav_admin', 'ops_manager')
    or (
      public.current_user_role() = 'pilot'
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

-- Same reasoning for post-flight logs.
drop policy if exists flight_logs_insert on flight_logs;
create policy flight_logs_insert on flight_logs for insert to authenticated
  with check (
    public.current_user_role() in ('uav_admin', 'ops_manager')
    or (
      public.current_user_role() = 'pilot'
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 14. LOW — foreign keys and hot filter columns were unindexed. The dashboard
-- issues ~12 aggregate queries per load and the RLS subqueries above run per
-- row, so these matter well before the tables get large.
-- ---------------------------------------------------------------------------

create index if not exists idx_uavs_assigned_pilot     on uavs (assigned_pilot_id);
create index if not exists idx_uavs_status             on uavs (status);
create index if not exists idx_pilots_profile          on pilots (profile_id);
create index if not exists idx_flight_requests_pilot   on flight_requests (pilot_id);
create index if not exists idx_flight_requests_uav     on flight_requests (uav_id);
create index if not exists idx_flight_logs_pilot       on flight_logs (pilot_id);
create index if not exists idx_flight_logs_uav         on flight_logs (uav_id);
create index if not exists idx_flight_logs_date        on flight_logs (flight_date);
create index if not exists idx_maintenance_uav         on maintenance_records (uav_id);
create index if not exists idx_maintenance_status      on maintenance_records (status);
create index if not exists idx_incidents_uav           on incidents (uav_id);
create index if not exists idx_incidents_pilot         on incidents (pilot_id);
create index if not exists idx_incidents_reported_by   on incidents (reported_by);
create index if not exists idx_incidents_status        on incidents (status);
create index if not exists idx_audits_status           on audits (status);
create index if not exists idx_audit_findings_audit    on audit_findings (audit_id);
create index if not exists idx_audit_findings_assigned on audit_findings (assigned_to);
create index if not exists idx_training_pilot          on training_records (pilot_id);
create index if not exists idx_training_expiry         on training_records (expiry_date);
create index if not exists idx_documents_category      on documents (category);
