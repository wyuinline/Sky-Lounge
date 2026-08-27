-- ============================================================================
-- organisation_id on every view.
--
-- The views are security_invoker, so for anyone signed in RLS on the base
-- tables already scopes them. But two callers run on the service role, where
-- there is no RLS to do it: the read API and the weekly reminders job. Both
-- filter on organisation_id, and a filter on a column that does not exist is
-- not a filter at all.
--
-- Each view is wrapped rather than rewritten. Wrapping cannot change or reorder
-- an existing column — which is what create-or-replace requires and, more to
-- the point, what every page reading these views requires. The join is to a
-- primary key and left, so it can only add a column, never drop a row.
-- ============================================================================

create or replace view battery_cell_health
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT b.id AS battery_id,
      b.battery_id AS battery_tag,
      b.status,
      count(f.id) FILTER (WHERE f.max_cell_spread IS NOT NULL) AS flights_with_cell_data,
      max(f.max_cell_spread) AS worst_spread,
      min(f.min_cell_voltage) AS lowest_cell,
      max(f.flight_date) FILTER (WHERE f.max_cell_spread IS NOT NULL) AS last_cell_reading,
      ( SELECT f2.max_cell_spread
             FROM flight_battery_usage u2
               JOIN flight_logs f2 ON f2.id = u2.flight_log_id
            WHERE u2.battery_id = b.id AND f2.max_cell_spread IS NOT NULL
            ORDER BY f2.flight_date DESC
           LIMIT 1) AS latest_spread
     FROM batteries b
       LEFT JOIN flight_battery_usage u ON u.battery_id = b.id
       LEFT JOIN flight_logs f ON f.id = u.flight_log_id
    GROUP BY b.id, b.battery_id, b.status
) v
left join batteries owner on owner.id = v.battery_id;

create or replace view battery_status_view
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  WITH logged AS (
           SELECT flight_battery_usage.battery_id,
              COALESCE(sum(flight_battery_usage.cycles), 0::bigint)::integer AS cycles
             FROM flight_battery_usage
            GROUP BY flight_battery_usage.battery_id
          ), last_flight AS (
           SELECT u.battery_id,
              max(f.flight_date) AS last_used
             FROM flight_battery_usage u
               JOIN flight_logs f ON f.id = u.flight_log_id
            GROUP BY u.battery_id
          )
   SELECT b.id,
      b.battery_id,
      b.model,
      b.manufacturer,
      b.serial_number,
      b.capacity_mah,
      b.cell_count,
      b.purchased_date,
      b.baseline_cycles,
      b.cycle_limit,
      b.status,
      b.location_site,
      b.notes,
      b.created_at,
      b.baseline_cycles + COALESCE(l.cycles, 0) AS total_cycles,
          CASE
              WHEN b.cycle_limit IS NULL THEN NULL::integer
              ELSE b.cycle_limit - (b.baseline_cycles + COALESCE(l.cycles, 0))
          END AS cycles_remaining,
      lf.last_used AS last_used_on,
          CASE
              WHEN b.purchased_date IS NULL THEN NULL::integer
              ELSE (EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, b.purchased_date::timestamp with time zone)) * 12::numeric + EXTRACT(month FROM age(CURRENT_DATE::timestamp with time zone, b.purchased_date::timestamp with time zone)))::integer
          END AS age_months
     FROM batteries b
       LEFT JOIN logged l ON l.battery_id = b.id
       LEFT JOIN last_flight lf ON lf.battery_id = b.id
) v
left join batteries owner on owner.id = v.id;

