-- ============================================================================
-- Acknowledging newly submitted data.
--
-- Almost every "needs attention" signal in the portal is derivable: a date is
-- close, a service interval is nearly used up, a required document is absent.
-- Those need no new state and get none, because a stored flag is a flag that
-- goes stale.
--
-- One case is genuinely not derivable. A flight log arrives from a pilot and
-- there is nothing about the row itself that says whether anyone has looked at
-- it — flight requests have an approval status and incidents have a workflow,
-- but a log is simply filed. So it carries the one fact that cannot be worked
-- out: whether an administrator has seen it.
-- ============================================================================

alter table flight_logs
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references profiles (id);

comment on column flight_logs.acknowledged_at is
  'When an administrator confirmed they had seen this log. Null means it is '
  'still flagged as new. Everything else the portal flags is derived from '
  'dates and does not need a column.';

create index if not exists idx_flight_logs_unacknowledged
  on flight_logs (acknowledged_at)
  where acknowledged_at is null;
