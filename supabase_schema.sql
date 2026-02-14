-- Create Events Table
-- Note: The table name in the application code (app/api/crawl/route.ts) is 'match', not 'events'.
create table if not exists match (
  id text primary key,           -- Combined ID (Date + Title + Key)
  date text,                     -- Display Date (e.g. "1.24 (sat)")
  iso_date text,                 -- Sortable Date (e.g. "2026-01-24")
  time text,                     -- Time Range (e.g. "10:00-12:00") - Display only
  start_time text,               -- Start Time (e.g. "10:00") - For sorting
  title text,                    -- Event Title
  stadium text,                  -- Organizer Name
  address text,                  -- Location
  region text,                   -- Prefecture (e.g. "東京都")
  url text,                      -- Event URL
  booked int,                    -- Current Booked Count
  capacity int,                  -- Max Capacity
  status text,                   -- Status Label
  price int,                     -- Price (e.g. 2000)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration: Add start_time column if not exists
ALTER TABLE match ADD COLUMN IF NOT EXISTS start_time TEXT;

-- Migration: Populate start_time from existing time data
-- This splits "10:00-12:00" and takes "10:00"
UPDATE match SET start_time = SPLIT_PART(time, '-', 1) WHERE start_time IS NULL;

-- Migration: Add price column if not exists
ALTER TABLE match ADD COLUMN IF NOT EXISTS price INTEGER;

-- Enable Row Level Security (RLS)
alter table match enable row level security;

-- Policy: Allow Public Read access
-- Note: 'create policy if not exists' is not standard SQL, so we wrap in a DO block or just ignore error if exists.
-- For simplicity in Supabase SQL Editor, you can run this. If it errors "policy already exists", that's fine.
drop policy if exists "Allow Public Read" on match;
create policy "Allow Public Read" on match for select using (true);

-- Policy: Allow Service Role full access (implicit, but good to be explicit if using specific roles)
-- Usually service_role has bypass RLS, so no specific policy needed for write if using service_role key.
