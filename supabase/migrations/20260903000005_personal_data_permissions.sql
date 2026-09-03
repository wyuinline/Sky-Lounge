-- ============================================================================
-- Who may see restricted personal data.
--
-- Nobody, by default. The area exists and every role holds nothing in it until
-- an operator deliberately grants it — which is the right default for date of
-- birth and immigration status, and the wrong one for almost anything else.
--
-- The exception is the system administrator, who would otherwise be unable to
-- grant it to anyone: a permission nobody can turn on is a permission that
-- does not exist.
-- ============================================================================

insert into role_permissions (organisation_id, role, area, level)
select o.id, r.role, 'personal_data'::access_area,
       case when r.role = 'system_admin' then 'full' else 'none' end::access_level
  from organisations o
  cross join (select unnest(enum_range(null::user_role)) as role) r
on conflict (organisation_id, role, area) do nothing;

-- And for every operator provisioned from here on.
insert into role_permission_defaults (role, area, level)
select r.role, 'personal_data'::access_area,
       case when r.role = 'system_admin' then 'full' else 'none' end::access_level
  from (select unnest(enum_range(null::user_role)) as role) r
on conflict (role, area) do nothing;
