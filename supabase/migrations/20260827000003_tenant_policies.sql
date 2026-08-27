-- ============================================================================
-- Tenant policies.
--
-- Every policy in the schema, rewritten with one clause added: the row must
-- belong to the caller's organisation. Generated from the policies as they
-- actually stood in the database rather than from the migrations that created
-- them, so nothing that drifted along the way is missed.
--
-- The permission checks are untouched. What a UAV lead may do inside their own
-- operation is exactly what it was; what changes is that "inside their own
-- operation" is now enforced rather than assumed.
--
-- Note what is NOT here: no platform-administrator bypass. Someone who runs the
-- platform can create an organisation and invite its first administrator, and
-- that is the whole of it — they cannot read an operator's incident reports by
-- flipping a boolean. Cross-organisation work happens through the service role
-- on dedicated screens, deliberately and visibly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The permission matrix is now per organisation
-- ---------------------------------------------------------------------------

/*
 * Each operator configures their own roles, so the lookup is scoped to the
 * caller's organisation. Without this clause an operator who removed a
 * permission would still be granted it by another operator's row.
 */
create or replace function public.access_level_for(p_area access_area)
returns access_level language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select rp.level
       from role_permissions rp
      where rp.role = public.current_user_role()
        and rp.area = p_area
        and rp.organisation_id = public.current_org_id()),
    'none'::access_level
  );
$fn$;


-- api_keys
drop policy if exists "api keys readable by user managers" on api_keys;
create policy "api keys readable by user managers" on api_keys
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_manage('users'::access_area)));
drop policy if exists "api keys writable by user managers" on api_keys;
create policy "api keys writable by user managers" on api_keys
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('users'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('users'::access_area)));

-- audit_findings
drop policy if exists "audit_findings_manage" on audit_findings;
create policy "audit_findings_manage" on audit_findings
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('audits'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('audits'::access_area)));
drop policy if exists "audit_findings_select" on audit_findings;
create policy "audit_findings_select" on audit_findings
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('audits'::access_area)));

-- audits
drop policy if exists "audits_manage" on audits;
create policy "audits_manage" on audits
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('audits'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('audits'::access_area)));
drop policy if exists "audits_select" on audits;
create policy "audits_select" on audits
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('audits'::access_area)));

-- batteries
drop policy if exists "batteries_manage" on batteries;
create policy "batteries_manage" on batteries
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)));
drop policy if exists "batteries_select" on batteries;
create policy "batteries_select" on batteries
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('fleet'::access_area)));

-- checklist_completions
drop policy if exists "checklist_completions_select" on checklist_completions;
create policy "checklist_completions_select" on checklist_completions
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('requests'::access_area) OR (completed_by = auth.uid()))));
drop policy if exists "checklist_completions_write" on checklist_completions;
create policy "checklist_completions_write" on checklist_completions
  for all to authenticated
  using (public.owns_row(organisation_id) and ((can_create('requests'::access_area) OR can_manage('requests'::access_area))))
  with check (public.owns_row(organisation_id) and ((can_create('requests'::access_area) OR can_manage('requests'::access_area))));

-- checklist_items
drop policy if exists "checklist_items_manage" on checklist_items;
create policy "checklist_items_manage" on checklist_items
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)));
drop policy if exists "checklist_items_select" on checklist_items;
create policy "checklist_items_select" on checklist_items
  for select to authenticated
  using (public.owns_row(organisation_id) and (true));

-- checklist_responses
drop policy if exists "checklist_responses_select" on checklist_responses;
create policy "checklist_responses_select" on checklist_responses
  for select to authenticated
  using (public.owns_row(organisation_id) and ((EXISTS ( SELECT 1
   FROM checklist_completions c
  WHERE ((c.id = checklist_responses.completion_id) AND (can_read_all('requests'::access_area) OR (c.completed_by = auth.uid())))))));
drop policy if exists "checklist_responses_write" on checklist_responses;
create policy "checklist_responses_write" on checklist_responses
  for all to authenticated
  using (public.owns_row(organisation_id) and ((can_create('requests'::access_area) OR can_manage('requests'::access_area))))
  with check (public.owns_row(organisation_id) and ((can_create('requests'::access_area) OR can_manage('requests'::access_area))));

