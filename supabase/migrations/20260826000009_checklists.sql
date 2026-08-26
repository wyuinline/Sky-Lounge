-- ============================================================================
-- Pre-flight checklists.
--
-- Both competitors treat a checklist as a first-class record, and the reason is
-- not tidiness: a completed checklist is evidence. Ours has lived on paper or
-- in someone's head, which means the portal cannot show that a check was done
-- and cannot show which one was skipped.
--
-- A template is the list. A completion is one crew, one aircraft, one time,
-- with a response per item. Templates are versioned by being immutable once
-- used — see the guard at the bottom — so a completion always shows what was
-- actually asked, not what the list says today.
-- ============================================================================

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Matches uavs.model. Null means it applies to any aircraft.
  applies_to_model text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger checklist_templates_set_updated_at
  before update on checklist_templates
  for each row execute function public.set_updated_at();

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates (id) on delete cascade,
  prompt text not null,
  -- A no-go item: the aircraft does not fly until this one is satisfied.
  critical boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_checklist_items_template on checklist_items (template_id, sort_order);

create table checklist_completions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates (id) on delete restrict,
  uav_id uuid references uavs (id) on delete set null,
  -- Attached to whichever it was done for. A pre-flight check belongs to the
  -- request; a post-flight one to the log.
  flight_request_id uuid references flight_requests (id) on delete set null,
  flight_log_id uuid references flight_logs (id) on delete set null,
  completed_by uuid references profiles (id),
  completed_at timestamptz not null default now(),
  -- Derived at completion and stored, because it is a statement about what was
  -- true at that moment. Recomputing it later from a since-edited template
  -- would rewrite history.
  all_critical_passed boolean not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_checklist_completions_request on checklist_completions (flight_request_id);
create index idx_checklist_completions_log on checklist_completions (flight_log_id);
create index idx_checklist_completions_uav on checklist_completions (uav_id);

create table checklist_responses (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references checklist_completions (id) on delete cascade,
  item_id uuid not null references checklist_items (id) on delete restrict,
  checked boolean not null default false,
  comment text,
  unique (completion_id, item_id)
);

comment on column checklist_completions.all_critical_passed is
  'Whether every no-go item was satisfied, as judged when the check was '
  'completed. Stored rather than derived: the template may change afterwards, '
  'and this is a record of a moment, not a live calculation.';

-- ---------------------------------------------------------------------------
-- Templates stop changing once they have been used
--
-- Editing a list after a crew has signed it would silently change what they
-- appear to have checked. A used template can be deactivated and replaced, but
-- its items are fixed.
-- ---------------------------------------------------------------------------

create or replace function public.protect_used_checklist_items()
returns trigger
language plpgsql
as $$
declare
  v_template uuid;
begin
  v_template := coalesce(new.template_id, old.template_id);

  if exists (select 1 from checklist_completions c where c.template_id = v_template) then
    raise exception
      'This checklist has already been completed by a crew and cannot be changed. Deactivate it and create a new version.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger checklist_items_protect_used
  before insert or update or delete on checklist_items
  for each row execute function public.protect_used_checklist_items();

-- ---------------------------------------------------------------------------
-- Derived: what a completion amounts to
-- ---------------------------------------------------------------------------

create or replace view checklist_completion_summary
with (security_invoker = true) as
select
  c.id,
  c.template_id,
  t.name                                   as template_name,
  c.uav_id,
  u.drone_id,
  c.flight_request_id,
  c.flight_log_id,
  c.completed_by,
  p.full_name                              as completed_by_name,
  c.completed_at,
  c.all_critical_passed,
  c.notes,
  count(r.id)                              as item_count,
  count(r.id) filter (where r.checked)     as checked_count
from checklist_completions c
join checklist_templates t on t.id = c.template_id
left join uavs u on u.id = c.uav_id
left join profiles p on p.id = c.completed_by
left join checklist_responses r on r.completion_id = c.id
group by c.id, t.name, u.drone_id, p.full_name;

-- ---------------------------------------------------------------------------
-- Access
--
-- Templates are governed with the fleet they belong to; completing one is part
-- of flying, so it follows the flight-request permission a pilot already has.
-- ---------------------------------------------------------------------------

alter table checklist_templates enable row level security;
alter table checklist_items enable row level security;
alter table checklist_completions enable row level security;
alter table checklist_responses enable row level security;

create policy checklist_templates_select on checklist_templates
  for select to authenticated using (true);

create policy checklist_templates_manage on checklist_templates
  for all to authenticated
  using (public.can_manage('fleet'))
  with check (public.can_manage('fleet'));

create policy checklist_items_select on checklist_items
  for select to authenticated using (true);

create policy checklist_items_manage on checklist_items
  for all to authenticated
  using (public.can_manage('fleet'))
  with check (public.can_manage('fleet'));

create policy checklist_completions_select on checklist_completions
  for select to authenticated
  using (public.can_read_all('requests') or completed_by = auth.uid());

create policy checklist_completions_write on checklist_completions
  for all to authenticated
  using (public.can_create('requests') or public.can_manage('requests'))
  with check (public.can_create('requests') or public.can_manage('requests'));

create policy checklist_responses_select on checklist_responses
  for select to authenticated
  using (
    exists (
      select 1 from checklist_completions c
      where c.id = checklist_responses.completion_id
        and (public.can_read_all('requests') or c.completed_by = auth.uid())
    )
  );

create policy checklist_responses_write on checklist_responses
  for all to authenticated
  using (public.can_create('requests') or public.can_manage('requests'))
  with check (public.can_create('requests') or public.can_manage('requests'));

-- ---------------------------------------------------------------------------
-- Airspace authorisation on the request
--
-- NAV Drone is the single national platform for controlled-airspace
-- authorisation and publishes no developer API, so the portal records the
-- reference and its expiry rather than pretending to integrate.
-- ---------------------------------------------------------------------------

alter table flight_requests
  add column if not exists airspace_authorisation text,
  add column if not exists airspace_authorisation_expires date;

comment on column flight_requests.airspace_authorisation is
  'NAV Drone authorisation reference for controlled airspace. Entered by the '
  'requester after obtaining it; the portal links out rather than integrating, '
  'because NAV CANADA publishes no API for it.';
