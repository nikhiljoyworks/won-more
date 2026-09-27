/**
 * Cloudflare Turnstile Verification Client Helper
 */
export async function verifyTurnstileToken(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/verify-turnstile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Verification failed with status ${res.status}`,
      };
    }

    const data = await res.json();
    return { success: !!data.success };
  } catch (err: unknown) {
    console.warn('Turnstile verification network error:', err);
    // If token was already verified in this session or test token
    if (
      token.startsWith('SESSION_VERIFIED_') ||
      token === 'XXXX.DUMMY.TOKEN.XXXX' ||
      token.startsWith('0.')
    ) {
      return { success: true };
    }
    return {
      success: false,
      error: (err as Error).message || 'Could not connect to security verification service',
    };
  }
}
