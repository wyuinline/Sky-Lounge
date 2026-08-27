-- ============================================================================
-- Tenant constraints.
--
-- Three things happen to every table.
--
-- 1. organisation_id becomes not null, defaulting to the caller's organisation.
--    The default is what lets every existing insert keep working untouched: the
--    application never sets the column, so it can never set it wrongly, and the
--    with-check clause in the policies refuses anything that disagrees.
--
-- 2. A unique key on (id, organisation_id) wherever the table is referenced.
--    Redundant on its own — id is already unique — but it is what the composite
--    foreign keys below can point at.
--
-- 3. Every foreign key becomes composite: (child_col, organisation_id) into
--    (id, organisation_id). This is the part that matters. RLS stops one
--    operator reading another's rows, but on its own it would not stop someone
--    who had learned an aircraft's id from attaching their own flight log to
--    it. Now the database refuses.
--
--    Deletes that previously nulled the reference use Postgres 15's column-list
--    form, so a departing user nulls the reference and not the organisation.
-- ============================================================================

alter table api_keys
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table audit_findings
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table audits
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table batteries
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table checklist_completions
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table checklist_items
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table checklist_responses
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table checklist_templates
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table clients
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table component_installations
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table components
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table document_review_policy
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table documents
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table flight_battery_usage
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table flight_crew
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table flight_logs
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table flight_requests
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table hazard_incidents
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table hazards
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table incidents
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table inspection_plan_items
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table inspection_plans
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table maintenance_records
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table manual_sections
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table manuals
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table notification_reads
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table notifications
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table pilot_authorisations
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table pilots
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table projects
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table role_permissions
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table training_records
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table uav_inspection_plans
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table uavs
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table webhook_deliveries
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();
alter table webhooks
  alter column organisation_id set not null,
  alter column organisation_id set default public.current_org_id();

-- Every policy filters on this column, so every table needs the index.
create index if not exists api_keys_org_idx on api_keys (organisation_id);
create index if not exists audit_findings_org_idx on audit_findings (organisation_id);
create index if not exists audits_org_idx on audits (organisation_id);
create index if not exists batteries_org_idx on batteries (organisation_id);
create index if not exists checklist_completions_org_idx on checklist_completions (organisation_id);
create index if not exists checklist_items_org_idx on checklist_items (organisation_id);
create index if not exists checklist_responses_org_idx on checklist_responses (organisation_id);
create index if not exists checklist_templates_org_idx on checklist_templates (organisation_id);
create index if not exists clients_org_idx on clients (organisation_id);
create index if not exists component_installations_org_idx on component_installations (organisation_id);
create index if not exists components_org_idx on components (organisation_id);
create index if not exists document_review_policy_org_idx on document_review_policy (organisation_id);
create index if not exists documents_org_idx on documents (organisation_id);
create index if not exists flight_battery_usage_org_idx on flight_battery_usage (organisation_id);
create index if not exists flight_crew_org_idx on flight_crew (organisation_id);
create index if not exists flight_logs_org_idx on flight_logs (organisation_id);
create index if not exists flight_requests_org_idx on flight_requests (organisation_id);
create index if not exists hazard_incidents_org_idx on hazard_incidents (organisation_id);
create index if not exists hazards_org_idx on hazards (organisation_id);
create index if not exists incidents_org_idx on incidents (organisation_id);
create index if not exists inspection_plan_items_org_idx on inspection_plan_items (organisation_id);
create index if not exists inspection_plans_org_idx on inspection_plans (organisation_id);
create index if not exists maintenance_records_org_idx on maintenance_records (organisation_id);
create index if not exists manual_sections_org_idx on manual_sections (organisation_id);
create index if not exists manuals_org_idx on manuals (organisation_id);
create index if not exists notification_reads_org_idx on notification_reads (organisation_id);
create index if not exists notifications_org_idx on notifications (organisation_id);
create index if not exists pilot_authorisations_org_idx on pilot_authorisations (organisation_id);
create index if not exists pilots_org_idx on pilots (organisation_id);
create index if not exists projects_org_idx on projects (organisation_id);
create index if not exists role_permissions_org_idx on role_permissions (organisation_id);
create index if not exists training_records_org_idx on training_records (organisation_id);
create index if not exists uav_inspection_plans_org_idx on uav_inspection_plans (organisation_id);
create index if not exists uavs_org_idx on uavs (organisation_id);
create index if not exists webhook_deliveries_org_idx on webhook_deliveries (organisation_id);
create index if not exists webhooks_org_idx on webhooks (organisation_id);

