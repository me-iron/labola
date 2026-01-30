'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import { RefreshCw, MapPin, Calendar, Users, AlertCircle, TrendingUp, Download, Upload, Trash2, Search, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { SupplyChart } from '@/components/SupplyChart';
import { OrganizerChart } from '@/components/OrganizerChart';

interface Event {
  id: string;
  date: string;
  isoDate: string;
  time: string;
  startTime?: string;
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
  byDate: { date: string; supply: number; booked: number; count: number; proceeding: number }[];
  byStadium: { stadium: string; supply: number; count: number }[];
  totalEvents: number;
  totalCapacity: number;
  totalBooked: number;
  proceedingCount: number;
  totalOrganizers: number;
}

type Period = 1 | 7 | 30;

// UI Labels (Japanese only - use Chrome translate for other languages)
const UI = {
  title: 'LaBOLA Analytics',
  subtitle: 'フットサル個人参加イベント分析',
  totalEvents: 'Total Events',
  totalCapacity: 'Total Capacity',
  fillRate: 'Fill Rate',
  proceedingRate: 'Est. Proceeding Rate',
  supplyByDate: 'Supply Forecast by Date',
  supplyByStadium: 'Top Organizers by Events',
  recentEvents: 'All Events',
  period1: '1 Day',
  period7: '7 Days',
  period30: '30 Days',
  noData: 'No data available. Click "Update Data" to fetch.',
  proceedingSubtext: 'Ratio of events with 10+ booked'
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type SortField = 'date' | 'time' | 'stadium' | 'status';
type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDays, setLoadingDays] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Sorting & Filtering State
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

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

  const quickUpdate = async (days: number) => {
    setLoading(true);
    setLoadingDays(days);
    try {
      const startDate = new Date().toISOString().substring(0, 10);
      console.log(`Quick update: ${days} days starting from ${startDate}`);

      const res = await fetch(`/api/crawl?startDate=${startDate}&days=${days}&clean=true`);
      const data = await res.json();

      if (data.success) {
        setLastUpdated(new Date().toLocaleTimeString());
        await fetchEvents();
        alert(`Update complete: ${data.count} events (${days} days)`);
      } else {
        alert('Update failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Quick update failed:', error);
      alert('Update failed');
    } finally {
      setLoading(false);
      setLoadingDays(null);
    }
  };

  const cleanupData = async () => {
    if (period !== 1) {
      alert('Cleanup is only available in 1-day mode.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/cleanup?date=${selectedDate}`);
      const data = await res.json();

      if (data.success) {
        alert(`Cleanup complete: ${data.deletedCount} deleted (${data.checked} checked)`);
        await fetchEvents();
      } else {
        alert('Cleanup failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      alert('Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (filteredEvents.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['ID', 'Date', 'Time', 'Title', 'Organizer', 'Region', 'Status', 'Booked', 'Capacity', 'URL'];
    const rows = filteredEvents.map(e => [
      e.id,
      e.date,
      e.time,
      `"${e.title.replace(/"/g, '""')}"`, // Escape quotes
      `"${e.stadium.replace(/"/g, '""')}"`,
      e.region || '',
      e.status,
      e.booked,
      e.capacity,
      e.url
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `labola_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchEvents();
  }, [period, selectedDate]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [period, selectedDate, selectedRegion, events]);



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

  // Unique statuses for filter dropdown
  const uniqueStatuses = React.useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => {
      if (e.status) set.add(e.status);
    });
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    let result = events.filter(e => {
      // 1. Region Filter
      let matchesRegion = true;
      if (selectedRegion !== 'all') {
        if (e.region) matchesRegion = e.region === selectedRegion;
        else matchesRegion = e.address.startsWith(selectedRegion);
      }
      if (!matchesRegion) return false;

      // 2. Date Filter
      const eventDate = e.isoDate || e.date;
      if (period === 1) {
        if (eventDate !== selectedDate) return false;
      } else {
        const today = new Date().toISOString().substring(0, 10);
        const endDate = new Date();
        endDate.setDate(new Date().getDate() + period - 1);
        const endDateStr = endDate.toISOString().substring(0, 10);
        if (!(eventDate >= today && eventDate <= endDateStr)) return false;
      }

      // 3. Keyword Search (title, stadium)
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.toLowerCase();
        const matchesKeyword =
          e.title.toLowerCase().includes(keyword) ||
          e.stadium.toLowerCase().includes(keyword) ||
          e.title.toLowerCase().includes(keyword) ||
          e.stadium.toLowerCase().includes(keyword);
        if (!matchesKeyword) return false;
      }

      // 4. Status Filter
      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(e.status)) return false;
      }

      return true;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          const dateA = a.isoDate || a.date;
          const dateB = b.isoDate || b.date;
          comparison = dateA.localeCompare(dateB);
          if (comparison === 0) {
            // Secondary sort by start time
            comparison = (a.startTime || a.time).localeCompare(b.startTime || b.time);
          }
          break;
        case 'time':
          comparison = (a.startTime || a.time).localeCompare(b.startTime || b.time);
          break;
        case 'stadium':
          comparison = a.stadium.localeCompare(b.stadium);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [events, selectedRegion, period, selectedDate, searchKeyword, selectedStatuses, sortField, sortDirection]);

  const analytics = React.useMemo((): AnalyticsData => {
    const byDateMap = new Map<string, { supply: number; booked: number; count: number; proceeding: number }>();
    const byStadiumMap = new Map<string, { supply: number; count: number }>();
    let totalCapacity = 0;
    let totalBooked = 0;
    let proceedingCount = 0;

    // Filter events based on Period (1, 7, 15) for Charts
    // The 'filteredEvents' already contains the correct date range event list.
    // However, for the chart X-axis, we want to ensure we show all dates in the range, even with 0 data.

    // Generate full date range keys
    const dateKeys = new Set<string>();
    if (period > 1) {
      const today = new Date();
      for (let i = 0; i < period; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        // Format: "1.22(Wed)" to match crawler format if possible, 
        // BUT crawler returns "YYYY-MM-DD" in isoDate. Use isoDate for sorting.
        // Actually, `byDateMap` uses `dateKey`.
        // Let's use `isoDate` for map keys to be safe, then format for display.
      }
    }

    filteredEvents.forEach(event => {
      // If period is 1, we want hourly aggregation. Use `startTime` for proper sorting.
      // If period > 1, we want daily aggregation. Use `isoDate`.
      const dateKey = period === 1 ? (event.startTime || event.time.split('-')[0]) : (event.isoDate || event.date);

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

    // Fill missing dates with 0 for Charts (Only for Period > 1)
    if (period > 1) {
      const today = new Date();
      for (let i = 0; i < period; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().substring(0, 10);

        // We need to match the key used above. 
        // Above uses `event.isoDate` matching `iso`.
        if (!byDateMap.has(iso)) {
          byDateMap.set(iso, { supply: 0, booked: 0, count: 0, proceeding: 0 });
        }
      }
    }

    const byDate = Array.from(byDateMap.entries()).map(([key, data]) => {
      // key is isoDate (YYYY-MM-DD) for period > 1
      // key is startTime (HH:MM) for period = 1
      let dateLabel = key;
      if (period > 1) {
        // Convert YYYY-MM-DD to "MM-DD"
        dateLabel = key.substring(5);
      }

      return {
        date: dateLabel,
        fullDate: key,
        ...data
      };
    }).sort((a, b) => {
      // For period === 1 (time-based), sort by time string which works correctly for HH:MM format
      // "08:30" < "19:00" in string comparison, which is correct chronological order
      return a.fullDate.localeCompare(b.fullDate);
    });

    // Explicitly slice to exactly 'period' length if we generated extra keys? 
    // No, loop above generates exactly 'period' days.
    // However, if we have old data in DB that is not in range, `filteredEvents` already excludes it.
    // So `byDate` should be correct length.

    const byStadium = Array.from(byStadiumMap.entries()).map(([stadium, data]) => ({
      stadium,
      ...data
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    return {
      byDate, // Will contain 15 items for 15-day period
      byStadium,
      totalEvents: filteredEvents.length,
      totalCapacity,
      totalBooked,
      proceedingCount,
      totalOrganizers: byStadiumMap.size
    };
  }, [filteredEvents, period]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                {UI.title}
              </h1>
              <Link href="/upload" className="text-sm font-medium text-neutral-500 hover:text-indigo-400 transition-colors flex items-center gap-1 border border-neutral-800 rounded-full px-3 py-1 bg-neutral-900/50">
                <Upload className="w-3 h-3" />
                Upload CSV
              </Link>
            </div>
            <p className="text-neutral-400 mt-1">{UI.subtitle}</p>
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
                <option value="all" className="bg-neutral-900">{'All Regions'}</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region} className="bg-neutral-900">
                    {region}
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
              <button onClick={() => setPeriod(1)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", period === 1 ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>{UI.period1}</button>
              <button onClick={() => setPeriod(7)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", period === 7 ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>{UI.period7}</button>
              <button onClick={() => setPeriod(30)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", period === 30 ? "bg-indigo-600 text-white shadow-lg" : "text-neutral-400 hover:text-white")}>{UI.period30}</button>
            </div>


            <button
              onClick={downloadCSV}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                "bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700",
                "text-neutral-300 hover:text-white"
              )}
            >
              <Download className="w-4 h-4" />
              CSV
            </button>

            <button
              onClick={cleanupData}
              disabled={loading || period !== 1}
              title={period !== 1 ? 'Only available in 1-day mode' : 'Cleanup deleted events'}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                "bg-red-900/50 hover:bg-red-800/70 active:bg-red-700/80 border border-red-800/50",
                "text-red-300 hover:text-red-100",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <Trash2 className="w-4 h-4" />
              {'Cleanup'}
            </button>

            <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
              <span className="text-xs text-neutral-500 px-2">{'Update'}</span>
              <button
                onClick={() => quickUpdate(1)}
                disabled={loading}
                title={'Refresh today only'}
                className={cn(
                  "w-14 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1",
                  "bg-emerald-600 hover:bg-emerald-500 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loadingDays === 1 && <RefreshCw className="w-3 h-3 animate-spin" />}
                1{'D'}
              </button>
              <button
                onClick={() => quickUpdate(7)}
                disabled={loading}
                title={'Refresh 7 days'}
                className={cn(
                  "w-14 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1",
                  "bg-blue-600 hover:bg-blue-500 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loadingDays === 7 && <RefreshCw className="w-3 h-3 animate-spin" />}
                7{'D'}
              </button>
              <button
                onClick={() => quickUpdate(14)}
                disabled={loading}
                title={'Refresh 14 days'}
                className={cn(
                  "w-16 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1",
                  "bg-indigo-600 hover:bg-indigo-500 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loadingDays === 14 && <RefreshCw className="w-3 h-3 animate-spin" />}
                14{'D'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <StatCard
            label={UI.totalEvents}
            value={analytics.totalEvents}
            icon={<MapPin className="w-5 h-5 text-emerald-400" />}
            subtext={`${period === 1 ? 'Selected Date' : period + ' Days'}`}
          />
          <StatCard
            label={'Organizers'}
            value={analytics.totalOrganizers}
            icon={<Users className="w-5 h-5 text-cyan-400" />}
            subtext={`${period === 1 ? 'Selected Date' : period + ' Days'}`}
          />
          <StatCard
            label={UI.totalCapacity}
            value={analytics.totalCapacity}
            icon={<Users className="w-5 h-5 text-blue-400" />}
            subtext="Available spots"
          />
          <StatCard
            label={UI.fillRate}
            value={`${analytics.totalCapacity ? Math.round((analytics.totalBooked / analytics.totalCapacity) * 100) : 0}%`}
            icon={<AlertCircle className="w-5 h-5 text-orange-400" />}
            subtext={`${analytics.totalBooked} booked`}
          />
          <StatCard
            label={UI.proceedingRate}
            value={`${analytics.totalEvents ? Math.round((analytics.proceedingCount / analytics.totalEvents) * 100) : 0}%`}
            icon={<TrendingUp className="w-5 h-5 text-pink-400" />}
            subtext={UI.proceedingSubtext}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Supply Trend Chart */}
          <ChartCard title={UI.supplyByDate}>
            <SupplyChart data={analytics.byDate} scrollable={period === 30} />
          </ChartCard>

          {/* Organizer Event Top */}
          <ChartCard title={UI.supplyByStadium}>
            <OrganizerChart
              data={analytics.byStadium.map(item => ({
                ...item,
                stadium: item.stadium
              }))}
            />
          </ChartCard>
        </div>

        {/* Recent Events Table */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-neutral-800">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <h3 className="text-lg font-semibold text-white">{UI.recentEvents}</h3>

              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Keyword Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
                    placeholder={'Search title, organizer...'}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 w-56"
                  />
                </div>

                {/* Status Filter Dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600">
                    <Filter className="w-4 h-4" />
                    {'Status'}
                    {selectedStatuses.length > 0 && (
                      <span className="bg-indigo-600 text-white text-xs rounded-full px-1.5">{selectedStatuses.length}</span>
                    )}
                  </button>
                  <div className="absolute right-0 top-full mt-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-2 max-h-64 overflow-y-auto">
                      {uniqueStatuses.map(status => (
                        <label key={status} className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-700 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status]);
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                              }
                              setCurrentPage(1);
                            }}
                            className="rounded border-neutral-600 bg-neutral-700 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-neutral-300">{status}</span>
                        </label>
                      ))}
                      {selectedStatuses.length > 0 && (
                        <button
                          onClick={() => { setSelectedStatuses([]); setCurrentPage(1); }}
                          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-neutral-700 rounded"
                        >
                          {'Clear filters'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-400">
              <thead className="bg-neutral-900 uppercase text-xs font-medium tracking-wider text-neutral-500">
                <tr>
                  <th
                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => {
                      if (sortField === 'date') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('date'); setSortDirection('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortField === 'date' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => {
                      if (sortField === 'time') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('time'); setSortDirection('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Time
                      {sortField === 'time' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4">Title</th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => {
                      if (sortField === 'stadium') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('stadium'); setSortDirection('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Organizer
                      {sortField === 'stadium' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => {
                      if (sortField === 'status') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortField('status'); setSortDirection('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Spots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredEvents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((event) => (
                  <tr key={event.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-white">{event.isoDate || event.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{event.time}</td>
                    <td className="px-6 py-4 font-medium text-white max-w-xs truncate">
                      <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 hover:underline">
                        {event.title}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs truncate">{event.stadium}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        event.status.includes('접수') || event.status.includes('受付け') ? "bg-emerald-500/10 text-emerald-400" :
                          event.status.includes('대기') || event.status.includes('キャンセル') ? "bg-orange-500/10 text-orange-400" :
                            "bg-neutral-700 text-neutral-400"
                      )}>
                        {event.status}
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
        </div>
        {filteredEvents.length === 0 && !loading && (
          <div className="p-8 text-center text-neutral-500">
            {UI.noData}
          </div>
        )}

        {/* Pagination Controls */}
        {filteredEvents.length > 0 && (
          <div className="border-t border-neutral-800 p-4 flex items-center justify-between">
            <span className="text-sm text-neutral-400">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredEvents.length)} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-neutral-800 rounded disabled:opacity-50 hover:bg-neutral-700 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-2 py-1 text-sm text-neutral-400 self-center">
                Page {currentPage} / {Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE))}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredEvents.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage >= Math.ceil(filteredEvents.length / ITEMS_PER_PAGE)}
                className="px-3 py-1 text-sm bg-neutral-800 rounded disabled:opacity-50 hover:bg-neutral-700 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