create or replace view checklist_completion_summary
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT c.id,
      c.template_id,
      t.name AS template_name,
      c.uav_id,
      u.drone_id,
      c.flight_request_id,
      c.flight_log_id,
      c.completed_by,
      p.full_name AS completed_by_name,
      c.completed_at,
      c.all_critical_passed,
      c.notes,
      count(r.id) AS item_count,
      count(r.id) FILTER (WHERE r.checked) AS checked_count
     FROM checklist_completions c
       JOIN checklist_templates t ON t.id = c.template_id
       LEFT JOIN uavs u ON u.id = c.uav_id
       LEFT JOIN profiles p ON p.id = c.completed_by
       LEFT JOIN checklist_responses r ON r.completion_id = c.id
    GROUP BY c.id, t.name, u.drone_id, p.full_name
) v
left join checklist_completions owner on owner.id = v.id;

create or replace view component_status_view
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  WITH installed_hours AS (
           SELECT i.component_id,
              COALESCE(sum(f.effective_duration_minutes), 0::bigint)::numeric / 60.0 AS hours
             FROM component_installations i
               LEFT JOIN flight_logs f ON f.uav_id = i.uav_id AND f.flight_date >= i.installed_on AND (i.removed_on IS NULL OR f.flight_date <= i.removed_on)
            GROUP BY i.component_id
          ), current_fit AS (
           SELECT DISTINCT ON (i.component_id) i.component_id,
              i.uav_id,
              i.installed_on,
              u.drone_id
             FROM component_installations i
               JOIN uavs u ON u.id = i.uav_id
            WHERE i.removed_on IS NULL
            ORDER BY i.component_id, i.installed_on DESC
          )
   SELECT c.id,
      c.component_id,
      c.category,
      c.name,
      c.manufacturer,
      c.model,
      c.serial_number,
      c.purchased_date,
      c.baseline_hours,
      c.service_interval_hours,
      c.status,
      c.location_site,
      c.notes,
      c.created_at,
      c.baseline_hours + COALESCE(h.hours, 0::numeric) AS total_hours,
          CASE
              WHEN c.service_interval_hours IS NULL THEN NULL::numeric
              ELSE c.service_interval_hours::numeric - (c.baseline_hours + COALESCE(h.hours, 0::numeric))
          END AS hours_until_service,
      cf.uav_id AS fitted_to_uav_id,
      cf.drone_id AS fitted_to,
      cf.installed_on AS fitted_on
     FROM components c
       LEFT JOIN installed_hours h ON h.component_id = c.id
       LEFT JOIN current_fit cf ON cf.component_id = c.id
) v
left join components owner on owner.id = v.id;

create or replace view document_review_status
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT d.id,
      d.title,
      d.category,
      d.version,
      d.approval_status,
      d.storage_path,
      d.uav_model,
      d.department,
      d.pilot_id,
      d.uploaded_by,
      d.created_at,
      d.effective_date,
      d.last_reviewed_at,
      d.review_interval_months,
      d.expires_at,
          CASE
              WHEN d.review_interval_months IS NULL THEN NULL::date
              ELSE (COALESCE(d.last_reviewed_at, d.effective_date, d.created_at::date) + d.review_interval_months::double precision * '1 mon'::interval)::date
          END AS review_due,
      p.full_name AS pilot_name,
      p.profile_id AS pilot_profile_id,
      p.active AS pilot_active
     FROM documents d
       LEFT JOIN pilots p ON p.id = d.pilot_id
) v
left join documents owner on owner.id = v.id;

create or replace view hazard_register
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT h.id,
      h.hazard_code,
      h.title,
      h.description,
      h.category,
      h.initial_likelihood,
      h.initial_severity,
      h.mitigation,
      h.residual_likelihood,
      h.residual_severity,
      h.owner_id,
      p.full_name AS owner_name,
      h.status,
      h.identified_on,
      h.last_reviewed_at,
      h.review_interval_months,
      h.notes,
      h.created_at,
      likelihood_score(h.initial_likelihood) * severity_score(h.initial_severity) AS initial_score,
          CASE
              WHEN h.residual_likelihood IS NULL THEN NULL::integer
              ELSE likelihood_score(h.residual_likelihood) * severity_score(h.residual_severity)
          END AS residual_score,
      (COALESCE(h.last_reviewed_at, h.identified_on) + h.review_interval_months::double precision * '1 mon'::interval)::date AS review_due,
      ( SELECT count(*) AS count
             FROM hazard_incidents hi
            WHERE hi.hazard_id = h.id) AS incident_count,
      ( SELECT count(*) AS count
             FROM audit_findings f
            WHERE f.hazard_id = h.id AND f.status <> 'closed'::finding_status) AS open_finding_count
     FROM hazards h
       LEFT JOIN profiles p ON p.id = h.owner_id
) v
left join hazards owner on owner.id = v.id;