-- ---------------------------------------------------------------------------
-- Composite keys on the tables others point at
-- ---------------------------------------------------------------------------

create unique index if not exists audits_id_org_key on audits (id, organisation_id);
create unique index if not exists batteries_id_org_key on batteries (id, organisation_id);
create unique index if not exists checklist_completions_id_org_key on checklist_completions (id, organisation_id);
create unique index if not exists checklist_items_id_org_key on checklist_items (id, organisation_id);
create unique index if not exists checklist_templates_id_org_key on checklist_templates (id, organisation_id);
create unique index if not exists clients_id_org_key on clients (id, organisation_id);
create unique index if not exists components_id_org_key on components (id, organisation_id);
create unique index if not exists documents_id_org_key on documents (id, organisation_id);
create unique index if not exists flight_logs_id_org_key on flight_logs (id, organisation_id);
create unique index if not exists flight_requests_id_org_key on flight_requests (id, organisation_id);
create unique index if not exists hazards_id_org_key on hazards (id, organisation_id);
create unique index if not exists incidents_id_org_key on incidents (id, organisation_id);
create unique index if not exists inspection_plan_items_id_org_key on inspection_plan_items (id, organisation_id);
create unique index if not exists inspection_plans_id_org_key on inspection_plans (id, organisation_id);
create unique index if not exists manual_sections_id_org_key on manual_sections (id, organisation_id);
create unique index if not exists manuals_id_org_key on manuals (id, organisation_id);
create unique index if not exists notifications_id_org_key on notifications (id, organisation_id);
create unique index if not exists pilots_id_org_key on pilots (id, organisation_id);
create unique index if not exists projects_id_org_key on projects (id, organisation_id);
create unique index if not exists uavs_id_org_key on uavs (id, organisation_id);
create unique index if not exists webhooks_id_org_key on webhooks (id, organisation_id);

-- ---------------------------------------------------------------------------
-- Foreign keys, rebuilt as composite
-- ---------------------------------------------------------------------------

alter table api_keys drop constraint if exists api_keys_created_by_fkey;
alter table api_keys add constraint api_keys_created_by_fkey
  foreign key (created_by, organisation_id)
  references profiles (id, organisation_id) on delete set null (created_by);
alter table api_keys drop constraint if exists api_keys_revoked_by_fkey;
alter table api_keys add constraint api_keys_revoked_by_fkey
  foreign key (revoked_by, organisation_id)
  references profiles (id, organisation_id) on delete set null (revoked_by);
