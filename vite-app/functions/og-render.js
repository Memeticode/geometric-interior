/**
 * OG image render endpoint — returns a PNG for social media previews.
 *
 * Primary: Cloudflare Browser Rendering (screenshots the actual Three.js scene).
 * Fallback: Styled 2D card via @vercel/og ImageResponse (when browser budget
 * is exhausted or rendering fails).
 *
 * Responses are cached forever (deterministic renders = same params = same image).
 */

import puppeteer from '@cloudflare/puppeteer';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Palette display names for the fallback card
const PALETTE_LABELS = {
    'violet-depth': 'Violet Depth',
    'warm-spectrum': 'Warm Spectrum',
    'teal-volumetric': 'Teal Volumetric',
    'prismatic': 'Prismatic',
    'crystal-lattice': 'Crystal Lattice',
    'sapphire': 'Sapphire',
    'amethyst': 'Amethyst',
    'custom': 'Custom',
};

// Palette accent hues for the fallback card gradient
const PALETTE_HUES = {
    'violet-depth': 280,
    'warm-spectrum': 40,
    'teal-volumetric': 190,
    'prismatic': 270,
    'crystal-lattice': 230,
    'sapphire': 220,
    'amethyst': 295,
    'custom': 325,
};

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Only respond to requests with share params
    if (!url.searchParams.has('s')) {
        return new Response('Missing share params', { status: 400 });
    }

    // Check cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // TODO: Re-enable Browser Rendering once spending cap is configured
    // let png;
    // try {
    //     png = await renderWithBrowser(env, url);
    // } catch (err) {
    //     console.error('Browser Rendering failed, using fallback card:', err.message);
    //     png = await renderFallbackCard(url);
    // }
    const png = await renderFallbackCard(url);

    const response = new Response(png, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });

    // Store in cache (non-blocking)
    context.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
}

/**
 * Primary: Use Cloudflare Browser Rendering to screenshot the actual scene.
 */
async function renderWithBrowser(env, ogUrl) {
    if (!env.BROWSER) {
        throw new Error('BROWSER binding not available');
    }

    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: OG_WIDTH, height: OG_HEIGHT });

        // Build the app URL with the same share params
        const appUrl = new URL('/', ogUrl.origin);
        for (const [key, value] of ogUrl.searchParams) {
            appUrl.searchParams.set(key, value);
        }

        await page.goto(appUrl.toString(), { waitUntil: 'networkidle0', timeout: 15000 });

        // Wait for render to complete (canvas overlay gets 'hidden' class)
        await page.waitForSelector('#canvasOverlay.hidden', { timeout: 12000 });

        // Small extra delay for any post-render effects to settle
        await new Promise(r => setTimeout(r, 500));

        // Screenshot just the canvas area
        const canvasEl = await page.$('#c');
        let png;
        if (canvasEl) {
            png = await canvasEl.screenshot({ type: 'png' });
        } else {
            png = await page.screenshot({ type: 'png' });
        }

        return png;
    } finally {
        await page.close();
        await browser.close();
    }
}

/**
 * Fallback: Generate a styled 2D card when Browser Rendering is unavailable.
 * Uses @vercel/og ImageResponse via the Cloudflare Pages plugin.
 */
async function renderFallbackCard(url) {
    // Dynamic import to avoid loading when not needed
    const { ImageResponse } = await import('@cloudflare/pages-plugin-vercel-og/api');

    const name = url.searchParams.get('n') || 'Geometric Interior';
    const palette = url.searchParams.get('p') || 'violet-depth';
    const paletteLabel = PALETTE_LABELS[palette] || palette;
    const hue = PALETTE_HUES[palette] || 280;

    const response = new ImageResponse(
        {
            type: 'div',
            props: {
                style: {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: `linear-gradient(135deg, hsl(${hue}, 30%, 8%) 0%, hsl(${hue}, 40%, 4%) 100%)`,
                    fontFamily: 'sans-serif',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '24px',
                            },
                            children: [
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            fontSize: '48px',
                                            fontWeight: 700,
                                            color: `hsl(${hue}, 50%, 80%)`,
                                            textAlign: 'center',
                                            maxWidth: '900px',
                                            lineHeight: 1.2,
                                        },
                                        children: name,
                                    },
                                },
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                        },
                                        children: [
                                            {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        width: '12px',
                                                        height: '12px',
                                                        borderRadius: '50%',
                                                        background: `hsl(${hue}, 60%, 60%)`,
                                                    },
                                                },
                                            },
                                            {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        fontSize: '22px',
                                                        color: `hsl(${hue}, 20%, 55%)`,
                                                        letterSpacing: '0.05em',
                                                    },
                                                    children: paletteLabel,
                                                },
                                            },
                                        ],
                                    },
                                },
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            fontSize: '16px',
                                            color: `hsl(${hue}, 15%, 40%)`,
                                            marginTop: '16px',
                                            letterSpacing: '0.15em',
                                            textTransform: 'uppercase',
                                        },
                                        children: 'Geometric Interior',
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        { width: OG_WIDTH, height: OG_HEIGHT },
    );

    return new Uint8Array(await response.arrayBuffer());
}
