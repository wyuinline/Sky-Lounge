-- ============================================================================
-- Policies driven by role_permissions.
--
-- Every rule below asks the permission table rather than naming roles, so
-- editing the matrix in the portal changes what the database actually allows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- role_permissions itself: readable by everyone signed in, writable only by a
-- role that can manage users. It has to be readable so the portal can show
-- people what they are allowed to do.
-- ---------------------------------------------------------------------------

alter table role_permissions enable row level security;

create policy role_permissions_select on role_permissions for select to authenticated
  using (true);

create policy role_permissions_write on role_permissions for all to authenticated
  using (public.can_manage('users'))
  with check (public.can_manage('users'));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_all on profiles for select to authenticated
  using (true);

create policy profiles_manage on profiles for all to authenticated
  using (public.can_manage('users'))
  with check (public.can_manage('users'));

-- Own row stays editable; the role column is guarded by its own trigger.
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fleet and servicing
-- ---------------------------------------------------------------------------

create policy uavs_select on uavs for select to authenticated
  using (public.can_read_all('fleet'));

create policy uavs_manage on uavs for all to authenticated
  using (public.can_manage('fleet'))
  with check (public.can_manage('fleet'));

create policy maintenance_select on maintenance_records for select to authenticated
  using (public.can_read_all('maintenance'));

create policy maintenance_manage on maintenance_records for all to authenticated
  using (public.can_manage('maintenance'))
  with check (public.can_manage('maintenance'));

-- ---------------------------------------------------------------------------
-- Crew and training — 'own' means the record linked to this account
-- ---------------------------------------------------------------------------

create policy pilots_select on pilots for select to authenticated
  using (
    public.can_read_all('pilots')
    or (public.can_read_own('pilots') and profile_id = auth.uid())
  );

create policy pilots_manage on pilots for all to authenticated
  using (public.can_manage('pilots'))
  with check (public.can_manage('pilots'));

create policy training_select on training_records for select to authenticated
  using (
    public.can_read_all('training')
    or (
      public.can_read_own('training')
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

create policy training_manage on training_records for all to authenticated
  using (public.can_manage('training'))
  with check (public.can_manage('training'));

-- ---------------------------------------------------------------------------
-- Flight operations
--
-- 'create' lets a pilot file their own request or log but not approve one;
-- approving is an update, which needs 'full'.
-- ---------------------------------------------------------------------------

create policy flight_requests_select on flight_requests for select to authenticated
  using (
    public.can_read_all('requests')
    or (
      public.can_read_own('requests')
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

create policy flight_requests_insert on flight_requests for insert to authenticated
  with check (
    public.can_manage('requests')
    or (
      public.can_create('requests')
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

create policy flight_requests_update on flight_requests for update to authenticated
  using (public.can_manage('requests'))
  with check (public.can_manage('requests'));

create policy flight_logs_select on flight_logs for select to authenticated
  using (
    public.can_read_all('logs')
    or (
      public.can_read_own('logs')
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

create policy flight_logs_insert on flight_logs for insert to authenticated
  with check (
    public.can_manage('logs')
    or (
      public.can_create('logs')
      and pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Incidents
--
-- Reporting is intentionally the widest permission in the system: anyone who
-- can create may file one, anonymously if they choose.
-- ---------------------------------------------------------------------------

create policy incidents_select on incidents for select to authenticated
  using (
    public.can_read_all('incidents')
    or pilot_id in (select id from pilots where profile_id = auth.uid())
    or reported_by = auth.uid()
  );

create policy incidents_insert on incidents for insert to authenticated
  with check (
    public.can_create('incidents')
    and (
      pilot_id is null
      or public.can_manage('incidents')
      or pilot_id in (select id from pilots where profile_id = auth.uid())
    )
  );

create policy incidents_update on incidents for update to authenticated
  using (public.can_manage('incidents'))
  with check (public.can_manage('incidents'));

-- ---------------------------------------------------------------------------
-- Audits
-- ---------------------------------------------------------------------------

create policy audits_select on audits for select to authenticated
  using (public.can_read_all('audits'));

create policy audits_manage on audits for all to authenticated
  using (public.can_manage('audits'))
  with check (public.can_manage('audits'));

create policy audit_findings_select on audit_findings for select to authenticated
  using (public.can_read_all('audits'));

create policy audit_findings_manage on audit_findings for all to authenticated
  using (public.can_manage('audits'))
  with check (public.can_manage('audits'));

-- ---------------------------------------------------------------------------
-- Documents
--
-- Three tiers: general, restricted (regulatory and incident reports), and
-- ROC-A, which is a personal credential and so also visible to its owner.
-- ---------------------------------------------------------------------------

create policy documents_select on documents for select to authenticated
  using (
    case
      when category = 'roc_a' then
        public.can_read_all('roc_a')
        or (
          public.can_read_own('roc_a')
          and pilot_id in (select id from pilots where profile_id = auth.uid())
        )
      when public.is_restricted_document_category(category) then
        public.can_read_all('docs_restricted')
      else
        public.can_read_all('docs_general')
    end
  );

create policy documents_manage on documents for all to authenticated
  using (
    case
      when category = 'roc_a' then public.can_manage('roc_a')
      when public.is_restricted_document_category(category) then public.can_manage('docs_restricted')
      else public.can_manage('docs_general')
    end
  )
  with check (
    case
      when category = 'roc_a' then public.can_manage('roc_a')
      when public.is_restricted_document_category(category) then public.can_manage('docs_restricted')
      else public.can_manage('docs_general')
    end
  );

create policy documents_storage_read on storage.objects for select to authenticated
  using (
    case
      when bucket_id = 'roc-a-certificates' then
        public.can_read_all('roc_a')
        or (
          public.can_read_own('roc_a')
          and (storage.foldername(name))[1] in (
            select p.id::text from pilots p where p.profile_id = auth.uid()
          )
        )
      when bucket_id in ('regulatory-documents', 'incident-reports') then
        public.can_read_all('docs_restricted')
      else
        public.can_read_all('docs_general')
    end
  );

create policy documents_storage_write on storage.objects for all to authenticated
  using (
    case
      when bucket_id = 'roc-a-certificates' then public.can_manage('roc_a')
      when bucket_id in ('regulatory-documents', 'incident-reports') then public.can_manage('docs_restricted')
      else public.can_manage('docs_general')
    end
  )
  with check (
    case
      when bucket_id = 'roc-a-certificates' then public.can_manage('roc_a')
      when bucket_id in ('regulatory-documents', 'incident-reports') then public.can_manage('docs_restricted')
      else public.can_manage('docs_general')
    end
  );

-- ---------------------------------------------------------------------------
-- Notifications
--
-- Targeting still decides who sees a given reminder; the permission decides
-- whether the notification centre is available at all.
-- ---------------------------------------------------------------------------

create policy notifications_select on notifications for select to authenticated
  using (
    (
      public.access_level_for('notifications') <> 'none'
      and public.current_user_role() = any (target_roles)
    )
    or target_profile_id = auth.uid()
  );

create policy notification_reads_own on notification_reads for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
