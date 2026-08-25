-- ============================================================================
-- Role model v2, and permissions that can actually be edited.
--
-- Until now every rule was hardcoded into a policy: "in ('uav_admin',
-- 'ops_manager')". That cannot be changed without a migration, so a
-- permissions screen would have been a screen that lies.
--
-- Access is now data. role_permissions holds one access level per role per
-- area, and the policies consult it. Changing a permission in the portal
-- changes enforcement, because they are the same thing.
--
-- Everything here is one transaction: policies are dropped so the role enum
-- can be replaced, and recreated before commit. There is no window in which
-- the tables sit unprotected.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the policies that depend on current_user_role()
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_all      on profiles;
drop policy if exists profiles_admin_write     on profiles;
drop policy if exists profiles_self_update     on profiles;
drop policy if exists uavs_select_all          on uavs;
drop policy if exists uavs_write               on uavs;
drop policy if exists pilots_select            on pilots;
drop policy if exists pilots_write             on pilots;
drop policy if exists flight_requests_select   on flight_requests;
drop policy if exists flight_requests_insert   on flight_requests;
drop policy if exists flight_requests_update   on flight_requests;
drop policy if exists flight_logs_select       on flight_logs;
drop policy if exists flight_logs_insert       on flight_logs;
drop policy if exists maintenance_select       on maintenance_records;
drop policy if exists maintenance_write        on maintenance_records;
drop policy if exists incidents_select         on incidents;
drop policy if exists incidents_insert         on incidents;
drop policy if exists incidents_update         on incidents;
drop policy if exists audits_all               on audits;
drop policy if exists audit_findings_all       on audit_findings;
drop policy if exists training_select          on training_records;
drop policy if exists training_write           on training_records;
drop policy if exists documents_select         on documents;
drop policy if exists documents_write          on documents;
drop policy if exists notifications_select     on notifications;
drop policy if exists notification_reads_own   on notification_reads;
drop policy if exists documents_storage_read   on storage.objects;
drop policy if exists documents_storage_write  on storage.objects;

drop trigger  if exists profiles_enforce_role_change on profiles;
drop function if exists public.enforce_role_change_is_admin_only() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.pilot_has_roc_a(uuid) cascade;

-- Views read the role indirectly; rebuilt at the end.
drop view if exists pilot_certificate_status;

-- ---------------------------------------------------------------------------
-- 2. Replace the role enum
--
-- Mapping of existing accounts:
--   uav_admin        -> system_admin   (held full control, including accounts)
--   ops_manager      -> uav_admin      (ran the programme)
--   maintenance_team -> uav_lead       (owned airworthiness day to day)
--   auditor, pilot, read_only          (unchanged)
-- ---------------------------------------------------------------------------

create type user_role_v2 as enum (
  'system_admin',
  'uav_admin',
  'uav_lead',
  'auditor',
  'pilot',
  'read_only'
);

create or replace function public.map_legacy_role(t text)
returns user_role_v2 language sql immutable as $$
  select case t
    when 'uav_admin'        then 'system_admin'
    when 'ops_manager'      then 'uav_admin'
    when 'maintenance_team' then 'uav_lead'
    when 'auditor'          then 'auditor'
    when 'pilot'            then 'pilot'
    else 'read_only'
  end::user_role_v2;
$$;

alter table profiles alter column role drop default;
alter table profiles
  alter column role type user_role_v2 using public.map_legacy_role(role::text);
alter table profiles alter column role set default 'read_only'::user_role_v2;

-- Array form as its own function: a USING transform may not contain a
-- subquery, so the unnest has to live inside a function call.
create or replace function public.map_legacy_roles(t text[])
returns user_role_v2[] language sql immutable as $$
  select array(select public.map_legacy_role(x) from unnest(t) x);
$$;

alter table notifications alter column target_roles drop default;
alter table notifications
  alter column target_roles type user_role_v2[]
  using public.map_legacy_roles(target_roles::text[]);
alter table notifications
  alter column target_roles set default '{}'::user_role_v2[];

drop type user_role;
alter type user_role_v2 rename to user_role;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3. The permission model
-- ---------------------------------------------------------------------------

create type access_area as enum (
  'fleet', 'maintenance', 'pilots', 'training', 'requests', 'logs',
  'incidents', 'audits', 'docs_general', 'docs_restricted', 'roc_a',
  'notifications', 'users'
);

create type access_level as enum ('full', 'create', 'read', 'own', 'none');

comment on type access_level is
  'full: read and change everything. create: read everything, add own records '
  'only. read: read everything, change nothing. own: read only own linked '
  'record. none: no access.';

create table role_permissions (
  role       user_role    not null,
  area       access_area  not null,
  level      access_level not null default 'none',
  updated_at timestamptz  not null default now(),
  updated_by uuid references profiles (id),
  primary key (role, area)
);

-- ---------------------------------------------------------------------------
-- 4. Access helpers
--
-- STABLE so Postgres evaluates them once per statement rather than per row;
-- SECURITY DEFINER so reading the permission table is never itself blocked by
-- the policy on that table.
-- ---------------------------------------------------------------------------

create or replace function public.access_level_for(p_area access_area)
returns access_level
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select rp.level
       from role_permissions rp
      where rp.role = public.current_user_role()
        and rp.area = p_area),
    'none'::access_level
  );
$$;

/** Sees every record in the area. */
create or replace function public.can_read_all(p_area access_area)
returns boolean language sql stable security definer set search_path = public as $$
  select public.access_level_for(p_area) in ('full', 'create', 'read');
$$;

