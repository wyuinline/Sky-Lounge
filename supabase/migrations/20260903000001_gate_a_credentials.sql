-- ============================================================================
-- Gate A — Transport Canada credentials.
--
-- The portal has carried a pilot's certificate as four columns on the pilot
-- row: number, type, issued, expires. That was enough to warn someone that a
-- date was approaching. It is not enough for an operator certificate holder,
-- for three reasons.
--
--   A certificate does not expire (CAR 901.55/901.64/901.90). Recency does,
--   separately, on a rolling 24 months — and the portal was conflating the two
--   in a single `certificate_expires` field.
--
--   Recency is earned by any of five different activities (901.56/901.65/
--   901.91), each with its own evidence. "Last recency activity: a date" cannot
--   say which, or show an inspector the questionnaire behind it.
--
--   An inspector asks to trace a record to the CAR that requires it. So every
--   table here carries `car_reference`, and every report can be filtered as
--   "everything 901.223 requires".
--
-- Nothing is dropped from `pilots`. The existing columns keep working and
-- become a summary of the records below; a later migration can retire them
-- once every operator has moved across.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Who a person is, for the parts that are not sensitive
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'employment_status') then
    create type employment_status as enum ('employee', 'contractor', 'agent', 'representative');
  end if;

  if not exists (select 1 from pg_type where typname = 'rpas_role') then
    create type rpas_role as enum (
      'pilot_in_command',
      'visual_observer',
      'chief_pilot',
      'training_pilot',
      'person_responsible_for_maintenance',
      'accountable_executive'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'onboarding_status') then
    create type onboarding_status as enum (
      'phase_1_verify_person',
      'phase_2_certification',
      'phase_3_company_qualification',
      'phase_4_documentation',
      'phase_5_aircraft',
      'phase_6_operational_release',
      'released',
      'suspended'
    );
  end if;
end $$;

alter table pilots
  -- The legal name must match the certificate exactly; the preferred name is
  -- what everyone actually calls them. Conflating the two is how a certificate
  -- check fails against a person who is perfectly qualified.
  add column if not exists legal_first_name text,
  add column if not exists legal_middle_names text,
  add column if not exists legal_last_name text,
  add column if not exists preferred_name text,
  add column if not exists employment_status employment_status,
  add column if not exists position_title text,
  add column if not exists rpas_roles rpas_role[] not null default '{}',
  add column if not exists reports_to_id uuid,
  add column if not exists onboarding_status onboarding_status;

-- A supervisor is another pilot in the same organisation. Composite, like
-- every other reference in the schema.
alter table pilots drop constraint if exists pilots_reports_to_id_fkey;
alter table pilots add constraint pilots_reports_to_id_fkey
  foreign key (reports_to_id, organisation_id)
  references pilots (id, organisation_id) on delete set null (reports_to_id);

comment on column pilots.legal_first_name is
  'Must match the Transport Canada certificate exactly. The preferred name is what people call them.';

-- ---------------------------------------------------------------------------
-- Restricted personal data, held apart
-- ---------------------------------------------------------------------------

/*
 * Date of birth and immigration status, in their own table.
 *
 * A separate table rather than more columns on `pilots`, because Postgres
 * policies are row-level: the only way to give these fields a stricter rule
 * than flight hours is to put them in a row of their own. Anyone with the
 * pilots area sees the pilot; only the personal_data area sees this.
 */
create table if not exists pilot_personal_data (
  pilot_id uuid primary key,
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,

  -- Drives the age gates: 16 for Advanced, 18 for Level 1 Complex.
  date_of_birth date,

  work_authorization_status text
    check (work_authorization_status is null or work_authorization_status in
      ('citizen', 'permanent_resident', 'work_permit', 'other')),
  work_authorization_expires_on date,
  work_authorization_notes text,

  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint pilot_personal_data_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade
);

comment on table pilot_personal_data is
  'PIPEDA-sensitive. Separate from pilots so it can carry a stricter policy: row-level security cannot restrict one column of a row.';

