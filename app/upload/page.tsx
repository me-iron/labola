'use client';

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapPin, Calendar, Users, AlertCircle, TrendingUp, Upload, ArrowLeft, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import { transliterate } from '@/lib/transliterate';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { SupplyChart } from '@/components/SupplyChart';
import { OrganizerChart } from '@/components/OrganizerChart';

// Reuse types from page.tsx (ideally these should be in a shared types file)
interface Event {
    id: string;
    date: string;
    isoDate: string;
    time: string;
    title: string;
    stadium: string;
    address: string;
    url: string;
    booked: number;
    capacity: number;
    status: string;
    region?: string | null;
}

// ... Reuse KEYWORDS, DICT, constants ...
// For brevity, I will copy the minimal needed or import if I refactored them.
// Since I didn't refactor constants, I'll copy the DICT and translate functions locally or
// better yet, I should have refactored them. For now, to avoid breaking page.tsx, I will duplicate 
// the translation logic or create a shared util. 
// Actually, `transliterate` is already in lib.
// The `translateContent` and `DICT` are local.
// I will create a simple version here.

const DICT = {
    ko: {
        title: 'LaBOLA 데이터 분석 (CSV 업로드)',
        subtitle: '외부 CSV 파일을 업로드하여 데이터를 분석합니다.',
        uploadSub: '여기에 CSV 파일을 드래그하거나 클릭하여 업로드하세요.',
        back: '대시보드로 돌아가기',
        totalEvents: '총 이벤트',
        totalCapacity: '총 모집 인원',
        fillRate: '충원율',
        proceedingRate: '예상 진행률',
        supplyByDate: '일별 공급량 예측',
        supplyByStadium: '주최자별 이벤트 상위',
        recentEvents: '업로드된 이벤트 목록',
        date: '날짜',
        time: '시간',
        eventTitle: '제목',
        organizer: '주최자',
        status: '상태',
        spots: '인원',
        noData: '데이터가 없습니다. CSV 파일을 업로드해주세요.',
        proceedingSubtext: '10명 이상 예약된 이벤트 비율'
    },
    ja: {
        title: 'LaBOLA CSV Analysis',
        subtitle: 'Analyze external CSV data files.',
        uploadSub: 'Drag & drop or click to upload CSV file.',
        back: 'Back to Dashboard',
        totalEvents: 'Total Events',
        totalCapacity: 'Total Capacity',
        fillRate: 'Fill Rate',
        proceedingRate: 'Est. Proceeding Rate',
        supplyByDate: 'Supply Forecast by Date',
        supplyByStadium: 'Top Organizers by Events',
        recentEvents: 'Uploaded Events List',
        date: 'Date',
        time: 'Time',
        eventTitle: 'Title',
        organizer: 'Organizer',
        status: 'Status',
        spots: 'Spots',
        noData: 'No data. Please upload a CSV file.',
        proceedingSubtext: 'Ratio of events with 10+ booked'
    }
};

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export default function UploadPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [lang, setLang] = useState<'ko' | 'ja'>('ko');
    const t = DICT[lang];

    // Filtering State
    const [selectedRegion, setSelectedRegion] = useState<string>('all');

    // Handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCSV(text);
            setLoading(false);
        };
        reader.readAsText(file);
    };

    const parseCSV = (csvText: string) => {
        // Simple CSV parser assuming standard format from our Export
        // Headers: ID, Date, Time, Title, Organizer, Region, Status, Booked, Capacity, URL
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return;

        const headers = lines[0].split(','); // Naive split, assuming no commas in headers

        const parsedEvents: Event[] = lines.slice(1).map((line, index) => {
            // Handle quoted strings (Title, Organizer) complexity if needed
            // For simplicity, using a regex to split only on commas outside quotes
            // But standard split might fail if title has comma.
            // Let's use a slightly better split logic or regex.
            const values: string[] = [];
            let inQuote = false;
            let currentVal = '';

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal);
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal);

            // Clean up quotes
            const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

            // Map to Event interface using index
            // 0: ID, 1: Date, 2: Time, 3: Title, 4: Organizer, 5: Region, 6: Status, 7: Booked, 8: Capacity, 9: URL
            return {
                id: cleanValues[0] || `csv-${index}`,
                date: cleanValues[1],
                isoDate: new Date().toISOString().substring(0, 10), // CSV export didn't have isoDate column? 
                // Wait, current export has: ID, Date, Time, Title, Organizer, Region, Status, Booked, Capacity, URL
                // It does NOT have isoDate. We might need to parse Date "1.24 (sat)" or just use empty.
                // Or better, update export to include isoDate.
                // For now, let's try to infer or leave empty. 
                // If empty, sorting by date might fail.
                // Let's assume the user doesn't care about strict date sorting if it's external data, 
                // OR we try to extract it.
                time: cleanValues[2],
                title: cleanValues[3],
                stadium: cleanValues[4],
                region: cleanValues[5] === 'undefined' ? null : cleanValues[5],
                status: cleanValues[6],
                booked: parseInt(cleanValues[7]) || 0,
                capacity: parseInt(cleanValues[8]) || 0,
                url: cleanValues[9]
            } as Event;
        });

        setEvents(parsedEvents);
    };

    // Helper functions
    const translateContent = (text: string) => {
        // Simplified translation/transliteration
        // For full support, needs the logic from page.tsx or a shared util
        return transliterate(text, lang);
    };

    const translateStatus = (status: string) => {
        // Simplified status map
        if (lang === 'ko') {
            if (status.includes('受付け') || status.includes('접수')) return '접수중';
            if (status.includes('キャンセル') || status.includes('대기')) return '대기자 모집';
            if (status.includes('中止') || status.includes('취소')) return '개최취소';
            return status;
        }
        return status;
    };

    // Analytics Logic (Reused)
    const uniqueRegions = useMemo(() => {
        const regions = new Set(events.map(e => e.region).filter(Boolean));
        return Array.from(regions);
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (selectedRegion !== 'all' && event.region !== selectedRegion) return false;
            return true;
        });
    }, [events, selectedRegion]);

    const analytics = useMemo(() => {
        const totalEvents = filteredEvents.length;
        const totalCapacity = filteredEvents.reduce((sum, e) => sum + e.capacity, 0);
        const totalBooked = filteredEvents.reduce((sum, e) => sum + e.booked, 0);
        const proceedingCount = filteredEvents.filter(e => e.booked >= 10).length;

        // Aggregations
        const byDateMap = new Map<string, { supply: number, booked: number, count: number, proceeding: number }>();
        filteredEvents.forEach(e => {
            const key = e.date; // Use date string as key since we might not have isoDate
            const current = byDateMap.get(key) || { supply: 0, booked: 0, count: 0, proceeding: 0 };
            current.supply += e.capacity;
            current.booked += e.booked;
            current.count += 1;
            if (e.booked >= 10) current.proceeding += 1;
            byDateMap.set(key, current);
        });

        const byStadiumMap = new Map<string, { supply: number, count: number }>();
        filteredEvents.forEach(e => {
            const key = e.stadium;
            const current = byStadiumMap.get(key) || { supply: 0, count: 0 };
            current.supply += e.capacity;
            current.count += 1;
            byStadiumMap.set(key, current);
        });

        return {
            totalEvents,
            totalCapacity,
            totalBooked,
            proceedingCount,
            byDate: Array.from(byDateMap.entries()).map(([date, val]) => ({ date, ...val })).sort((a, b) => a.date.localeCompare(b.date, undefined, { numeric: true })),
            byStadium: Array.from(byStadiumMap.entries()).map(([stadium, val]) => ({ stadium, ...val })).sort((a, b) => b.count - a.count).slice(0, 10)
        };
    }, [filteredEvents]);

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <Link href="/" className="inline-flex items-center text-sm text-neutral-400 hover:text-white mb-2 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            {t.back}
                        </Link>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                            {t.title}
                        </h1>
                        <p className="text-neutral-400 mt-1">{t.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                            <button onClick={() => setLang('ko')} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", lang === 'ko' ? "bg-emerald-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>KO</button>
                            <button onClick={() => setLang('ja')} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", lang === 'ja' ? "bg-emerald-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>JA</button>
                        </div>
                    </div>
                </div>

                {/* Upload Area */}
                {events.length === 0 && (
                    <div className="border-2 border-dashed border-neutral-800 rounded-2xl p-12 text-center hover:border-neutral-600 transition-colors bg-neutral-900/30">
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                                <Upload className="w-8 h-8 text-neutral-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Upload CSV File</h3>
                            <p className="text-neutral-400 mb-6">{t.uploadSub}</p>

                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-neutral-400
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-indigo-600 file:text-white
                              file:cursor-pointer hover:file:bg-indigo-500
                              cursor-pointer max-w-xs mx-auto"
                            />
                        </div>
                    </div>
                )}

                {/* Dashboard Content (Only if data exists) */}
                {events.length > 0 && (
                    <>
                        {/* Filters */}
                        <div className="flex items-center gap-4 mb-8">
                            <span className="text-sm font-medium text-neutral-400">Filter Region:</span>
                            <select
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                className="bg-neutral-900 border border-neutral-800 text-white text-sm px-3 py-1.5 rounded-lg outline-none"
                            >
                                <option value="all">All</option>
                                {uniqueRegions.map(r => <option key={r} value={r}>{translateContent(r)}</option>)}
                            </select>

                            <button
                                onClick={() => setEvents([])}
                                className="ml-auto text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                            >
                                Clear Data
                            </button>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <StatCard label={t.totalEvents} value={analytics.totalEvents} icon={<Calendar className="w-5 h-5 text-indigo-400" />} subtext="" />
                            <StatCard label={t.totalCapacity} value={analytics.totalCapacity} icon={<Users className="w-5 h-5 text-emerald-400" />} subtext="" />
                            <StatCard label={t.fillRate} value={`${analytics.totalCapacity ? Math.round((analytics.totalBooked / analytics.totalCapacity) * 100) : 0}%`} icon={<TrendingUp className="w-5 h-5 text-blue-400" />} subtext={`${analytics.totalBooked} / ${analytics.totalCapacity}`} />
                            <StatCard
                                label={t.proceedingRate}
                                value={`${analytics.totalEvents ? Math.round((analytics.proceedingCount / analytics.totalEvents) * 100) : 0}%`}
                                icon={<AlertCircle className="w-5 h-5 text-amber-400" />}
                                subtext={`${analytics.proceedingCount} events (10+)`}
                            />
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <ChartCard title={t.supplyByDate}>
                                <SupplyChart data={analytics.byDate} t={t} />
                            </ChartCard>
                            <ChartCard title={t.supplyByStadium}>
                                <OrganizerChart data={analytics.byStadium.map(item => ({ ...item, stadium: translateContent(item.stadium) }))} />
                            </ChartCard>
                        </div>

                        {/* Table */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm">
                            <div className="p-6 border-b border-neutral-800">
                                <h3 className="text-lg font-semibold text-white">{t.recentEvents}</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-neutral-400">
                                    <thead className="bg-neutral-900 uppercase text-xs font-medium tracking-wider text-neutral-500">
                                        <tr>
                                            <th className="px-6 py-4">{t.date}</th>
                                            <th className="px-6 py-4">{t.time}</th>
                                            <th className="px-6 py-4">{t.eventTitle}</th>
                                            <th className="px-6 py-4">{t.organizer}</th>
                                            <th className="px-6 py-4">{t.status}</th>
                                            <th className="px-6 py-4 text-right">{t.spots}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800">
                                        {filteredEvents.slice(0, 100).map((event) => (
                                            <tr key={event.id} className="hover:bg-neutral-800/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-white">{event.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{event.time}</td>
                                                <td className="px-6 py-4 font-medium text-white max-w-xs truncate">
                                                    <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 hover:underline">
                                                        {translateContent(event.title)}
                                                    </a>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap max-w-xs truncate">{translateContent(event.stadium)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">{translateStatus(event.status)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <span className="text-white">{event.booked}</span> / {event.capacity}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
