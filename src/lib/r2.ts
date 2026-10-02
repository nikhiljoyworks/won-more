import { compressImageToTargetSize } from './utils';

export const R2_PUBLIC_BASE_URL =
  import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-e0044e1504ad43c28ca96a5d8158efa3.r2.dev';

export const FOLDER_SIZE_LIMITS: Record<string, number> = {
  prizes: 250 * 1024,     // 250 KB strictly for prize images
  logos: 150 * 1024,      // 150 KB for shop logos
  campaigns: 350 * 1024,  // 350 KB for campaign banners
  uploads: 250 * 1024,    // 250 KB default
};

export interface UploadOptions {
  folder?: 'logos' | 'prizes' | 'campaigns' | 'uploads';
  namePrefix?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxSizeBytes?: number;
}

/**
 * Uploads an image (File or base64 Data URL) to Cloudflare R2
 * Automatically reduces size to meet folder limits (e.g. 250KB for prizes).
 * Returns the public CDN URL (e.g. https://pub-xxx.r2.dev/prizes/prize-123.webp)
 */
export async function uploadImageToR2(
  fileOrDataUrl: File | string,
  options: UploadOptions = {}
): Promise<string> {
  const folder = options.folder || 'uploads';
  const maxWidth = options.maxWidth || 800;
  const maxHeight = options.maxHeight || 600;
  const sizeLimit = options.maxSizeBytes || FOLDER_SIZE_LIMITS[folder] || 250 * 1024;
  const namePrefix = (options.namePrefix || 'media')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');

  // 1. Client-Side Adaptive Compression (Shrinks images down to <= sizeLimit)
  const compressionResult = await compressImageToTargetSize(
    fileOrDataUrl,
    sizeLimit,
    maxWidth,
    maxHeight
  );

  const base64Data = compressionResult.dataUrl;
  const contentType = compressionResult.mimeType || 'image/jpeg';
  const byteSize = compressionResult.byteSize;

  // 2. Client-side sanity check against folder limit
  if (byteSize > sizeLimit) {
    const limitKb = Math.round(sizeLimit / 1024);
    const actualKb = Math.round(byteSize / 1024);
    throw new Error(
      `Image size (${actualKb}KB) exceeds the maximum limit of ${limitKb}KB for ${folder}.`
    );
  }

  const extension = contentType.includes('webp')
    ? 'webp'
    : contentType.includes('png')
    ? 'png'
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

    const data = await res.json().catch(() => null);

    if (res.ok && data?.url) {
      return data.url;
    }

    if (res.status === 413 || data?.error) {
      throw new Error(data?.error || 'Upload rejected: file exceeds size limit.');
    }

    console.warn('/api/upload returned non-OK status, falling back to base64 data URL');
  } catch (err: unknown) {
    if ((err as Error).message?.includes('exceeds')) {
      throw err;
    }
    console.warn('Could not contact /api/upload endpoint, using base64 fallback:', err);
  }

  // Graceful fallback to compressed base64 if upload endpoint is unavailable
  return base64Data;
}
