-- ============================================================================
-- Gate C — type competency — and the aircraft safety-assurance declarations.
--
-- Two things that decide whether a *specific* aircraft may fly a *specific*
-- operation, which is the question the portal could not previously answer.
--
-- The declaration matrix is the one most operators miss. A manufacturer
-- declares an aircraft against a Standard 922 requirement for a given kind of
-- operation; flying that operation without the declaration is an offence
-- carrying up to $5,000 for a corporation. The aircraft being airworthy and
-- the pilot being qualified are not substitutes for it.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rpas_operation') then
    create type rpas_operation as enum (
      'small_vlos_controlled',
      'small_near_people',
      'small_over_people',
      'small_sheltered_controlled',
      'medium_vlos_away',
      'medium_near_people',
      'medium_over_people',
      'medium_vlos_controlled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'declaration_type') then
    create type declaration_type as enum ('declaration', 'pre_validated_declaration');
  end if;

  if not exists (select 1 from pg_type where typname = 'competency_type') then
    create type competency_type as enum (
      'airframe',
      'payload',
      'ground_control_station',
      'rtk_base_station',
      'software'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'assessment_method') then
    create type assessment_method as enum ('written', 'observed_flight', 'oral_practical');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- What each operation requires
-- ---------------------------------------------------------------------------

/*
 * The regulatory matrix itself: reference data, the same for every operator.
 *
 * A table rather than a constant in the application, so a report can join to
 * it and an inspector can be shown the mapping the portal is working from.
 * When SOR amendments move a requirement, one row changes.
 */
create table if not exists declaration_requirements (
  operation rpas_operation primary key,
  label text not null,
  rpas_standard text not null,
  declaration_type declaration_type not null,
  car_reference text not null,
  sort_order integer not null default 0
);

insert into declaration_requirements
  (operation, label, rpas_standard, declaration_type, car_reference, sort_order)
values
  ('small_vlos_controlled', 'Small, VLOS in controlled airspace',
   '922.04', 'declaration', '901.69(a)', 10),
  ('small_near_people', 'Small, near people (under 30 m, over 5 m)',
   '922.05', 'declaration', '901.69(b)', 20),
  ('small_over_people', 'Small, over people (under 5 m)',
   '922.06', 'declaration', '901.69(c)', 30),
  ('small_sheltered_controlled', 'Small, sheltered operations in controlled airspace',
   '922.04', 'declaration', '901.69(d)', 40),
  ('medium_vlos_away', 'Medium, VLOS away from people (over 500 ft)',
   '922.08(1),(2)', 'declaration', '901.69(e)', 50),
  ('medium_near_people', 'Medium, near people (under 500 ft, over 100 ft)',
   '922.07', 'pre_validated_declaration', '901.69(f)', 60),
  ('medium_over_people', 'Medium, over people (under 100 ft)',
   '922.07', 'pre_validated_declaration', '901.69(g)', 70),
  ('medium_vlos_controlled', 'Medium, VLOS in controlled airspace',
   '922.04 + 922.08(1),(2)', 'declaration', '901.69(h)', 80)
on conflict (operation) do update
  set label = excluded.label,
      rpas_standard = excluded.rpas_standard,
      declaration_type = excluded.declaration_type,
      car_reference = excluded.car_reference,
      sort_order = excluded.sort_order;

comment on table declaration_requirements is
  'CAR 901.69: which manufacturer declaration each kind of operation needs. Reference data, identical for every operator.';

/*
 * What each aircraft actually holds.
 *
 * The manufacturer declares; the operator records the evidence. Both matter:
 * "the manufacturer says it complies" is the claim, and the declaration
 * document is what an inspector asks to see.
 */
create table if not exists aircraft_declarations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  uav_id uuid not null,
  operation rpas_operation not null,
  declared_by_manufacturer text,
  declared_on date,
  evidence_path text,
  notes text,
  created_at timestamptz not null default now(),

  constraint aircraft_declarations_uav_fkey
    foreign key (uav_id, organisation_id)
    references uavs (id, organisation_id) on delete cascade,
  constraint aircraft_declarations_unique unique (uav_id, operation)
);

create index if not exists aircraft_declarations_uav_idx
  on aircraft_declarations (organisation_id, uav_id);

-- ---------------------------------------------------------------------------
-- The aircraft fields Part IX asks for
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rpas_category') then
    create type rpas_category as enum ('small', 'medium');
  end if;

  if not exists (select 1 from pg_type where typname = 'rpas_class') then
    create type rpas_class as enum ('multirotor', 'fixed_wing', 'vtol', 'helicopter', 'hybrid');
  end if;
end $$;

