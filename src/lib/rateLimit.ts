export const MAX_LOGIN_ATTEMPTS = 5;
export const BLOCK_DURATION_SECONDS = 90;

export async function getClientIp(): Promise<string> {
  try {
    const res = await fetch('/api/client-ip');
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) return data.ip;
    }
  } catch {
    // Ignore and fallback
  }

  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) return data.ip;
    }
  } catch {
    // Fallback to local identifier
  }

  return 'client-user';
}

interface RateLimitRecord {
  attempts: number;
  blockedUntil: number | null; // epoch timestamp in ms
}

function getStorageKey(scope: 'merchant' | 'admin', ip: string): string {
  const cleanIp = ip.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `rate_limit_${scope}_${cleanIp}`;
}

export function checkRateLimit(
  scope: 'merchant' | 'admin',
  ip: string
): { isBlocked: boolean; remainingSeconds: number; attempts: number } {
  try {
    const raw = localStorage.getItem(getStorageKey(scope, ip));
    if (!raw) return { isBlocked: false, remainingSeconds: 0, attempts: 0 };

    const record: RateLimitRecord = JSON.parse(raw);
    const now = Date.now();

    if (record.blockedUntil && record.blockedUntil > now) {
      const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return { isBlocked: true, remainingSeconds, attempts: record.attempts };
    }

    // If block duration has expired, reset
    if (record.blockedUntil && record.blockedUntil <= now) {
      localStorage.removeItem(getStorageKey(scope, ip));
      return { isBlocked: false, remainingSeconds: 0, attempts: 0 };
    }

    return {
      isBlocked: false,
      remainingSeconds: 0,
      attempts: record.attempts || 0,
    };
  } catch {
    return { isBlocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedAttempt(
  scope: 'merchant' | 'admin',
  ip: string
): { isBlocked: boolean; remainingSeconds: number; attempts: number } {
  const current = checkRateLimit(scope, ip);
  const newAttempts = current.attempts + 1;

  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    const blockedUntil = Date.now() + BLOCK_DURATION_SECONDS * 1000;
    const record: RateLimitRecord = {
      attempts: newAttempts,
      blockedUntil,
    };
    localStorage.setItem(getStorageKey(scope, ip), JSON.stringify(record));
    return {
      isBlocked: true,
      remainingSeconds: BLOCK_DURATION_SECONDS,
      attempts: newAttempts,
    };
  }

  const record: RateLimitRecord = {
    attempts: newAttempts,
    blockedUntil: null,
  };
  localStorage.setItem(getStorageKey(scope, ip), JSON.stringify(record));
  return {
    isBlocked: false,
    remainingSeconds: 0,
    attempts: newAttempts,
  };
}

export function resetRateLimit(scope: 'merchant' | 'admin', ip: string): void {
  try {
    localStorage.removeItem(getStorageKey(scope, ip));
  } catch {
    // Ignore storage errors
  }
}

export function clearAllStoredRateLimits(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('rate_limit_') || key.includes('43_229_88_237') || key.includes('43.229.88.237'))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore
  }
}

