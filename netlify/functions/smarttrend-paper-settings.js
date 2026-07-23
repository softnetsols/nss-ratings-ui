const { createClient } = require('@supabase/supabase-js');
const { getETDateString } = require('./_shared/smarttrend-performance');

exports.handler = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      body: 'Missing Supabase environment variables on server.'
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (event.httpMethod === 'GET') {
    try {
      const { data, error } = await supabase
        .from('smarttrend_paper_settings')
        .select('*')
        .eq('setting_key', 'default')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is single row not found
        console.error('Error fetching settings:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      const setting = data || {
        setting_key: 'default',
        allocation_per_trade: 10000.00,
        effective_from: getETDateString(new Date())
      };

      // Check if today's allocation is locked (daily performance row exists for today)
      const todayET = getETDateString(new Date());
      const { data: perfRows } = await supabase
        .from('smarttrend_daily_performance')
        .select('allocation_per_trade')
        .eq('trade_date', todayET)
        .eq('strategy_name', 'smarttrend_core');

      const isLocked = perfRows && perfRows.length > 0;
      const lockedAllocation = isLocked ? Number(perfRows[0].allocation_per_trade) : null;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          setting,
          isLocked,
          lockedAllocation
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: err.message })
      };
    }
  }

  if (event.httpMethod === 'POST') {
    // Auth Check
    const expectedToken = process.env.WEBHOOK_SECRET || process.env.WEBHOOK_SECRET_TOKEN;
    if (!expectedToken) {
      return {
        statusCode: 500,
        body: 'Webhook secret is not configured on the server.'
      };
    }

    const headerToken = event.headers['authorization'] || event.headers['Authorization'];
    const token = headerToken || (event.queryStringParameters && event.queryStringParameters.token);
    if (!token || token !== expectedToken) {
      return {
        statusCode: 401,
        body: 'Unauthorized'
      };
    }

    try {
      const body = JSON.parse(event.body || '{}');
      const allocation = Number(body.allocation);

      if (isNaN(allocation) || allocation < 100) {
        return {
          statusCode: 400,
          body: 'Invalid allocation. Must be a number >= 100.'
        };
      }

      const todayET = getETDateString(new Date());
      const { data, error } = await supabase
        .from('smarttrend_paper_settings')
        .upsert({
          setting_key: 'default',
          allocation_per_trade: allocation,
          effective_from: todayET,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' })
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, setting: data })
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    body: 'Method Not Allowed'
  };
};
