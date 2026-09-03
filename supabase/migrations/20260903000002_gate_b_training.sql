-- ============================================================================
-- Gate B — company authorization: the training programme under CAR 901.219.
--
-- Distinct from `training_records`, which the portal already has and which
-- holds external certifications: a first-aid ticket, a radio operator
-- certificate, a manufacturer course. Those are things a pilot *holds*.
--
-- This is the operator's own training programme — what the RPOC holder is
-- required to deliver, evaluate and re-deliver on an interval, and to review
-- the effectiveness of once a year. An inspector asks for the programme, the
-- records against it, and the annual evaluation. All three live here.
--
-- The catalogue is per-organisation and seeded with the modules from
-- AC 901-002 Appendix A §11. Every operator can change theirs; changing the
-- default for future operators is a separate act.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'training_category') then
    create type training_category as enum (
      'indoctrination',
      'initial',
      'recurrent',
      'annual',
      'on_the_job'
    );
  end if;
end $$;

create table if not exists training_modules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  -- Null means "on amendment only" — the Operations Manual orientation is
  -- re-delivered when the manual changes, not on a clock.
  interval_months integer check (interval_months is null or interval_months > 0),
  car_reference text,
  -- A module every pilot must hold, versus one that applies to some roles.
  required_for_all boolean not null default true,
  applies_to_roles rpas_role[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint training_modules_code_not_blank check (btrim(code) <> ''),
  constraint training_modules_code_unique unique (organisation_id, code)
);

comment on column training_modules.interval_months is
  'Null means the module is re-delivered on amendment rather than on a clock — the Operations Manual orientation works that way.';

-- The composite key the completions below reference, so a completion can
-- never point at another operator's module.
create unique index if not exists training_modules_id_org_key
  on training_modules (id, organisation_id);

create table if not exists training_completions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  module_id uuid not null,
  training_category training_category not null default 'initial',
  delivered_by text,
  delivered_on date not null,
  hours numeric(5, 1) check (hours is null or hours >= 0),
  assessment_result text not null default 'pass' check (assessment_result in ('pass', 'fail')),
  score numeric(5, 2) check (score is null or (score >= 0 and score <= 100)),
  -- Separation of duties: AC 901-002 App. A §11(4) asks for objectivity, so
  -- the evaluator is recorded separately from whoever delivered the training.
  evaluator_id uuid,
  evidence_path text,
  notes text,
  created_at timestamptz not null default now(),

  constraint training_completions_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade,
  constraint training_completions_module_fkey
    foreign key (module_id, organisation_id)
    references training_modules (id, organisation_id) on delete cascade
);

create index if not exists training_completions_pilot_idx
  on training_completions (organisation_id, pilot_id, module_id, delivered_on desc);

/*
 * The annual evaluation of the programme itself.
 *
 * CAR 901.219(2)(c) requires the operator to assess whether the training is
 * working, once a year — a separate obligation from delivering it. Modelled as
 * its own object with an owner and a due date, because an obligation with
 * nobody's name on it is one nobody does.
 */
create table if not exists training_effectiveness_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  owner_id uuid,
  completed_on date,
  findings text,
  actions text,
  car_reference text not null default '901.219(2)(c)',
  created_at timestamptz not null default now(),

  constraint training_reviews_period check (period_end >= period_start)
);

-- ---------------------------------------------------------------------------
-- The default catalogue
-- ---------------------------------------------------------------------------

create table if not exists training_module_defaults (
  code text primary key,
  name text not null,
  interval_months integer,
  car_reference text,
  sort_order integer not null default 0
);

