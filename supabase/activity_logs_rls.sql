-- Activity log access.
--
-- The activity_logs table has existed since the first migration but nothing
-- ever wrote to it and no policy ever allowed it. The console now records who
-- changed what; apply this once so those writes land and the Activity screen
-- has something to show.

alter table public.activity_logs enable row level security;

-- Any active admin may record their own actions.
drop policy if exists "admins insert their own activity" on public.activity_logs;
create policy "admins insert their own activity"
  on public.activity_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.is_active
    )
  );

-- Only super admins read the log — it names people and what they deleted.
drop policy if exists "super admins read activity" on public.activity_logs;
create policy "super admins read activity"
  on public.activity_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      join public.admin_roles on admin_roles.id = admin_users.role_id
      where admin_users.user_id = auth.uid()
        and admin_users.is_active
        and admin_roles.name in ('super_admin', 'owner')
    )
  );

-- The log is append-only. Nobody edits or deletes history from the console,
-- so no update or delete policy is granted.

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);
