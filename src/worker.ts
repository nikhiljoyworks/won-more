import { onRequestPost } from '../functions/api/upload';
import { onRequestGet as proxyImageGet } from '../functions/api/proxy-image';
import { onRequestGet as clientIpGet } from '../functions/api/client-ip';

export interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  ADMIN_ACCESS_CODE?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

// In-memory rate limiter for Admin authentication on the Edge Worker
const adminRateLimiter = new Map<string, { attempts: number; blockedUntil: number }>();

function getClientIpFromReq(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS preflight handling for all /api/* endpoints
    if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 2. Route /api/admin/login (Server-side admin authentication with 90s rate limiting)
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      const ip = getClientIpFromReq(request);
      const now = Date.now();
      const existing = adminRateLimiter.get(ip);

      if (existing && existing.blockedUntil > now) {
        const remainingSeconds = Math.ceil((existing.blockedUntil - now) / 1000);
        return new Response(
          JSON.stringify({
            success: false,
            isBlocked: true,
            remainingSeconds,
            error: `Security lockout: 5 consecutive incorrect login attempts. Access is temporarily blocked for ${remainingSeconds} seconds.`,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Retry-After': String(remainingSeconds),
            },
          }
        );
      }

      try {
        const body: { accessCode?: string } = await request.json();
        const accessCode = body?.accessCode?.trim();
        const expectedSecret = env.ADMIN_ACCESS_CODE || 'WM_ADMIN_2026';

        if (!accessCode || accessCode !== expectedSecret) {
          const attempts = (existing && existing.blockedUntil <= now ? 0 : existing?.attempts || 0) + 1;

          if (attempts >= 5) {
            const blockedUntil = now + 90 * 1000;
            adminRateLimiter.set(ip, { attempts, blockedUntil });
            return new Response(
              JSON.stringify({
                success: false,
                isBlocked: true,
                remainingSeconds: 90,
                error: 'Security lockout: 5 consecutive incorrect attempts. Access blocked for 90 seconds.',
              }),
              {
                status: 429,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Retry-After': '90',
                },
              }
            );
          } else {
            adminRateLimiter.set(ip, { attempts, blockedUntil: 0 });
            const remaining = 5 - attempts;
            return new Response(
              JSON.stringify({
                success: false,
                isBlocked: false,
                remainingAttempts: remaining,
                error: `Invalid admin access code. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 90s lockout)`,
              }),
              {
                status: 401,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
              }
            );
          }
        }

        // On successful authentication, reset rate limiting and return verified admin token
        adminRateLimiter.delete(ip);
        return new Response(
          JSON.stringify({
            success: true,
            token: 'WM_ADMIN_2026',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (err: unknown) {
        return new Response(
          JSON.stringify({ success: false, error: (err as Error).message || 'Invalid request' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // 3. Route /api/upload POST requests to our R2 upload handler
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      return onRequestPost({ request, env });
    }

    // 4. Route /api/proxy-image GET requests to image proxy handler
    if (url.pathname === '/api/proxy-image' && request.method === 'GET') {
      return proxyImageGet({ request });
    }

    // 5. Route /api/client-ip GET requests to IP extractor
    if (url.pathname === '/api/client-ip' && request.method === 'GET') {
      return clientIpGet({ request });
    }

    // 6. Fallback to static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
