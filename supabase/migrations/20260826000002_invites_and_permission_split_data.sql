-- ============================================================================
-- Uses the 'permissions' area added in the previous migration.
--
-- Separate file because Postgres refuses to use a new enum value in the same
-- transaction that added it, and each migration file runs in its own.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed the new area, and give UAV Administrator day-to-day user management
-- ---------------------------------------------------------------------------

insert into role_permissions (role, area, level) values
  ('system_admin','permissions','full'),
  ('uav_admin','permissions','none'),
  ('uav_lead','permissions','none'),
  ('auditor','permissions','none'),
  ('pilot','permissions','none'),
  ('read_only','permissions','none')
on conflict (role, area) do nothing;

-- Asked for explicitly: UAV Administrator invites people and sets their role.
-- They still cannot edit the matrix above, which is the point of the split.
update role_permissions
   set level = 'full'
 where role = 'uav_admin' and area = 'users';

-- ---------------------------------------------------------------------------
-- 2. Editing the matrix now requires the narrower permission
-- ---------------------------------------------------------------------------

drop policy if exists role_permissions_write on role_permissions;

create policy role_permissions_write on role_permissions for all to authenticated
  using (public.can_manage('permissions'))
  with check (public.can_manage('permissions'));

-- ---------------------------------------------------------------------------
-- 3. Guards
-- ---------------------------------------------------------------------------

/**
 * Refuses any change that would leave nobody able to manage users, or nobody
 * able to edit this matrix. Either one is a lockout that needs a database
 * console to undo.
 */
create or replace function public.keep_one_user_manager()
returns trigger
language plpgsql
as $$
declare
  v_area access_area;
begin
  foreach v_area in array array['users','permissions']::access_area[] loop
    if not exists (
      select 1 from role_permissions
       where area = v_area and level = 'full'
    ) then
      raise exception 'At least one role must keep full access to %', v_area
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

/**
 * Nobody edits their own role.
 *
 * Now that UAV Administrator can assign roles, self-promotion would be a one
 * click path to System Administrator — and from there to the permission matrix
 * itself. Changing someone else's role is still allowed; changing your own
 * never is, whatever you hold.
 */
create or replace function public.enforce_role_change_is_admin_only()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role'
        using errcode = 'insufficient_privilege';
    end if;

    if not public.can_manage('users') then
      raise exception 'You do not have permission to change a user role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
