-- ============================================================================
-- Outbound integrations: API keys and webhooks.
--
-- Two shapes of the same need. A BI tool pulls (a key and a read endpoint); a
-- Teams channel or a client's system wants to be pushed to (a webhook). Both
-- are read-only views of the portal — nothing external may write a flight, a
-- maintenance record or an approval, because a record with no person's name
-- against it is not a record anyone can be held to.
--
-- Keys are stored hashed. A copy of this database is therefore a list of what
-- exists, not a set of working credentials. The hint is the visible fragment
-- so a key can be recognised in a list without the secret being kept anywhere.
-- ============================================================================

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- SHA-256 of the secret. The secret itself is shown once and never stored.
  key_hash text not null unique,
  key_hint text not null,
  scopes access_area[] not null default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Written on every authenticated call. Deliberately coarse: the point is
  -- "is this key still in use", not an audit trail of every request.
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references profiles(id) on delete set null,
  constraint api_keys_name_not_blank check (btrim(name) <> ''),
  constraint api_keys_has_scopes check (revoked_at is not null or array_length(scopes, 1) > 0)
);

comment on table api_keys is
  'Read-only credentials for external systems. Secrets are stored only as a SHA-256 hash.';

create index if not exists api_keys_hash_idx on api_keys (key_hash) where revoked_at is null;

-- A key is a credential for the whole portal, so minting one is a user-
-- management act, not a fleet one.
alter table api_keys enable row level security;

create policy "api keys readable by user managers"
  on api_keys for select to authenticated
  using (public.can_manage('users'));

create policy "api keys writable by user managers"
  on api_keys for all to authenticated
  using (public.can_manage('users'))
  with check (public.can_manage('users'));

-- ---------------------------------------------------------------------------
-- Webhooks
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'webhook_event') then
    create type webhook_event as enum (
      'flight.logged',
      'flight_request.submitted',
      'flight_request.approved',
      'flight_request.rejected',
      'incident.reported',
      'maintenance.due',
      'maintenance.completed',
      'document.expiring',
      'certification.expiring'
    );
  end if;
end $$;

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  events webhook_event[] not null default '{}',
  -- Signs each delivery so the receiver can prove the payload came from here.
  -- Kept in clear because HMAC needs the secret at signing time; it is only
  -- ever readable by someone who could mint a new one anyway.
  signing_secret text not null,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint webhooks_url_is_https check (url ~* '^https://'),
  constraint webhooks_name_not_blank check (btrim(name) <> ''),
  constraint webhooks_has_events check (array_length(events, 1) > 0)
);

comment on constraint webhooks_url_is_https on webhooks is
  'Deliveries carry operational data. Plain HTTP would put it on the wire in clear.';

create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references webhooks(id) on delete cascade,
  event webhook_event not null,
  payload jsonb not null,
  -- Null until the attempt finishes. A row with no status is in flight.
  status_code integer,
  error text,
  attempted_at timestamptz not null default now(),
  duration_ms integer
);

comment on table webhook_deliveries is
  'Every attempt, successful or not. A silent integration is indistinguishable from a working one without this.';

create index if not exists webhook_deliveries_webhook_idx
  on webhook_deliveries (webhook_id, attempted_at desc);

alter table webhooks enable row level security;
alter table webhook_deliveries enable row level security;

create policy "webhooks readable by user managers"
  on webhooks for select to authenticated
  using (public.can_manage('users'));

create policy "webhooks writable by user managers"
  on webhooks for all to authenticated
  using (public.can_manage('users'))
  with check (public.can_manage('users'));

create policy "webhook deliveries readable by user managers"
  on webhook_deliveries for select to authenticated
  using (public.can_manage('users'));

-- Deliveries are written by the server on the service role, which bypasses
-- RLS. No insert policy exists on purpose: a delivery log an authenticated
-- user could forge would be worthless as evidence that a push happened.

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

-- Delivery logs grow with traffic and are only useful while recent. Called by
-- the weekly reminder job rather than a separate schedule.
create or replace function public.prune_webhook_deliveries(p_keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from webhook_deliveries
   where attempted_at < now() - make_interval(days => p_keep_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
