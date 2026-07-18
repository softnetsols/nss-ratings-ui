exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: 'Missing FMP API key on server.'
    };
  }

  const queryParams = event.queryStringParameters || {};
  const requestedPathValue = queryParams.path || '';
  const requestedPath = requestedPathValue.startsWith('/') ? requestedPathValue.slice(1) : requestedPathValue;

  const allowedPaths = [
    'stable/grades-latest-news',
    'stable/most-actives'
  ];

  if (!requestedPath || !allowedPaths.includes(requestedPath)) {
    return {
      statusCode: 400,
      body: 'Unsupported FinancialModelingPrep endpoint.'
    };
  }

  const filteredQuery = Object.entries(queryParams)
    .filter(([key]) => key !== 'path' && key !== 'apikey')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const url = `https://financialmodelingprep.com/${requestedPath}?apikey=${encodeURIComponent(apiKey)}${filteredQuery ? `&${filteredQuery}` : ''}`;

  try {
    const response = await fetch(url);
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body
    };
  } catch (err) {
    console.error('FMP proxy error:', err instanceof Error ? err.message : err);
    return {
      statusCode: 502,
      body: 'Failed to fetch FinancialModelingPrep data.'
    };
  }
};