insert into training_module_defaults (code, name, interval_months, car_reference, sort_order) values
  ('OPS-MANUAL', 'Operations Manual orientation', 24, '901.217', 10),
  ('SMS', 'Safety management processes', 24, '901.218', 20),
  ('HUMAN-FACTORS', 'Human factors', 36, 'AC 901-002 App. A §11(2)(d)', 30),
  ('EMERGENCY', 'Emergency procedures', 12, '901.23(b)', 40),
  ('CONTINGENCY', 'Contingency and abnormal procedures', 12, '901.23', 50),
  ('PLANNING', 'Flight planning and site survey', 12, '901.24 / 901.27 / 901.28', 60),
  ('AIRSPACE', 'Airspace, NOTAM and NAV CANADA RPAS flight authorization', 12, '901.14 / 901.47 / 901.71 / 901.73', 70),
  ('LOST-LINK', 'Lost link, C2 failure, flyaway and flight termination', 12, '901.32 / 901.44', 80),
  ('COMMS', 'Communications and crew handover', 24, '901.42', 90),
  ('REPORTING', 'Incident and accident reporting', 24, '901.49', 100),
  ('INSPECTION', 'Pre and post-flight inspection and elementary work', 12, '901.29 / MCM', 110),
  ('BATTERY', 'Battery handling and lithium-ion fire response', 12, 'AC 700-065', 120),
  ('TDG', 'Transportation of dangerous goods', 12, 'TDG Act', 130),
  ('VO', 'Visual observer duties', 24, '901.20 / 901.38', 140),
  ('WEIGHT-BALANCE', 'Weight, balance and payload limits', 24, '901.31 / 901.43', 150),
  ('RECORDS', 'Records and logbook procedures', 24, '901.48 / 901.223 / 103.04', 160)
on conflict (code) do nothing;

comment on table training_module_defaults is
  'What a newly provisioned operator starts with, from AC 901-002 App. A §11. Changing it affects future operators, never existing ones.';

/*
 * Every existing organisation gets the catalogue, and so does every future
 * one — provision_organisation is extended to seed it alongside the
 * permissions matrix.
 */
insert into training_modules (organisation_id, code, name, interval_months, car_reference, sort_order)
select o.id, d.code, d.name, d.interval_months, d.car_reference, d.sort_order
  from organisations o cross join training_module_defaults d
on conflict (organisation_id, code) do nothing;

create or replace function public.provision_organisation(
  p_name text,
  p_slug text,
  p_legal_name text default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator may create an organisation'
      using errcode = 'insufficient_privilege';
  end if;

  insert into organisations (name, slug, legal_name, contact_email)
  values (btrim(p_name), lower(btrim(p_slug)), nullif(btrim(coalesce(p_legal_name, '')), ''),
          nullif(btrim(coalesce(p_contact_email, '')), ''))
  returning id into new_org;

  insert into role_permissions (organisation_id, role, area, level)
  select new_org, role, area, level from role_permission_defaults;

  insert into document_review_policy (organisation_id, category, review_interval_months, rationale)
  select new_org, category, review_interval_months, rationale from document_review_defaults;

  -- An operator certificate holder needs a training programme from day one;
  -- arriving to an empty catalogue would mean building it from the CARs by
  -- hand before anybody could be signed off.
  insert into training_modules (organisation_id, code, name, interval_months, car_reference, sort_order)
  select new_org, code, name, interval_months, car_reference, sort_order
    from training_module_defaults;

  return new_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table training_modules enable row level security;
alter table training_completions enable row level security;
alter table training_effectiveness_reviews enable row level security;
alter table training_module_defaults enable row level security;

create policy "training defaults readable" on training_module_defaults
  for select to authenticated using (true);

create policy "training modules readable" on training_modules
  for select to authenticated
  using (public.owns_row(organisation_id) and public.can_read_all('training'));

create policy "training modules writable" on training_modules
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('training'))
  with check (public.owns_row(organisation_id) and public.can_manage('training'));

-- A pilot may see their own training record without seeing the roster's.
create policy "training completions readable" on training_completions
  for select to authenticated
  using (
    public.owns_row(organisation_id)
    and (
      public.can_read_all('training')
      or pilot_id in (select p.id from pilots p where p.profile_id = auth.uid())
    )
  );

create policy "training completions writable" on training_completions
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('training'))
  with check (public.owns_row(organisation_id) and public.can_manage('training'));

create policy "training reviews readable" on training_effectiveness_reviews
  for select to authenticated
  using (public.owns_row(organisation_id) and public.can_read_all('training'));

create policy "training reviews writable" on training_effectiveness_reviews
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('training'))
  with check (public.owns_row(organisation_id) and public.can_manage('training'));
