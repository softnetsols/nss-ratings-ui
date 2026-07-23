const { createClient } = require('@supabase/supabase-js');
const { aggregatePerformanceForDate, getETDateString } = require('./_shared/smarttrend-performance');

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
    const queryParams = event.queryStringParameters || {};
    const days = Number(queryParams.days) || 30;
    const groupName = queryParams.group || 'ALL';

    const validDays = [7, 30, 90, 365];
    const finalDays = validDays.includes(days) ? days : 30;

    try {
      const { data, error } = await supabase
        .from('smarttrend_daily_performance')
        .select('*')
        .eq('strategy_name', 'smarttrend_core')
        .eq('group_name', groupName)
        .order('trade_date', { ascending: false })
        .limit(finalDays);

      if (error) {
        console.error('Error fetching performance:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, history: data || [] })
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
      let startDateStr = body.startDate || body.start_date;
      let endDateStr = body.endDate || body.end_date;

      // Default to today and yesterday if not provided
      if (!startDateStr) {
        startDateStr = getETDateString(new Date());
      }
      if (!endDateStr) {
        endDateStr = startDateStr;
      }

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          statusCode: 400,
          body: 'Invalid date formats. Use YYYY-MM-DD.'
        };
      }

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 365) {
        return {
          statusCode: 400,
          body: 'Maximum rebuild range is 365 days.'
        };
      }

      const datesToRebuild = [];
      const current = new Date(start);
      // Ensure start <= end logic
      const targetEnd = new Date(end);
      if (current.getTime() > targetEnd.getTime()) {
        const temp = new Date(current);
        current.setTime(targetEnd.getTime());
        targetEnd.setTime(temp.getTime());
      }

      while (current.getTime() <= targetEnd.getTime()) {
        datesToRebuild.push(getETDateString(current));
        current.setDate(current.getDate() + 1);
      }

      console.log(`[performance-post] Triggering rebuild for dates:`, datesToRebuild);

      const summary = [];
      let totalTradesPaired = 0;
      let totalOrphanOpens = 0;
      let totalOrphanExits = 0;

      for (const d of datesToRebuild) {
        const results = await aggregatePerformanceForDate(supabase, d);
        
        // Sum details for the response summary
        const allRow = results.find(r => r.group_name === 'ALL');
        if (allRow) {
          totalTradesPaired += allRow.closed_trades;
          totalOrphanOpens += allRow.active_unclosed_count;
        }

        summary.push({
          date: d,
          groupsCalculated: results.map(r => r.group_name),
          success: true
        });
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          datesRebuilt: datesToRebuild.length,
          tradesPaired: totalTradesPaired,
          orphanOpens: totalOrphanOpens,
          orphanExits: totalOrphanExits, // modeled exits are paired so this is 0 or tracked by difference
          duplicatesIgnored: 0, // deduplicated internally
          summary
        })
      };
    } catch (err) {
      console.error('[performance-post] Error:', err);
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
