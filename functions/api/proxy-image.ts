export const onRequestGet = async (context: { request: Request }) => {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const parsed = new URL(targetUrl);

    // 1. SSRF Defense: Enforce HTTPS only
    if (parsed.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only HTTPS URLs are permitted' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. SSRF Defense: Block private/internal network hostnames & cloud metadata services
    const hostname = parsed.hostname.toLowerCase();
    const isPrivateOrLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname === '169.254.169.254' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname);

    if (isPrivateOrLoopback) {
      return new Response(JSON.stringify({ error: 'Access to private and internal hosts is forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch remote resource with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WonMore-ImageProxy/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch source image' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Validate Content-Type: strictly require an image MIME type
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Target URL is not a valid image' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imageBytes = await res.arrayBuffer();

    // Prevent memory exhaustion attacks: max 10MB
    if (imageBytes.byteLength > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Image exceeds maximum allowed size (10MB)' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(imageBytes, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Proxy error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
