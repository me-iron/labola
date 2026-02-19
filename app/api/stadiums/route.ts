import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/stadiums?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * Returns stadiums with utilization metrics.
 * 
 * slot_type (공통 6개): available / rental_booking / individual / school / other / block
 * event_label (rawClass): 원본 CSS class (구장별 고유 라벨)
 * 
 * other_details: 기타 카테고리의 rawClass별 상세 타임 (예: { visitor: 5, tournament: 2 })
 * 
 * 가동률 = 예약타임 / 운영타임 × 100 (block 제외)
 * 공실률 = 공실타임 / 운영타임 × 100 (block 제외)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);
        const endDate = searchParams.get('endDate') || startDate;

        // Fetch stadiums
        const { data: stadiums, error: sErr } = await supabase
            .from('stadium')
            .select('*')
            .order('name');
        if (sErr) throw sErr;

        // Fetch courts
        const { data: courts, error: cErr } = await supabase
            .from('stadium_court')
            .select('*')
            .order('name');
        if (cErr) throw cErr;

        // Fetch ALL slots (paginated)
        const slots = await fetchAllSlots(startDate, endDate);

        // Helper: duration in minutes
        function durationMin(start: string, end: string): number {
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            return diff > 0 ? diff : 0;
        }

        // Aggregate per stadium
        type RawStats = {
            total_min: number;
            available_min: number;
            rental_booking_min: number;
            individual_min: number;
            school_min: number;
            other_min: number;
            block_min: number;
            total_slots: number;
            other_details: Record<string, number>; // rawClass → minutes
        };

        const statsMap = new Map<string, RawStats>();

        // rawClass(event_label) → 공통 카테고리 매핑
        function mapToCategory(rawClass: string): string {
            switch (rawClass) {
                case 'empty': return 'available';
                case 'rental_booking': return 'rental_booking';
                case 'individual': return 'individual';
                case 'school':
                case 'facility_usage': return 'school';
                case 'excess': return 'block';
                // 이전 크롤링 하위 호환
                case 'available': return 'available';
                case 'academy': return 'school';
                case 'block': return 'block';
                default:
                    if (/^member\d+$/.test(rawClass)) return 'rental_booking';
                    return 'other';
            }
        }

        for (const slot of slots) {
            const key = slot.stadium_id;
            const s = statsMap.get(key) || {
                total_min: 0, available_min: 0, rental_booking_min: 0,
                individual_min: 0, school_min: 0, other_min: 0,
                block_min: 0, total_slots: 0, other_details: {},
            };

            const dur = durationMin(slot.start_time || '00:00', slot.end_time || '00:00');
            s.total_min += dur;
            s.total_slots++;

            const rawClass = slot.event_label || 'block';
            const category = mapToCategory(rawClass);

            switch (category) {
                case 'available': s.available_min += dur; break;
                case 'rental_booking': s.rental_booking_min += dur; break;
                case 'individual': s.individual_min += dur; break;
                case 'school': s.school_min += dur; break;
                case 'other': s.other_min += dur; break;
                default: s.block_min += dur; break;
            }

            if (category === 'other') {
                s.other_details[rawClass] = (s.other_details[rawClass] || 0) + dur;
            }

            statsMap.set(key, s);
        }

        // Build result
        const toTime = (min: number) => Math.round(min / 60);

        const result = (stadiums || []).map(stadium => {
            const sCourts = (courts || []).filter(c => c.stadium_id === stadium.id);
            const raw = statsMap.get(stadium.id);

            const available = toTime(raw?.available_min || 0);
            const rental_booking = toTime(raw?.rental_booking_min || 0);
            const individual = toTime(raw?.individual_min || 0);
            const school = toTime(raw?.school_min || 0);
            const other = toTime(raw?.other_min || 0);
            const block = toTime(raw?.block_min || 0);

            const total = available + rental_booking + individual + school + other + block;
            const booked = rental_booking + individual + school + other;
            const operating = total - block;

            const vacancy_rate = operating > 0 ? Math.round((available / operating) * 100) : 0;
            const utilization_rate = operating > 0 ? 100 - vacancy_rate : 0;

            // other_details: rawClass별 분→타임 변환
            const other_details: Record<string, number> = {};
            if (raw?.other_details) {
                for (const [k, v] of Object.entries(raw.other_details)) {
                    const t = toTime(v);
                    if (t > 0) other_details[k] = t;
                }
            }

            return {
                ...stadium,
                courts: sCourts,
                stats: {
                    total,
                    available,
                    rental_booking,
                    individual,
                    school,
                    other,
                    other_details,
                    block,
                    booked,
                    operating,
                    total_slots: raw?.total_slots || 0,
                    utilization_rate,
                    vacancy_rate,
                },
            };
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error('Stadium API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch stadiums' },
            { status: 500 }
        );
    }
}

/**
 * Supabase pagination: fetch all slots for the date range
 */
async function fetchAllSlots(startDate: string, endDate: string) {
    const PAGE_SIZE = 1000;
    const allSlots: any[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('stadium_slot')
            .select('stadium_id, event_label, start_time, end_time')
            .gte('slot_date', startDate)
            .lte('slot_date', endDate)
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allSlots.push(...data);

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return allSlots;
}