alter table uavs
  -- Small is 250 g to 25 kg; medium is over 25 kg to 150 kg. The category
  -- decides which half of the declaration matrix applies.
  add column if not exists rpas_category rpas_category,
  add column if not exists rpas_class rpas_class,
  add column if not exists propulsion text,
  -- CAR 901.04: the registered owner must be a Canadian citizen, permanent
  -- resident, or a corporation incorporated in Canada. It is the company,
  -- never a foreign employee.
  add column if not exists registered_owner text,
  -- The marking must be affixed and legible, not merely allocated. Flying
  -- unregistered or unmarked runs to $25,000 for a corporation.
  add column if not exists registration_marking_verified_on date,
  -- Remote ID is not law today. NPA 2026-005 proposed it on 8 June 2026 and
  -- the consultation closed on 9 September 2026, with Canada Gazette Part I
  -- targeted for winter 2027. The fields exist so the fleet is ready; nothing
  -- gates on them, and the readiness engine deliberately ignores them.
  add column if not exists remote_id_capable boolean,
  add column if not exists remote_id_method text
    check (remote_id_method is null or remote_id_method in
      ('broadcast', 'network', 'retrofit_module', 'none')),
  add column if not exists remote_id_serial text;

comment on column uavs.registered_owner is
  'CAR 901.04 — must be a Canadian citizen, permanent resident or Canadian-incorporated corporation. The company, never a foreign employee.';
comment on column uavs.remote_id_capable is
  'Advisory only. Remote ID is not a legal requirement as of this migration; NPA 2026-005 is at consultation. Never gate a flight on this.';

/*
 * Tracking the regulations that are coming.
 *
 * AC 901-002 asks an operator to manage change. Remote ID is the live example
 * and will not be the last, so it gets a table rather than a note in a manual.
 */
create table if not exists regulatory_watch (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  reference text not null,
  title text not null,
  stage text not null default 'consultation'
    check (stage in ('consultation', 'closed', 'gazette_i', 'gazette_ii', 'in_force', 'withdrawn')),
  consultation_closes_on date,
  expected_in_force_on date,
  owner_id uuid,
  review_due_on date,
  impact_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into regulatory_watch
  (organisation_id, reference, title, stage, consultation_closes_on, impact_notes)
select o.id, 'NPA 2026-005',
  'Remote ID, community-based organizations and designated RPAS airspace',
  'closed', '2026-09-09',
  'Performance-based Remote ID (broadcast or network, ASTM F3411) proposed for 250 g to 150 kg in Basic, Advanced and Level 1 Complex. Canada Gazette Part I targeted winter 2027. Fleet fields exist; nothing is gated on them.'
from organisations o
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Gate C — type competency
-- ---------------------------------------------------------------------------

/*
 * A pilot signed off on a specific airframe, payload or ground station.
 *
 * Either a specific aircraft or a model: an operator with six identical
 * Matrice 350s signs a pilot off on the type, not six times. Both are allowed
 * and the readiness engine accepts either.
 */
create table if not exists type_competencies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null default public.current_org_id()
    references organisations(id) on delete restrict,
  pilot_id uuid not null,
  competency_type competency_type not null,

  uav_id uuid,
  -- Free text matching uavs.model, for a sign-off that covers a type rather
  -- than one airframe.
  aircraft_model text,
  component_id uuid,

  assessed_by uuid,
  assessed_on date not null,
  method assessment_method not null default 'observed_flight',
  result text not null default 'pass' check (result in ('pass', 'fail')),
  limitations text,
  expires_on date,
  evidence_path text,
  created_at timestamptz not null default now(),

  constraint type_competencies_pilot_fkey
    foreign key (pilot_id, organisation_id)
    references pilots (id, organisation_id) on delete cascade,
  constraint type_competencies_uav_fkey
    foreign key (uav_id, organisation_id)
    references uavs (id, organisation_id) on delete cascade,
  constraint type_competencies_component_fkey
    foreign key (component_id, organisation_id)
    references components (id, organisation_id) on delete cascade,
  -- A sign-off has to be about something.
  constraint type_competencies_has_a_subject check (
    uav_id is not null or aircraft_model is not null or component_id is not null
  )
);

create index if not exists type_competencies_pilot_idx
  on type_competencies (organisation_id, pilot_id, competency_type);

comment on constraint type_competencies_has_a_subject on type_competencies is
  'A competency names an airframe, a model or a component. One that names nothing authorises nothing.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table declaration_requirements enable row level security;
alter table aircraft_declarations enable row level security;
alter table regulatory_watch enable row level security;
alter table type_competencies enable row level security;

-- Reference data: readable by anyone signed in, writable through migrations.
create policy "declaration requirements readable" on declaration_requirements
  for select to authenticated using (true);

create policy "aircraft declarations readable" on aircraft_declarations
  for select to authenticated
  using (public.owns_row(organisation_id) and public.can_read_all('fleet'));

create policy "aircraft declarations writable" on aircraft_declarations
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('fleet'))
  with check (public.owns_row(organisation_id) and public.can_manage('fleet'));

create policy "regulatory watch readable" on regulatory_watch
  for select to authenticated using (public.owns_row(organisation_id));

create policy "regulatory watch writable" on regulatory_watch
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('audits'))
  with check (public.owns_row(organisation_id) and public.can_manage('audits'));

create policy "type competencies readable" on type_competencies
  for select to authenticated
  using (
    public.owns_row(organisation_id)
    and (
      public.can_read_all('pilots')
      or pilot_id in (select p.id from pilots p where p.profile_id = auth.uid())
    )
  );

create policy "type competencies writable" on type_competencies
  for all to authenticated
  using (public.owns_row(organisation_id) and public.can_manage('pilots'))
  with check (public.owns_row(organisation_id) and public.can_manage('pilots'));
