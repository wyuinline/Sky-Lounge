-- ============================================================================
-- Recorded weather, not remembered weather.
--
-- flight_logs.weather_conditions is free text: it records what somebody typed,
-- which may be accurate and cannot be checked. A METAR records what was
-- observed at a named aerodrome at a named time, and that difference is what
-- makes it evidence.
--
-- The free-text field stays — a crew note about conditions at the site is
-- worth having, and the nearest aerodrome can be twenty kilometres away.
-- ============================================================================

alter table flight_logs
  -- ICAO identifier of the reporting aerodrome.
  add column if not exists weather_station text,
  add column if not exists weather_observed_at timestamptz,
  add column if not exists wind_direction_deg integer
    check (wind_direction_deg is null or wind_direction_deg between 0 and 360),
  add column if not exists wind_speed_kt integer
    check (wind_speed_kt is null or wind_speed_kt >= 0),
  add column if not exists temperature_c numeric(4, 1),
  add column if not exists visibility_sm numeric(5, 1)
    check (visibility_sm is null or visibility_sm >= 0),
  add column if not exists flight_category text
    check (flight_category is null or flight_category in ('VFR', 'MVFR', 'IFR', 'LIFR')),
  -- The report verbatim. Parsed fields are a convenience; this is the record.
  add column if not exists weather_raw text;

comment on column flight_logs.weather_raw is
  'The METAR verbatim, as issued. Parsed columns beside it are for reporting '
  'and filtering; this is what was actually published.';

comment on column flight_logs.wind_direction_deg is
  'Null for variable wind. Recording variable as 0 would claim a northerly.';
