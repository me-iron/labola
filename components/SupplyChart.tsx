
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SupplyChartProps {
    data: {
        date: string;
        supply: number;
        booked: number;
        count: number;
        proceeding: number;
    }[];
    t: any;
}

export function SupplyChart({ data, t }: SupplyChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#e5e5e5' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend
                    // @ts-ignore
                    payload={[
                        { value: "Proceeding Events", type: 'rect', color: '#10b981', id: 'proceeding' },
                        { value: "Total Events", type: 'rect', color: '#6366f1', id: 'count' }
                    ]}
                />
                <Bar dataKey="proceeding" name="Proceeding Events" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" name="Total Events" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
