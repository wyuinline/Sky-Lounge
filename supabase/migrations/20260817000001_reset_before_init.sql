-- One-time cleanup: removes both the partially-applied init_schema tables
-- and the extra tables Supabase's "Debug with Assistant" generated when it
-- tried to auto-fix the original migration error. Run this once, then
-- re-run 20260817000000_init_schema.sql fresh.

drop table if exists
  audit_findings, audits, competency_matrix, document_links, flight_logs,
  flight_request_crew, flight_request_hazards, flight_requests,
  incident_attachments, incident_corrective_actions, incident_root_causes,
  incidents, maintenance_records, notification_log, pilot_certifications,
  pilot_profiles, profiles, roles, training_attendance, training_courses,
  training_sessions, uav_fleet, user_roles, uavs, pilots, training_records, documents
cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.sync_uav_after_maintenance() cascade;
drop function if exists public.is_restricted_document_category(text) cascade;

drop type if exists user_role cascade;
drop type if exists uav_status cascade;
drop type if exists risk_level cascade;
drop type if exists approval_status cascade;
drop type if exists mission_outcome cascade;
drop type if exists maintenance_type cascade;
drop type if exists maintenance_status cascade;
drop type if exists incident_type cascade;
drop type if exists severity_level cascade;
drop type if exists incident_status cascade;
drop type if exists audit_type cascade;
drop type if exists audit_status cascade;
drop type if exists compliance_status cascade;
drop type if exists finding_status cascade;
drop type if exists currency_status cascade;
drop type if exists competency_level cascade;
drop type if exists document_category cascade;
drop type if exists document_workflow_status cascade;
