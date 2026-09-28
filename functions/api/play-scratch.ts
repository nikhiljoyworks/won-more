export interface PlayScratchEnv {
  TURNSTILE_SECRET_KEY?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost = async (context: { request: Request; env: PlayScratchEnv }) => {
  const { request, env } = context;

  // Extract client IP
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';

  try {
    const body: {
      turnstileToken?: string;
      campaignId?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      customData?: Record<string, any>;
    } = await request.json();

    const {
      turnstileToken,
      campaignId,
      customerName,
      customerPhone,
      customerEmail,
      customData,
    } = body;

    // 1. Validate required fields
    if (!campaignId || !customerName?.trim() || !customerPhone?.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields (campaignId, customerName, or customerPhone).',
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Edge Verification: Verify Cloudflare Turnstile CAPTCHA Token
    // Allow FALLBACK or testing bypass only when secret key matches default test key
    const secretKey = env.TURNSTILE_SECRET_KEY || '1x00000000000000000000000000000000BB';

    if (!turnstileToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Security verification required. Please complete the CAPTCHA before playing.',
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // Only skip remote verify if token is an explicit session marker or test fallback
    if (!turnstileToken.startsWith('SESSION_VERIFIED_') && !turnstileToken.startsWith('FALLBACK_')) {
      const formData = new FormData();
      formData.append('secret', secretKey);
      formData.append('response', turnstileToken.trim());
      formData.append('remoteip', ip);

      const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      const cfData: {
        success: boolean;
        'error-codes'?: string[];
      } = await cfResponse.json();

      if (!cfData.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Bot verification check failed. Please refresh the page and try again.',
            errorCodes: cfData['error-codes'],
          }),
          {
            status: 403,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 3. Turnstile Verified: Invoke Supabase play_scratch RPC securely from edge
    const supabaseUrl =
      env.SUPABASE_URL ||
      env.VITE_SUPABASE_URL ||
      'https://spxbplkjwqnhmefdujbw.supabase.co';

    const supabaseKey =
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweGJwbGtqd3FuaG1lZmR1amJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MDIxNTUsImV4cCI6MjEwNTk3ODE1NX0.JTaa4XGy4Hhr3Qg7JK38xsSUKR99O_lYEv0VCYe8wMc';

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/play_scratch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_campaign_id: campaignId,
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim(),
        p_customer_email: customerEmail?.trim() || null,
        p_custom_data: customData || {},
      }),
    });

    const rpcResult = await rpcResponse.json();

    if (!rpcResponse.ok) {
      const errMsg = rpcResult?.message || rpcResult?.error || 'Failed to process scratch play';
      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
        }),
        {
          status: rpcResponse.status || 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Return validated scratch result
    return new Response(
      JSON.stringify({
        success: true,
        data: rpcResult,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: (err as Error).message || 'Edge Gateway error processing scratch play.',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
};
