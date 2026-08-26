-- ============================================================================
-- Splitting "manage users" from "rewrite the access model".
--
-- UAV Administrator needs to invite people and set their role. It does not
-- follow that they should be able to edit the permission matrix itself — that
-- is the platform owner's job, and one cell away from granting themselves
-- anything.
--
-- So 'users' now means the day-to-day work (invite, enable, disable, assign a
-- role, link a pilot record) and a new 'permissions' area means editing the
-- matrix. System Administrator keeps both.
-- ============================================================================

alter type access_area add value if not exists 'permissions';

comment on type access_area is
  'A part of the portal that permissions are granted over. "users" is the '
  'day-to-day account work; "permissions" is editing this matrix, which is '
  'deliberately narrower.';
