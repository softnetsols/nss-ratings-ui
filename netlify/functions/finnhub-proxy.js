exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: 'Missing Finnhub API key on server.'
    };
  }

  const queryParams = event.queryStringParameters || {};
  const requestedPathValue = queryParams.path || '';
  const requestedPath = requestedPathValue.startsWith('/') ? requestedPathValue : `/${requestedPathValue}`;

  const allowedPaths = [
    '/stock/recommendation',
    '/upgrades-downgrades',
    '/stock/profile2',
    '/quote'
  ];

  if (!requestedPath || !allowedPaths.includes(requestedPath)) {
    return {
      statusCode: 400,
      body: 'Unsupported Finnhub endpoint.'
    };
  }

  const symbol = (queryParams.symbol || '').toString().trim().toUpperCase();
  const symbolRegex = /^[A-Z0-9.\-]{1,12}$/;
  if (!symbolRegex.test(symbol)) {
    return {
      statusCode: 400,
      body: 'Missing or invalid symbol parameter.'
    };
  }

  const url = `https://finnhub.io/api/v1${requestedPath}?symbol=${encodeURIComponent(symbol)}`;
  const finalUrl = `${url}&token=${apiKey}`;

  try {
    const response = await fetch(finalUrl);
    const body = await response.text();
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body
    };
  } catch (err) {
    console.error('Finnhub proxy error:', err instanceof Error ? err.message : err);
    return {
      statusCode: 502,
      body: 'Failed to fetch Finnhub data.'
    };
  }
};
