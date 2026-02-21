-- Run in Supabase SQL Editor:
-- 지도 화면에 표시할 구장별 이벤트 수를 빠르게 집계하기 위한 뷰입니다.
-- 매 API 호출 시 전체 match 테이블을 스캔하는 비효율을 제거합니다.

CREATE OR REPLACE VIEW stadium_event_counts AS
SELECT 
    stadium,
    COUNT(*) as event_count
FROM 
    match
WHERE 
    stadium IS NOT NULL
GROUP BY 
    stadium;
