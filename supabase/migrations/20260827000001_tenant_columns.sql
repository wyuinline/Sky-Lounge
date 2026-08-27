-- ============================================================================
-- Tenant columns.
--
-- Generated, because doing this by hand across thirty-six tables and sixty-five
-- foreign keys is how one gets missed — and the one that gets missed is the one
-- that leaks.
--
-- This file only adds the column and fills it. The constraints that depend on
-- it are the next migration: Postgres refuses to take a not-null on a column in
-- the same transaction as the update that filled it, because the update's
-- trigger events are still pending.
-- ============================================================================

alter table api_keys add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table audit_findings add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table audits add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table batteries add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table checklist_completions add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table checklist_items add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table checklist_responses add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table checklist_templates add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table clients add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table component_installations add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table components add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table document_review_policy add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table documents add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table flight_battery_usage add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table flight_crew add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table flight_logs add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table flight_requests add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table hazard_incidents add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table hazards add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table incidents add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table inspection_plan_items add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table inspection_plans add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table maintenance_records add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table manual_sections add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table manuals add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table notification_reads add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table notifications add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table pilot_authorisations add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table pilots add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table projects add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table role_permissions add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table training_records add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table uav_inspection_plans add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table uavs add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table webhook_deliveries add column if not exists organisation_id uuid references organisations(id) on delete restrict;
alter table webhooks add column if not exists organisation_id uuid references organisations(id) on delete restrict;

-- Everything that predates organisations belongs to the first tenant.
do $$
declare
  first_org uuid;
begin
  select id into first_org from organisations where slug = 'inline-group';
  update api_keys set organisation_id = first_org where organisation_id is null;
  update audit_findings set organisation_id = first_org where organisation_id is null;
  update audits set organisation_id = first_org where organisation_id is null;
  update batteries set organisation_id = first_org where organisation_id is null;
  update checklist_completions set organisation_id = first_org where organisation_id is null;
  update checklist_items set organisation_id = first_org where organisation_id is null;
  update checklist_responses set organisation_id = first_org where organisation_id is null;
  update checklist_templates set organisation_id = first_org where organisation_id is null;
  update clients set organisation_id = first_org where organisation_id is null;
  update component_installations set organisation_id = first_org where organisation_id is null;
  update components set organisation_id = first_org where organisation_id is null;
  update document_review_policy set organisation_id = first_org where organisation_id is null;
  update documents set organisation_id = first_org where organisation_id is null;
  update flight_battery_usage set organisation_id = first_org where organisation_id is null;
  update flight_crew set organisation_id = first_org where organisation_id is null;
  update flight_logs set organisation_id = first_org where organisation_id is null;
  update flight_requests set organisation_id = first_org where organisation_id is null;
  update hazard_incidents set organisation_id = first_org where organisation_id is null;
  update hazards set organisation_id = first_org where organisation_id is null;
  update incidents set organisation_id = first_org where organisation_id is null;
  update inspection_plan_items set organisation_id = first_org where organisation_id is null;
  update inspection_plans set organisation_id = first_org where organisation_id is null;
  update maintenance_records set organisation_id = first_org where organisation_id is null;
  update manual_sections set organisation_id = first_org where organisation_id is null;
  update manuals set organisation_id = first_org where organisation_id is null;
  update notification_reads set organisation_id = first_org where organisation_id is null;
  update notifications set organisation_id = first_org where organisation_id is null;
  update pilot_authorisations set organisation_id = first_org where organisation_id is null;
  update pilots set organisation_id = first_org where organisation_id is null;
  update projects set organisation_id = first_org where organisation_id is null;
  update role_permissions set organisation_id = first_org where organisation_id is null;
  update training_records set organisation_id = first_org where organisation_id is null;
  update uav_inspection_plans set organisation_id = first_org where organisation_id is null;
  update uavs set organisation_id = first_org where organisation_id is null;
  update webhook_deliveries set organisation_id = first_org where organisation_id is null;
  update webhooks set organisation_id = first_org where organisation_id is null;
end $$;