create or replace view inspection_plan_status
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  WITH airframe AS (
           SELECT f.uav_id,
              f.drone_id,
              f.model,
              f.status,
              f.flight_hours,
              COALESCE(c.cycles, 0::bigint) AS cycles,
              COALESCE(u.purchased_date, CURRENT_DATE) AS in_service_on,
              u.baseline_flight_hours
             FROM uav_fleet_status f
               JOIN uavs u ON u.id = f.uav_id
               LEFT JOIN ( SELECT flight_logs.uav_id,
                      count(*) AS cycles
                     FROM flight_logs
                    GROUP BY flight_logs.uav_id) c ON c.uav_id = f.uav_id
          ), applicable AS (
           SELECT DISTINCT a_1.uav_id,
              p_1.id AS plan_id
             FROM airframe a_1
               JOIN inspection_plans p_1 ON p_1.active
               LEFT JOIN uav_inspection_plans link ON link.uav_id = a_1.uav_id AND link.plan_id = p_1.id
            WHERE link.plan_id IS NOT NULL OR p_1.applies_to_model IS NOT NULL AND p_1.applies_to_model = a_1.model
          ), last_done AS (
           SELECT DISTINCT ON (m.uav_id, m.plan_item_id) m.uav_id,
              m.plan_item_id,
              m.completed_date,
              m.flight_hours_at_service,
              m.cycles_at_service
             FROM maintenance_records m
            WHERE m.status = 'completed'::maintenance_status AND m.plan_item_id IS NOT NULL
            ORDER BY m.uav_id, m.plan_item_id, m.completed_date DESC
          )
   SELECT a.uav_id,
      a.drone_id,
      a.model,
      p.id AS plan_id,
      p.name AS plan_name,
      i.id AS item_id,
      i.name AS item_name,
      i.description AS item_description,
      i.is_critical,
      i.sort_order,
      i.interval_hours,
      i.interval_cycles,
      i.interval_months,
      d.completed_date AS last_completed_on,
      d.flight_hours_at_service AS last_completed_at_hours,
      d.cycles_at_service AS last_completed_at_cycles,
      a.flight_hours AS current_hours,
      a.cycles AS current_cycles,
          CASE
              WHEN i.interval_hours IS NULL THEN NULL::numeric
              ELSE COALESCE(d.flight_hours_at_service, a.baseline_flight_hours) + i.interval_hours - a.flight_hours
          END AS hours_remaining,
          CASE
              WHEN i.interval_months IS NULL THEN NULL::integer
              ELSE (COALESCE(d.completed_date, a.in_service_on) + make_interval(months => i.interval_months))::date - CURRENT_DATE
          END AS days_remaining,
          CASE
              WHEN i.interval_months IS NULL THEN NULL::date
              ELSE (COALESCE(d.completed_date, a.in_service_on) + make_interval(months => i.interval_months))::date
          END AS due_date,
          CASE
              WHEN i.interval_cycles IS NULL THEN NULL::bigint
              ELSE COALESCE(d.cycles_at_service, 0) + i.interval_cycles - a.cycles
          END AS cycles_remaining,
      i.interval_hours IS NOT NULL AND (COALESCE(d.flight_hours_at_service, a.baseline_flight_hours) + i.interval_hours) <= a.flight_hours OR i.interval_months IS NOT NULL AND (COALESCE(d.completed_date, a.in_service_on) + make_interval(months => i.interval_months))::date <= CURRENT_DATE OR i.interval_cycles IS NOT NULL AND (COALESCE(d.cycles_at_service, 0) + i.interval_cycles) <= a.cycles AS is_due
     FROM airframe a
       JOIN applicable ap ON ap.uav_id = a.uav_id
       JOIN inspection_plans p ON p.id = ap.plan_id
       JOIN inspection_plan_items i ON i.plan_id = p.id
       LEFT JOIN last_done d ON d.uav_id = a.uav_id AND d.plan_item_id = i.id
    WHERE a.status <> 'retired'::uav_status
) v
left join uavs owner on owner.id = v.uav_id;

