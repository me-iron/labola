import { NextResponse } from 'next/server';

/**
 * Server-side proxy to fetch LaBOLA shop pages.
 * LaBOLA blocks iframe embedding (X-Frame-Options: DENY),
 * so we fetch the HTML server-side and serve it to our frontend.
 * 
 * Usage: GET /api/shop-proxy?id=3443&tab=profile|calendar|inquiries
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('id') || '3443';
    const tab = searchParams.get('tab') || 'profile';

    // Map tab to URL path
    let path = '';
    switch (tab) {
        case 'calendar':
            path = '/calendar_week/';
            break;
        case 'inquiries':
            path = '/inquiries/';
            break;
        default: // profile
            path = '/';
            break;
    }

    const targetUrl = `https://yoyaku.labola.jp/r/shop/${shopId}${path}`;

    try {
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ja,en;q=0.9',
            },
            next: { revalidate: 300 }, // Cache 5 min
        });

        if (!res.ok) {
            return NextResponse.json({ success: false, error: `HTTP ${res.status}` }, { status: res.status });
        }

        let html = await res.text();

        // Rewrite relative URLs to absolute
        html = html.replace(/(href|src|action)="\/(?!\/)/g, `$1="https://yoyaku.labola.jp/`);
        // Rewrite relative CSS url() references
        html = html.replace(/url\('?\//g, "url('https://yoyaku.labola.jp/");

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
            },
        });
    } catch (error) {
        console.error('Shop proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch shop page' },
            { status: 500 }
        );
    }
}
