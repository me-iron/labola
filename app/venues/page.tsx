'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Building2, MapPin, Phone, Mail, Globe,
    BarChart3, TrendingUp, Activity, Search,
    ChevronDown, ChevronUp, ExternalLink, Layers, Calendar, Clock
} from 'lucide-react';

interface Court {
    id: string;
    stadium_id: string;
    name: string;
    dimensions: string;
    surface: string;
    sport_type: string;
    rental_price: number | null;
    calendar_url: string;
}

interface Stats {
    total: number;
    available: number;
    rental_booking: number;
    individual: number;
    school: number;
    other: number;
    other_details?: Record<string, number>;
    block: number;
    booked: number;
    operating: number;
    total_slots: number;
    utilization_rate: number;
    vacancy_rate: number;
}

interface Stadium {
    id: string;
    name: string;
    name_kana: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    google_maps_url: string;
    description: string;
    court_count: number;
    labola_url: string;
    courts: Court[];
    stats: Stats;
}

function cn(...classes: (string | false | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}

// ── Slot type colors & labels ──

const SLOT_TYPES = [
    { key: 'rental_booking', field: 'rental_booking', color: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', label: '일반 예약', emoji: '🔵' },
    { key: 'individual', field: 'individual', color: '#84cc16', bg: 'bg-lime-500/10', border: 'border-lime-500/20', text: 'text-lime-400', label: '개인 참가', emoji: '🟢' },
    { key: 'school', field: 'school', color: '#06b6d4', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', label: '학교', emoji: '🩵' },
    { key: 'other', field: 'other', color: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', label: '기타', emoji: '🟡' },
    { key: 'block', field: 'block', color: 'rgba(100,100,100,0.5)', bg: 'bg-neutral-500/10', border: 'border-neutral-500/20', text: 'text-neutral-400', label: 'Block', emoji: '⬛' },
    { key: 'available', field: 'available', color: 'rgba(255,255,255,0.2)', bg: 'bg-white/5', border: 'border-white/10', text: 'text-neutral-300', label: '공실', emoji: '⚪' },
] as const;

// ── Stacked Bar (count-based) ──

function StackedBar({ stats }: { stats: Stats }) {
    if (stats.total === 0) return null;
    const total = stats.total;

    return (
        <div className="w-full">
            <div className="flex h-3 rounded-full overflow-hidden bg-neutral-800">
                {SLOT_TYPES.filter(t => {
                    const val = stats[t.field as keyof Stats] as number;
                    return val > 0;
                }).map((t) => {
                    const val = stats[t.field as keyof Stats] as number;
                    return (
                        <div
                            key={t.key}
                            style={{ width: `${(val / total) * 100}%`, backgroundColor: t.color }}
                            className="transition-all"
                            title={`${t.label}: ${val}타임 (${Math.round((val / total) * 100)}%)`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ── Utilization Bar ──

function UtilizationBar({ rate }: { rate: number }) {
    const color = rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2 w-full mt-1">
            <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-sm font-mono text-neutral-300 w-10 text-right">{rate}%</span>
        </div>
    );
}

// ── Stadium Card ──

function StadiumCard({ stadium, expanded, onToggle }: { stadium: Stadium; expanded: boolean; onToggle: () => void }) {
    const stats = stadium.stats;
    const hasData = stats.total > 0;

    return (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-all">
            <div className="p-5 cursor-pointer" onClick={onToggle}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <Building2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                            <h3 className="text-lg font-bold text-white truncate">{stadium.name}</h3>
                            {stadium.court_count > 0 && (
                                <span className="flex items-center gap-1 text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full flex-shrink-0">
                                    <Layers className="w-3 h-3" />{stadium.court_count}면
                                </span>
                            )}
                        </div>
                        {stadium.address && (
                            <p className="text-sm text-neutral-400 flex items-center gap-1.5 ml-8">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{stadium.address}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {stadium.labola_url && (
                            <a href={stadium.labola_url} target="_blank" rel="noopener noreferrer"
                                className="text-neutral-500 hover:text-indigo-400 transition-colors"
                                onClick={e => e.stopPropagation()}>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                        {expanded ? <ChevronUp className="w-5 h-5 text-neutral-500" /> : <ChevronDown className="w-5 h-5 text-neutral-500" />}
                    </div>
                </div>

                {hasData ? (
                    <div className="mt-4">
                        {/* Summary Row */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="flex flex-col items-center px-2 py-2 rounded-lg border bg-indigo-500/10 border-indigo-500/20">
                                <span className="text-lg font-bold text-white">{stats.total}</span>
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wider">전체</span>
                            </div>
                            <div className="flex flex-col items-center px-2 py-2 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
                                <span className="text-lg font-bold text-white">{stats.utilization_rate}%</span>
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wider">가동률</span>
                            </div>
                            <div className="flex flex-col items-center px-2 py-2 rounded-lg border bg-red-500/10 border-red-500/20">
                                <span className="text-lg font-bold text-white">{stats.vacancy_rate}%</span>
                                <span className="text-[10px] text-neutral-400 uppercase tracking-wider">공실률</span>
                            </div>
                        </div>
                        {/* Category Number Cards */}
                        <div className="grid grid-cols-6 gap-2 mb-3">
                            {SLOT_TYPES.map(t => {
                                const val = stats[t.field as keyof Stats] as number;
                                return (
                                    <div key={t.key} className={cn("flex flex-col items-center px-1 py-2 rounded-lg border", t.bg, t.border)}>
                                        <span className="text-lg font-bold text-white">{val}</span>
                                        <span className="text-[10px] text-neutral-400 tracking-wider leading-tight text-center">{t.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Stacked Utilization Bar */}
                        <StackedBar stats={stats} />
                    </div>
                ) : (
                    <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>캘린더 데이터 없음</span>
                    </div>
                )}
            </div>

            {/* Expanded Detail */}
            {expanded && (
                <div className="border-t border-neutral-800">
                    {/* Contact */}
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {stadium.phone && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-emerald-400" />
                                <a href={`tel:${stadium.phone}`} className="text-neutral-300 hover:text-white">{stadium.phone}</a>
                            </div>
                        )}
                        {stadium.email && (
                            <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-blue-400" />
                                <a href={`mailto:${stadium.email}`} className="text-neutral-300 hover:text-white truncate">{stadium.email}</a>
                            </div>
                        )}
                        {stadium.website && (
                            <div className="flex items-center gap-2 text-sm">
                                <Globe className="w-4 h-4 text-purple-400" />
                                <a href={stadium.website} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white truncate">웹사이트</a>
                            </div>
                        )}
                        {stadium.google_maps_url && (
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-red-400" />
                                <a href={stadium.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white">Google Maps</a>
                            </div>
                        )}
                    </div>

                    {/* Slot breakdown — count-based */}
                    {hasData && (
                        <div className="px-5 pb-4">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-400" />
                                타입별 타임 분석 (전체 {stats.total}타임)
                            </h4>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                {SLOT_TYPES.map(t => {
                                    const val = stats[t.field as keyof Stats] as number;
                                    const pct = stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;
                                    return (
                                        <div key={t.key} className={cn("rounded-lg border p-2.5 text-center", t.bg, t.border)}>
                                            <div className="text-xs text-neutral-400">{t.emoji} {t.label}</div>
                                            <div className="text-lg font-bold text-white">{val}</div>
                                            <div className="text-[10px] text-neutral-500">{pct}%</div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Sum verification: 합계 표시 */}
                            <div className="mt-2 text-[10px] text-neutral-600 text-right">
                                합계: {stats.rental_booking + stats.individual + stats.school + stats.other + stats.block + stats.available} / 전체: {stats.total}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {stadium.description && (
                        <div className="px-5 pb-4">
                            <p className="text-sm text-neutral-400 leading-relaxed bg-neutral-800/50 p-3 rounded-lg">
                                {stadium.description}
                            </p>
                        </div>
                    )}

                    {/* Courts */}
                    {stadium.courts.length > 0 && (
                        <div className="px-5 pb-5">
                            <h4 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-400" />
                                코트 상세 ({stadium.courts.length}면)
                            </h4>
                            <div className="grid gap-2">
                                {stadium.courts.map(court => (
                                    <div key={court.id} className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-4 py-3 border border-neutral-700/50">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white text-sm">{court.name}</span>
                                                {court.sport_type && (
                                                    <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">{court.sport_type}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                                                {court.dimensions && <span>📐 {court.dimensions}</span>}
                                                {court.surface && <span>🌿 {court.surface}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4">
                                            {court.rental_price && (
                                                <span className="text-sm font-mono text-amber-400">¥{court.rental_price.toLocaleString()}/h</span>
                                            )}
                                            {court.calendar_url && (
                                                <a href={court.calendar_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300">
                                                    예약 →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Date Helpers ───

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPresetDates(preset: string): { start: string; end: string } {
    const today = new Date();
    const start = toDateStr(today);
    switch (preset) {
        case '1d': return { start, end: start };
        case '7d': { const e = new Date(today); e.setDate(today.getDate() + 6); return { start, end: toDateStr(e) }; }
        case '14d': { const e = new Date(today); e.setDate(today.getDate() + 13); return { start, end: toDateStr(e) }; }
        case '30d': { const e = new Date(today); e.setDate(today.getDate() + 29); return { start, end: toDateStr(e) }; }
        case 'month': {
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { start: toDateStr(first), end: toDateStr(last) };
        }
        default: return { start, end: start };
    }
}

// ─── Main ───

export default function VenuesPage() {
    const [stadiums, setStadiums] = useState<Stadium[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'utilization' | 'vacancy' | 'name'>('utilization');
    const [activePreset, setActivePreset] = useState('7d');
    const [startDate, setStartDate] = useState(() => getPresetDates('7d').start);
    const [endDate, setEndDate] = useState(() => getPresetDates('7d').end);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/stadiums?startDate=${startDate}&endDate=${endDate}`);
            const { data } = await res.json();
            setStadiums(data || []);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePreset = (preset: string) => {
        setActivePreset(preset);
        const { start, end } = getPresetDates(preset);
        setStartDate(start);
        setEndDate(end);
    };

    const filtered = stadiums
        .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.address || '').toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            switch (sortBy) {
                case 'utilization': return b.stats.utilization_rate - a.stats.utilization_rate;
                case 'vacancy': return b.stats.vacancy_rate - a.stats.vacancy_rate;
                default: return a.name.localeCompare(b.name);
            }
        });

    // Global aggregate
    const withData = stadiums.filter(s => s.stats.total > 0);
    const gTotal = withData.reduce((a, s) => a + s.stats.total, 0);
    const gAvail = withData.reduce((a, s) => a + s.stats.available, 0);
    const gRental = withData.reduce((a, s) => a + s.stats.rental_booking, 0);
    const gIndiv = withData.reduce((a, s) => a + s.stats.individual, 0);
    const gSchool = withData.reduce((a, s) => a + s.stats.school, 0);
    const gOther = withData.reduce((a, s) => a + s.stats.other, 0);
    const gBlock = withData.reduce((a, s) => a + s.stats.block, 0);
    const gBooked = gRental + gIndiv + gSchool + gOther;
    const gOperating = gTotal - gBlock;
    const gVacRate = gOperating > 0 ? Math.round((gAvail / gOperating) * 100) : 0;
    const gUtilRate = gOperating > 0 ? 100 - gVacRate : 0;

    const globalStats: Stats = {
        total: gTotal,
        available: gAvail,
        rental_booking: gRental,
        individual: gIndiv,
        school: gSchool,
        other: gOther,
        block: gBlock,
        booked: gBooked,
        operating: gOperating,
        total_slots: withData.reduce((a, s) => a + s.stats.total_slots, 0),
        utilization_rate: gUtilRate,
        vacancy_rate: gVacRate,
    };

    const presets = [
        { key: '1d', label: '오늘' },
        { key: '7d', label: '7일' },
        { key: '14d', label: '14일' },
        { key: '30d', label: '30일' },
        { key: 'month', label: '이번 달' },
    ];

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">대시보드</span>
                            </Link>
                            <div className="h-6 w-px bg-neutral-800" />
                            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                🏟️ 구장 데이터베이스
                            </h1>
                            <span className="text-xs text-neutral-500 bg-neutral-800 px-2.5 py-1 rounded-full">
                                {stadiums.length}개 구장 · {withData.length}개 데이터
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                                <input type="date" value={startDate}
                                    onChange={e => { setStartDate(e.target.value); setActivePreset(''); }}
                                    className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white text-xs" />
                                <span>~</span>
                                <input type="date" value={endDate}
                                    onChange={e => { setEndDate(e.target.value); setActivePreset(''); }}
                                    className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white text-xs" />
                            </div>
                            <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                                {presets.map(p => (
                                    <button key={p.key} onClick={() => handlePreset(p.key)}
                                        className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                                            activePreset === p.key ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white"
                                        )}>{p.label}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Global Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
                            <Clock className="w-4 h-4 text-indigo-400" />전체 타임
                        </div>
                        <p className="text-2xl font-bold">{gTotal}<span className="text-sm text-neutral-500 ml-1">타임</span></p>
                        <p className="text-[10px] text-neutral-500">{withData.length}개 구장 · 운영 {gOperating}타임</p>
                    </div>
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />가동률
                        </div>
                        <p className="text-2xl font-bold">{gUtilRate}%</p>
                        <UtilizationBar rate={gUtilRate} />
                        <p className="text-[10px] text-neutral-500 mt-1">예약 {gBooked} / 운영 {gOperating}</p>
                    </div>
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
                            <Activity className="w-4 h-4 text-red-400" />공실률
                        </div>
                        <p className="text-2xl font-bold">{gVacRate}%</p>
                        <UtilizationBar rate={100 - gVacRate} />
                        <p className="text-[10px] text-neutral-500 mt-1">공실 {gAvail} / 운영 {gOperating}</p>
                    </div>
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
                            <BarChart3 className="w-4 h-4 text-amber-400" />예약 타임
                        </div>
                        <p className="text-2xl font-bold">{gBooked}<span className="text-sm text-neutral-500 ml-1">타임</span></p>
                        <p className="text-[10px] text-neutral-500">일반{gRental} + 개인{gIndiv} + 학교{gSchool} + 기타{gOther}</p>
                    </div>
                </div>

                {/* Type breakdown cards */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                    {SLOT_TYPES.map(t => {
                        const val = globalStats[t.field as keyof Stats] as number;
                        const pct = gTotal > 0 ? Math.round((val / gTotal) * 100) : 0;
                        return (
                            <div key={t.key} className={cn("rounded-xl border p-3", t.bg, t.border)}>
                                <div className={cn("text-[10px] uppercase mb-1", t.text)}>{t.emoji} {t.label}</div>
                                <p className="text-lg font-bold text-white">{val}</p>
                                <p className="text-[10px] text-neutral-500">{pct}%</p>
                            </div>
                        );
                    })}
                </div>

                {/* Overall stacked bar */}
                {gTotal > 0 && (
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-neutral-400">전체 타임 분포 ({gTotal}타임 = {SLOT_TYPES.map(t => (globalStats[t.field as keyof Stats] as number)).reduce((a, b) => a + b, 0)}합계)</span>
                            <div className="flex items-center gap-3 text-[10px] text-neutral-500 flex-wrap">
                                {SLOT_TYPES.map(t => {
                                    const val = globalStats[t.field as keyof Stats] as number;
                                    if (val <= 0) return null;
                                    return <span key={t.key}>{t.emoji}{t.label} {val}</span>;
                                })}
                            </div>
                        </div>
                        <StackedBar stats={globalStats} />
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="구장 검색..."
                            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                        {[
                            { key: 'utilization' as const, label: '가동률순' },
                            { key: 'vacancy' as const, label: '공실률순' },
                            { key: 'name' as const, label: '이름순' },
                        ].map(s => (
                            <button key={s.key} onClick={() => setSortBy(s.key)}
                                className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                    sortBy === s.key ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white"
                                )}>{s.label}</button>
                        ))}
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Activity className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="ml-3 text-neutral-400">구장 데이터 로딩 중...</span>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filtered.map(stadium => (
                            <StadiumCard key={stadium.id} stadium={stadium}
                                expanded={expandedId === stadium.id}
                                onToggle={() => setExpandedId(expandedId === stadium.id ? null : stadium.id)} />
                        ))}
                        {filtered.length === 0 && (
                            <div className="text-center py-12 text-neutral-500">검색 결과 없음</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