create or replace view manual_contents
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  WITH RECURSIVE numbered AS (
           SELECT s.id,
              s.manual_id,
              s.parent_id,
              s.heading,
              s.document_id,
              s.body,
              s.sort_order,
              1 AS depth,
              row_number() OVER (PARTITION BY s.manual_id ORDER BY s.sort_order, s.heading)::text AS number,
              lpad(row_number() OVER (PARTITION BY s.manual_id ORDER BY s.sort_order, s.heading)::text, 4, '0'::text) AS sort_path
             FROM manual_sections s
            WHERE s.parent_id IS NULL
          UNION ALL
           SELECT c.id,
              c.manual_id,
              c.parent_id,
              c.heading,
              c.document_id,
              c.body,
              c.sort_order,
              n_1.depth + 1,
              (n_1.number || '.'::text) || row_number() OVER (PARTITION BY c.parent_id ORDER BY c.sort_order, c.heading)::text,
              (n_1.sort_path || '.'::text) || lpad(row_number() OVER (PARTITION BY c.parent_id ORDER BY c.sort_order, c.heading)::text, 4, '0'::text)
             FROM manual_sections c
               JOIN numbered n_1 ON n_1.id = c.parent_id
          )
   SELECT n.id AS section_id,
      n.manual_id,
      n.parent_id,
      n.number AS section_number,
      n.heading,
      n.depth,
      n.sort_order,
      n.sort_path,
      n.body,
      n.document_id,
      d.title AS document_title,
      d.category AS document_category,
      d.version AS document_version,
      d.approval_status AS document_approval_status,
      d.effective_date AS document_effective_date,
      d.storage_path AS document_storage_path
     FROM numbered n
       LEFT JOIN documents d ON d.id = n.document_id
) v
left join manuals owner on owner.id = v.manual_id;

create or replace view manual_summary
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT m.id,
      m.title,
      m.revision,
      m.effective_date,
      m.approval_status,
      m.description,
      m.created_at,
      m.updated_at,
      COALESCE(c.section_count, 0::bigint) AS section_count,
      COALESCE(c.document_count, 0::bigint) AS document_count,
      COALESCE(c.empty_count, 0::bigint) AS empty_section_count
     FROM manuals m
       LEFT JOIN ( SELECT s.manual_id,
              count(*) AS section_count,
              count(s.document_id) AS document_count,
              count(*) FILTER (WHERE s.document_id IS NULL AND (s.body IS NULL OR btrim(s.body) = ''::text) AND NOT (EXISTS ( SELECT 1
                     FROM manual_sections k
                    WHERE k.parent_id = s.id))) AS empty_count
             FROM manual_sections s
            GROUP BY s.manual_id) c ON c.manual_id = m.id
) v
left join manuals owner on owner.id = v.id;

create or replace view pilot_authorisation_status
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT a.id,
      a.pilot_id,
      p.full_name AS pilot_name,
      p.active AS pilot_active,
      a.operation,
      a.authorised_on,
      a.expires_on,
      a.evidence,
      a.notes,
      a.authorised_by,
      granted.full_name AS authorised_by_name,
      a.expires_on IS NULL OR a.expires_on >= CURRENT_DATE AS currently_valid
     FROM pilot_authorisations a
       JOIN pilots p ON p.id = a.pilot_id
       LEFT JOIN profiles granted ON granted.id = a.authorised_by
) v
left join pilot_authorisations owner on owner.id = v.id;

