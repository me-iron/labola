-- Stadium Database Schema
-- Run this in Supabase SQL Editor

-- 1. Stadium (구장 기본 정보)
CREATE TABLE IF NOT EXISTS stadium (
  id TEXT PRIMARY KEY,              -- LaBOLA shop_id (예: "3443")
  name TEXT NOT NULL,               -- 구장명
  name_kana TEXT,                   -- 가나 표기
  address TEXT,                     -- 주소
  phone TEXT,                       -- 전화번호
  email TEXT,                       -- 이메일
  website TEXT,                     -- 공식 사이트 URL
  google_maps_url TEXT,             -- Google Maps 링크
  description TEXT,                 -- 시설 설명
  court_count INT DEFAULT 0,        -- 코트 수
  labola_url TEXT,                  -- LaBOLA 프로필 URL
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Stadium Court (코트 별 상세)
CREATE TABLE IF NOT EXISTS stadium_court (
  id TEXT PRIMARY KEY,              -- LaBOLA space_id (예: "2833")
  stadium_id TEXT NOT NULL REFERENCES stadium(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- 코트명 (例: グリーンコート)
  dimensions TEXT,                  -- 규격 (例: 32m×18m)
  surface TEXT,                     -- 표면 종류
  sport_type TEXT,                  -- 종목 (例: フットサルコート)
  rental_price INT,                 -- 60분 기본 대관료 (엔)
  calendar_url TEXT,                -- 예약 캘린더 URL
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS (Row Level Security) 정책
ALTER TABLE stadium ENABLE ROW LEVEL SECURITY;
ALTER TABLE stadium_court ENABLE ROW LEVEL SECURITY;

-- 읽기 정책 (anon key로 읽기 허용)
CREATE POLICY "Public read stadium" ON stadium FOR SELECT USING (true);
CREATE POLICY "Public read stadium_court" ON stadium_court FOR SELECT USING (true);

-- 쓰기 정책 (anon key로 쓰기 허용 — 크롤러용)
CREATE POLICY "Allow insert stadium" ON stadium FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update stadium" ON stadium FOR UPDATE USING (true);
CREATE POLICY "Allow insert stadium_court" ON stadium_court FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update stadium_court" ON stadium_court FOR UPDATE USING (true);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_stadium_court_stadium_id ON stadium_court(stadium_id);
