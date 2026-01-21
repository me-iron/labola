-- Create Events Table
create table if not exists events (
  id text primary key,           -- Combined ID (Date + Title + Key)
  date text,                     -- Display Date (e.g. "1.24 (sat)")
  iso_date text,                 -- Sortable Date (e.g. "2026-01-24")
  time text,                     -- Time (e.g. "10:00-12:00")
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

-- (Optional) Enable Row Level Security if needed, but for now we leave it open for Service Role writing.
alter table events enable row level security;

-- Policy: Allow Public Read access
create policy "Allow Public Read" on events
  for select using (true);
