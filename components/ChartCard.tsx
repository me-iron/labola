import React from 'react';

interface ChartCardProps {
    title: string;
    children: React.ReactNode;
}

export function ChartCard({ title, children }: ChartCardProps) {
    return (
        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
            {children}
        </div>
    );
}