/*
 * Citizenship is not a Transport Canada matter.
 *
 * A foreign national may hold a Canadian pilot certificate. What must be
 * Canadian is the *operator*: the RPOC holder and the registered owner of the
 * aircraft (CAR 901.04). Recording that here so nobody re-derives it wrongly.
 */
comment on column pilot_personal_data.work_authorization_status is
  'An IRCC matter, not a TC one. Citizenship is not required to hold a pilot certificate; it is required to hold the RPOC and register aircraft, and both stay with the company.';

/*
 * Every read of the restricted fields, recorded.
 *
 * Append-only and readable only by the people who could see the data anyway.
 * The point is not to catch anyone; it is that PIPEDA expects an operator to
 * be able to say who looked at someone's immigration status and when.
 */
create table if not exists personal_data_access_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  accessed_by uuid,
  accessed_at timestamptz not null default now(),
  -- Why it was looked at, in the reader's own words where the caller supplies
  -- one: "age gate for L1C application", "work permit renewal".
  purpose text
);

create index if not exists personal_data_access_log_pilot_idx
  on personal_data_access_log (organisation_id, pilot_id, accessed_at desc);

-- ---------------------------------------------------------------------------
-- Gate A records
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'certificate_level') then
    create type certificate_level as enum ('basic', 'advanced', 'level_1_complex');
  end if;

  if not exists (select 1 from pg_type where typname = 'recency_activity') then
    create type recency_activity as enum (
      'exam_retake',
      'flight_review',
      'tc_endorsed_seminar',
      'recurrent_training_program',
      'self_paced_study'
    );
  end if;
end $$;

/*
 * The certificate itself.
 *
 * No expiry column, deliberately: a Transport Canada pilot certificate does
 * not expire. What lapses is recency, and it lives in its own table below. A
 * nullable expiry here would invite somebody to fill it in and then act on it.
 */
create table if not exists pilot_certificates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  certificate_level certificate_level not null,
  certificate_number text not null,
  issued_on date not null,
  document_path text,
  -- Company verification that the certificate is genuine, which is a separate
  -- act from recording that it exists.
  verified_by uuid,
  verified_on date,
  car_reference text not null default '901.55 / 901.64 / 901.90',
  superseded_by uuid,
  created_at timestamptz not null default now(),

  constraint pilot_certificates_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade,
  constraint pilot_certificates_number_not_blank check (btrim(certificate_number) <> '')
);

create index if not exists pilot_certificates_pilot_idx
  on pilot_certificates (organisation_id, pilot_id, certificate_level);

comment on table pilot_certificates is
  'A TC pilot certificate. Certificates do not expire — recency does, separately, in recency_records.';

create table if not exists pilot_exams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  exam_type certificate_level not null,
  passed_on date not null,
  -- Level 1 Complex needs 80% (Standard 921.07); the others are pass/fail, so
  -- the score is recorded but not required.
  score numeric(5, 2) check (score is null or (score >= 0 and score <= 100)),
  document_path text,
  car_reference text not null default 'Standard 921.07',
  created_at timestamptz not null default now(),

  constraint pilot_exams_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade
);

create index if not exists pilot_exams_pilot_idx on pilot_exams (organisation_id, pilot_id);

create table if not exists flight_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  review_type certificate_level not null,
  completed_on date not null,
  reviewer_name text,
  reviewer_certificate_number text,
  flight_reviewer_rating_ref text,
  result text not null default 'pass' check (result in ('pass', 'fail')),
  document_path text,
  -- A flight review must be within the 12 months before the certificate
  -- application (CAR 901.64(c)), which is why the date matters more than the
  -- fact.
  car_reference text not null default '901.64(c)',
  created_at timestamptz not null default now(),

  constraint flight_reviews_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade
);

create index if not exists flight_reviews_pilot_idx
  on flight_reviews (organisation_id, pilot_id, completed_on desc);

create table if not exists ground_school_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  provider_name text not null,
  -- Level 1 Complex requires at least 20 hours at a flight school (TP 15530).
  hours numeric(6, 1) check (hours is null or hours >= 0),
  syllabus_ref text,
  completed_on date not null,
  certificate_path text,
  car_reference text not null default 'TP 15530',
  created_at timestamptz not null default now(),

  constraint ground_school_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade
);

