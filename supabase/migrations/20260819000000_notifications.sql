-- ============================================================================
-- Automated reminders (original plan, Section 10).
--
-- A scheduled job scans for expiring credentials, due and overdue maintenance,
-- upcoming audits and overdue findings, and records a notification for each.
--
-- The job is expected to run repeatedly over the same data, so every
-- notification carries a dedupe_key and the writer upserts on it. The key
-- includes the underlying due date, so renewing a certificate produces a fresh
-- reminder rather than being silently suppressed by the old one.
-- ============================================================================

create type notification_kind as enum (
  'certification_expiring',
  'certification_expired',
  'medical_expiring',
  'medical_expired',
  'maintenance_due',
  'maintenance_overdue',
  'audit_upcoming',
  'audit_overdue',
  'finding_overdue'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),

  -- Idempotency across repeated runs. Format:
  --   <kind>:<entity_id>:<due_date>:<threshold_days>
  dedupe_key text not null unique,

  kind notification_kind not null,
  severity severity_level not null,
  title text not null,
  body text,

  -- What the reminder is about, kept loose on purpose: these point at several
  -- different tables, so a real foreign key isn't available.
  entity_table text,
  entity_id uuid,
  due_date date,

  -- Who should see it. Roles cover the responsible team; target_profile_id
  -- additionally surfaces it to the specific person affected.
  target_roles user_role[] not null default '{}',
  target_profile_id uuid references profiles (id) on delete set null,

  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_created on notifications (created_at desc);
create index idx_notifications_target_profile on notifications (target_profile_id);
create index idx_notifications_roles on notifications using gin (target_roles);
create index idx_notifications_emailed on notifications (emailed_at) where emailed_at is null;

-- Read state is per person, so it cannot live on the notification itself.
create table notification_reads (
  notification_id uuid not null references notifications (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table notifications enable row level security;
alter table notification_reads enable row level security;

-- You see a notification if it targets your role, or if it is about you.
create policy notifications_select on notifications for select to authenticated
  using (
    public.current_user_role() = any (target_roles)
    or target_profile_id = auth.uid()
  );

-- Only the service role writes notifications; the cron job runs as such and
-- bypasses RLS. No policy for insert/update means no authenticated user can
-- forge or alter a reminder.

create policy notification_reads_own on notification_reads for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
