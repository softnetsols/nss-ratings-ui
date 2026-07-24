// ────────────────────────────────────────────────────────────────────────────
// SCHWAB OAUTH CALLBACK HANDLER (Netlify Function)
// ────────────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const queryParams = event.queryStringParameters || {};
  const authCode = queryParams.code;
  const error = queryParams.error;

  if (error) {
    console.error('[schwab-callback] OAuth Error:', error);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: `<h3>Schwab Authorization Failed</h3><p>Error: ${error}</p>`
    };
  }

  if (!authCode) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: `<h3>Missing Authorization Code</h3><p>No authorization code received from Schwab.</p>`
    };
  }

  const clientId = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
  const redirectUri = process.env.SCHWAB_REDIRECT_URI || 'https://nss-analysis-dev.netlify.app/.netlify/functions/schwab-callback';

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `<h3>Server Configuration Error</h3><p>Schwab API credentials missing on server.</p>`
    };
  }

  try {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://api.schwabapi.com/v1/oauth/token';

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'authorization_code');
    bodyParams.append('code', authCode);
    bodyParams.append('redirect_uri', redirectUri);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[schwab-callback] Token Exchange Error:', data);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `<h3>Token Exchange Failed</h3><pre>${JSON.stringify(data, null, 2)}</pre>`
      };
    }

    console.log('[schwab-callback] Schwab OAuth Success! Access token granted.');

    // Return clean success HTML page that passes tokens back to UI opener
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Schwab Connected</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; }
          .icon { font-size: 3rem; color: #10b981; margin-bottom: 1rem; }
          h2 { margin: 0 0 0.5rem 0; color: #38bdf8; }
          p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; }
          button { background: #0284c7; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
          button:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Schwab Connected!</h2>
          <p>Your Charles Schwab account has been successfully linked for Paper & Live trading.</p>
          <button onclick="window.close()">Close Window</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'SCHWAB_AUTH_SUCCESS', tokens: ${JSON.stringify(data)} }, '*');
          }
        </script>
      </body>
      </html>
    `;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: htmlResponse
    };
  } catch (err) {
    console.error('[schwab-callback] Exception:', err);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/html' },
      body: `<h3>Server Exception</h3><p>${err instanceof Error ? err.message : String(err)}</p>`
    };
  }
};
