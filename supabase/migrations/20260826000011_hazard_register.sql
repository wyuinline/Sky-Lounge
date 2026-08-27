-- ============================================================================
-- Hazard register and risk matrix.
--
-- Since 4 November 2025 a Canadian BVLOS operator needs an RPAS Operator
-- Certificate, and holding one means keeping documented policies and
-- procedures proportionate to the operation. The portal already carries four
-- of the five pieces that amounts to — document control with review cycles,
-- audits with corrective actions, incident reporting, training records.
--
-- The missing piece is a hazard register: what could go wrong, how likely and
-- how bad, what has been done about it, and what risk remains. That is the one
-- safety-management component with no home here, and neither DroneLogbook nor
-- Airdata offers it at any tier.
-- ============================================================================

create type risk_likelihood as enum (
  'rare',            -- 1
  'unlikely',        -- 2
  'possible',        -- 3
  'likely',          -- 4
  'almost_certain'   -- 5
);

create type risk_severity as enum (
  'negligible',      -- 1
  'minor',           -- 2
  'moderate',        -- 3
  'major',           -- 4
  'catastrophic'     -- 5
);

create type hazard_status as enum ('open', 'mitigated', 'accepted', 'closed');

comment on type hazard_status is
  'open — identified, nothing done yet. mitigated — controls in place and the '
  'residual risk recorded. accepted — residual risk judged tolerable and signed '
  'off. closed — no longer applies to how the operation runs.';

create type hazard_category as enum (
  'operational',
  'technical',
  'environmental',
  'human_factors',
  'regulatory',
  'security'
);

create table hazards (
  id uuid primary key default gen_random_uuid(),
  hazard_code text not null unique,
  title text not null,
  description text,
  category hazard_category not null default 'operational',

  -- Inherent risk: how bad this is before any control is applied. Kept even
  -- after mitigation, because the whole point of a register is showing that
  -- the controls made a difference.
  initial_likelihood risk_likelihood not null,
  initial_severity risk_severity not null,

  mitigation text,

  -- Residual risk: what remains once the controls are working. Null until
  -- someone has actually assessed it — a blank is honest, a copied-down
  -- initial score is not.
  residual_likelihood risk_likelihood,
  residual_severity risk_severity,

  owner_id uuid references profiles (id),
  status hazard_status not null default 'open',
  identified_on date not null default current_date,

  -- A hazard register that is never re-read is a document, not a control.
  last_reviewed_at date,
  review_interval_months integer not null default 12
    check (review_interval_months > 0),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Residual risk is a pair or it is nothing; half of it cannot be scored.
  constraint hazards_residual_pair
    check (
      (residual_likelihood is null and residual_severity is null)
      or (residual_likelihood is not null and residual_severity is not null)
    )
);

create trigger hazards_set_updated_at
  before update on hazards
  for each row execute function public.set_updated_at();

create index idx_hazards_status on hazards (status);
create index idx_hazards_owner on hazards (owner_id);

-- ---------------------------------------------------------------------------
-- Scoring
--
-- Likelihood x severity on a 5x5 matrix, which is the form every aviation
-- safety management system uses. Ordinals live in the database so a report
-- written in SQL scores a hazard the same way the interface does.
-- ---------------------------------------------------------------------------

create or replace function public.likelihood_score(v risk_likelihood)
returns integer language sql immutable as $$
  select case v
    when 'rare' then 1
    when 'unlikely' then 2
    when 'possible' then 3
    when 'likely' then 4
    when 'almost_certain' then 5
  end;
$$;

create or replace function public.severity_score(v risk_severity)
returns integer language sql immutable as $$
  select case v
    when 'negligible' then 1
    when 'minor' then 2
    when 'moderate' then 3
    when 'major' then 4
    when 'catastrophic' then 5
  end;
$$;

-- ---------------------------------------------------------------------------
-- What an incident revealed
--
-- The link that turns a pile of records into a safety management system: an
-- incident is evidence that a hazard is real, and a hazard with incidents
-- against it is one whose controls are not working.
-- ---------------------------------------------------------------------------

create table hazard_incidents (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references hazards (id) on delete cascade,
  incident_id uuid not null references incidents (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (hazard_id, incident_id)
);

create index idx_hazard_incidents_incident on hazard_incidents (incident_id);

-- ---------------------------------------------------------------------------
-- Closing the loop on a finding
--
-- A corrective action is only closed when something actually changed. These
-- columns say what: the event that raised it, the hazard it addresses, the
-- procedure that was revised, and whether the crew had to be retrained.
-- ---------------------------------------------------------------------------

alter table audit_findings
  add column if not exists incident_id uuid references incidents (id) on delete set null,
  add column if not exists hazard_id uuid references hazards (id) on delete set null,
  add column if not exists resulting_document_id uuid references documents (id) on delete set null,
  add column if not exists training_required boolean not null default false;

comment on column audit_findings.resulting_document_id is
  'The procedure this finding changed. What an audit actually asks for is the '
  'trace from an event to the document it revised, and this is that link.';

-- ---------------------------------------------------------------------------
-- Derived register
-- ---------------------------------------------------------------------------

create or replace view hazard_register
with (security_invoker = true) as
select
  h.id,
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
  p.full_name                                            as owner_name,
  h.status,
  h.identified_on,
  h.last_reviewed_at,
  h.review_interval_months,
  h.notes,
  h.created_at,
  public.likelihood_score(h.initial_likelihood)
    * public.severity_score(h.initial_severity)          as initial_score,
  case
    when h.residual_likelihood is null then null
    else public.likelihood_score(h.residual_likelihood)
       * public.severity_score(h.residual_severity)
  end                                                    as residual_score,
  (
    coalesce(h.last_reviewed_at, h.identified_on)
    + (h.review_interval_months * interval '1 month')
  )::date                                                as review_due,
  (select count(*) from hazard_incidents hi where hi.hazard_id = h.id)
                                                         as incident_count,
  (select count(*) from audit_findings f
     where f.hazard_id = h.id and f.status <> 'closed')  as open_finding_count
from hazards h
left join profiles p on p.id = h.owner_id;

comment on view hazard_register is
  'Hazards with derived risk scores, next review date, and counts of the '
  'incidents that evidenced them and the corrective actions still open.';

-- ---------------------------------------------------------------------------
-- Access
--
-- The register belongs with incidents: whoever can see the safety record can
-- see the hazards it evidences, and whoever manages incidents manages them.
-- ---------------------------------------------------------------------------

alter table hazards enable row level security;
alter table hazard_incidents enable row level security;

create policy hazards_select on hazards for select to authenticated
  using (public.can_read_all('incidents'));

create policy hazards_manage on hazards for all to authenticated
  using (public.can_manage('incidents'))
  with check (public.can_manage('incidents'));

create policy hazard_incidents_select on hazard_incidents for select to authenticated
  using (public.can_read_all('incidents'));

create policy hazard_incidents_manage on hazard_incidents for all to authenticated
  using (public.can_manage('incidents'))
  with check (public.can_manage('incidents'));