-- checklist_templates
drop policy if exists "checklist_templates_manage" on checklist_templates;
create policy "checklist_templates_manage" on checklist_templates
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)));
drop policy if exists "checklist_templates_select" on checklist_templates;
create policy "checklist_templates_select" on checklist_templates
  for select to authenticated
  using (public.owns_row(organisation_id) and (true));

-- clients
drop policy if exists "clients_manage" on clients;
create policy "clients_manage" on clients
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('requests'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('requests'::access_area)));
drop policy if exists "clients_select" on clients;
create policy "clients_select" on clients
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('requests'::access_area) OR can_read_own('requests'::access_area))));

-- component_installations
drop policy if exists "component_installations_manage" on component_installations;
create policy "component_installations_manage" on component_installations
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)));
drop policy if exists "component_installations_select" on component_installations;
create policy "component_installations_select" on component_installations
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('fleet'::access_area)));

-- components
drop policy if exists "components_manage" on components;
create policy "components_manage" on components
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)));
drop policy if exists "components_select" on components;
create policy "components_select" on components
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('fleet'::access_area)));

-- document_review_policy
drop policy if exists "document_review_policy_select" on document_review_policy;
create policy "document_review_policy_select" on document_review_policy
  for select to authenticated
  using (public.owns_row(organisation_id) and (true));
drop policy if exists "document_review_policy_write" on document_review_policy;
create policy "document_review_policy_write" on document_review_policy
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('docs_general'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('docs_general'::access_area)));

-- documents
drop policy if exists "documents_manage" on documents;
create policy "documents_manage" on documents
  for all to authenticated
  using (public.owns_row(organisation_id) and (CASE
    WHEN (category = 'roc_a'::document_category) THEN can_manage('roc_a'::access_area)
    WHEN is_restricted_document_category(category) THEN can_manage('docs_restricted'::access_area)
    ELSE can_manage('docs_general'::access_area)
END))
  with check (public.owns_row(organisation_id) and (CASE
    WHEN (category = 'roc_a'::document_category) THEN can_manage('roc_a'::access_area)
    WHEN is_restricted_document_category(category) THEN can_manage('docs_restricted'::access_area)
    ELSE can_manage('docs_general'::access_area)
END));
drop policy if exists "documents_select" on documents;
create policy "documents_select" on documents
  for select to authenticated
  using (public.owns_row(organisation_id) and (CASE
    WHEN (category = 'roc_a'::document_category) THEN (can_read_all('roc_a'::access_area) OR (can_read_own('roc_a'::access_area) AND (pilot_id IN ( SELECT pilots.id
       FROM pilots
      WHERE (pilots.profile_id = auth.uid())))))
    WHEN is_restricted_document_category(category) THEN can_read_all('docs_restricted'::access_area)
    ELSE can_read_all('docs_general'::access_area)
END));

-- flight_battery_usage
drop policy if exists "flight_battery_usage_select" on flight_battery_usage;
create policy "flight_battery_usage_select" on flight_battery_usage
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('logs'::access_area) OR can_read_own('logs'::access_area))));
drop policy if exists "flight_battery_usage_write" on flight_battery_usage;
create policy "flight_battery_usage_write" on flight_battery_usage
  for all to authenticated
  using (public.owns_row(organisation_id) and ((can_create('logs'::access_area) OR can_manage('logs'::access_area))))
  with check (public.owns_row(organisation_id) and ((can_create('logs'::access_area) OR can_manage('logs'::access_area))));

-- flight_crew
drop policy if exists "flight_crew_select" on flight_crew;
create policy "flight_crew_select" on flight_crew
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('logs'::access_area) OR (can_read_own('logs'::access_area) AND (EXISTS ( SELECT 1
   FROM pilots p
  WHERE ((p.id = flight_crew.pilot_id) AND (p.profile_id = auth.uid()))))))));
drop policy if exists "flight_crew_write" on flight_crew;
create policy "flight_crew_write" on flight_crew
  for all to authenticated
  using (public.owns_row(organisation_id) and ((can_create('logs'::access_area) OR can_manage('logs'::access_area))))
  with check (public.owns_row(organisation_id) and ((can_create('logs'::access_area) OR can_manage('logs'::access_area))));

