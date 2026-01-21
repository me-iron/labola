'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw, MapPin, Calendar, Users, AlertCircle, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { transliterate } from '@/lib/transliterate';

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

interface AnalyticsData {
  byDate: { date: string; supply: number; booked: number }[];
  byStadium: { stadium: string; supply: number; count: number }[];
  totalEvents: number;
  totalCapacity: number;
  totalBooked: number;
  proceedingCount: number;
}

type Lang = 'ko' | 'ja';
type Period = 1 | 7 | 30;

// Simple keyword dictionary for dynamic content translation
// Prefecture Map for Phonetic Transliteration (User Request)
const PREFECTURE_MAP: Record<string, string> = {
  '北海道': '홋카이도', '青森県': '아오모리현', '岩手県': '이와테현', '宮城県': '미야기현', '秋田県': '아키타현', '山形県': '야마가타현', '福島県': '후쿠시마현',
  '茨城県': '이바라키현', '栃木県': '도치기현', '群馬県': '군마현', '埼玉県': '사이타마현', '千葉県': '치바현', '東京都': '도쿄도', '神奈川県': '가나가와현',
  '新潟県': '니이가타현', '富山県': '토야마현', '石川県': '이시카와현', '福井県': '후쿠이현', '山梨県': '야마나시현', '長野県': '나가노현', '岐阜県': '기후현', '静岡県': '시즈오카현', '愛知県': '아이치현',
  '三重県': '미에현', '滋賀県': '아가현', '京都府': '교토부', '大阪府': '오사카부', '兵庫県': '효고현', '奈良県': '나라현', '和歌山県': '와카야마현',
  '鳥取県': '돗토리현', '島根県': '시마네현', '岡山県': '오카야마현', '広島県': '히로시마현', '山口県': '야마구치현',
  '徳島県': '도쿠시마현', '香川県': '카가와현', '愛媛県': '에히메현', '高知県': '코치현',
  '福岡県': '후쿠오카현', '佐賀県': '사가현', '長崎県': '나가사키현', '熊本県': '구마모토현', '大分県': '오이타현', '宮崎県': '미야자키현', '鹿児島県': '가고시마현', '沖縄県': '오키나와현'
};

const KEYWORDS: Record<string, string> = {
  // Stadiums / Organizers
  'フットサル': '풋살',
  'スタジアム': '스타디움',
  'ステージ': '스테이지',
  '個人参加': '개인참가',
  '横浜': '요코하마',
  '新宿': '신주쿠',
  '日本橋': '니혼바시',
  '渋谷': '시부야',
  '池袋': '이케부쿠로',
  '銀座': '긴자',
  '西東京': '니시도쿄',
  '川崎': '카와사키',
  'アスタ': '아스타',
  '屋上': '옥상',
  '室内': '실내',
  '完全室内': '완전실내',
  '屋外': '야외',

  // Title / Levels
  'カテゴリー': '카테고리',
  'エンジョイ': '엔조이',
  'ガチ': '진지',
  'ミックス': '믹스',
  '初心者': '초심자',
  '経験者': '경험자',
  '中級': '중급',
  '上級': '상급',
  '初級': '초급',
  '女性': '여성',
  '男性': '남성',
  '中止': '중지',
  '開催': '개최',
  '割引': '할인',
  'キャンペーン': '캠페인',
  '朝イチ': '아침첫타임',
  '夜': '밤',
  '昼': '점심',
  '個サル': '개인풋살',
  'コサル': '개인풋살',
  '募集': '모집',
  '名': '명'
};

