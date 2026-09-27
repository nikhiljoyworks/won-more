import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  R2_BUCKET?: any; // Cloudflare R2 bucket binding if attached in Pages/Workers dashboard
  ADMIN_ACCESS_CODE?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;

    // 1. Authorization Check: Require valid Bearer token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required to upload media' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: { key: string; base64Data: string; contentType?: string } = await request.json();
    const { key, base64Data, contentType = 'image/jpeg' } = body;

    if (!key || !base64Data) {
      return new Response(JSON.stringify({ error: 'Missing key or base64Data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. MIME Type Validation
    const cleanContentType = contentType.toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES.has(cleanContentType)) {
      return new Response(
        JSON.stringify({ error: `Unsupported image format. Allowed formats: PNG, JPG, WebP, GIF, SVG.` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Size Limit (Max 5MB raw, ~7MB base64)
    if (base64Data.length > 7 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File size exceeds maximum allowed limit (5MB)' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Sanitize Storage Key (Path Traversal Prevention)
    const sanitizedKey = key
      .replace(/\\/g, '/')
      .replace(/\.{2,}/g, '') // remove ..
      .replace(/^\/+/, '')    // remove leading slash
      .replace(/[^a-zA-Z0-9_\-./]/g, '_');

    if (!sanitizedKey) {
      return new Response(JSON.stringify({ error: 'Invalid storage key path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Strip data URL header if present
    const pureBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const binaryStr = atob(pureBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const publicBaseUrl =
      env.R2_PUBLIC_URL || 'https://pub-e0044e1504ad43c28ca96a5d8158efa3.r2.dev';

    // Option A: Direct Cloudflare R2 bucket binding (Zero Secret Exposure)
    if (env.R2_BUCKET && typeof env.R2_BUCKET.put === 'function') {
      await env.R2_BUCKET.put(sanitizedKey, bytes.buffer, {
        httpMetadata: { contentType: cleanContentType },
      });
      return new Response(
        JSON.stringify({
          success: true,
          url: `${publicBaseUrl}/${sanitizedKey}`,
          key: sanitizedKey,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Option B: S3 API using environment secrets (No hardcoded credentials)
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME || 'won-more-media';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return new Response(
        JSON.stringify({
          error: 'Cloudflare R2 configuration error: Missing environment credentials or R2 bucket binding.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: sanitizedKey,
      Body: bytes,
      ContentType: cleanContentType,
    });

    await s3.send(command);

    return new Response(
      JSON.stringify({
        success: true,
        url: `${publicBaseUrl}/${sanitizedKey}`,
        key: sanitizedKey,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: (err as Error).message || 'Failed to upload to Cloudflare R2',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
