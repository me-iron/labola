-- Create Events Table
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration: Add start_time column to existing table
-- ALTER TABLE match ADD COLUMN IF NOT EXISTS start_time TEXT;

-- Migration: Populate start_time from existing time data
-- UPDATE match SET start_time = SPLIT_PART(time, '-', 1) WHERE start_time IS NULL;

-- (Optional) Enable Row Level Security if needed, but for now we leave it open for Service Role writing.
alter table match enable row level security;

-- Policy: Allow Public Read access
create policy "Allow Public Read" on match
  for select using (true);