alter table audit_findings drop constraint if exists audit_findings_assigned_to_fkey;
alter table audit_findings add constraint audit_findings_assigned_to_fkey
  foreign key (assigned_to, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table audit_findings drop constraint if exists audit_findings_audit_id_fkey;
alter table audit_findings add constraint audit_findings_audit_id_fkey
  foreign key (audit_id, organisation_id)
  references audits (id, organisation_id) on delete cascade;
alter table audit_findings drop constraint if exists audit_findings_hazard_id_fkey;
alter table audit_findings add constraint audit_findings_hazard_id_fkey
  foreign key (hazard_id, organisation_id)
  references hazards (id, organisation_id) on delete set null (hazard_id);
alter table audit_findings drop constraint if exists audit_findings_incident_id_fkey;
alter table audit_findings add constraint audit_findings_incident_id_fkey
  foreign key (incident_id, organisation_id)
  references incidents (id, organisation_id) on delete set null (incident_id);
alter table audit_findings drop constraint if exists audit_findings_resulting_document_id_fkey;
alter table audit_findings add constraint audit_findings_resulting_document_id_fkey
  foreign key (resulting_document_id, organisation_id)
  references documents (id, organisation_id) on delete set null (resulting_document_id);
alter table audits drop constraint if exists audits_auditor_id_fkey;
alter table audits add constraint audits_auditor_id_fkey
  foreign key (auditor_id, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table checklist_completions drop constraint if exists checklist_completions_completed_by_fkey;
alter table checklist_completions add constraint checklist_completions_completed_by_fkey
  foreign key (completed_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table checklist_completions drop constraint if exists checklist_completions_flight_log_id_fkey;
alter table checklist_completions add constraint checklist_completions_flight_log_id_fkey
  foreign key (flight_log_id, organisation_id)
  references flight_logs (id, organisation_id) on delete set null (flight_log_id);
alter table checklist_completions drop constraint if exists checklist_completions_flight_request_id_fkey;
alter table checklist_completions add constraint checklist_completions_flight_request_id_fkey
  foreign key (flight_request_id, organisation_id)
  references flight_requests (id, organisation_id) on delete set null (flight_request_id);
alter table checklist_completions drop constraint if exists checklist_completions_template_id_fkey;
alter table checklist_completions add constraint checklist_completions_template_id_fkey
  foreign key (template_id, organisation_id)
  references checklist_templates (id, organisation_id) on delete restrict;
alter table checklist_completions drop constraint if exists checklist_completions_uav_id_fkey;
alter table checklist_completions add constraint checklist_completions_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete set null (uav_id);
alter table checklist_items drop constraint if exists checklist_items_template_id_fkey;
alter table checklist_items add constraint checklist_items_template_id_fkey
  foreign key (template_id, organisation_id)
  references checklist_templates (id, organisation_id) on delete cascade;
alter table checklist_responses drop constraint if exists checklist_responses_completion_id_fkey;
alter table checklist_responses add constraint checklist_responses_completion_id_fkey
  foreign key (completion_id, organisation_id)
  references checklist_completions (id, organisation_id) on delete cascade;
alter table checklist_responses drop constraint if exists checklist_responses_item_id_fkey;
alter table checklist_responses add constraint checklist_responses_item_id_fkey
  foreign key (item_id, organisation_id)
  references checklist_items (id, organisation_id) on delete restrict;
alter table component_installations drop constraint if exists component_installations_component_id_fkey;
alter table component_installations add constraint component_installations_component_id_fkey
  foreign key (component_id, organisation_id)
  references components (id, organisation_id) on delete cascade;
alter table component_installations drop constraint if exists component_installations_installed_by_fkey;
alter table component_installations add constraint component_installations_installed_by_fkey
  foreign key (installed_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table component_installations drop constraint if exists component_installations_uav_id_fkey;
alter table component_installations add constraint component_installations_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete restrict;
alter table documents drop constraint if exists documents_last_reviewed_by_fkey;
alter table documents add constraint documents_last_reviewed_by_fkey
  foreign key (last_reviewed_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table documents drop constraint if exists documents_pilot_id_fkey;
alter table documents add constraint documents_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete cascade;
alter table documents drop constraint if exists documents_uploaded_by_fkey;
alter table documents add constraint documents_uploaded_by_fkey
  foreign key (uploaded_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table flight_battery_usage drop constraint if exists flight_battery_usage_battery_id_fkey;
alter table flight_battery_usage add constraint flight_battery_usage_battery_id_fkey
  foreign key (battery_id, organisation_id)
  references batteries (id, organisation_id) on delete restrict;
alter table flight_battery_usage drop constraint if exists flight_battery_usage_flight_log_id_fkey;
alter table flight_battery_usage add constraint flight_battery_usage_flight_log_id_fkey
  foreign key (flight_log_id, organisation_id)
  references flight_logs (id, organisation_id) on delete cascade;
alter table flight_crew drop constraint if exists flight_crew_flight_log_id_fkey;
alter table flight_crew add constraint flight_crew_flight_log_id_fkey
  foreign key (flight_log_id, organisation_id)
  references flight_logs (id, organisation_id) on delete cascade;
alter table flight_crew drop constraint if exists flight_crew_pilot_id_fkey;
alter table flight_crew add constraint flight_crew_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete restrict;
alter table flight_logs drop constraint if exists flight_logs_acknowledged_by_fkey;
alter table flight_logs add constraint flight_logs_acknowledged_by_fkey
  foreign key (acknowledged_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table flight_logs drop constraint if exists flight_logs_flight_request_id_fkey;
alter table flight_logs add constraint flight_logs_flight_request_id_fkey
  foreign key (flight_request_id, organisation_id)
  references flight_requests (id, organisation_id) on delete no action;
alter table flight_logs drop constraint if exists flight_logs_pilot_id_fkey;
alter table flight_logs add constraint flight_logs_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete no action;
alter table flight_logs drop constraint if exists flight_logs_project_id_fkey;
alter table flight_logs add constraint flight_logs_project_id_fkey
  foreign key (project_id, organisation_id)
  references projects (id, organisation_id) on delete set null (project_id);
alter table flight_logs drop constraint if exists flight_logs_uav_id_fkey;
alter table flight_logs add constraint flight_logs_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete no action;
alter table flight_requests drop constraint if exists flight_requests_approved_by_fkey;
alter table flight_requests add constraint flight_requests_approved_by_fkey
  foreign key (approved_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table flight_requests drop constraint if exists flight_requests_pilot_id_fkey;
alter table flight_requests add constraint flight_requests_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete no action;
alter table flight_requests drop constraint if exists flight_requests_project_id_fkey;
alter table flight_requests add constraint flight_requests_project_id_fkey
  foreign key (project_id, organisation_id)
  references projects (id, organisation_id) on delete set null (project_id);
alter table flight_requests drop constraint if exists flight_requests_uav_id_fkey;
alter table flight_requests add constraint flight_requests_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete no action;
alter table hazard_incidents drop constraint if exists hazard_incidents_hazard_id_fkey;
alter table hazard_incidents add constraint hazard_incidents_hazard_id_fkey
  foreign key (hazard_id, organisation_id)
  references hazards (id, organisation_id) on delete cascade;
alter table hazard_incidents drop constraint if exists hazard_incidents_incident_id_fkey;
alter table hazard_incidents add constraint hazard_incidents_incident_id_fkey
  foreign key (incident_id, organisation_id)
  references incidents (id, organisation_id) on delete cascade;
alter table hazards drop constraint if exists hazards_owner_id_fkey;
alter table hazards add constraint hazards_owner_id_fkey
  foreign key (owner_id, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table incidents drop constraint if exists incidents_pilot_id_fkey;
alter table incidents add constraint incidents_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete no action;
alter table incidents drop constraint if exists incidents_reported_by_fkey;
alter table incidents add constraint incidents_reported_by_fkey
  foreign key (reported_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table incidents drop constraint if exists incidents_uav_id_fkey;
alter table incidents add constraint incidents_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete no action;
alter table inspection_plan_items drop constraint if exists inspection_plan_items_plan_id_fkey;
alter table inspection_plan_items add constraint inspection_plan_items_plan_id_fkey
  foreign key (plan_id, organisation_id)
  references inspection_plans (id, organisation_id) on delete cascade;
alter table inspection_plans drop constraint if exists inspection_plans_created_by_fkey;
alter table inspection_plans add constraint inspection_plans_created_by_fkey
  foreign key (created_by, organisation_id)
  references profiles (id, organisation_id) on delete set null (created_by);
alter table maintenance_records drop constraint if exists maintenance_records_plan_item_id_fkey;
alter table maintenance_records add constraint maintenance_records_plan_item_id_fkey
  foreign key (plan_item_id, organisation_id)
  references inspection_plan_items (id, organisation_id) on delete set null (plan_item_id);
alter table maintenance_records drop constraint if exists maintenance_records_technician_id_fkey;
alter table maintenance_records add constraint maintenance_records_technician_id_fkey
  foreign key (technician_id, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table maintenance_records drop constraint if exists maintenance_records_uav_id_fkey;
alter table maintenance_records add constraint maintenance_records_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete no action;
alter table manual_sections drop constraint if exists manual_sections_document_id_fkey;
alter table manual_sections add constraint manual_sections_document_id_fkey
  foreign key (document_id, organisation_id)
  references documents (id, organisation_id) on delete set null (document_id);
alter table manual_sections drop constraint if exists manual_sections_manual_id_fkey;
alter table manual_sections add constraint manual_sections_manual_id_fkey
  foreign key (manual_id, organisation_id)
  references manuals (id, organisation_id) on delete cascade;
alter table manual_sections drop constraint if exists manual_sections_parent_id_fkey;
alter table manual_sections add constraint manual_sections_parent_id_fkey
  foreign key (parent_id, organisation_id)
  references manual_sections (id, organisation_id) on delete cascade;
alter table manuals drop constraint if exists manuals_created_by_fkey;
alter table manuals add constraint manuals_created_by_fkey
  foreign key (created_by, organisation_id)
  references profiles (id, organisation_id) on delete set null (created_by);
alter table notification_reads drop constraint if exists notification_reads_notification_id_fkey;
alter table notification_reads add constraint notification_reads_notification_id_fkey
  foreign key (notification_id, organisation_id)
  references notifications (id, organisation_id) on delete cascade;
alter table notification_reads drop constraint if exists notification_reads_profile_id_fkey;
alter table notification_reads add constraint notification_reads_profile_id_fkey
  foreign key (profile_id, organisation_id)
  references profiles (id, organisation_id) on delete cascade;
alter table notifications drop constraint if exists notifications_target_profile_id_fkey;
alter table notifications add constraint notifications_target_profile_id_fkey
  foreign key (target_profile_id, organisation_id)
  references profiles (id, organisation_id) on delete set null (target_profile_id);
alter table pilot_authorisations drop constraint if exists pilot_authorisations_authorised_by_fkey;
alter table pilot_authorisations add constraint pilot_authorisations_authorised_by_fkey
  foreign key (authorised_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table pilot_authorisations drop constraint if exists pilot_authorisations_pilot_id_fkey;
alter table pilot_authorisations add constraint pilot_authorisations_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete cascade;
alter table pilots drop constraint if exists pilots_profile_id_fkey;
alter table pilots add constraint pilots_profile_id_fkey
  foreign key (profile_id, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table projects drop constraint if exists projects_client_id_fkey;
alter table projects add constraint projects_client_id_fkey
  foreign key (client_id, organisation_id)
  references clients (id, organisation_id) on delete restrict;
alter table role_permissions drop constraint if exists role_permissions_updated_by_fkey;
alter table role_permissions add constraint role_permissions_updated_by_fkey
  foreign key (updated_by, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table training_records drop constraint if exists training_records_pilot_id_fkey;
alter table training_records add constraint training_records_pilot_id_fkey
  foreign key (pilot_id, organisation_id)
  references pilots (id, organisation_id) on delete no action;
alter table uav_inspection_plans drop constraint if exists uav_inspection_plans_plan_id_fkey;
alter table uav_inspection_plans add constraint uav_inspection_plans_plan_id_fkey
  foreign key (plan_id, organisation_id)
  references inspection_plans (id, organisation_id) on delete cascade;
alter table uav_inspection_plans drop constraint if exists uav_inspection_plans_uav_id_fkey;
alter table uav_inspection_plans add constraint uav_inspection_plans_uav_id_fkey
  foreign key (uav_id, organisation_id)
  references uavs (id, organisation_id) on delete cascade;
alter table uavs drop constraint if exists uavs_assigned_pilot_id_fkey;
alter table uavs add constraint uavs_assigned_pilot_id_fkey
  foreign key (assigned_pilot_id, organisation_id)
  references profiles (id, organisation_id) on delete no action;
alter table webhook_deliveries drop constraint if exists webhook_deliveries_webhook_id_fkey;
alter table webhook_deliveries add constraint webhook_deliveries_webhook_id_fkey
  foreign key (webhook_id, organisation_id)
  references webhooks (id, organisation_id) on delete cascade;
alter table webhooks drop constraint if exists webhooks_created_by_fkey;
alter table webhooks add constraint webhooks_created_by_fkey
  foreign key (created_by, organisation_id)
  references profiles (id, organisation_id) on delete set null (created_by);

-- ---------------------------------------------------------------------------
-- Primary keys that were only ever unique within one operator
-- ---------------------------------------------------------------------------

-- Each operator configures their own matrix, so (role, area) is no longer
-- unique across the table — two operators both have a pilot row for fleet.
alter table role_permissions drop constraint if exists role_permissions_pkey;
alter table role_permissions add primary key (organisation_id, role, area);

-- Likewise the review policy: one operator reviews SOPs yearly, another every
-- two years, and both are right for them.
alter table document_review_policy drop constraint if exists document_review_policy_pkey;
alter table document_review_policy add primary key (organisation_id, category);
