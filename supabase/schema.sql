-- AFAQ Scientific Club — Registration table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT NOT NULL,
  study_year TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  motivation TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
);

-- Enable Row Level Security
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for the registration form)
CREATE POLICY "Allow anonymous inserts" ON registrations
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read (for future admin dashboard)
CREATE POLICY "Allow authenticated reads" ON registrations
  FOR SELECT
  TO authenticated
  USING (true);
