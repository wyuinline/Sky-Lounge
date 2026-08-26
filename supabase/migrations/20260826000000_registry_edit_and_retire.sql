-- ============================================================================
-- Retiring airframes and crew.
--
-- Until now a UAV or a pilot could only be added. Correcting a typo meant the
-- SQL editor, and an airframe sold or written off stayed in the fleet forever,
-- counted in every total and offered in every picker.
--
-- Deleting is the wrong answer for most of them: flight logs, maintenance
-- records and incidents point at these rows, and that history is the
-- compliance record. The foreign keys already refuse such a delete, which is
-- correct — so records that carry history are retired instead, and only a row
-- nothing references can actually be removed.
-- ============================================================================

-- 'retired' is not an airworthiness state, it means the airframe has left the
-- fleet. Kept in the same enum so one column still answers "where is it?".
alter type uav_status add value if not exists 'retired';

comment on type uav_status is
  'airworthy / maintenance / grounded describe an airframe still in service. '
  'retired means it has left the fleet: excluded from totals and pickers, but '
  'its flight and maintenance history is preserved.';

-- Pilots have no status column, and adding a whole enum for two states would
-- be ceremony. A departed pilot is inactive; their record and its certificate
-- history stay for audit.
alter table pilots
  add column if not exists active boolean not null default true;

comment on column pilots.active is
  'False once someone has left the crew. Their record is kept for audit but is '
  'excluded from credential alerts and from pilot pickers.';

-- The view is what the pilots page and the reminder scan both read, so the
-- flag has to reach them through it. CREATE OR REPLACE VIEW permits appending
-- a column but not reordering, hence the position.
create or replace view pilot_certificate_status
with (security_invoker = true) as
select
  p.id, p.full_name, p.certificate_number, p.certificate_type,
  p.certificate_issued, p.certificate_expires, p.last_recency_activity,
  p.flight_hours, p.notes, p.profile_id,
  (p.last_recency_activity + interval '24 months')::date as recency_due,
  public.pilot_has_roc_a(p.id)                           as has_roc_a,
  p.active
from pilots p;
