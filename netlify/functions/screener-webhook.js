const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const payload = JSON.parse(event.body);

    // Verify token (authorization header or query param)
    const token = event.headers['authorization'] || (event.queryStringParameters && event.queryStringParameters.token);
    const expectedToken = process.env.WEBHOOK_SECRET_TOKEN;
    if (expectedToken && token !== expectedToken) {
      return {
        statusCode: 401,
        body: 'Unauthorized'
      };
    }

    // Initialize Supabase Client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: 'Missing Supabase environment variables on server.'
      };
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bullish = payload.bullish || [];
    const bearish = payload.bearish || [];
    const group_name = payload.group || 'Unknown';

    // Combine lists with direction flag
    const rows = [];
    for (const item of bullish) {
      rows.push({
        symbol: item.sym,
        direction: 'bullish',
        price: item.price,
        change_pct: item.chg,
        rvol: item.rvol,
        vwap_dist: item.vwap_dist,
        score: item.score,
        age: item.age,
        group_name: group_name,
        updated_at: new Date().toISOString()
      });
    }

    for (const item of bearish) {
      rows.push({
        symbol: item.sym,
        direction: 'bearish',
        price: item.price,
        change_pct: item.chg,
        rvol: item.rvol,
        vwap_dist: item.vwap_dist,
        score: item.score,
        age: item.age,
        group_name: group_name,
        updated_at: new Date().toISOString()
      });
    }

    // 1. Delete previous setups for this watchlist group
    const { error: deleteError } = await supabase
      .from('screener_setups')
      .delete()
      .eq('group_name', group_name);

    if (deleteError) {
      console.error('Error clearing old setups:', deleteError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: deleteError.message })
      };
    }

    // 2. Insert new setups (if any are active)
    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('screener_setups')
        .insert(rows);

      if (insertError) {
        console.error('Error inserting setups:', insertError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: insertError.message })
        };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, count: rows.length })
    };

  } catch (err) {
    console.error('Webhook processing error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
