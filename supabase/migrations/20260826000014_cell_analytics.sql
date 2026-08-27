-- ============================================================================
-- Per-cell battery health.
--
-- The single most useful thing a flight log carries about a battery: a pack
-- fails one cell at a time, and the spread between the strongest and weakest
-- cell widens long before the pack stops holding charge. Airdata built a
-- product on this; it costs almost nothing once telemetry is parsed.
--
-- Recorded per flight, so the trend across a pack's flights is a query rather
-- than a stored figure that would need maintaining.
-- ============================================================================

alter table flight_logs
  add column if not exists cell_count integer
    check (cell_count is null or cell_count > 0),
  add column if not exists max_cell_spread numeric(5, 3)
    check (max_cell_spread is null or max_cell_spread >= 0),
  add column if not exists min_cell_voltage numeric(5, 3),
  add column if not exists max_cell_spread_at integer;

comment on column flight_logs.max_cell_spread is
  'Widest gap between the strongest and weakest cell during the flight, in '
  'volts. Above roughly 0.1 V under load the pack is worth watching; above '
  '0.3 V it should come out of service.';

-- ---------------------------------------------------------------------------
-- Cell health per pack, derived from the flights it flew
-- ---------------------------------------------------------------------------

create or replace view battery_cell_health
with (security_invoker = true) as
select
  b.id                                             as battery_id,
  b.battery_id                                     as battery_tag,
  b.status,
  count(f.id) filter (where f.max_cell_spread is not null) as flights_with_cell_data,
  max(f.max_cell_spread)                           as worst_spread,
  min(f.min_cell_voltage)                          as lowest_cell,
  max(f.flight_date) filter (where f.max_cell_spread is not null) as last_cell_reading,
  -- The most recent flight's spread, which is what matters now rather than
  -- the worst it ever managed.
  (
    select f2.max_cell_spread
    from flight_battery_usage u2
    join flight_logs f2 on f2.id = u2.flight_log_id
    where u2.battery_id = b.id and f2.max_cell_spread is not null
    order by f2.flight_date desc
    limit 1
  )                                                as latest_spread
from batteries b
left join flight_battery_usage u on u.battery_id = b.id
left join flight_logs f on f.id = u.flight_log_id
group by b.id, b.battery_id, b.status;

comment on view battery_cell_health is
  'Cell health per pack, derived from the flights it flew. Never stored — a '
  'health figure that has to be recomputed by hand is one that will be stale.';
