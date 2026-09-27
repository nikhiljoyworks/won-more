export interface TurnstileEnv {
  TURNSTILE_SECRET_KEY?: string;
}

export const onRequestPost = async (context: { request: Request; env: TurnstileEnv }) => {
  const { request, env } = context;

  // Extract client IP
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';

  try {
    const body: { token?: string } = await request.json();
    const token = body?.token?.trim();

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Cloudflare Turnstile token missing. Please complete verification.' 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*' 
          } 
        }
      );
    }

    // Default to Cloudflare Turnstile Always-Pass test secret key if not set
    const secretKey = env.TURNSTILE_SECRET_KEY || '1x00000000000000000000000000000000BB';

    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const cfData: {
      success: boolean;
      'error-codes'?: string[];
      challenge_ts?: string;
      hostname?: string;
    } = await cfResponse.json();

    if (!cfData.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bot verification check failed. Please refresh and try again.',
          errorCodes: cfData['error-codes'],
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: Date.now(),
        hostname: cfData.hostname,
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
      JSON.stringify({ 
        success: false, 
        error: (err as Error).message || 'Turnstile verification service error' 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