create or replace view pilot_certificate_status
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  SELECT id,
      full_name,
      certificate_number,
      certificate_type,
      certificate_issued,
      certificate_expires,
      last_recency_activity,
      flight_hours,
      notes,
      profile_id,
      (last_recency_activity + '2 years'::interval)::date AS recency_due,
      pilot_has_roc_a(id) AS has_roc_a,
      active
     FROM pilots p
) v
left join pilots owner on owner.id = v.id;

create or replace view project_summary
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  WITH flights AS (
           SELECT flight_logs.project_id,
              count(*) AS flight_count,
              COALESCE(sum(flight_logs.effective_duration_minutes), 0::bigint)::numeric / 60.0 AS hours,
              min(flight_logs.flight_date) AS first_flight,
              max(flight_logs.flight_date) AS last_flight,
              count(DISTINCT flight_logs.pilot_id) AS pilots_used,
              count(DISTINCT flight_logs.uav_id) AS aircraft_used
             FROM flight_logs
            WHERE flight_logs.project_id IS NOT NULL
            GROUP BY flight_logs.project_id
          )
   SELECT p.id,
      p.project_code,
      p.name,
      p.client_id,
      c.name AS client_name,
      p.site_name,
      p.latitude,
      p.longitude,
      p.status,
      p.start_date,
      p.end_date,
      p.hourly_rate,
      p.notes,
      p.created_at,
      COALESCE(f.flight_count, 0::bigint) AS flight_count,
      COALESCE(f.hours, 0::numeric) AS flight_hours,
      f.first_flight,
      f.last_flight,
      COALESCE(f.pilots_used, 0::bigint) AS pilots_used,
      COALESCE(f.aircraft_used, 0::bigint) AS aircraft_used,
          CASE
              WHEN p.hourly_rate IS NULL THEN NULL::numeric
              ELSE round(COALESCE(f.hours, 0::numeric) * p.hourly_rate, 2)
          END AS estimated_cost
     FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN flights f ON f.project_id = p.id
) v
left join projects owner on owner.id = v.id;

create or replace view uav_fleet_status
with (security_invoker = true) as
select v.*, owner.organisation_id
from (
  WITH logged AS (
           SELECT flight_logs.uav_id,
              COALESCE(sum(flight_logs.effective_duration_minutes), 0::bigint)::numeric / 60.0 AS hours
             FROM flight_logs
            GROUP BY flight_logs.uav_id
          )
   SELECT u.id AS uav_id,
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
      u.baseline_flight_hours + COALESCE(l.hours, 0::numeric) AS flight_hours,
      last_service.completed_date AS last_maintenance_date,
      last_service.flight_hours_at_service,
      u.baseline_flight_hours + COALESCE(l.hours, 0::numeric) - COALESCE(last_service.flight_hours_at_service, u.baseline_flight_hours) AS hours_since_service,
          CASE
              WHEN u.maintenance_interval_hours IS NULL THEN NULL::numeric
              ELSE u.maintenance_interval_hours::numeric - (u.baseline_flight_hours + COALESCE(l.hours, 0::numeric) - COALESCE(last_service.flight_hours_at_service, u.baseline_flight_hours))
          END AS hours_until_service,
      assigned.full_name AS assigned_pilot_name
     FROM uavs u
       LEFT JOIN logged l ON l.uav_id = u.id
       LEFT JOIN profiles assigned ON assigned.id = u.assigned_pilot_id
       LEFT JOIN LATERAL ( SELECT m.completed_date,
              m.flight_hours_at_service
             FROM maintenance_records m
            WHERE m.uav_id = u.id AND m.status = 'completed'::maintenance_status
            ORDER BY m.completed_date DESC NULLS LAST, m.created_at DESC
           LIMIT 1) last_service ON true
) v
left join uavs owner on owner.id = v.uav_id;

