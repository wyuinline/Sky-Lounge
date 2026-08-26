-- ============================================================================
-- Document review cycles.
--
-- Most controlled documents never carry an expiry date — an SOP or a manual is
-- valid until someone decides it is not. What they need is a review clock: read
-- it once a year, confirm it still matches how the work is actually done, and
-- restart the clock. Others do expire on a printed date, and a few (a ROC-A
-- radio licence) neither expire nor need reviewing.
--
-- So a document carries two independent dates:
--   review_due  — derived from the last review and the interval
--   expires_at  — a hard date printed on the document itself
-- and either can raise a reminder.
-- ============================================================================

alter type notification_kind add value if not exists 'document_review_due';
alter type notification_kind add value if not exists 'document_review_overdue';
alter type notification_kind add value if not exists 'document_expiring';
alter type notification_kind add value if not exists 'document_expired';

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table documents
  -- When this version took effect. The review clock starts here until someone
  -- actually reviews it, which is usually the upload date but not always: a
  -- manual issued in March and filed in June is a year old in March.
  add column if not exists effective_date date,
  add column if not exists last_reviewed_at date,
  add column if not exists last_reviewed_by uuid references profiles (id),
  -- Null means this document never needs reviewing.
  add column if not exists review_interval_months integer,
  -- A real expiry printed on the document. Separate from the review clock:
  -- a certificate can be in date and still be overdue for a look.
  add column if not exists expires_at date;

alter table documents
  drop constraint if exists documents_review_interval_positive,
  add constraint documents_review_interval_positive
    check (review_interval_months is null or review_interval_months > 0);

comment on column documents.review_interval_months is
  'How often this document must be reviewed, in months. Null means never.';
comment on column documents.expires_at is
  'A hard expiry printed on the document. Independent of the review clock.';

-- ---------------------------------------------------------------------------
-- 2. Per-category defaults
--
-- A lookup rather than a hardcoded CASE, so the cycle can be corrected without
-- a migration. It only supplies the default at upload — each document then
-- owns its own interval, so changing policy here never silently moves the due
-- date of something already on file.
-- ---------------------------------------------------------------------------

create table if not exists document_review_policy (
  category document_category primary key,
  review_interval_months integer,
  rationale text,
  constraint document_review_policy_interval_positive
    check (review_interval_months is null or review_interval_months > 0)
);

insert into document_review_policy (category, review_interval_months, rationale) values
  ('sop', 12, 'Standard operating procedures are read annually against how the work is actually done.'),
  ('policy', 12, 'Reviewed annually.'),
  ('flight_manual', 12, 'Manufacturer revisions and firmware changes accumulate over a year.'),
  ('maintenance_manual', 12, 'Reviewed annually alongside the servicing schedule.'),
  ('safety_document', 12, 'Reviewed annually.'),
  ('training_material', 12, 'Reviewed annually so course content matches current procedure.'),
  ('regulatory', 12, 'Checked annually against the current Transport Canada rules.'),
  ('incident_report', null, 'A record of something that happened. It does not go stale.'),
  ('roc_a', null, 'A ROC-A radio operator certificate does not expire and needs no review.')
on conflict (category) do nothing;

alter table document_review_policy enable row level security;

create policy document_review_policy_select on document_review_policy
  for select to authenticated using (true);

create policy document_review_policy_write on document_review_policy
  for all to authenticated
  using (public.can_manage('docs_general'))
  with check (public.can_manage('docs_general'));

-- ---------------------------------------------------------------------------
-- 3. Backfill
--
-- Existing rows predate all of this, so give them the effective date they
-- actually have and their category's cycle. Without this every document
-- already on file would read as "never needs review", which is the one answer
-- nobody asked for.
-- ---------------------------------------------------------------------------

update documents d
   set effective_date = coalesce(d.effective_date, d.created_at::date),
       review_interval_months = coalesce(
         d.review_interval_months,
         (select p.review_interval_months from document_review_policy p where p.category = d.category)
       )
 where d.effective_date is null or d.review_interval_months is null;

-- ---------------------------------------------------------------------------
-- 4. Derived status
--
-- review_due is derived, never stored: a stored due date is one nobody
-- maintains, and this codebase has been bitten by that three times already.
-- Postgres clamps date + interval correctly (31 Jan + 1 month is 28 Feb), so
-- the deadline cannot drift later than it should.
-- ---------------------------------------------------------------------------

create or replace view document_review_status
with (security_invoker = true) as
select
  d.id,
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
  case
    when d.review_interval_months is null then null
    else (
      coalesce(d.last_reviewed_at, d.effective_date, d.created_at::date)
      + (d.review_interval_months * interval '1 month')
    )::date
  end                                        as review_due,
  p.full_name                                as pilot_name,
  p.profile_id                               as pilot_profile_id,
  p.active                                   as pilot_active
from documents d
left join pilots p on p.id = d.pilot_id;

comment on view document_review_status is
  'Documents with their derived next-review date. Null review_due means the '
  'document never needs reviewing.';
