
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OrganizerChartProps {
    data: {
        stadium: string;
        supply: number;
        count: number;
    }[];
}

export function OrganizerChart({ data }: OrganizerChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
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
    );
}