/** Sees only their own linked record. */
create or replace function public.can_read_own(p_area access_area)
returns boolean language sql stable security definer set search_path = public as $$
  select public.access_level_for(p_area) = 'own';
$$;

/** May add records, but not necessarily amend anyone else's. */
create or replace function public.can_create(p_area access_area)
returns boolean language sql stable security definer set search_path = public as $$
  select public.access_level_for(p_area) in ('full', 'create');
$$;

/** Full authority: update and delete, not just insert. */
create or replace function public.can_manage(p_area access_area)
returns boolean language sql stable security definer set search_path = public as $$
  select public.access_level_for(p_area) = 'full';
$$;

-- ---------------------------------------------------------------------------
-- 5. Seed the matrix
-- ---------------------------------------------------------------------------

insert into role_permissions (role, area, level) values
  -- System Administrator — the platform owner.
  ('system_admin','fleet','full'), ('system_admin','maintenance','full'),
  ('system_admin','pilots','full'), ('system_admin','training','full'),
  ('system_admin','requests','full'), ('system_admin','logs','full'),
  ('system_admin','incidents','full'), ('system_admin','audits','full'),
  ('system_admin','docs_general','full'), ('system_admin','docs_restricted','full'),
  ('system_admin','roc_a','full'), ('system_admin','notifications','read'),
  ('system_admin','users','full'),

  -- UAV Administrator — owns the programme, not the platform.
  ('uav_admin','fleet','full'), ('uav_admin','maintenance','full'),
  ('uav_admin','pilots','full'), ('uav_admin','training','full'),
  ('uav_admin','requests','full'), ('uav_admin','logs','full'),
  ('uav_admin','incidents','full'), ('uav_admin','audits','full'),
  ('uav_admin','docs_general','full'), ('uav_admin','docs_restricted','full'),
  ('uav_admin','roc_a','full'), ('uav_admin','notifications','read'),
  ('uav_admin','users','none'),

  -- UAV Lead — runs the flying day to day.
  ('uav_lead','fleet','full'), ('uav_lead','maintenance','full'),
  ('uav_lead','pilots','read'), ('uav_lead','training','read'),
  ('uav_lead','requests','full'), ('uav_lead','logs','full'),
  ('uav_lead','incidents','full'), ('uav_lead','audits','read'),
  ('uav_lead','docs_general','full'), ('uav_lead','docs_restricted','read'),
  ('uav_lead','roc_a','read'), ('uav_lead','notifications','read'),
  ('uav_lead','users','none'),

  -- Auditor — independent oversight. Reads the compliance record, including
  -- training, which the previous model wrongly withheld from audits.
  ('auditor','fleet','read'), ('auditor','maintenance','read'),
  ('auditor','pilots','read'), ('auditor','training','read'),
  ('auditor','requests','read'), ('auditor','logs','read'),
  ('auditor','incidents','read'), ('auditor','audits','full'),
  ('auditor','docs_general','read'), ('auditor','docs_restricted','read'),
  ('auditor','roc_a','read'), ('auditor','notifications','read'),
  ('auditor','users','none'),

  -- Pilot.
  ('pilot','fleet','read'), ('pilot','maintenance','read'),
  ('pilot','pilots','own'), ('pilot','training','own'),
  ('pilot','requests','create'), ('pilot','logs','create'),
  ('pilot','incidents','create'), ('pilot','audits','none'),
  ('pilot','docs_general','read'), ('pilot','docs_restricted','none'),
  ('pilot','roc_a','own'), ('pilot','notifications','own'),
  ('pilot','users','none'),

  -- Read-only. Incident reporting stays open: a safety system that gates
  -- reporting by seniority does not get told about problems.
  ('read_only','fleet','read'), ('read_only','maintenance','read'),
  ('read_only','pilots','none'), ('read_only','training','none'),
  ('read_only','requests','read'), ('read_only','logs','read'),
  ('read_only','incidents','create'), ('read_only','audits','none'),
  ('read_only','docs_general','read'), ('read_only','docs_restricted','none'),
  ('read_only','roc_a','none'), ('read_only','notifications','read'),
  ('read_only','users','none')
on conflict (role, area) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Guards
-- ---------------------------------------------------------------------------

/**
 * Refuses any change that would leave no role able to manage users. Without
 * it, one careless click removes the ability to undo that click, and recovery
 * needs a database console.
 */
create or replace function public.keep_one_user_manager()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from role_permissions
     where area = 'users' and level = 'full'
  ) then
    raise exception 'At least one role must keep full access to user management'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists role_permissions_keep_manager on role_permissions;
create constraint trigger role_permissions_keep_manager
  after update or delete on role_permissions
  deferrable initially deferred
  for each row execute function public.keep_one_user_manager();

create or replace function public.enforce_role_change_is_admin_only()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.can_manage('users') then
    raise exception 'You do not have permission to change a user role'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_role_change
  before update on public.profiles
  for each row execute function public.enforce_role_change_is_admin_only();

create or replace function public.pilot_has_roc_a(p_pilot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from documents d
    where d.pilot_id = p_pilot_id and d.category = 'roc_a'
  );
$$;

create or replace view pilot_certificate_status
with (security_invoker = true) as
select
  p.id, p.full_name, p.certificate_number, p.certificate_type,
  p.certificate_issued, p.certificate_expires, p.last_recency_activity,
  p.flight_hours, p.notes, p.profile_id,
  (p.last_recency_activity + interval '24 months')::date as recency_due,
  public.pilot_has_roc_a(p.id)                           as has_roc_a
from pilots p;
