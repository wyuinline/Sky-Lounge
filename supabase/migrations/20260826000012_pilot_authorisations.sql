-- ============================================================================
-- Who is cleared for what.
--
-- The portal knows whether a pilot's certificate and recency are current. It
-- does not know whether this particular pilot is cleared for beyond-line-of-
-- sight, or night, or flight over people — and those are separate
-- authorisations resting on separate evidence: a certificate, a training
-- record, a check ride, an SFOC.
--
-- This extends the permission matrix already built for the portal into the
-- operation itself: instead of what a role may do in the software, what a
-- pilot may do in the air.
-- ============================================================================

create type operation_type as enum (
  'vlos',                 -- ordinary visual line of sight
  'evlos',                -- extended, with a visual observer
  'bvlos',                -- beyond visual line of sight
  'sheltered',            -- within 100 m of and below the top of a structure
  'controlled_airspace',
  'over_people',
  'night',
  'medium_rpas'           -- 25–150 kg
);

comment on type operation_type is
  'Operation categories a pilot is separately authorised for. These are the '
  'distinctions Canadian rules draw, so they are the ones the portal draws.';

create table pilot_authorisations (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references pilots (id) on delete cascade,
  operation operation_type not null,
  authorised_on date not null default current_date,
  authorised_by uuid references profiles (id),
  -- Null means it does not lapse on its own; it still ends if the pilot's
  -- certificate or recency does, which is checked separately.
  expires_on date,
  -- What backs the authorisation: "Level 1 Complex certificate", "check ride
  -- 2026-03-14", "SFOC 2026-0087". An authorisation with no evidence behind it
  -- is an opinion.
  evidence text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_id, operation),
  constraint pilot_authorisations_dates_ordered
    check (expires_on is null or expires_on >= authorised_on)
);

create trigger pilot_authorisations_set_updated_at
  before update on pilot_authorisations
  for each row execute function public.set_updated_at();

create index idx_pilot_authorisations_pilot on pilot_authorisations (pilot_id);

-- ---------------------------------------------------------------------------
-- What a flight request is asking to do
--
-- Without this the portal cannot check an authorisation, because nothing on a
-- request says which rules the flight is operating under.
-- ---------------------------------------------------------------------------

alter table flight_requests
  add column if not exists operations operation_type[] not null default '{}';

comment on column flight_requests.operations is
  'The operation categories this flight needs. Checked against the pilot''s '
  'authorisations before the request is accepted and again before it is '
  'approved, since a clearance can lapse while a request sits in the queue.';

-- ---------------------------------------------------------------------------
-- Derived: is this authorisation actually live today?
-- ---------------------------------------------------------------------------

create or replace view pilot_authorisation_status
with (security_invoker = true) as
select
  a.id,
  a.pilot_id,
  p.full_name                                  as pilot_name,
  p.active                                     as pilot_active,
  a.operation,
  a.authorised_on,
  a.expires_on,
  a.evidence,
  a.notes,
  a.authorised_by,
  granted.full_name                            as authorised_by_name,
  (a.expires_on is null or a.expires_on >= current_date) as currently_valid
from pilot_authorisations a
join pilots p on p.id = a.pilot_id
left join profiles granted on granted.id = a.authorised_by;

-- ---------------------------------------------------------------------------
-- Access — authorisations are crew records
-- ---------------------------------------------------------------------------

alter table pilot_authorisations enable row level security;

create policy pilot_authorisations_select on pilot_authorisations for select to authenticated
  using (
    public.can_read_all('pilots')
    or (
      public.can_read_own('pilots')
      and exists (
        select 1 from pilots p
        where p.id = pilot_authorisations.pilot_id and p.profile_id = auth.uid()
      )
    )
  );

create policy pilot_authorisations_manage on pilot_authorisations for all to authenticated
  using (public.can_manage('pilots'))
  with check (public.can_manage('pilots'));
