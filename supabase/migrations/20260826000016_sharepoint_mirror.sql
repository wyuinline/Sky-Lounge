-- ============================================================================
-- SharePoint mirror status.
--
-- The portal is the system of record; SharePoint holds a copy so people find
-- documents where they have always looked. These columns record whether that
-- copy exists and, when it does not, why — a mirror that fails silently is
-- indistinguishable from one that was never configured.
--
-- Restricted categories (regulatory, incident reports, ROC-A certificates) are
-- never mirrored: they are restricted here by RLS keyed to a role, and a
-- SharePoint library has its own permissions that someone else changes.
-- ============================================================================

alter table documents
  add column if not exists sharepoint_url text,
  add column if not exists sharepoint_path text,
  add column if not exists sharepoint_synced_at timestamptz,
  -- Null when the last attempt succeeded, or when none has been made.
  add column if not exists sharepoint_error text;

comment on column documents.sharepoint_error is
  'Why the last mirror attempt failed. Null means the last attempt succeeded or none was made.';

create index if not exists documents_sharepoint_pending_idx
  on documents (created_at desc)
  where sharepoint_synced_at is null;
