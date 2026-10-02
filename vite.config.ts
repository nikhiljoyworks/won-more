import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function cloudflareR2DevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'cloudflare-r2-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/upload' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { key, base64Data, contentType = 'image/jpeg' } = JSON.parse(body);
              if (!key || !base64Data) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing key or base64Data' }));
                return;
              }

              const pureBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
              const buffer = Buffer.from(pureBase64, 'base64');

              const FOLDER_LIMITS: Record<string, number> = {
                prizes: 250 * 1024,
                logos: 150 * 1024,
                campaigns: 350 * 1024,
                uploads: 500 * 1024,
              };

              const folderName = key.split('/')[0] || 'uploads';
              const maxAllowedBytes = FOLDER_LIMITS[folderName] || 500 * 1024;

              if (buffer.length > maxAllowedBytes) {
                res.statusCode = 413;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `File size (${Math.round(buffer.length / 1024)}KB) exceeds maximum allowed limit of ${Math.round(maxAllowedBytes / 1024)}KB for ${folderName}.`,
                  })
                );
                return;
              }

              const accountId =
                env.CLOUDFLARE_ACCOUNT_ID || '63a5ead3079ab0e314e53e192a3b862a';
              const accessKeyId =
                env.R2_ACCESS_KEY_ID || '5f717e0673ded00565bec606c0227956';
              const secretAccessKey =
                env.R2_SECRET_ACCESS_KEY ||
                'fb3fc231f3de833685e76388d6b522100a6d51ab2c53174e5b9500553d69448d';
              const bucketName = env.R2_BUCKET_NAME || 'won-more-media';
              const publicBaseUrl =
                env.R2_PUBLIC_URL ||
                'https://pub-e0044e1504ad43c28ca96a5d8158efa3.r2.dev';

              const s3 = new S3Client({
                region: 'auto',
                endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
                credentials: {
                  accessKeyId,
                  secretAccessKey,
                },
              });

              await s3.send(
                new PutObjectCommand({
                  Bucket: bucketName,
                  Key: key,
                  Body: buffer,
                  ContentType: contentType,
                })
              );

              const publicUrl = `${publicBaseUrl}/${key}`;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, url: publicUrl, key }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Upload failed' }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), cloudflareR2DevPlugin(env)],
    server: {
      host: true,
      port: 5173,
    },
  };
});