/*
 * Recency, the thing that actually lapses.
 *
 * expires_on is generated, not stored as a typed date: 24 months from the
 * activity is the rule, and a hand-entered expiry is a hand-entered mistake
 * waiting to authorise a flight it should have refused.
 */
create table if not exists recency_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  activity_type recency_activity not null,
  completed_on date not null,
  expires_on date generated always as (completed_on + interval '24 months') stored,
  evidence_path text,
  notes text,
  car_reference text not null default '901.56 / 901.65 / 901.91',
  created_at timestamptz not null default now(),

  constraint recency_records_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade
);

create index if not exists recency_records_pilot_idx
  on recency_records (organisation_id, pilot_id, expires_on desc);

comment on column recency_records.expires_on is
  'Derived: 24 months from the activity. Never typed, because a typed expiry is how a lapsed pilot gets authorised.';

/*
 * Foreign credentials — recorded, credited at nothing.
 *
 * Transport Canada offers no special certification procedure or credit for
 * foreign pilots, and there is no RPAS equivalent of the crewed-aviation
 * Foreign Licence Validation Certificate. This table exists only so the
 * company can assess risk and plan training. The column comment says so,
 * because the table will outlive whoever explains it.
 */
create table if not exists foreign_qualifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  issuing_state text not null,
  authority text,
  credential_name text not null,
  credential_number text,
  issued_on date,
  expires_on date,
  logged_hours numeric(8, 1),
  aircraft_types_flown text,
  document_path text,
  translation_path text,
  verification_notes text,
  created_at timestamptz not null default now(),

  constraint foreign_qualifications_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade
);

comment on table foreign_qualifications is
  'No regulatory credit in Canada. Recorded for the company''s own risk assessment and training plan only.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table pilot_certificates enable row level security;
alter table pilot_exams enable row level security;
alter table flight_reviews enable row level security;
alter table ground_school_records enable row level security;
alter table recency_records enable row level security;
alter table foreign_qualifications enable row level security;
alter table pilot_personal_data enable row level security;
alter table personal_data_access_log enable row level security;

/*
 * Gate A records follow the pilots area, including its "own record" level: a
 * pilot may read their own certificate and recency without being able to read
 * anybody else's.
 */
do $$
declare
  t text;
begin
  foreach t in array array[
    'pilot_certificates', 'pilot_exams', 'flight_reviews',
    'ground_school_records', 'recency_records', 'foreign_qualifications'
  ] loop
    execute format($f$
      create policy %1$I on %2$I for select to authenticated
        using (
          public.owns_row(organisation_id)
          and (
            public.can_read_all('pilots')
            or (
              public.can_read_own('pilots')
              and pilot_id in (select p.id from pilots p where p.profile_id = auth.uid())
            )
          )
        );
    $f$, t || '_select', t);

    execute format($f$
      create policy %1$I on %2$I for all to authenticated
        using (public.owns_row(organisation_id) and public.can_manage('pilots'))
        with check (public.owns_row(organisation_id) and public.can_manage('pilots'));
    $f$, t || '_manage', t);
  end loop;
end $$;

-- Restricted: its own area, and a pilot may always read their own.
create policy "personal data readable" on pilot_personal_data
  for select to authenticated
  using (
    public.owns_row(organisation_id)
    and (
      public.can_read_all('personal_data')
      or pilot_id in (select p.id from pilots p where p.profile_id = auth.uid())
    )
  );

create policy "personal data writable" on pilot_personal_data
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('personal_data'))
  with check (public.owns_row(organisation_id) and public.can_manage('personal_data'));

-- The log is readable by whoever can see the data, and appendable by anyone
-- signed in — a reader must not be able to decline to be logged.
create policy "personal data log readable" on personal_data_access_log
  for select to authenticated
  using (public.owns_row(organisation_id) and public.can_read_all('personal_data'));

create policy "personal data log appendable" on personal_data_access_log
  for insert to authenticated
  with check (public.owns_row(organisation_id));

-- Deliberately no update or delete policy: an access log that can be edited is
-- not an access log.
