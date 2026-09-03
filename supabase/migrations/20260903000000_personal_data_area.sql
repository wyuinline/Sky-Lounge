-- ============================================================================
-- A permission area for restricted personal data.
--
-- Date of birth and work-authorization status are sensitive personal
-- information under PIPEDA. They are needed — the age gates (16 for Advanced,
-- 18 for Level 1 Complex) and the work-permit expiry alert both depend on them
-- — but they must not sit behind the same permission as a pilot's flight hours.
--
-- Its own area, in its own migration, because Postgres will not let a new enum
-- value be used in the same transaction that adds it.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'access_area' and e.enumlabel = 'personal_data'
  ) then
    alter type access_area add value 'personal_data';
  end if;
end $$;
