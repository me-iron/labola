'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin, Search, Layers, ArrowLeft, BarChart3 } from 'lucide-react';
import type { MapVenue } from '@/components/MapClient';

const MapClient = dynamic(() => import('@/components/MapClient'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4" />
            <p className="text-neutral-400">지도를 불러오는 중...</p>
        </div>
    ),
});

export default function MapPage() {
    const [venues, setVenues] = useState<MapVenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'labola' | 'external'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const [stats, setStats] = useState({ total: 0, labola: 0, external: 0 });

    useEffect(() => {
        fetch('/api/map-venues')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setVenues(data.venues);
                    setStats(data.stats);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filteredVenues = venues.filter(v => {
        if (filter === 'labola' && v.source !== 'labola') return false;
        if (filter === 'external' && v.source === 'labola') return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return v.name.toLowerCase().includes(query) || v.address.toLowerCase().includes(query);
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col">
            <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-800/50 h-16 shrink-0 flex items-center px-4">
                <div className="flex items-center gap-4 w-full max-w-[1600px] mx-auto">
                    <Link href="/" className="p-2 -ml-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-blue-400" />
                    </div>
                    <h1 className="text-lg font-semibold flex-1">도쿄 풋살장 지도</h1>

                    <div className="hidden md:flex items-center gap-6 text-sm">
                        <span>전체 <b className="font-semibold">{stats.total}</b></span>
                        <span className="text-blue-400">LaBOLA <b className="font-semibold">{stats.labola}</b></span>
                        <span className="text-emerald-400">Google <b className="font-semibold">{stats.external}</b></span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
                <aside className="w-full lg:w-[400px] flex flex-col bg-[#0f0f0f] border-r border-neutral-800 h-1/2 lg:h-full z-10 shrink-0">
                    <div className="p-4 border-b border-neutral-800 space-y-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="구장명 검색..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setFilter('all')} className={"flex-1 py-1.5 text-xs rounded-md " + (filter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400')}>전체</button>
                            <button onClick={() => setFilter('labola')} className={"flex-1 py-1.5 text-xs rounded-md " + (filter === 'labola' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400')}>LaBOLA</button>
                            <button onClick={() => setFilter('external')} className={"flex-1 py-1.5 text-xs rounded-md " + (filter === 'external' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-400')}>Google</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? (
                            <div className="p-8 text-center text-neutral-500 text-sm">로딩 중...</div>
                        ) : filteredVenues.map(venue => (
                            <button
                                key={venue.id}
                                onClick={() => setSelectedVenue(venue.id)}
                                className={"w-full text-left p-3 mb-1 rounded-lg border " + (selectedVenue === venue.id ? 'bg-blue-500/10 border-blue-500/30' : 'border-transparent hover:bg-neutral-800/50')}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-sm truncate">{venue.name}</h3>
                                    <span className={"text-[10px] px-1.5 py-0.5 rounded " + (venue.source === 'labola' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400')}>
                                        {venue.source === 'labola' ? 'LaBOLA' : 'Google'}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-500 truncate mb-1">{venue.address}</p>
                                {venue.source === 'labola' && venue.eventCount > 0 && (
                                    <div className="flex gap-3 text-[11px] text-neutral-400">
                                        <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {venue.courtCount}</span>
                                        <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {venue.eventCount}</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </aside>

                <div className="flex-1 bg-neutral-900 relative">
                    <MapClient
                        venues={venues}
                        filter={filter}
                        selectedVenue={selectedVenue}
                        onSelectVenue={setSelectedVenue}
                    />
                </div>
            </main>
        </div>
    );
}
