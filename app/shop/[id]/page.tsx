'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Calendar, MessageCircle, ExternalLink, RefreshCw } from 'lucide-react';

type Tab = 'profile' | 'calendar' | 'inquiries';

const TABS: { key: Tab; label: string; labelEn: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'プロフィール', labelEn: 'Profile', icon: <Building2 className="w-4 h-4" /> },
    { key: 'calendar', label: '空き情報・予約', labelEn: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
    { key: 'inquiries', label: 'お問い合わせ', labelEn: 'Inquiry', icon: <MessageCircle className="w-4 h-4" /> },
];

export default function ShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = React.use(params);
    const shopId = resolvedParams.id;

    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [html, setHtml] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPage = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/shop-proxy?id=${shopId}&tab=${activeTab}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                setHtml(text);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load');
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [shopId, activeTab]);

    const labolaUrl = `https://yoyaku.labola.jp/r/shop/${shopId}/${activeTab === 'profile' ? '' : activeTab === 'calendar' ? 'calendar_week/' : 'inquiries/'}`;

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-sm font-medium">대시보드</span>
                            </Link>
                            <div className="h-6 w-px bg-neutral-800" />
                            <h1 className="text-lg font-bold">구장 상세정보</h1>
                            <span className="text-xs font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded">ID: {shopId}</span>
                        </div>

                        <a
                            href={labolaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            원본 보기
                        </a>
                    </div>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="sticky top-[73px] z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 py-2">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${activeTab === tab.key
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="ml-3 text-neutral-400">로딩 중...</span>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center py-24 text-red-400">
                        <p className="text-lg font-medium">페이지 로드 실패</p>
                        <p className="text-sm mt-2">{error}</p>
                        <button
                            onClick={() => setActiveTab(activeTab)}
                            className="mt-4 px-4 py-2 bg-red-900/50 hover:bg-red-800/70 rounded-lg text-sm transition-colors"
                        >
                            다시 시도
                        </button>
                    </div>
                )}

                {!loading && !error && (
                    <div className="bg-white rounded-xl overflow-hidden shadow-2xl shadow-black/30">
                        <iframe
                            srcDoc={html}
                            className="w-full border-0"
                            style={{ minHeight: '800px', height: '100vh' }}
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                            title={`LaBOLA Shop ${shopId} - ${activeTab}`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
