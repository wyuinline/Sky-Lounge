-- ============================================================================
-- Rework the pilot registry around Transport Canada RPAS credentials.
--
-- The registry was modelled on manned aviation: an employee number and a
-- medical certificate expiry. Canadian RPAS crew do not hold an aviation
-- medical. What Transport Canada actually requires is a pilot certificate
-- (Basic, Advanced, or Level 1 Complex), a recency activity every 24 months,
-- and a ROC-A radio licence where aeronautical radio is used.
-- ============================================================================

create type rpas_certificate_type as enum (
  'basic_operations',
  'advanced_operations',
  'level_1_complex'
);

-- ---------------------------------------------------------------------------
-- Pilot registry
-- ---------------------------------------------------------------------------

alter table pilots
  drop column if exists employee_id,
  drop column if exists medical_expiry,
  -- currency_status was already vestigial: nothing maintained it and the app
  -- derives currency from dates. Removing it so no one trusts it again.
  drop column if exists currency_status;

-- The "Certificate #" on the operational sheet is this same field.
alter table pilots rename column license_number to certificate_number;

alter table pilots
  add column if not exists certificate_type rpas_certificate_type,
  add column if not exists certificate_issued date,
  add column if not exists certificate_expires date,
  add column if not exists last_recency_activity date,
  add column if not exists notes text;

create unique index if not exists idx_pilots_certificate_number
  on pilots (certificate_number)
  where certificate_number is not null;

alter table pilots
  drop constraint if exists pilots_certificate_dates_ordered,
  add constraint pilots_certificate_dates_ordered
    check (
      certificate_issued is null
      or certificate_expires is null
      or certificate_expires >= certificate_issued
    );

comment on column pilots.last_recency_activity is
  'Date of the most recent recency activity. Transport Canada requires one '
  'every 24 months; the due date is derived, never stored.';

-- ---------------------------------------------------------------------------
-- Attach documents to a pilot, so ROC-A can be evidenced rather than asserted
-- ---------------------------------------------------------------------------

alter table documents
  add column if not exists pilot_id uuid references pilots (id) on delete cascade;

create index if not exists idx_documents_pilot on documents (pilot_id);

insert into storage.buckets (id, name, public)
values ('roc-a-certificates', 'roc-a-certificates', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Derived credential status
--
-- recency_due and the ROC-A flag are computed, not stored. A stored copy of
-- either would drift the moment a record changed, and an audit tick that
-- nothing verifies is worse than no tick at all.
-- ---------------------------------------------------------------------------

create or replace view pilot_certificate_status
with (security_invoker = true)
as
select
  p.id,
  p.full_name,
  p.certificate_number,
  p.certificate_type,
  p.certificate_issued,
  p.certificate_expires,
  p.last_recency_activity,
  p.flight_hours,
  p.notes,
  p.profile_id,
  (p.last_recency_activity + interval '24 months')::date as recency_due,
  exists (
    select 1
    from documents d
    where d.pilot_id = p.id
      and d.category = 'roc_a'
  ) as has_roc_a
from pilots p;
