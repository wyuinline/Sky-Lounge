-- ============================================================================
-- Tenant-scoped storage.
--
-- RLS on the tables was only ever half the boundary. A document row is scoped
-- to its organisation, but the file it points at lives in a shared bucket keyed
-- by path — and a path is guessable in a way a row is not. Until now any signed
-- in user with docs_general could have read any operator's SOP by asking for
-- the right object name.
--
-- So every object path now begins with the organisation's id, and every policy
-- requires that first segment to match the caller's. The application builds the
-- prefix; the database is what enforces it, because an application that forgets
-- is exactly the failure this is guarding against.
--
-- The ROC-A rule is the one that changes shape: a pilot may read their own
-- certificate, and their id used to be the first path segment. It is now the
-- second, behind the organisation.
-- ============================================================================

/*
 * The organisation a path claims to belong to.
 *
 * A function rather than an inlined expression so that "the first segment is
 * the organisation" has one definition, and so the ROC-A policy below can talk
 * about the second segment without repeating the parsing.
 */
create or replace function public.storage_path_org(p_name text)
returns text
language sql
immutable
as $$
  select (storage.foldername(p_name))[1];
$$;

create or replace function public.storage_path_owns(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.storage_path_org(p_name) = public.current_org_id()::text;
$$;

comment on function public.storage_path_owns is
  'Whether an object path begins with the caller''s organisation. The whole of storage tenancy rests on this.';

-- ---------------------------------------------------------------------------
-- Existing objects move under their organisation
-- ---------------------------------------------------------------------------

/*
 * Every object that predates this belongs to the first tenant, so its name
 * gains that prefix. Renaming the row is enough — Supabase Storage addresses
 * objects by name, and the metadata row is the name.
 *
 * Guarded on the prefix so re-running cannot double it.
 */
do $$
declare
  first_org text;
begin
  select id::text into first_org from organisations where slug = 'inline-group';

  update storage.objects
     set name = first_org || '/' || name
   where bucket_id in (
           'sops', 'policies', 'flight-manuals', 'maintenance-manuals',
           'regulatory-documents', 'incident-reports', 'training-materials',
           'safety-documents', 'roc-a-certificates', 'flight-telemetry'
         )
     and name not like first_org || '/%';
end $$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists "documents_storage_read" on storage.objects;
create policy "documents_storage_read"
  on storage.objects for select to authenticated
  using (
    public.storage_path_owns(name)
    and case
      when bucket_id = 'roc-a-certificates' then
        public.can_read_all('roc_a')
        or (
          public.can_read_own('roc_a')
          -- Second segment now: the organisation took the first.
          and (storage.foldername(name))[2] in (
            select p.id::text from pilots p where p.profile_id = auth.uid()
          )
        )
      when bucket_id in ('regulatory-documents', 'incident-reports') then
        public.can_read_all('docs_restricted')
      else public.can_read_all('docs_general')
    end
  );

drop policy if exists "documents_storage_write" on storage.objects;
create policy "documents_storage_write"
  on storage.objects for all to authenticated
  using (
    public.storage_path_owns(name)
    and case
      when bucket_id = 'roc-a-certificates' then public.can_manage('roc_a')
      when bucket_id in ('regulatory-documents', 'incident-reports') then
        public.can_manage('docs_restricted')
      else public.can_manage('docs_general')
    end
  )
  with check (
    public.storage_path_owns(name)
    and case
      when bucket_id = 'roc-a-certificates' then public.can_manage('roc_a')
      when bucket_id in ('regulatory-documents', 'incident-reports') then
        public.can_manage('docs_restricted')
      else public.can_manage('docs_general')
    end
  );

drop policy if exists "telemetry read" on storage.objects;
create policy "telemetry read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'flight-telemetry'
    and public.storage_path_owns(name)
    and public.can_read_all('logs')
  );

drop policy if exists "telemetry write" on storage.objects;
create policy "telemetry write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'flight-telemetry'
    and public.storage_path_owns(name)
    and (public.can_create('logs') or public.can_manage('logs'))
  );

drop policy if exists "telemetry delete" on storage.objects;
create policy "telemetry delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'flight-telemetry'
    and public.storage_path_owns(name)
    and public.can_manage('logs')
  );

-- ---------------------------------------------------------------------------
-- Organisation logos
-- ---------------------------------------------------------------------------

-- Public, deliberately: a logo appears in the portal chrome on every page, and
-- a signed URL per request for a decorative image is a round trip for nothing.
-- Nothing confidential goes in this bucket.
insert into storage.buckets (id, name, public)
values ('organisation-logos', 'organisation-logos', true)
on conflict (id) do nothing;

drop policy if exists "logos readable by anyone" on storage.objects;
create policy "logos readable by anyone"
  on storage.objects for select to public
  using (bucket_id = 'organisation-logos');

drop policy if exists "logos writable by their organisation" on storage.objects;
create policy "logos writable by their organisation"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'organisation-logos'
    and public.storage_path_owns(name)
    and public.can_manage('users')
  )
  with check (
    bucket_id = 'organisation-logos'
    and public.storage_path_owns(name)
    and public.can_manage('users')
  );