const DICT = {
  ko: {
    title: 'LaBOLA 분석 대시보드',
    subtitle: '풋살 개인참가 이벤트 분석',
    updateData: '데이터 업데이트',
    updating: '업데이트 중...',
    totalEvents: '총 이벤트',
    totalCapacity: '총 모집 인원',
    fillRate: '충원율',
    proceedingRate: '예상 진행률',
    supplyByDate: '일별 공급량 예측',
    supplyByStadium: '주최자별 이벤트 상위',
    recentEvents: '전체 이벤트',
    date: '날짜',
    time: '시간',
    eventTitle: '제목',
    organizer: '주최자',
    stadium: '주최자',
    region: '지역',
    status: '상태',
    spots: '인원',
    period1: '1일',
    period7: '7일',
    period30: '30일',
    language: '언어',
    statusMap: {
      '受付け中': '접수중',
      'キャンセル待ち': '대기자 모집',
      '開催中止': '개최취소',
      '受付け終了': '접수마감',
      '空いたら通知': '빈자리 알림',
    } as Record<string, string>,
    noData: '데이터가 없습니다. "데이터 업데이트"를 클릭하세요.',
    proceedingSubtext: '10명 이상 예약된 이벤트 비율'
  },
  ja: {
    title: 'LaBOLA Analytics',
    subtitle: 'Futsal Individual Participation Insights',
    updateData: 'Update Data',
    updating: 'Updating...',
    totalEvents: 'Total Events',
    totalCapacity: 'Total Capacity',
    fillRate: 'Fill Rate',
    proceedingRate: 'Est. Proceeding Rate',
    supplyByDate: 'Supply Forecast by Date',
    supplyByStadium: 'Top Organizers by Events',
    recentEvents: 'All Events',
    date: 'Date',
    time: 'Time',
    eventTitle: 'Title',
    organizer: 'Organizer',
    stadium: 'Organizer',
    region: 'Region',
    status: 'Status',
    spots: 'Spots',
    period1: '1 Day',
    period7: '7 Days',
    period30: '30 Days',
    language: 'Language',
    statusMap: {} as Record<string, string>,
    noData: 'No data available. Click "Update Data" to fetch.',
    proceedingSubtext: 'Ratio of events with 10+ booked'
  }
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>('ko');
  const [period, setPeriod] = useState<Period>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const t = DICT[lang];

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const startDate = period === 1 ? selectedDate : new Date().toISOString().substring(0, 10);

      // Read from DB
      const res = await fetch(`/api/events?startDate=${startDate}`);
      const data = await res.json();

      if (data.success) {
        setEvents(data.events);
        // setLastUpdated(new Date().toLocaleTimeString()); // Optional: DB doesn't give fetch time, only updated_at
      }
    } catch (error) {
      console.error('Failed to fetch events', error);
    } finally {
      setLoading(false);
    }
  };

  const updateData = async () => {
    setLoading(true);
    try {
      const daysToFetch = period;
      const startDate = period === 1 ? selectedDate : new Date().toISOString().substring(0, 10);

      // Trigger Crawl (Write to DB)
      const res = await fetch(`/api/crawl?days=${daysToFetch}&startDate=${startDate}`);
      const data = await res.json();

      if (data.success) {
        setLastUpdated(new Date().toLocaleTimeString());
        // After crawl, re-fetch from DB to see new data
        await fetchEvents();
      } else {
        alert('Update failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update data', error);
      alert('Failed to update data. Check console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [period]);

  const translateStatus = (originalStatus: string) => {
    if (lang === 'ja') return originalStatus;
    for (const [key, val] of Object.entries(DICT.ko.statusMap)) {
      if (originalStatus.includes(key)) return val;
    }
    return originalStatus;
  };

  const translateContent = (text: string) => {
    if (lang === 'ja') return text;
    // Correct Logic:
    // 1. Replace Keywords (Whole words) -> Korean
    // 2. Transliterate remaining characters -> Korean

    let mixed = text;

    // 1. Prefecture Transliteration (Primary Priority)
    Object.entries(PREFECTURE_MAP).forEach(([ja, ko]) => {
      mixed = mixed.replaceAll(ja, ko);
    });

    // 2. Replace other Keywrods
    Object.entries(KEYWORDS).forEach(([ja, ko]) => {
      mixed = mixed.replaceAll(ja, ko);
    });

    return transliterate(mixed, 'ko');
  };

  const uniqueRegions = React.useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => {
      // Use pre-extracted region if available, fallback to regex just in case
      if (e.region) {
        set.add(e.region);
      } else {
        const match = e.address.match(/^(.+?[都道府県])/);
        if (match) set.add(match[0]);
      }
    });
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    if (selectedRegion === 'all' || !selectedRegion) return events;
    return events.filter(e => {
      if (e.region) return e.region === selectedRegion;
      // Fallback
      return e.address.startsWith(selectedRegion);
    });
  }, [events, selectedRegion]);

  const analytics = React.useMemo((): AnalyticsData => {
    const byDateMap = new Map<string, { supply: number; booked: number; count: number; proceeding: number }>();
    const byStadiumMap = new Map<string, { supply: number; count: number }>();
    let totalCapacity = 0;
    let totalBooked = 0;
    let proceedingCount = 0;

    filteredEvents.forEach(event => {
      // If period is 1, we want hourly aggregation. Use `time`.
      // If period > 1, we want daily aggregation. Use `date`.
      const dateKey = period === 1 ? event.time : (event.isoDate || event.date);

      const currentDate = byDateMap.get(dateKey) || { supply: 0, booked: 0, count: 0, proceeding: 0 };

      const isProceeding = event.booked >= 10;

      byDateMap.set(dateKey, {
        supply: currentDate.supply + event.capacity,
        booked: currentDate.booked + event.booked,
        count: currentDate.count + 1,
        proceeding: currentDate.proceeding + (isProceeding ? 1 : 0),
      });

      const stadiumKey = event.stadium;
      const currentStadium = byStadiumMap.get(stadiumKey) || { supply: 0, count: 0 };
      byStadiumMap.set(stadiumKey, {
        supply: currentStadium.supply + event.capacity,
        count: currentStadium.count + 1,
      });

      totalCapacity += event.capacity;
      totalBooked += event.booked;

      if (isProceeding) {
        proceedingCount++;
      }
    });

    const byDate = Array.from(byDateMap.entries()).map(([date, data]) => ({
      date: period === 1 ? date : date.substring(5), // Keep full time for 1-day, remove year for others
      fullDate: date,
      ...data
    })).sort((a, b) => period === 1 ? a.fullDate.localeCompare(b.fullDate) : a.fullDate.localeCompare(b.fullDate));

    const byStadium = Array.from(byStadiumMap.entries()).map(([stadium, data]) => ({
      stadium,
      ...data
    })).sort((a, b) => b.count - a.count).slice(0, 10); // Sort by Event Count (Metric Update)

    return {
      byDate,
      byStadium,
      totalEvents: filteredEvents.length,
      totalCapacity,
      totalBooked,
      proceedingCount
    };
  }, [filteredEvents, period]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-neutral-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-neutral-400 mt-1">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Region Filter */}
            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-transparent text-white text-sm px-3 py-1.5 outline-none font-medium appearance-none min-w-[80px] cursor-pointer"
                style={{ textAlignLast: 'center' }}
              >
                <option value="all" className="bg-neutral-900">{lang === 'ko' ? '전체 지역' : 'All Regions'}</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region} className="bg-neutral-900">
                    {translateContent(region)}
                  </option>
                ))}
              </select>
            </div>

            {period === 1 && (
              <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-white text-sm px-3 py-1.5 outline-none font-medium [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            )}

            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
              <button onClick={() => setPeriod(1)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", period === 1 ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>{t.period1}</button>
              <button onClick={() => setPeriod(7)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", period === 7 ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>{t.period7}</button>
              <button onClick={() => setPeriod(30)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", period === 30 ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>{t.period30}</button>
            </div>

            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
              <button onClick={() => setLang('ko')} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", lang === 'ko' ? "bg-emerald-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>KO</button>
              <button onClick={() => setLang('ja')} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", lang === 'ja' ? "bg-emerald-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>JA</button>
            </div>

            <button
              onClick={() => updateData()}
              disabled={loading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)]"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? t.updating : t.updateData}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            label={t.totalEvents}
            value={analytics.totalEvents}
            icon={<MapPin className="w-5 h-5 text-emerald-400" />}
            subtext={`${period === 1 ? 'Selected Date' : period + ' Days'}`}
          />
          <StatCard
            label={t.totalCapacity}
            value={analytics.totalCapacity}
            icon={<Users className="w-5 h-5 text-blue-400" />}
            subtext="Available spots"
          />
          <StatCard
            label={t.fillRate}
            value={`${analytics.totalCapacity ? Math.round((analytics.totalBooked / analytics.totalCapacity) * 100) : 0}%`}
            icon={<AlertCircle className="w-5 h-5 text-orange-400" />}
            subtext={`${analytics.totalBooked} booked`}
          />
          <StatCard
            label={t.proceedingRate}
            value={`${analytics.totalEvents ? Math.round((analytics.proceedingCount / analytics.totalEvents) * 100) : 0}%`}
            icon={<TrendingUp className="w-5 h-5 text-pink-400" />}
            subtext={t.proceedingSubtext}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Supply by Date/Time */}
          <ChartCard title={period === 1 ? (lang === 'ko' ? '시간별 공급량' : 'Hourly Supply') : (period === 30 ? (lang === 'ko' ? '월간 공급량 (일별)' : 'Monthly Supply (Daily)') : (lang === 'ko' ? '주간 공급량 (일별)' : 'Weekly Supply (Daily)'))}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.byDate} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#e5e5e5' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend
                  iconType="circle"
                  // @ts-ignore
                  payload={[
                    { value: 'Total Events', type: 'circle', color: '#6366f1' },
                    { value: 'Proceeding Events', type: 'circle', color: '#10b981' }
                  ]}
                />
                {/* Changed to Event Count metrics */}
                <Bar dataKey="proceeding" name="Proceeding Events" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" name="Total Events" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Organizer Event Top */}
          <ChartCard title={t.supplyByStadium}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.byStadium.map(item => ({ ...item, stadium: translateContent(item.stadium) }))} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="stadium" type="category" width={100} stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#e5e5e5' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" name="Events" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Recent Events Table */}
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
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-white">{event.isoDate || event.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{event.time}</td>
                    <td className="px-6 py-4 font-medium text-white max-w-xs truncate">
                      <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 hover:underline">
                        {translateContent(event.title)}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs truncate">{translateContent(event.stadium)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        translateStatus(event.status).includes('접수') || event.status.includes('受付け') ? "bg-emerald-500/10 text-emerald-400" :
                          translateStatus(event.status).includes('대기') || event.status.includes('キャンセル') ? "bg-orange-500/10 text-orange-400" :
                            "bg-neutral-700 text-neutral-400"
                      )}>
                        {translateStatus(event.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-white">{event.booked}</span> / {event.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredEvents.length === 0 && !loading && (
            <div className="p-12 text-center text-neutral-500">
              {t.noData}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, subtext }: { label: string, value: number | string, icon: React.ReactNode, subtext: string }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl backdrop-blur-sm group hover:border-neutral-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-neutral-800 rounded-lg group-hover:bg-neutral-700 transition-colors">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm font-medium text-neutral-400">{label}</div>
      <div className="text-xs text-neutral-500 mt-2">{subtext}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
      {children}
    </div>
  );
}
