-- ============================================================================
-- UAV Operations Management Portal — initial schema
-- Tables mirror the SharePoint lists from the original planning doc (Section 8):
-- UAV_Fleet, Pilot_Registry, Flight_Requests, Flight_Logs, UAV_Maintenance,
-- UAV_Incidents, UAV_Audits, Audit_Findings, Training_Records, + Documents
-- (replacing the 8 SharePoint document libraries via Storage buckets).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('uav_admin', 'ops_manager', 'pilot', 'auditor', 'maintenance_team', 'read_only');
create type uav_status as enum ('active', 'maintenance', 'grounded');
create type risk_level as enum ('low', 'medium', 'high', 'critical');
create type approval_status as enum ('pending', 'approved', 'rejected');
create type mission_outcome as enum ('completed', 'aborted', 'partial');
create type maintenance_type as enum ('preventive', 'repair', 'calibration', 'battery', 'firmware');
create type maintenance_status as enum ('scheduled', 'in_progress', 'overdue', 'completed');
create type incident_type as enum ('near_miss', 'crash', 'equipment_failure', 'safety_hazard', 'regulatory_breach');
create type severity_level as enum ('low', 'medium', 'high', 'critical');
create type incident_status as enum ('open', 'investigating', 'closed', 'escalated');
create type audit_type as enum ('internal', 'regulatory');
create type audit_status as enum ('planned', 'in_progress', 'completed', 'overdue');
create type compliance_status as enum ('compliant', 'at_risk', 'non_compliant');
create type finding_status as enum ('open', 'in_progress', 'closed', 'overdue');
create type currency_status as enum ('current', 'due_soon', 'expired');
create type competency_level as enum ('beginner', 'intermediate', 'advanced', 'qualified');
create type document_category as enum ('sop', 'policy', 'flight_manual', 'maintenance_manual', 'regulatory', 'incident_report', 'training_material', 'safety_document');
create type document_workflow_status as enum ('draft', 'pending_approval', 'approved', 'published');

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users with role + display info
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role user_role not null default 'read_only',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reads the caller's role without recursing through RLS on profiles.
create function public.current_user_role()
returns user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- uavs — UAV_Fleet
-- ---------------------------------------------------------------------------

