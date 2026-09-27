export const onRequestGet = async (context: { env: Record<string, string> }) => {
  const siteKey =
    context.env?.VITE_TURNSTILE_SITE_KEY ||
    context.env?.TURNSTILE_SITE_KEY ||
    '';

  return new Response(JSON.stringify({ siteKey }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
