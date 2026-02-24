/**
 * Cloudflare Pages middleware — intercepts requests to inject dynamic OG meta
 * tags for social media crawlers when share params are present in the URL.
 *
 * Normal browser requests pass through untouched.
 */

const CRAWLER_RE = /bot|crawler|spider|facebookexternalhit|Facebot|meta-externalagent|twitterbot|TwitterBot|CardFetcher|Discordbot|Slackbot|LinkedInBot|WhatsApp|Telegram/i;

function isCrawler(request) {
    const ua = request.headers.get('user-agent') || '';
    return CRAWLER_RE.test(ua);
}

function hasShareParams(url) {
    return url.searchParams.has('s'); // 's' (seed/intent) is the required share param
}

export async function onRequest(context) {
    const { request, next } = context;
    const url = new URL(request.url);

    // Pass through non-crawler requests and requests without share params
    if (!isCrawler(request) || !hasShareParams(url)) {
        return next();
    }

    // Fetch the original HTML response from Pages
    const response = await next();

    // Only rewrite HTML responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
        return response;
    }

    // Build the OG image URL pointing to our render endpoint
    const ogImageUrl = new URL('/og-render', url.origin);
    for (const [key, value] of url.searchParams) {
        ogImageUrl.searchParams.set(key, value);
    }

    const name = url.searchParams.get('n') || '';
    const title = name
        ? `${name} — Geometric Interior`
        : 'Geometric Interior: Self-Portraits of a Predictive Model';
    const fullUrl = url.toString();

    // Rewrite OG and Twitter meta tags
    return new HTMLRewriter()
        .on('meta[property="og:image"]', new MetaRewriter('content', ogImageUrl.toString()))
        .on('meta[property="og:title"]', new MetaRewriter('content', title))
        .on('meta[property="og:url"]', new MetaRewriter('content', fullUrl))
        .on('meta[name="twitter:image"]', new MetaRewriter('content', ogImageUrl.toString()))
        .on('meta[name="twitter:title"]', new MetaRewriter('content', title))
        .transform(response);
}

class MetaRewriter {
    constructor(attr, value) {
        this.attr = attr;
        this.value = value;
    }
    element(el) {
        el.setAttribute(this.attr, this.value);
    }
}
