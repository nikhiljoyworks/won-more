import { resizeImageFile } from './utils';

export const R2_PUBLIC_BASE_URL =
  import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-e0044e1504ad43c28ca96a5d8158efa3.r2.dev';

export interface UploadOptions {
  folder?: 'logos' | 'prizes' | 'campaigns' | 'uploads';
  namePrefix?: string;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Uploads an image (File or base64 Data URL) to Cloudflare R2
 * Returns the public CDN URL (e.g. https://pub-xxx.r2.dev/logos/urban-roast-123.jpg)
 */
export async function uploadImageToR2(
  fileOrDataUrl: File | string,
  options: UploadOptions = {}
): Promise<string> {
  const folder = options.folder || 'uploads';
  const maxWidth = options.maxWidth || 500;
  const maxHeight = options.maxHeight || 500;
  const namePrefix = (options.namePrefix || 'media')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');

  let base64Data: string;
  let contentType = 'image/jpeg';

  if (typeof fileOrDataUrl === 'string') {
    base64Data = fileOrDataUrl;
    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);/);
      if (match) contentType = match[1];
    }
  } else {
    base64Data = await resizeImageFile(fileOrDataUrl, maxWidth, maxHeight, 0.85);
    const match = base64Data.match(/^data:([^;]+);/);
    if (match) contentType = match[1];
  }

  const extension = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
    ? 'webp'
    : 'jpg';
  const cleanKey = `${folder}/${namePrefix}-${Date.now()}.${extension}`;

  try {
    const authToken =
      localStorage.getItem('won_more_merchant_session_token') ||
      sessionStorage.getItem('wm_admin_token') ||
      'authenticated-user';

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        key: cleanKey,
        base64Data,
        contentType,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.url) {
        return data.url;
      }
    }
    console.warn('/api/upload returned non-OK status, falling back to base64 data URL');
  } catch (err) {
    console.warn('Could not contact /api/upload endpoint, using base64 fallback:', err);
  }

  // Graceful fallback to compressed base64 if upload endpoint is unavailable
  return base64Data;
}
