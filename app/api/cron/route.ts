import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for full 30-day crawl

// This endpoint is called by Vercel Cron at 00:00 UTC (09:00 KST)
export async function GET(request: Request) {
    try {
        // Verify cron secret for security (optional but recommended)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Cron job started: Full 30-day update');

        const startDate = new Date().toISOString().substring(0, 10);
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        // Call the crawl API with clean mode for full refresh
        const response = await fetch(`${baseUrl}/api/crawl?startDate=${startDate}&days=30&clean=true`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        console.log('Cron job completed:', data);

        return NextResponse.json({
            success: true,
            message: 'Scheduled 30-day update completed',
            result: data,
            executedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Cron job failed',
            executedAt: new Date().toISOString()
        }, { status: 500 });
    }
}
