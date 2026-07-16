const { createClient } = require('@supabase/supabase-js');

function calculateScoreAndReasons(item, direction) {
  // If pre-calculated in Pine Script, decode the bitwise packed reasons
  if (item.score_reasons !== undefined && item.score_reasons !== "") {
    const pineScore = Number(item.score) || 30;
    const packed = Number(item.score_reasons) || 0;
    const reasons = ["+30 Base Setup"];
    const rvol = Number(item.rvol) || 0.0;
    
    if (packed & 1) reasons.push("+15 EMA Trend Alignment");
    if (packed & 2) reasons.push("+15 VWAP Alignment (<1.25%)");
    if (packed & 4) reasons.push("+15 Volume Expansion (RVOL " + rvol.toFixed(1) + ")");
    if (packed & 8) reasons.push(direction === 'bullish' ? "+10 Stock Stronger than SPY" : "+10 Stock Weaker than SPY");
    if (packed & 16) reasons.push(direction === 'bullish' ? "+15 Near Daily High Breakout" : "+15 Near Daily Low Breakdown");
    if (packed & 32) reasons.push(direction === 'bullish' ? "+10 Premarket High Cleared" : "+10 Premarket Low Cleared");
    if (packed & 64) reasons.push("-15 Midday Chop Period");
    if (packed & 128) reasons.push("-25 Extended from VWAP (>1.25%)");
    if (packed & 256) reasons.push("-15 Extended from EMA9 (>1.5%)");
    if (packed & 512) reasons.push("-15 Premarket Low Volume");
    
    return { score: Math.max(0, Math.min(100, pineScore)), reasons };
  }

  let score = 30;
  const reasons = ["+30 Base Setup"];

  const price = Number(item.price) || 0.0;
  const vwap = Number(item.vwap) || 0.0;
  const ema9 = Number(item.ema9) || 0.0;
  const ema21 = Number(item.ema21) || 0.0;
  const atr = Number(item.atr) || 0.0;
  const volume = Number(item.volume) || 0.0;
  const rvol = Number(item.rvol) || 0.0;
  const day_high = Number(item.day_high) || price;
  const day_low = Number(item.day_low) || price;
  const premarket_high = item.premarket_high ? Number(item.premarket_high) : null;
  const premarket_low = item.premarket_low ? Number(item.premarket_low) : null;
  const spy_chg = item.spy_chg ? Number(item.spy_chg) : 0.0;
  const chg = Number(item.chg) || 0.0;

  const vwap_dist = vwap !== 0 ? ((price - vwap) / vwap) * 100 : 0.0;

  // New York timezone calculations
  const signal_time = item.signal_time ? Number(item.signal_time) : Date.now();
  const nyDateStr = new Date(signal_time).toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyDateStr);
  const ny_hour = nyDate.getHours();
  const ny_minute = nyDate.getMinutes();
  const ny_day = nyDate.getDay(); // 0 = Sun, 1 = Mon, etc.

  const is_pm = (ny_day >= 1 && ny_day <= 5) && (ny_hour >= 4 && (ny_hour < 9 || (ny_hour === 9 && ny_minute < 30)));
  const is_regular = (ny_day >= 1 && ny_day <= 5) && ((ny_hour === 9 && ny_minute >= 30) || (ny_hour > 9 && ny_hour < 16));

  if (direction === 'bullish') {
    // 1. EMA Trend
    if (price > ema9 && ema9 > ema21) {
      score += 15;
      reasons.push("+15 EMA Trend Alignment");
    }
    // 2. VWAP Alignment
    if (price > vwap && vwap_dist <= 1.25) {
      score += 15;
      reasons.push("+15 VWAP Alignment (<1.25%)");
    } else if (price > vwap && vwap_dist > 1.25) {
      score -= 25;
      reasons.push("-25 Extended from VWAP (>1.25%)");
    }
    // 3. Volume Expansion
    if (rvol >= 1.2) {
      score += 15;
      reasons.push("+15 Volume Expansion (RVOL " + rvol.toFixed(1) + ")");
    } else if (volume < 5000 && is_pm) {
      score -= 15;
      reasons.push("-15 Premarket Low Volume");
    }
    // 4. Market Strength
    if (chg > spy_chg) {
      score += 10;
      reasons.push("+10 Stock Stronger than SPY");
    }
    // 5. Break of high / range
    if (day_high !== 0 && (day_high - price) / day_high * 100 < 0.25) {
      score += 15;
      reasons.push("+15 Near Daily High Breakout");
    }
    // 6. Premarket Room to move
    if (premarket_high && price > premarket_high) {
      score += 10;
      reasons.push("+10 Premarket High Cleared");
    }
  } else {
    // Bearish
    // 1. EMA Trend
    if (price < ema9 && ema9 < ema21) {
      score += 15;
      reasons.push("+15 EMA Trend Alignment");
    }
    // 2. VWAP Alignment
    if (price < vwap && vwap_dist >= -1.25) {
      score += 15;
      reasons.push("+15 VWAP Alignment (>-1.25%)");
    } else if (price < vwap && vwap_dist < -1.25) {
      score -= 25;
      reasons.push("-25 Extended from VWAP (<-1.25%)");
    }
    // 3. Volume Expansion
    if (rvol >= 1.2) {
      score += 15;
      reasons.push("+15 Volume Expansion (RVOL " + rvol.toFixed(1) + ")");
    } else if (volume < 5000 && is_pm) {
      score -= 15;
      reasons.push("-15 Premarket Low Volume");
    }
    // 4. Market Weakness
    if (chg < spy_chg) {
      score += 10;
      reasons.push("+10 Stock Weaker than SPY");
    }
    // 5. Break of low / range
    if (day_low !== 0 && (price - day_low) / day_low * 100 < 0.25) {
      score += 15;
      reasons.push("+15 Near Daily Low Breakdown");
    }
    // 6. Premarket Room to move
    if (premarket_low && price < premarket_low) {
      score += 10;
      reasons.push("+10 Premarket Low Cleared");
    }
  }

  // General penalties
  // 1. Midday chop (11:30 AM to 1:30 PM EST)
  const is_midday = is_regular && ((ny_hour === 11 && ny_minute >= 30) || (ny_hour === 12) || (ny_hour === 13 && ny_minute < 30));
  if (is_midday) {
    score -= 15;
    reasons.push("-15 Midday Chop Period");
  }

  // 2. Extended from EMA9/EMA21
  const ema9_dist_pct = ema9 !== 0 ? Math.abs((price - ema9) / ema9) * 100 : 0.0;
  if (ema9_dist_pct > 1.5) {
    score -= 15;
    reasons.push("-15 Extended from EMA9 (>1.5%)");
  }

  // Normalize
  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}

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
    const processItems = (items, direction) => {
      for (const item of items) {
        const signal_bar_time = item.signal_time ? new Date(Number(item.signal_time)).toISOString() : new Date().toISOString();
        const timeframe = item.timeframe || '15';
        const strategy = item.strategy || 'unknown';
        const signal_id = `${item.sym}_${strategy}_${direction}_${timeframe}_${item.signal_time || Date.now()}`;

        // Scoring
        const { score, reasons } = calculateScoreAndReasons(item, direction);
        const quality = score >= 80 ? 'A' : (score >= 65 ? 'B' : (score >= 50 ? 'C' : 'R'));

        // Calculations
        const price = Number(item.price) || 0.0;
        const vwap = Number(item.vwap) || 0.0;
        const ema9 = Number(item.ema9) || 0.0;
        const day_high = Number(item.day_high) || price;
        const day_low = Number(item.day_low) || price;
        
        const distance_from_vwap_pct = vwap !== 0 ? ((price - vwap) / vwap) * 100 : 0.0;
        const distance_from_ema9_pct = ema9 !== 0 ? ((price - ema9) / ema9) * 100 : 0.0;
        const move_from_day_high_pct = day_high !== 0 ? ((price - day_high) / day_high) * 100 : 0.0;
        const move_from_day_low_pct = day_low !== 0 ? ((price - day_low) / day_low) * 100 : 0.0;
        const move_from_premarket_high_pct = item.premarket_high ? ((price - item.premarket_high) / item.premarket_high) * 100 : null;
        const move_from_premarket_low_pct = item.premarket_low ? ((price - item.premarket_low) / item.premarket_low) * 100 : null;
        
        // Mark as stale if delay is >= 120 minutes (2 hours)
        let status = score < 50 ? 'rejected' : 'fresh';
        const ageMs = Date.now() - new Date(signal_bar_time).getTime();
        if (status === 'fresh' && ageMs >= 120 * 60000) {
          status = 'stale';
        }

        rows.push({
          signal_id,
          symbol: item.sym,
          group_name,
          strategy_name: strategy,
          direction,
          timeframe,
          signal_mode: item.mode || 'confirmed',
          signal_bar_time,
          alert_received_at: new Date().toISOString(),
          trigger_price: item.trigger_price || price,
          current_price: price,
          current_price_updated_at: new Date().toISOString(),
          vwap_at_signal: item.vwap,
          ema9_at_signal: item.ema9,
          ema21_at_signal: item.ema21,
          atr_at_signal: item.atr,
          volume_at_signal: item.volume,
          relative_volume_at_signal: item.rvol,
          day_high_at_signal: item.day_high,
          day_low_at_signal: item.day_low,
          premarket_high: item.premarket_high,
          premarket_low: item.premarket_low,
          distance_from_vwap_pct,
          distance_from_ema9_pct,
          move_from_day_high_pct,
          move_from_day_low_pct,
          move_from_premarket_high_pct,
          move_from_premarket_low_pct,
          signal_score: score,
          signal_quality: quality,
          status,
          score_reasons: item.score_reasons || [],
          duplicate_of_signal_id: null,
          confirmation_count: 1,
          confirmations: [strategy],
          outcome_15m: null,
          outcome_30m: null,
          outcome_60m: null,
          max_favorable_move: 0.0,
          max_adverse_move: 0.0,
          raw_alert_payload: item,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    };

    processItems(bullish, 'bullish');
    processItems(bearish, 'bearish');

    if (rows.length > 0) {
      const symbolsInPayload = [...new Set(rows.map(r => r.symbol))];

      // Fetch active signals in the last 2 hours to check for duplicates/conflicts/confirmations
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const { data: existingSignals, error: selectError } = await supabase
        .from('screener_signals')
        .select('*')
        .in('symbol', symbolsInPayload)
        .gt('signal_bar_time', twoHoursAgo.toISOString())
        .not('status', 'in', '("rejected")');

      if (selectError) {
        console.error('Error selecting existing signals:', selectError);
      }

      const activeSignals = existingSignals || [];
      const auxiliaryUpdates = [];

      // Process duplicate and confirmation checks
      for (const row of rows) {
        if (row.status === 'rejected') continue;

        // 1. Conflict check (opposite direction within 30 minutes)
        const conflictSignal = activeSignals.find(s => 
          s.symbol === row.symbol && 
          s.direction !== row.direction &&
          Math.abs(new Date(s.signal_bar_time).getTime() - new Date(row.signal_bar_time).getTime()) < 30 * 60000
        );

        if (conflictSignal) {
          row.status = 'conflict';
          auxiliaryUpdates.push({
            signal_id: conflictSignal.signal_id,
            data: { status: 'conflict', updated_at: new Date().toISOString() }
          });
          continue;
        }

        // 2. Duplicate check (same strategy + direction + timeframe within 30 min cooldown)
        const duplicateSignal = activeSignals.find(s => 
          s.symbol === row.symbol && 
          s.strategy_name === row.strategy_name &&
          s.direction === row.direction &&
          s.timeframe === row.timeframe &&
          Math.abs(new Date(s.signal_bar_time).getTime() - new Date(row.signal_bar_time).getTime()) < 30 * 60000
        );

        if (duplicateSignal && !row.raw_alert_payload.is_reset) {
          row.status = 'duplicate';
          row.duplicate_of_signal_id = duplicateSignal.signal_id;
          continue;
        }

        // 3. Multi-confirmation check (different strategy + same direction within 15 minutes)
        const confirmationSignal = activeSignals.find(s => 
          s.symbol === row.symbol && 
          s.strategy_name !== row.strategy_name &&
          s.direction === row.direction &&
          Math.abs(new Date(s.signal_bar_time).getTime() - new Date(row.signal_bar_time).getTime()) < 15 * 60000
        );

        if (confirmationSignal) {
          const isRowPrimary = new Date(row.signal_bar_time).getTime() < new Date(confirmationSignal.signal_bar_time).getTime();
          
          if (isRowPrimary) {
            row.confirmation_count = 2;
            row.confirmations = [...new Set([...row.confirmations, confirmationSignal.strategy_name])];
            
            auxiliaryUpdates.push({
              signal_id: confirmationSignal.signal_id,
              data: { 
                status: 'duplicate', 
                duplicate_of_signal_id: row.signal_id,
                updated_at: new Date().toISOString()
              }
            });
          } else {
            row.status = 'duplicate';
            row.duplicate_of_signal_id = confirmationSignal.signal_id;

            const updatedConfirmations = [...new Set([...(confirmationSignal.confirmations || []), row.strategy_name])];
            auxiliaryUpdates.push({
              signal_id: confirmationSignal.signal_id,
              data: { 
                confirmation_count: (Number(confirmationSignal.confirmation_count) || 1) + 1,
                confirmations: updatedConfirmations,
                updated_at: new Date().toISOString()
              }
            });
          }
        }
      }

      // Check which rows already exist in the database (to prevent trigger price updates)
      const signalIds = rows.map(r => r.signal_id);
      const { data: recordsInDb, error: dbQueryError } = await supabase
        .from('screener_signals')
        .select('*')
        .in('signal_id', signalIds);

      if (dbQueryError) {
        console.error('Error fetching records from DB:', dbQueryError);
      }

      const dbRecordsMap = new Map((recordsInDb || []).map(r => [r.signal_id, r]));
      const upsertRows = new Map();

      // 1. Process active updates/inserts
      for (const row of rows) {
        const existing = dbRecordsMap.get(row.signal_id);
        if (existing) {
          // Merge dynamic update fields but preserve original immutable values
          const mergedRow = {
            ...row,
            trigger_price: existing.trigger_price, // Preserve original trigger price
            created_at: existing.created_at,       // Preserve original created_at
            signal_bar_time: existing.signal_bar_time, // Preserve original bar time
            current_price_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          upsertRows.set(row.signal_id, mergedRow);
        } else {
          // New row to insert
          upsertRows.set(row.signal_id, {
            ...row,
            current_price_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      // 2. Process auxiliary updates from duplicate/conflict checks
      for (const aux of auxiliaryUpdates) {
        const existing = activeSignals.find(s => s.signal_id === aux.signal_id);
        if (existing) {
          // Merge with any values already staged in this batch, or fall back to DB values
          const currentVal = upsertRows.get(aux.signal_id) || existing;
          const updatedRecord = {
            ...currentVal,
            ...aux.data,
            updated_at: new Date().toISOString()
          };
          upsertRows.set(aux.signal_id, updatedRecord);
        }
      }

      // 3. Execute single bulk upsert query
      if (upsertRows.size > 0) {
        const { error: upsertError } = await supabase
          .from('screener_signals')
          .upsert(Array.from(upsertRows.values()), { onConflict: 'signal_id' });

        if (upsertError) {
          console.error('Unified bulk upsert error:', upsertError);
        }
      }
    }

    // Clean up database signals that are older than 1 week (7 days)
    // Run cleanup only 2% of the time to avoid database locks under heavy concurrent webhook payloads
    if (Math.random() < 0.02) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      supabase
        .from('screener_signals')
        .delete()
        .lt('updated_at', oneWeekAgo.toISOString())
        .then(({ error }) => {
          if (error) {
            console.warn('Background cleanup warning:', error.message);
          }
        });
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
