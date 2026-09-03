-- ============================================================================
-- How close the flight goes to people.
--
-- The declaration matrix distinguishes three cases, and the portal could only
-- express two. CAR 901.69 separates "near people" — under 30 m but over 5 m,
-- needing a 922.05 declaration — from "over people" under 5 m, needing 922.06.
-- A single is_over_people boolean collapses the middle case into "away", and
-- the aircraft would be cleared for a declaration it does not hold.
--
-- The existing boolean stays and keeps working: "over" implies the boolean,
-- and a flight recorded before this migration keeps whatever it said.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'people_proximity') then
    create type people_proximity as enum ('away', 'near', 'over');
  end if;
end $$;

alter table flight_requests
  add column if not exists proximity_to_people people_proximity not null default 'away';

alter table flight_logs
  add column if not exists proximity_to_people people_proximity not null default 'away';

-- Anything already marked as over people is exactly that.
update flight_logs set proximity_to_people = 'over'
 where is_over_people and proximity_to_people = 'away';

comment on column flight_logs.proximity_to_people is
  'CAR 901.69: away, near (under 30 m, over 5 m) or over (under 5 m). Decides which manufacturer declaration the aircraft must hold.';
