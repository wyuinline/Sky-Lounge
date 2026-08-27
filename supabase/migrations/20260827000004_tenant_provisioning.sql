-- ============================================================================
-- Provisioning an organisation, and the guards that are now per-operator.
--
-- Three things were written when there was only ever one operator, and each is
-- wrong in a way that only shows up with two.
--
-- 1. The signup trigger created a profile with no organisation. With the column
--    now not null, every invitation would fail at the moment of acceptance.
--
-- 2. "At least one role must keep full access to users" was checked across the
--    whole table, so a second operator could lock themselves out entirely and
--    the check would still pass on the strength of somebody else's row.
--
-- 3. A new operator would arrive to an empty permissions matrix and no document
--    review policy — every role holding no access to anything, including the
--    one they were invited as.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- What a new operator starts with
-- ---------------------------------------------------------------------------

/*
 * The defaults, held once rather than written into the provisioning function.
 *
 * A table rather than a hard-coded list because what a new operator should
 * start with is a product decision that will be revisited, and revisiting it
 * should not mean a migration.
 */
create table if not exists role_permission_defaults (
  role user_role not null,
  area access_area not null,
  level access_level not null,
  primary key (role, area)
);

create table if not exists document_review_defaults (
  category document_category primary key,
  review_interval_months integer,
  rationale text
);

comment on table role_permission_defaults is
  'The permissions matrix a newly provisioned organisation starts from. Changing it affects future organisations, never existing ones.';

-- Seeded from the matrix the first operator is already running, which is the
-- one that has actually been used in anger.
insert into role_permission_defaults (role, area, level)
select role, area, level from role_permissions
 where organisation_id = (select id from organisations where slug = 'inline-group')
on conflict (role, area) do nothing;

insert into document_review_defaults (category, review_interval_months, rationale)
select category, review_interval_months, rationale from document_review_policy
 where organisation_id = (select id from organisations where slug = 'inline-group')
on conflict (category) do nothing;

alter table role_permission_defaults enable row level security;
alter table document_review_defaults enable row level security;

-- Readable by anyone signed in — it is the product's own configuration, not
-- anybody's operational data — and writable by nobody through the API.
create policy "defaults readable" on role_permission_defaults
  for select to authenticated using (true);
create policy "review defaults readable" on document_review_defaults
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Provisioning
-- ---------------------------------------------------------------------------

/*
 * Creates an organisation with everything it needs to be usable.
 *
 * security definer because it writes rows for an organisation the caller does
 * not yet belong to, which every policy in the schema is built to prevent. The
 * platform-admin check inside is what stands in for those policies, and it is
 * the only place in the schema that is allowed to reach across the line.
 */
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

  -- Without these the organisation exists but nobody in it can do anything,
  -- including the administrator who was just invited to run it.
  insert into role_permissions (organisation_id, role, area, level)
  select new_org, role, area, level from role_permission_defaults;

  insert into document_review_policy (organisation_id, category, review_interval_months, rationale)
  select new_org, category, review_interval_months, rationale from document_review_defaults;

  return new_org;
end;
$$;

revoke all on function public.provision_organisation(text, text, text, text) from public;
grant execute on function public.provision_organisation(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Signup carries the organisation
-- ---------------------------------------------------------------------------

/*
 * A profile is created when an invited person accepts.
 *
 * The organisation comes from the invitation's user metadata, stamped there by
 * whoever sent it. There is deliberately no fallback: a signup that cannot say
 * which operator it belongs to must fail loudly at the moment of signup rather
 * than quietly produce an account attached to the wrong fleet.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_org uuid;
begin
  begin
    meta_org := (new.raw_user_meta_data ->> 'organisation_id')::uuid;
  exception when others then
    meta_org := null;
  end;

  if meta_org is null or not exists (select 1 from organisations where id = meta_org) then
    raise exception 'A new account must name the organisation it belongs to'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, full_name, email, organisation_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    meta_org
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The lockout guard, per operator
-- ---------------------------------------------------------------------------

/*
 * Refuses any change that would leave an organisation with nobody able to
 * manage users, or nobody able to edit its own matrix. Either is a lockout
 * that needs a database console to undo.
 *
 * Checks every organisation rather than only the caller's: this is a statement
 * trigger with no view of which rows moved, and an operator whose matrix is
 * edited by a migration deserves the same protection as one editing it by hand.
 */
create or replace function public.keep_one_user_manager()
returns trigger
language plpgsql
as $$
declare
  offending record;
begin
  for offending in
    select o.id, o.name, v.area
      from organisations o
      cross join unnest(array['users','permissions']::access_area[]) as v(area)
     where o.active
       and not exists (
         select 1 from role_permissions rp
          where rp.organisation_id = o.id
            and rp.area = v.area
            and rp.level = 'full'
       )
  loop
    raise exception '% would be left with no role holding full access to %',
      offending.name, offending.area
      using errcode = 'check_violation';
  end loop;
  return null;
end;
$$;
