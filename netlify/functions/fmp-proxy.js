exports.handler = async (event) => {
  const startTime = Date.now();
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
    'stable/most-actives',
    'stable/quote-short',
    'stable/batch-quote-short'
  ];

  if (!requestedPath || !allowedPaths.includes(requestedPath)) {
    return {
      statusCode: 400,
      body: 'Unsupported FinancialModelingPrep endpoint.'
    };
  }

  let symbolCount = 0;

  // Validation for quote endpoints
  if (requestedPath === 'stable/quote-short' || requestedPath === 'stable/batch-quote-short') {
    const symbols = queryParams.symbols || queryParams.symbol;
    if (!symbols) {
      return {
        statusCode: 400,
        body: 'Missing symbols parameter.'
      };
    }

    if (!/^[A-Za-z0-9.\-\^,]+$/.test(symbols)) {
      return {
        statusCode: 400,
        body: 'Invalid characters in symbols parameter.'
      };
    }

    const symbolList = symbols.split(',').filter(Boolean);
    symbolCount = symbolList.length;

    if (symbolCount > 50) {
      return {
        statusCode: 400,
        body: 'Maximum 50 symbols allowed.'
      };
    }

    for (const sym of symbolList) {
      if (sym.length > 20) {
        return {
          statusCode: 400,
          body: 'Individual symbol exceeds maximum length of 20 characters.'
        };
      }
    }
  }

  const filteredQuery = Object.entries(queryParams)
    .filter(([key]) => key !== 'path' && key !== 'apikey')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const url = `https://financialmodelingprep.com/${requestedPath}?apikey=${encodeURIComponent(apiKey)}${filteredQuery ? `&${filteredQuery}` : ''}`;

  try {
    const response = await fetch(url);
    const body = await response.text();
    const duration = Date.now() - startTime;

    console.log(`[fmp-proxy] endpoint=${requestedPath} symbols=${symbolCount} status=${response.status} duration=${duration}ms`);

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[fmp-proxy] Error: endpoint=${requestedPath} status=502 duration=${duration}ms`, err instanceof Error ? err.message : err);
    return {
      statusCode: 502,
      body: 'Failed to fetch FinancialModelingPrep data.'
    };
  }
};
