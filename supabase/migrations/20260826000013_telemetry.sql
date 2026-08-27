-- ============================================================================
-- Flight telemetry.
--
-- The scoping spike, recorded here because the decision matters more than the
-- code: DJI flight records from version 13 are AES encrypted and need a
-- keychain fetched from DJI's API with a registered developer key, and the
-- mature parser is a Rust crate needing a WASM build or a sidecar. The
-- enterprise route, DJI Cloud API over MQTT, works for the Matrice 350 but
-- requires a FlightHub 2 subscription.
--
-- Both are real and neither is worth carrying for two airframes. Every one of
-- those tools exports CSV, and so do ArduPilot and PX4 — so the portal ingests
-- CSV and recognises columns by name.
--
-- The raw file goes to storage; the summary and a downsampled track are stored
-- here. Putting every 10 Hz sample in Postgres would mean a hundred thousand
-- rows per flight to answer questions that a summary answers directly.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('flight-telemetry', 'flight-telemetry', false)
on conflict (id) do nothing;

alter table flight_logs
  add column if not exists telemetry_path text,
  add column if not exists telemetry_source text,
  add column if not exists telemetry_imported_at timestamptz,
  add column if not exists telemetry_sample_count integer,
  -- Derived from the track, so these are what the flight actually did rather
  -- than what someone typed. max_altitude_m already exists and is filled from
  -- the import when it is blank.
  add column if not exists telemetry_max_speed_ms numeric(6, 2),
  add column if not exists telemetry_max_distance_m numeric(9, 1),
  add column if not exists telemetry_track_length_m numeric(10, 1),
  add column if not exists battery_start_percent integer
    check (battery_start_percent is null or battery_start_percent between 0 and 100),
  add column if not exists battery_end_percent integer
    check (battery_end_percent is null or battery_end_percent between 0 and 100),
  add column if not exists min_voltage numeric(5, 2),
  add column if not exists min_satellites integer,
  -- Downsampled track: [{t, lat, lon, altitude}, ...]. Enough to draw and to
  -- prove where the aircraft went, without the full sample rate.
  add column if not exists telemetry_track jsonb;

comment on column flight_logs.telemetry_track is
  'Downsampled flight track as JSON. The full-rate file stays in storage; this '
  'is what the plot and any printed report draw from.';

comment on column flight_logs.telemetry_source is
  'Where the file came from, as the importer identified it — DJI, ArduPilot, '
  'or a generic CSV. Recorded so a later re-parse knows what it is looking at.';

-- ---------------------------------------------------------------------------
-- Storage access mirrors the flight log itself
-- ---------------------------------------------------------------------------

create policy "telemetry read" on storage.objects for select to authenticated
  using (bucket_id = 'flight-telemetry' and public.can_read_all('logs'));

create policy "telemetry write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'flight-telemetry'
    and (public.can_create('logs') or public.can_manage('logs'))
  );

create policy "telemetry delete" on storage.objects for delete to authenticated
  using (bucket_id = 'flight-telemetry' and public.can_manage('logs'));
