import React from 'react';

interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    subtext: string;
}

export function StatCard({ label, value, icon, subtext }: StatCardProps) {
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