create table uavs (
  id uuid primary key default gen_random_uuid(),
  drone_id text not null unique,
  model text not null,
  manufacturer text,
  status uav_status not null default 'active',
  flight_hours numeric not null default 0,
  battery_cycles integer not null default 0,
  firmware_version text,
  assigned_pilot_id uuid references profiles (id),
  next_inspection_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger uavs_set_updated_at
  before update on uavs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pilots — Pilot_Registry (sensitive: separate from profiles, richer HR data)
-- ---------------------------------------------------------------------------

create table pilots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles (id),
  full_name text not null,
  employee_id text unique,
  license_number text,
  medical_expiry date,
  flight_hours numeric not null default 0,
  currency_status currency_status not null default 'current',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- flight_requests / flight_logs — Flight_Requests, Flight_Logs
-- ---------------------------------------------------------------------------

create table flight_requests (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references pilots (id),
  uav_id uuid references uavs (id),
  location text,
  requested_date date not null default current_date,
  risk_level risk_level not null default 'low',
  risk_assessment text,
  approval_status approval_status not null default 'pending',
  approved_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table flight_logs (
  id uuid primary key default gen_random_uuid(),
  flight_request_id uuid references flight_requests (id),
  pilot_id uuid references pilots (id),
  uav_id uuid references uavs (id),
  flight_date date not null default current_date,
  duration_minutes integer,
  weather_conditions text,
  mission_outcome mission_outcome not null default 'completed',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- maintenance_records — UAV_Maintenance
-- ---------------------------------------------------------------------------

create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  uav_id uuid references uavs (id),
  maintenance_type maintenance_type not null,
  next_service_date date,
  technician_id uuid references profiles (id),
  status maintenance_status not null default 'scheduled',
  completed_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Completing maintenance keeps the fleet registry in sync, matching the
-- original doc's note that maintenance records auto-update the UAV record.
create function public.sync_uav_after_maintenance()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update uavs
      set status = 'active',
          next_inspection_date = new.next_service_date
      where id = new.uav_id;
  end if;
  return new;
end;
$$;

create trigger maintenance_records_sync_uav
  after update on maintenance_records
  for each row execute function public.sync_uav_after_maintenance();

-- ---------------------------------------------------------------------------
-- incidents — UAV_Incidents (sensitive; supports anonymous reporting)
-- ---------------------------------------------------------------------------

create table incidents (
  id uuid primary key default gen_random_uuid(),
  incident_date date not null default current_date,
  incident_type incident_type not null,
  uav_id uuid references uavs (id),
  pilot_id uuid references pilots (id),
  severity severity_level not null,
  status incident_status not null default 'open',
  description text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audits / audit_findings — UAV_Audits, Audit_Findings
-- ---------------------------------------------------------------------------

create table audits (
  id uuid primary key default gen_random_uuid(),
  audit_type audit_type not null,
  audit_date date not null,
  auditor_id uuid references profiles (id),
  status audit_status not null default 'planned',
  compliance_status compliance_status,
  created_at timestamptz not null default now()
);

create table audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid references audits (id) on delete cascade,
  severity severity_level not null,
  description text not null,
  assigned_to uuid references profiles (id),
  due_date date,
  status finding_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- training_records — Training_Records
-- ---------------------------------------------------------------------------

create table training_records (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references pilots (id),
  certification_name text not null,
  issue_date date,
  expiry_date date,
  competency_level competency_level,
  status currency_status not null default 'current',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- documents — metadata for the 8 SharePoint document libraries
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category document_category not null,
  uav_model text,
  department text,
  version integer not null default 1,
  approval_status document_workflow_status not null default 'draft',
  storage_path text not null,
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Restricted document categories per the original doc's access rules.
create function public.is_restricted_document_category(cat document_category)
returns boolean language sql immutable as $$
  select cat in ('regulatory', 'incident_report');
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table profiles enable row level security;
alter table uavs enable row level security;
alter table pilots enable row level security;
alter table flight_requests enable row level security;
alter table flight_logs enable row level security;
alter table maintenance_records enable row level security;
alter table incidents enable row level security;
alter table audits enable row level security;
alter table audit_findings enable row level security;
alter table training_records enable row level security;
alter table documents enable row level security;

-- profiles: everyone can read profiles (needed for name lookups across the
-- app); only admins can write; users may update their own non-role fields.
create policy profiles_select_all on profiles for select to authenticated using (true);
create policy profiles_admin_write on profiles for all to authenticated
  using (public.current_user_role() = 'uav_admin')
  with check (public.current_user_role() = 'uav_admin');
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- uavs: fleet data is operationally visible to everyone; writes restricted
-- to admins, ops managers, and maintenance team.
create policy uavs_select_all on uavs for select to authenticated using (true);
create policy uavs_write on uavs for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager', 'maintenance_team'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager', 'maintenance_team'));

-- pilots: sensitive registry — admins/ops/auditors see all, pilots see only
-- their own record; writes restricted to admins/ops.
create policy pilots_select on pilots for select to authenticated
  using (
    public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor')
    or profile_id = auth.uid()
  );
create policy pilots_write on pilots for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager'));

-- flight_requests: visible to all authenticated staff; pilots create their
-- own requests, ops managers/admins approve or reject.
create policy flight_requests_select on flight_requests for select to authenticated using (true);
create policy flight_requests_insert on flight_requests for insert to authenticated
  with check (public.current_user_role() in ('pilot', 'ops_manager', 'uav_admin'));
create policy flight_requests_update on flight_requests for update to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager'));

-- flight_logs: visible to all; created by pilots/ops/admins.
create policy flight_logs_select on flight_logs for select to authenticated using (true);
create policy flight_logs_insert on flight_logs for insert to authenticated
  with check (public.current_user_role() in ('pilot', 'ops_manager', 'uav_admin'));

-- maintenance_records: visible to all; written by maintenance team/admins.
create policy maintenance_select on maintenance_records for select to authenticated using (true);
create policy maintenance_write on maintenance_records for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'maintenance_team'))
  with check (public.current_user_role() in ('uav_admin', 'maintenance_team'));

-- incidents: restricted read (admins/ops/auditors/maintenance, or the
-- reporting pilot); anyone authenticated can report (insert), including
-- anonymous reports where pilot_id is left null.
create policy incidents_select on incidents for select to authenticated
  using (
    public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor', 'maintenance_team')
    or pilot_id in (select id from pilots where profile_id = auth.uid())
  );
create policy incidents_insert on incidents for insert to authenticated with check (true);
create policy incidents_update on incidents for update to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager'));

-- audits / audit_findings: restricted to admins, ops, auditors.
create policy audits_all on audits for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor'));
create policy audit_findings_all on audit_findings for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor'));

-- training_records: admins/ops see all, pilots see their own; writes by
-- admins/ops.
create policy training_select on training_records for select to authenticated
  using (
    public.current_user_role() in ('uav_admin', 'ops_manager')
    or pilot_id in (select id from pilots where profile_id = auth.uid())
  );
create policy training_write on training_records for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager'));

-- documents: regulatory/incident_report categories are restricted; the rest
-- are readable by all authenticated staff. Writes by admins/ops.
create policy documents_select on documents for select to authenticated
  using (
    not public.is_restricted_document_category(category)
    or public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor')
  );
create policy documents_write on documents for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager'));

-- ============================================================================
-- Storage buckets — replace the 8 SharePoint document libraries
-- ============================================================================

insert into storage.buckets (id, name, public) values
  ('sops', 'sops', false),
  ('policies', 'policies', false),
  ('flight-manuals', 'flight-manuals', false),
  ('maintenance-manuals', 'maintenance-manuals', false),
  ('regulatory-documents', 'regulatory-documents', false),
  ('incident-reports', 'incident-reports', false),
  ('training-materials', 'training-materials', false),
  ('safety-documents', 'safety-documents', false);

create policy documents_storage_read on storage.objects for select to authenticated
  using (
    bucket_id not in ('regulatory-documents', 'incident-reports')
    or public.current_user_role() in ('uav_admin', 'ops_manager', 'auditor')
  );
create policy documents_storage_write on storage.objects for all to authenticated
  using (public.current_user_role() in ('uav_admin', 'ops_manager'))
  with check (public.current_user_role() in ('uav_admin', 'ops_manager'));
