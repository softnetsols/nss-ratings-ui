const { createClient } = require('@supabase/supabase-js');
const { getETDateString, aggregatePerformanceForDate } = require('./_shared/smarttrend-performance');

const handler = async (event, context) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[scheduled] Missing environment variables.');
    return { statusCode: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Recalculate today and yesterday in America/New_York
  const todayET = getETDateString(new Date());
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayET = getETDateString(yesterday);

  console.log(`[scheduled] Running scheduled aggregation for today (${todayET}) and yesterday (${yesterdayET})`);

  try {
    await aggregatePerformanceForDate(supabase, todayET);
    await aggregatePerformanceForDate(supabase, yesterdayET);
    return { statusCode: 200, body: 'Scheduled aggregation complete.' };
  } catch (err) {
    console.error('[scheduled] Scheduled aggregation failed:', err);
    return { statusCode: 500, body: err.message };
  }
};

exports.handler = handler;

// Scheduled function config (hourly)
exports.config = {
  schedule: "0 * * * *"
};
