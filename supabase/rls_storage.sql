-- ============================================================
-- Run this AFTER `npm run db:push`
-- Drizzle cannot manage RLS policies, functions, or storage buckets
-- ============================================================

-- 1. Enable RLS on all tables
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions for RLS
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users au
    JOIN admin_roles r ON r.id = au.role_id
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND (r.name = required_role OR r.name = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users au
    JOIN admin_roles r ON r.id = au.role_id
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Default admin roles
INSERT INTO admin_roles (name, label, description) VALUES
  ('super_admin',    'Super Admin',    'Full access to all sections'),
  ('event_manager',  'Event Manager',  'Manage events and registrations'),
  ('media_manager',  'Media Manager',  'Manage gallery and media'),
  ('project_manager','Project Manager','Manage projects')
ON CONFLICT (name) DO NOTHING;

-- 4. RLS POLICIES (idempotent: drop first if exists)

-- Admin roles: any authenticated admin can read role definitions
DROP POLICY IF EXISTS "admin_read_admin_roles" ON admin_roles;
CREATE POLICY "admin_read_admin_roles" ON admin_roles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ));

DROP POLICY IF EXISTS "admin_users_read_own" ON admin_users;
CREATE POLICY "admin_users_read_own" ON admin_users
  FOR SELECT USING (user_id = auth.uid() AND is_active = true);

DROP POLICY IF EXISTS "super_admin_all_admin_users" ON admin_users;
CREATE POLICY "super_admin_all_admin_users" ON admin_users
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "admin_all_events" ON events;
CREATE POLICY "admin_all_events" ON events
  FOR ALL USING (has_role('event_manager'));

DROP POLICY IF EXISTS "public_select_published_events" ON events;
CREATE POLICY "public_select_published_events" ON events
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "admin_all_event_registrations" ON event_registrations;
CREATE POLICY "admin_all_event_registrations" ON event_registrations
  FOR ALL USING (has_role('event_manager'));

DROP POLICY IF EXISTS "public_insert_event_registrations" ON event_registrations;
CREATE POLICY "public_insert_event_registrations" ON event_registrations
  FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_projects" ON projects;
CREATE POLICY "admin_all_projects" ON projects
  FOR ALL USING (has_role('project_manager'));

DROP POLICY IF EXISTS "public_select_published_projects" ON projects;
CREATE POLICY "public_select_published_projects" ON projects
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "admin_all_project_images" ON project_images;
CREATE POLICY "admin_all_project_images" ON project_images
  FOR ALL USING (has_role('project_manager'));

DROP POLICY IF EXISTS "admin_all_gallery_albums" ON gallery_albums;
CREATE POLICY "admin_all_gallery_albums" ON gallery_albums
  FOR ALL USING (has_role('media_manager'));

DROP POLICY IF EXISTS "public_select_gallery_albums" ON gallery_albums;
CREATE POLICY "public_select_gallery_albums" ON gallery_albums
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_gallery_images" ON gallery_images;
CREATE POLICY "admin_all_gallery_images" ON gallery_images
  FOR ALL USING (has_role('media_manager'));

DROP POLICY IF EXISTS "public_select_gallery_images" ON gallery_images;
CREATE POLICY "public_select_gallery_images" ON gallery_images
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_announcements" ON announcements;
CREATE POLICY "admin_all_announcements" ON announcements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ));

DROP POLICY IF EXISTS "admin_all_contact_messages" ON contact_messages;
CREATE POLICY "admin_all_contact_messages" ON contact_messages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ));

DROP POLICY IF EXISTS "public_insert_contact_messages" ON contact_messages;
CREATE POLICY "public_insert_contact_messages" ON contact_messages
  FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_membership_applications" ON membership_applications;
CREATE POLICY "admin_all_membership_applications" ON membership_applications
  FOR ALL USING (has_role('event_manager'));

DROP POLICY IF EXISTS "public_insert_membership_applications" ON membership_applications;
CREATE POLICY "public_insert_membership_applications" ON membership_applications
  FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_read_activity_logs" ON activity_logs;
CREATE POLICY "admin_read_activity_logs" ON activity_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ));

-- 5. STORAGE BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public) VALUES
  ('events', 'events', true),
  ('projects', 'projects', true),
  ('gallery', 'gallery', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_gallery_storage" ON storage.objects;
CREATE POLICY "public_read_gallery_storage"
ON storage.objects FOR SELECT USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "admin_all_gallery_storage" ON storage.objects;
CREATE POLICY "admin_all_gallery_storage"
ON storage.objects FOR ALL USING (
  bucket_id = 'gallery'
  AND EXISTS (
    SELECT 1 FROM admin_users
    JOIN admin_roles ON admin_roles.id = admin_users.role_id
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
      AND (admin_roles.name = 'media_manager' OR admin_roles.name = 'super_admin')
  )
);

DROP POLICY IF EXISTS "admin_all_events_storage" ON storage.objects;
CREATE POLICY "admin_all_events_storage"
ON storage.objects FOR ALL USING (
  bucket_id = 'events'
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
  )
);

DROP POLICY IF EXISTS "admin_all_projects_storage" ON storage.objects;
CREATE POLICY "admin_all_projects_storage"
ON storage.objects FOR ALL USING (
  bucket_id = 'projects'
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
  )
);