-- flight_logs
drop policy if exists "flight_logs_insert" on flight_logs;
create policy "flight_logs_insert" on flight_logs
  for insert to authenticated
  with check (public.owns_row(organisation_id) and ((can_manage('logs'::access_area) OR (can_create('logs'::access_area) AND (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid())))))));
drop policy if exists "flight_logs_select" on flight_logs;
create policy "flight_logs_select" on flight_logs
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('logs'::access_area) OR (can_read_own('logs'::access_area) AND (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid())))))));

-- flight_requests
drop policy if exists "flight_requests_insert" on flight_requests;
create policy "flight_requests_insert" on flight_requests
  for insert to authenticated
  with check (public.owns_row(organisation_id) and ((can_manage('requests'::access_area) OR (can_create('requests'::access_area) AND (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid())))))));
drop policy if exists "flight_requests_select" on flight_requests;
create policy "flight_requests_select" on flight_requests
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('requests'::access_area) OR (can_read_own('requests'::access_area) AND (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid())))))));
drop policy if exists "flight_requests_update" on flight_requests;
create policy "flight_requests_update" on flight_requests
  for update to authenticated
  using (public.owns_row(organisation_id) and (can_manage('requests'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('requests'::access_area)));

-- hazard_incidents
drop policy if exists "hazard_incidents_manage" on hazard_incidents;
create policy "hazard_incidents_manage" on hazard_incidents
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('incidents'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('incidents'::access_area)));
drop policy if exists "hazard_incidents_select" on hazard_incidents;
create policy "hazard_incidents_select" on hazard_incidents
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('incidents'::access_area)));

-- hazards
drop policy if exists "hazards_manage" on hazards;
create policy "hazards_manage" on hazards
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('incidents'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('incidents'::access_area)));
drop policy if exists "hazards_select" on hazards;
create policy "hazards_select" on hazards
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('incidents'::access_area)));

-- incidents
drop policy if exists "incidents_insert" on incidents;
create policy "incidents_insert" on incidents
  for insert to authenticated
  with check (public.owns_row(organisation_id) and ((can_create('incidents'::access_area) AND ((pilot_id IS NULL) OR can_manage('incidents'::access_area) OR (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid())))))));
drop policy if exists "incidents_select" on incidents;
create policy "incidents_select" on incidents
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('incidents'::access_area) OR (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid()))) OR (reported_by = auth.uid()))));
drop policy if exists "incidents_update" on incidents;
create policy "incidents_update" on incidents
  for update to authenticated
  using (public.owns_row(organisation_id) and (can_manage('incidents'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('incidents'::access_area)));

-- inspection_plan_items
drop policy if exists "plan items readable" on inspection_plan_items;
create policy "plan items readable" on inspection_plan_items
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('maintenance'::access_area)));
drop policy if exists "plan items writable by maintenance managers" on inspection_plan_items;
create policy "plan items writable by maintenance managers" on inspection_plan_items
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)));

-- inspection_plans
drop policy if exists "inspection plans readable" on inspection_plans;
create policy "inspection plans readable" on inspection_plans
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('maintenance'::access_area)));
drop policy if exists "inspection plans writable by maintenance managers" on inspection_plans;
create policy "inspection plans writable by maintenance managers" on inspection_plans
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)));

-- maintenance_records
drop policy if exists "maintenance_manage" on maintenance_records;
create policy "maintenance_manage" on maintenance_records
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)));
drop policy if exists "maintenance_select" on maintenance_records;
create policy "maintenance_select" on maintenance_records
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('maintenance'::access_area)));

-- manual_sections
drop policy if exists "manual sections readable" on manual_sections;
create policy "manual sections readable" on manual_sections
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('docs_general'::access_area)));
drop policy if exists "manual sections writable by document managers" on manual_sections;
create policy "manual sections writable by document managers" on manual_sections
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('docs_general'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('docs_general'::access_area)));

-- manuals
drop policy if exists "manuals readable" on manuals;
create policy "manuals readable" on manuals
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('docs_general'::access_area)));
drop policy if exists "manuals writable by document managers" on manuals;
create policy "manuals writable by document managers" on manuals
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('docs_general'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('docs_general'::access_area)));

-- notification_reads
drop policy if exists "notification_reads_own" on notification_reads;
create policy "notification_reads_own" on notification_reads
  for all to authenticated
  using (public.owns_row(organisation_id) and ((profile_id = auth.uid())))
  with check (public.owns_row(organisation_id) and ((profile_id = auth.uid())));

