import { onRequestPost } from '../functions/api/upload';
import { onRequestGet as proxyImageGet } from '../functions/api/proxy-image';
import { onRequestGet as clientIpGet } from '../functions/api/client-ip';

export interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route /api/upload POST requests to our R2 upload handler
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      return onRequestPost({ request, env });
    }

    // Route /api/proxy-image GET requests to image proxy handler
    if (url.pathname === '/api/proxy-image' && request.method === 'GET') {
      return proxyImageGet({ request });
    }

    // Route /api/client-ip GET requests to IP extractor
    if (url.pathname === '/api/client-ip' && request.method === 'GET') {
      return clientIpGet({ request });
    }

    // CORS preflight handling for API endpoints
    if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Fallback to static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
