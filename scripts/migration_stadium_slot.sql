-- stadium_slot: 시간대별 코트 예약/공실 상태
-- slot_type: available, rental_booking, individual, school, tournament, closed

-- Drop old table if exists (to rebuild with new schema)
DROP TABLE IF EXISTS stadium_slot;

CREATE TABLE stadium_slot (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stadium_id text REFERENCES stadium(id) ON DELETE CASCADE,
  court_name text NOT NULL,
  slot_date date NOT NULL,
  start_time text NOT NULL,      -- "09:00"
  end_time text NOT NULL,        -- "10:00"
  duration_min int NOT NULL DEFAULT 60,
  slot_type text NOT NULL DEFAULT 'available',  
  -- available | rental_booking | individual | school | tournament | closed
  event_label text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(stadium_id, court_name, slot_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_stadium_slot_date ON stadium_slot(slot_date);
CREATE INDEX IF NOT EXISTS idx_stadium_slot_stadium ON stadium_slot(stadium_id);
CREATE INDEX IF NOT EXISTS idx_stadium_slot_type ON stadium_slot(slot_type);

ALTER TABLE stadium_slot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on stadium_slot" ON stadium_slot FOR SELECT USING (true);
CREATE POLICY "Allow public insert on stadium_slot" ON stadium_slot FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on stadium_slot" ON stadium_slot FOR UPDATE USING (true);
