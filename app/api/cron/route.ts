import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron — runs daily at 00:00 UTC (09:00 KST)
 * 
 * Only refreshes today's data (days=1) to stay within Vercel Hobby 10s limit.
 * The full 30-day crawl is handled by the GitHub Actions workflow.
 * 
 * NO clean=true — uses safe upsert that preserves existing prices.
 */
export async function GET(request: Request) {
    try {
        // Verify cron secret for security
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Cron job started: 1-day safe update (no delete)');

        const startDate = new Date().toISOString().substring(0, 10);
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        // Call crawl API — days=1 only, NO clean parameter
        const response = await fetch(`${baseUrl}/api/crawl?startDate=${startDate}&days=1`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        console.log('Cron job completed:', data);

        return NextResponse.json({
            success: true,
            message: '1-day safe update completed',
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
