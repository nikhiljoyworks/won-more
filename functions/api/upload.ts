import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  R2_BUCKET?: any; // Cloudflare R2 bucket binding if attached in Pages dashboard
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const body: { key: string; base64Data: string; contentType: string } = await request.json();

    const { key, base64Data, contentType = 'image/jpeg' } = body;
    if (!key || !base64Data) {
      return new Response(JSON.stringify({ error: 'Missing key or base64Data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Strip data URL header if present
    const pureBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const binaryStr = atob(pureBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const publicBaseUrl =
      env.R2_PUBLIC_URL || 'https://pub-e0044e1504ad43c28ca96a5d8158efa3.r2.dev';

    // 1. If direct Cloudflare Pages R2 bucket binding exists (named R2_BUCKET)
    if (env.R2_BUCKET && typeof env.R2_BUCKET.put === 'function') {
      await env.R2_BUCKET.put(key, bytes.buffer, {
        httpMetadata: { contentType },
      });
      return new Response(
        JSON.stringify({
          success: true,
          url: `${publicBaseUrl}/${key}`,
          key,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Otherwise use S3 API with credentials
    const accountId = env.CLOUDFLARE_ACCOUNT_ID || '63a5ead3079ab0e314e53e192a3b862a';
    const accessKeyId = env.R2_ACCESS_KEY_ID || '5f717e0673ded00565bec606c0227956';
    const secretAccessKey =
      env.R2_SECRET_ACCESS_KEY || 'fb3fc231f3de833685e76388d6b522100a6d51ab2c53174e5b9500553d69448d';
    const bucketName = env.R2_BUCKET_NAME || 'won-more-media';

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
      Key: key,
      Body: bytes,
      ContentType: contentType,
    });

    await s3.send(command);

    return new Response(
      JSON.stringify({
        success: true,
        url: `${publicBaseUrl}/${key}`,
        key,
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
