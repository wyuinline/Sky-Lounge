-- ============================================================================
-- Operations manuals.
--
-- The document module already carries the substance: categories, versions,
-- approval status, review cycles. What a reviewer asks for is the *binding* —
-- a numbered manual with a contents page, where section 4.3 is always section
-- 4.3 and can be cited in a finding.
--
-- So a manual is a tree of sections over the documents that already exist. A
-- section either points at a document, which stays versioned in its own
-- library, or carries its own text for the narrative parts a manual needs
-- ("1.2 Scope") that are not SOPs in their own right.
--
-- Section numbers are derived from position, never stored. A stored "4.3" is a
-- number that stays 4.3 after someone inserts a section above it, and a manual
-- whose contents page disagrees with its own headings is worse than no manual.
-- ============================================================================

create table if not exists manuals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- The revision people cite. Free text because operators number revisions
  -- their own way — "Rev 3", "2026-A", "Issue 2 Amendment 1".
  revision text not null default '1',
  effective_date date,
  -- Reuses the workflow the document module already has, so a manual and the
  -- documents inside it are approved through the same states.
  approval_status document_workflow_status not null default 'draft',
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manuals_title_not_blank check (btrim(title) <> '')
);

comment on table manuals is
  'A bound, numbered manual over the documents already in the library. Section numbers are derived from position.';

create table if not exists manual_sections (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references manuals(id) on delete cascade,
  -- Null for a top-level section. One level of nesting is enough for an
  -- operations manual; deeper trees are how contents pages become unreadable.
  parent_id uuid references manual_sections(id) on delete cascade,
  heading text not null,
  -- A section is either a pointer to a document or a piece of narrative. Both
  -- may be empty for a heading that only groups its children.
  document_id uuid references documents(id) on delete set null,
  body text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint manual_sections_heading_not_blank check (btrim(heading) <> ''),
  -- A section pointing at a document and also carrying its own text is two
  -- sources for one section, and they will disagree.
  constraint manual_sections_one_source check (document_id is null or body is null)
);

comment on constraint manual_sections_one_source on manual_sections is
  'A section points at a document or carries its own text, never both — two sources for one section will disagree.';

create index if not exists manual_sections_tree_idx
  on manual_sections (manual_id, parent_id, sort_order);

/*
 * A section's parent must belong to the same manual.
 *
 * Not expressible as a foreign key, and worth enforcing: a cross-manual parent
 * makes a section appear in one manual's tree while its children are counted
 * in another's, and the contents page silently loses them.
 */
create or replace function public.manual_section_parent_matches()
returns trigger
language plpgsql
as $$
declare
  parent_manual uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select manual_id into parent_manual from manual_sections where id = new.parent_id;

  if parent_manual is null or parent_manual <> new.manual_id then
    raise exception 'A section''s parent must belong to the same manual.';
  end if;

  if new.parent_id = new.id then
    raise exception 'A section cannot be its own parent.';
  end if;

  return new;
end;
$$;

drop trigger if exists manual_section_parent_matches_trigger on manual_sections;
create trigger manual_section_parent_matches_trigger
  before insert or update on manual_sections
  for each row execute function public.manual_section_parent_matches();

-- ---------------------------------------------------------------------------
-- Derived contents
-- ---------------------------------------------------------------------------

/*
 * Every section with its derived number and the document it points at.
 *
 * Numbering walks the tree in sort order: top-level sections get 1, 2, 3 and
 * children get 1.1, 1.2. Because it is derived, inserting a section renumbers
 * everything below it — which is what a reader expects and what a stored
 * number can never do.
 */
create or replace view manual_contents
with (security_invoker = true)
as
with recursive numbered as (
  select
    s.id,
    s.manual_id,
    s.parent_id,
    s.heading,
    s.document_id,
    s.body,
    s.sort_order,
    1 as depth,
    row_number() over (partition by s.manual_id order by s.sort_order, s.heading)::text as number,
    lpad(row_number() over (partition by s.manual_id order by s.sort_order, s.heading)::text, 4, '0')
      as sort_path
  from manual_sections s
  where s.parent_id is null

  union all

  select
    c.id,
    c.manual_id,
    c.parent_id,
    c.heading,
    c.document_id,
    c.body,
    c.sort_order,
    n.depth + 1,
    n.number || '.' || row_number() over (partition by c.parent_id order by c.sort_order, c.heading)::text,
    n.sort_path || '.' ||
      lpad(row_number() over (partition by c.parent_id order by c.sort_order, c.heading)::text, 4, '0')
  from manual_sections c
  join numbered n on n.id = c.parent_id
)
select
  n.id                                  as section_id,
  n.manual_id,
  n.parent_id,
  n.number                              as section_number,
  n.heading,
  n.depth,
  n.sort_order,
  n.sort_path,
  n.body,
  n.document_id,
  d.title                               as document_title,
  d.category                            as document_category,
  d.version                             as document_version,
  d.approval_status                     as document_approval_status,
  d.effective_date                      as document_effective_date,
  d.storage_path                        as document_storage_path
from numbered n
left join documents d on d.id = n.document_id;

comment on view manual_contents is
  'Sections with numbers derived from position. Order by sort_path to read the manual front to back.';

/*
 * One row per manual, for the list: how big it is and whether it is complete.
 *
 * "Empty sections" counts headings that neither point at a document nor carry
 * text and have no children — a gap in the manual rather than a grouping
 * heading, and exactly what a reviewer finds first.
 */
create or replace view manual_summary
with (security_invoker = true)
as
select
  m.id,
  m.title,
  m.revision,
  m.effective_date,
  m.approval_status,
  m.description,
  m.created_at,
  m.updated_at,
  coalesce(c.section_count, 0)      as section_count,
  coalesce(c.document_count, 0)     as document_count,
  coalesce(c.empty_count, 0)        as empty_section_count
from manuals m
left join (
  select
    s.manual_id,
    count(*)                                                as section_count,
    count(s.document_id)                                    as document_count,
    count(*) filter (
      where s.document_id is null
        and (s.body is null or btrim(s.body) = '')
        and not exists (select 1 from manual_sections k where k.parent_id = s.id)
    )                                                       as empty_count
  from manual_sections s
  group by s.manual_id
) c on c.manual_id = m.id;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table manuals enable row level security;
alter table manual_sections enable row level security;

create policy "manuals readable"
  on manuals for select to authenticated
  using (public.can_read_all('docs_general'));

create policy "manuals writable by document managers"
  on manuals for all to authenticated
  using (public.can_manage('docs_general'))
  with check (public.can_manage('docs_general'));

create policy "manual sections readable"
  on manual_sections for select to authenticated
  using (public.can_read_all('docs_general'));

create policy "manual sections writable by document managers"
  on manual_sections for all to authenticated
  using (public.can_manage('docs_general'))
  with check (public.can_manage('docs_general'));