-- notifications
drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications
  for select to authenticated
  using (public.owns_row(organisation_id) and ((((access_level_for('notifications'::access_area) <> 'none'::access_level) AND (current_user_role() = ANY (target_roles))) OR (target_profile_id = auth.uid()))));

-- pilot_authorisations
drop policy if exists "pilot_authorisations_manage" on pilot_authorisations;
create policy "pilot_authorisations_manage" on pilot_authorisations
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('pilots'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('pilots'::access_area)));
drop policy if exists "pilot_authorisations_select" on pilot_authorisations;
create policy "pilot_authorisations_select" on pilot_authorisations
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('pilots'::access_area) OR (can_read_own('pilots'::access_area) AND (EXISTS ( SELECT 1
   FROM pilots p
  WHERE ((p.id = pilot_authorisations.pilot_id) AND (p.profile_id = auth.uid()))))))));

-- pilots
drop policy if exists "pilots_manage" on pilots;
create policy "pilots_manage" on pilots
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('pilots'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('pilots'::access_area)));
drop policy if exists "pilots_select" on pilots;
create policy "pilots_select" on pilots
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('pilots'::access_area) OR (can_read_own('pilots'::access_area) AND (profile_id = auth.uid())))));

-- profiles
drop policy if exists "profiles_manage" on profiles;
create policy "profiles_manage" on profiles
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('users'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('users'::access_area)));
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles
  for select to authenticated
  using (public.owns_row(organisation_id) and (true));
drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles
  for update to authenticated
  using (public.owns_row(organisation_id) and ((id = auth.uid())))
  with check (public.owns_row(organisation_id) and ((id = auth.uid())));

-- projects
drop policy if exists "projects_manage" on projects;
create policy "projects_manage" on projects
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('requests'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('requests'::access_area)));
drop policy if exists "projects_select" on projects;
create policy "projects_select" on projects
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('requests'::access_area) OR can_read_own('requests'::access_area))));

-- role_permissions
drop policy if exists "role_permissions_select" on role_permissions;
create policy "role_permissions_select" on role_permissions
  for select to authenticated
  using (public.owns_row(organisation_id) and (true));
drop policy if exists "role_permissions_write" on role_permissions;
create policy "role_permissions_write" on role_permissions
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('permissions'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('permissions'::access_area)));

-- training_records
drop policy if exists "training_manage" on training_records;
create policy "training_manage" on training_records
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('training'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('training'::access_area)));
drop policy if exists "training_select" on training_records;
create policy "training_select" on training_records
  for select to authenticated
  using (public.owns_row(organisation_id) and ((can_read_all('training'::access_area) OR (can_read_own('training'::access_area) AND (pilot_id IN ( SELECT pilots.id
   FROM pilots
  WHERE (pilots.profile_id = auth.uid())))))));

-- uav_inspection_plans
drop policy if exists "plan assignments readable" on uav_inspection_plans;
create policy "plan assignments readable" on uav_inspection_plans
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('maintenance'::access_area)));
drop policy if exists "plan assignments writable by maintenance managers" on uav_inspection_plans;
create policy "plan assignments writable by maintenance managers" on uav_inspection_plans
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('maintenance'::access_area)));

-- uavs
drop policy if exists "uavs_manage" on uavs;
create policy "uavs_manage" on uavs
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('fleet'::access_area)));
drop policy if exists "uavs_select" on uavs;
create policy "uavs_select" on uavs
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_read_all('fleet'::access_area)));

-- webhook_deliveries
drop policy if exists "webhook deliveries readable by user managers" on webhook_deliveries;
create policy "webhook deliveries readable by user managers" on webhook_deliveries
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_manage('users'::access_area)));

-- webhooks
drop policy if exists "webhooks readable by user managers" on webhooks;
create policy "webhooks readable by user managers" on webhooks
  for select to authenticated
  using (public.owns_row(organisation_id) and (can_manage('users'::access_area)));
drop policy if exists "webhooks writable by user managers" on webhooks;
create policy "webhooks writable by user managers" on webhooks
  for all to authenticated
  using (public.owns_row(organisation_id) and (can_manage('users'::access_area)))
  with check (public.owns_row(organisation_id) and (can_manage('users'::access_area)));
