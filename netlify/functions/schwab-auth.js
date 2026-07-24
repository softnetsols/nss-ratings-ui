// ────────────────────────────────────────────────────────────────────────────
// SCHWAB OAUTH INITIALIZER (Netlify Function)
// ────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const clientId = process.env.SCHWAB_CLIENT_ID;
  const redirectUri = process.env.SCHWAB_REDIRECT_URI || 'https://nss-analysis-dev.netlify.app/.netlify/functions/schwab-callback';

  if (!clientId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'SCHWAB_CLIENT_ID is not configured in Netlify environment variables.'
      })
    };
  }

  // Schwab OAuth 2.0 Authorization Endpoint
  const schwabAuthUrl = `https://api.schwabapi.com/v1/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return {
    statusCode: 302,
    headers: {
      Location: schwabAuthUrl,
      'Cache-Control': 'no-cache'
    },
    body: ''
  };
};
