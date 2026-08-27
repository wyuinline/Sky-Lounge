-- ============================================================================
-- Organisations: the portal becomes a product.
--
-- Until now every row belonged to one operator by assumption. From here it
-- belongs to one by construction: an organisation owns its aircraft, crew,
-- flights, documents and audit trail, and no query, view, API key or webhook
-- can reach across that line.
--
-- The design rests on three decisions.
--
-- 1. One database, one organisation_id column on every table, and RLS keyed to
--    the caller's organisation. Schema-per-tenant would isolate more strongly
--    but makes every migration an N-times operation and every cross-tenant
--    question impossible; for a fleet-management portal the RLS boundary is
--    the right trade.
--
-- 2. There is no platform-admin escape hatch in domain RLS. Someone who runs
--    the platform can create organisations and invite their first
--    administrator, and that is all — they cannot read an operator's incident
--    reports by flipping a boolean. Cross-organisation work happens on
--    dedicated screens through the service role, deliberately and visibly.
--
-- 3. organisation_id defaults to the caller's organisation at the database.
--    Application code does not set it, cannot forge it (the with-check clause
--    refuses a mismatch), and cannot forget it (the column is not null).
-- ============================================================================

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- What appears on a report or an evidence pack, which is not always the
  -- name people use day to day.
  legal_name text,
  -- Stable, human-readable, and used in storage paths, so it may not change
  -- shape once files exist under it.
  slug text not null unique,

  -- The operator certificate this organisation flies under, printed on the
  -- evidence pack. Null until they hold one.
  rpoc_number text,
  contact_email text,
  contact_phone text,

  -- Branding. A firm that hands this portal to its own clients needs it to
  -- look like theirs.
  logo_path text,
  accent_colour text,

  active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint organisations_name_not_blank check (btrim(name) <> ''),
  constraint organisations_slug_shape check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  -- Six-digit hex only. The value is interpolated into a CSS custom property,
  -- so anything else would be a stylesheet injection through a text field.
  constraint organisations_accent_is_hex check (
    accent_colour is null or accent_colour ~* '^#[0-9a-f]{6}$'
  )
);

comment on table organisations is
  'One operator. Owns every row in the portal that is not platform infrastructure.';
comment on constraint organisations_accent_is_hex on organisations is
  'The colour is interpolated into a CSS custom property; free text here would be a stylesheet injection.';

-- ---------------------------------------------------------------------------
-- People belong to exactly one organisation
-- ---------------------------------------------------------------------------

alter table profiles
  add column if not exists organisation_id uuid references organisations(id) on delete restrict,
  -- Platform administration is not a role inside an organisation: it crosses
  -- them, so it cannot live in the per-organisation permissions matrix.
  add column if not exists is_platform_admin boolean not null default false;

comment on column profiles.is_platform_admin is
  'Runs the platform: may create organisations and invite their first administrator. Grants no access to any organisation''s operational data.';

-- The composite key every child table''s foreign key points at, so a row can
-- never reference a person in another organisation.
create unique index if not exists profiles_id_org_key on profiles (id, organisation_id);

-- ---------------------------------------------------------------------------
-- The first organisation
-- ---------------------------------------------------------------------------

/*
 * Inline Group becomes tenant one, and every existing row is theirs.
 *
 * Done in a DO block rather than a plain insert because the backfill below
 * needs the id, and because re-running this migration must not create a second
 * Inline Group.
 */
do $$
declare
  first_org uuid;
begin
  select id into first_org from organisations where slug = 'inline-group';

  if first_org is null then
    insert into organisations (name, legal_name, slug, accent_colour)
    values ('Inline Group', 'Inline Group Inc.', 'inline-group', '#c4e86c')
    returning id into first_org;
  end if;

  -- Every profile that predates organisations belongs to them.
  update profiles set organisation_id = first_org where organisation_id is null;

  -- Whoever already holds system_admin runs the platform, since they are the
  -- only person who could have set this up.
  update profiles set is_platform_admin = true
   where role = 'system_admin' and not is_platform_admin;
end $$;

alter table profiles alter column organisation_id set not null;

-- ---------------------------------------------------------------------------
-- Helpers every policy is built on
-- ---------------------------------------------------------------------------

/*
 * The caller's organisation.
 *
 * security definer because a policy on profiles cannot read profiles without
 * recursing, and stable so Postgres calls it once per statement rather than
 * once per row — this appears in every policy in the schema.
 */
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from profiles where id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$;

/*
 * Whether a row belongs to the caller.
 *
 * Written as a function rather than inlined so the rule has exactly one
 * definition. A null organisation on the caller — a profile row that somehow
 * predates this migration — matches nothing, which fails closed.
 */
create or replace function public.owns_row(p_org uuid)
returns boolean
language sql
stable
as $$
  select p_org is not null and p_org = public.current_org_id();
$$;

-- ---------------------------------------------------------------------------
-- Who may see and change organisations
-- ---------------------------------------------------------------------------

alter table organisations enable row level security;

-- Everyone reads their own, so the portal can put its name and colours on the
-- page. Platform administrators read all of them, which is what makes the
-- organisation list possible.
create policy "organisations readable by their members"
  on organisations for select to authenticated
  using (id = public.current_org_id() or public.is_platform_admin());

-- An organisation's own administrator may change its name, branding and
-- certificate number — but not create, delete, or deactivate one.
create policy "organisations editable by their user managers"
  on organisations for update to authenticated
  using (id = public.current_org_id() and public.can_manage('users'))
  with check (id = public.current_org_id() and public.can_manage('users'));

create policy "organisations created by platform admins"
  on organisations for insert to authenticated
  with check (public.is_platform_admin());

-- Deliberately no delete policy. An organisation with flight records is a
-- legal record for someone; deactivating is the reversible act, and removing
-- one is a deliberate operation through the service role.
