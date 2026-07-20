// ============================================================
// NSS Screener Webhook — Backward-Compatible Patch
// ============================================================
//
// PATCH SUMMARY
//   Adds support for the new nss-watchlist-v1 single-symbol schema
//   emitted by NSS_Master_Watchlist_Scanner_v1.pine while keeping
//   the existing legacy group/bullish/bearish processing completely
//   intact. No existing behaviour is modified.
//
// HOW TO APPLY
//   Replace the contents of
//   netlify/functions/screener-webhook.js
//   with this file. All environment variables and exports remain identical.
//
// SCHEMA ROUTING (lines 193-200 of original handler)
//   Legacy:       payload.schema === undefined  →  legacy path (unchanged)
//   New:          payload.schema === "nss-watchlist-v1"  →  new path
//
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// ────────────────────────────────────────────────────────────────────────────
// Legacy score calculation (unchanged from original)
// ────────────────────────────────────────────────────────────────────────────

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
    // 5. Day High Breakout
    if (day_high !== 0 && price >= day_high * 0.998) {
      score += 15;
      reasons.push("+15 Near Daily High Breakout");
    }
    // 6. Premarket High Cleared
    if (premarket_high && price >= premarket_high) {
      score += 10;
      reasons.push("+10 Premarket High Cleared");
    }
    // 7. EMA Extension Penalty
    if (ema9 !== 0 && ((price - ema9) / ema9) * 100 > 1.5) {
      score -= 15;
      reasons.push("-15 Extended from EMA9 (>1.5%)");
    }
  } else {
    // Bearish scoring
    if (price < ema9 && ema9 < ema21) {
      score += 15;
      reasons.push("+15 EMA Trend Alignment");
    }
    if (price < vwap && Math.abs(vwap_dist) <= 1.25) {
      score += 15;
      reasons.push("+15 VWAP Alignment (<1.25%)");
    } else if (price < vwap && Math.abs(vwap_dist) > 1.25) {
      score -= 25;
      reasons.push("-25 Extended from VWAP (>1.25%)");
    }
    if (rvol >= 1.2) {
      score += 15;
      reasons.push("+15 Volume Expansion (RVOL " + rvol.toFixed(1) + ")");
    } else if (volume < 5000 && is_pm) {
      score -= 15;
      reasons.push("-15 Premarket Low Volume");
    }
    if (chg < spy_chg) {
      score += 10;
      reasons.push("+10 Stock Weaker than SPY");
    }
    if (day_low !== 0 && price <= day_low * 1.002) {
      score += 15;
      reasons.push("+15 Near Daily Low Breakdown");
    }
    if (premarket_low && price <= premarket_low) {
      score += 10;
      reasons.push("+10 Premarket Low Cleared");
    }
    if (ema9 !== 0 && ((ema9 - price) / ema9) * 100 > 1.5) {
      score -= 15;
      reasons.push("-15 Extended from EMA9 (>1.5%)");
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// ────────────────────────────────────────────────────────────────────────────
// NEW: processWatchlistV1
//
// Converts a single nss-watchlist-v1 payload into one or more DB rows,
// one per qualifying event in the payload's events[] array.
//
// Each event is independently mapped to the legacy screener_signals schema
// so that the existing UI, duplicate checks, and confirmation logic continue
// to work without any Angular or Supabase schema changes.
// ────────────────────────────────────────────────────────────────────────────

function processWatchlistV1(payload) {
  const rows = [];

  const {
    symbolId,
    ticker,
    exchange,
    signalTf,
    session,
    signalBarOpenTime,
    signalBarCloseTime,
    detectedTime,
    signalPrice,
    deliveryPrice,
    changePct,
    rvol,
    vwap,
    vwapDistancePct,
    events = [],
    test: isTest = false
  } = payload;

  // Skip test-mode payloads — they are for TradingView validation only.
  if (isTest) {
    console.log(`[nss-watchlist-v1] Skipping test payload for ${symbolId}`);
    return rows;
  }

  // Derive the group_name from exchange/ticker for display grouping.
  const group_name = `NSS_Master_${exchange || 'UNKNOWN'}`;

  for (const ev of events) {
    const {
      eventId,
      strategy,
      event: evType,
      state,
      score: evScore,
      reasonMask,
      triggerPrice,
      isReset,
      alphaTrendValue,
      ema9,
      ema21,
      tradePlan
    } = ev;

    // Skip events with no qualifying signal (NONE means no action)
    if (!evType || evType === 'NONE') continue;

    // Map event direction
    const direction = evType === 'BUY' ? 'bullish' : 'bearish';

    // Map strategy name to legacy format
    const strategy_name =
      strategy === 'ALPHATREND' ? 'alphatrend_reversal' :
      strategy === 'GOLDENCROSS' ? 'goldencross' :
      strategy.toLowerCase();

    // Signal bar time (ISO) from close timestamp
    const signal_bar_time = signalBarCloseTime
      ? new Date(Number(signalBarCloseTime)).toISOString()
      : new Date().toISOString();

    // signal_id uses the Pine eventId directly to guarantee idempotency.
    // Format: NSS_Master|NASDAQ:AAPL|15|ALPHATREND|BUY|<closeTs>
    const signal_id = eventId || `${symbolId}_${strategy_name}_${direction}_${signalTf}_${signalBarCloseTime || Date.now()}`;

    // Score — Pine already calculated 0-100; build reasons from reasonMask.
    const score = typeof evScore === 'number' ? Math.max(0, Math.min(100, evScore)) : 30;
    const quality = score >= 80 ? 'A' : (score >= 65 ? 'B' : (score >= 50 ? 'C' : 'R'));

    // Decode reasonMask into human-readable reasons (same bit table as legacy)
    const reasons = ['+30 Base Setup'];
    if (reasonMask) {
      const mask = Number(reasonMask);
      const rvolVal = typeof rvol === 'number' ? rvol : Number(rvol) || 0;
      if (mask & 1) reasons.push('+15 EMA Trend Alignment');
      if (mask & 2) reasons.push('+15 VWAP Alignment (<1.25%)');
      if (mask & 4) reasons.push(`+15 Volume Expansion (RVOL ${rvolVal.toFixed(1)})`);
      if (mask & 8) reasons.push(direction === 'bullish' ? '+10 Stock Stronger than SPY' : '+10 Stock Weaker than SPY');
      if (mask & 16) reasons.push(direction === 'bullish' ? '+15 Near Daily High Breakout' : '+15 Near Daily Low Breakdown');
      if (mask & 32) reasons.push(direction === 'bullish' ? '+10 Premarket High Cleared' : '+10 Premarket Low Cleared');
      if (mask & 64) reasons.push('-15 Midday Chop Period');
      if (mask & 128) reasons.push('-25 Extended from VWAP (>1.25%)');
      if (mask & 256) reasons.push('-15 Extended from EMA9 (>1.5%)');
      if (mask & 512) reasons.push('-15 Premarket Low Volume');
    }

    // Trade plan fields — the new schema pre-calculates these in Pine.
    // Map to legacy column names directly.
    const tp = tradePlan || {};
    const trade_plan_valid = tp.valid === true;
    const entry_price_est = typeof triggerPrice === 'number' ? triggerPrice : (typeof signalPrice === 'number' ? signalPrice : 0);
    const stop_price         = trade_plan_valid && typeof tp.stop    === 'number' ? tp.stop    : null;
    const target1_price      = trade_plan_valid && typeof tp.target1 === 'number' ? tp.target1 : null;
    const target2_price      = trade_plan_valid && typeof tp.target2 === 'number' ? tp.target2 : null;
    const target3_price      = trade_plan_valid && typeof tp.target3 === 'number' ? tp.target3 : null;
    const risk_per_share     = trade_plan_valid && typeof tp.risk    === 'number' ? tp.risk    : null;
    const atr_at_signal      = trade_plan_valid && typeof tp.atr     === 'number' ? tp.atr     : null;
    const close_price_est    = target2_price; // matches legacy convention
    const recent_swing_high  = trade_plan_valid && typeof tp.swingHigh  === 'number' ? tp.swingHigh  : null;
    const recent_swing_low   = trade_plan_valid && typeof tp.swingLow   === 'number' ? tp.swingLow   : null;
    const signal_candle_high = trade_plan_valid && typeof tp.signalHigh === 'number' ? tp.signalHigh : null;
    const signal_candle_low  = trade_plan_valid && typeof tp.signalLow  === 'number' ? tp.signalLow  : null;
    const alphatrend_at_signal = typeof alphaTrendValue === 'number' ? alphaTrendValue : null;

    // Derived metrics
    const vwapNum = typeof vwap === 'number' ? vwap : Number(vwap) || 0;
    const price   = typeof signalPrice === 'number' ? signalPrice : Number(signalPrice) || 0;
    const ema9Num = typeof ema9 === 'number' ? ema9 : Number(ema9) || 0;

    const distance_from_vwap_pct = vwapNum !== 0 ? ((price - vwapNum) / vwapNum) * 100 : 0;
    const distance_from_ema9_pct = ema9Num !== 0 ? ((price - ema9Num) / ema9Num) * 100 : 0;

    // Trade plan quality — use Pine's pre-validated flag
    let trade_plan_quality = 'invalid';
    let trade_plan_reason  = 'Pine reported tradePlan.valid=false';
    let invalidation_reason = '';
    if (trade_plan_valid && risk_per_share !== null && risk_per_share > 0) {
      const risk_pct = (risk_per_share / entry_price_est) * 100;
      if (risk_pct > 2.0) {
        trade_plan_quality = 'wide_risk';
        trade_plan_reason  = 'Stop is more than 2% away from entry';
      } else {
        trade_plan_quality = 'valid';
        trade_plan_reason  = '';
      }
    }

    // Staleness check
    let status = score < 50 ? 'rejected' : 'fresh';
    const ageMs = Date.now() - new Date(signal_bar_time).getTime();
    if (status === 'fresh' && ageMs >= 120 * 60000) {
      status = 'stale';
    }

    rows.push({
      signal_id,
      symbol: ticker || symbolId,
      group_name,
      strategy_name,
      direction,
      timeframe: String(signalTf || '15'),
      signal_mode: 'confirmed',
      signal_bar_time,
      alert_received_at: new Date().toISOString(),
      trigger_price: entry_price_est,
      current_price: typeof deliveryPrice === 'number' ? deliveryPrice : price,
      current_price_updated_at: new Date().toISOString(),
      vwap_at_signal: vwapNum,
      ema9_at_signal: ema9Num,
      ema21_at_signal: typeof ema21 === 'number' ? ema21 : Number(ema21) || 0,
      atr_at_signal,
      volume_at_signal: null,
      relative_volume_at_signal: typeof rvol === 'number' ? rvol : Number(rvol) || null,
      day_high_at_signal: null,
      day_low_at_signal: null,
      premarket_high: null,
      premarket_low: null,
      distance_from_vwap_pct,
      distance_from_ema9_pct,
      move_from_day_high_pct: null,
      move_from_day_low_pct: null,
      move_from_premarket_high_pct: null,
      move_from_premarket_low_pct: null,
      signal_score: score,
      signal_quality: quality,
      status,
      score_reasons: reasons,
      duplicate_of_signal_id: null,
      confirmation_count: 1,
      confirmations: [strategy_name],
      outcome_15m: null,
      outcome_30m: null,
      outcome_60m: null,
      max_favorable_move: 0.0,
      max_adverse_move: 0.0,
      raw_alert_payload: ev,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // Trade plan
      entry_type: 'signal_entry',
      entry_price_est,
      entry_zone_low:  direction === 'bullish' ? entry_price_est * 0.998 : entry_price_est * 0.997,
      entry_zone_high: direction === 'bullish' ? entry_price_est * 1.003 : entry_price_est * 1.002,
      stop_price,
      target1_price,
      target2_price,
      target3_price,
      close_price_est,
      risk_per_share,
      reward_to_risk_t1: 1.0,
      reward_to_risk_t2: 2.0,
      reward_to_risk_t3: 3.0,
      trade_plan_quality,
      trade_plan_reason,
      invalidation_reason,
      recent_swing_high,
      recent_swing_low,
      signal_candle_high,
      signal_candle_low,
      alphatrend_at_signal
    });
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ────────────────────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    // ── GUARDED JSON PARSE ────────────────────────────────────────────────
    // Emit diagnostic context on parse failure so we can trace the raw body
    // without exposing webhook tokens or Supabase secrets.
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (parseError) {
      const rawBody  = event.body || '';
      const preview  = rawBody
        .slice(0, 1000)
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      console.error('[screener-webhook-v2] JSON parse failure');
      console.error('  error   :', parseError.message);
      console.error('  bodyLen :', rawBody.length);
      console.error('  ctype   :', event.headers['content-type'] || event.headers['Content-Type'] || 'not set');
      console.error('  body[0:1000]:', preview);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:   'Invalid JSON payload',
          details: parseError.message
        })
      };
    }
    // ── END GUARDED JSON PARSE ────────────────────────────────────────────


    // Verify token (authorization header or query param)
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

    // ── SCHEMA ROUTING ────────────────────────────────────────────────────
    // Route nss-watchlist-v1 payloads through the new processor.
    // All other payloads continue through the original legacy processor.
    // ─────────────────────────────────────────────────────────────────────
    let rows = [];

    if (payload.schema === 'nss-watchlist-v1') {
      // ── NEW PATH: Single-symbol Watchlist Alert ────────────────────────
      console.log(`[nss-watchlist-v1] Received payload for ${payload.symbolId}`);
      rows = processWatchlistV1(payload);
    } else {
      // ── LEGACY PATH: Group bullish[]/bearish[] arrays ──────────────────
      const bullish = payload.bullish || [];
      const bearish = payload.bearish || [];
      const group_name = payload.group || 'Unknown';

      const processItems = (items, direction) => {
        for (const item of items) {
          // Support both short and long keys
          const sym = item.s || item.sym;
          const price = item.p !== undefined ? Number(item.p) : (item.price !== undefined ? Number(item.price) : 0.0);
          const chg = item.c !== undefined ? Number(item.c) : (item.chg !== undefined ? Number(item.chg) : 0.0);
          const rvol = item.rv !== undefined ? Number(item.rv) : (item.rvol !== undefined ? Number(item.rvol) : 0.0);
          const score_val = item.sc !== undefined ? Number(item.sc) : (item.score !== undefined ? Number(item.score) : 0.0);
          const signal_time = item.st !== undefined ? item.st : item.signal_time;
          const trigger_price_val = item.tp !== undefined ? Number(item.tp) : (item.trigger_price !== undefined ? Number(item.trigger_price) : price);
          const vwap = item.at !== undefined ? Number(item.at) : (item.vwap !== undefined ? Number(item.vwap) : 0.0);
          const is_reset = item.ir !== undefined ? (item.ir === true || item.ir === "true") : (item.is_reset === true || item.is_reset === "true" || item.is_reset_float === 1.0);
          const timeframe = item.tf || item.timeframe || '15';
          const score_reasons = item.rs !== undefined ? String(item.rs) : (item.score_reasons !== undefined ? String(item.score_reasons) : "");

          const normalizedItem = {
            sym,
            price,
            chg,
            rvol,
            score: score_val,
            signal_time,
            trigger_price: trigger_price_val,
            vwap,
            is_reset,
            timeframe,
            score_reasons,
            strategy: item.strategy || (group_name.includes("AlphaTrend") ? "alphatrend_reversal" : "goldencross"),
            volume: item.volume !== undefined ? Number(item.volume) : 0.0,
            day_high: item.day_high !== undefined ? Number(item.day_high) : price,
            day_low: item.day_low !== undefined ? Number(item.day_low) : price,
            premarket_high: item.premarket_high !== undefined ? Number(item.premarket_high) : null,
            premarket_low: item.premarket_low !== undefined ? Number(item.premarket_low) : null,
            sw_high: item.sw_high !== undefined ? Number(item.sw_high) : null,
            sw_low: item.sw_low !== undefined ? Number(item.sw_low) : null,
            sig_high: item.sig_high !== undefined ? Number(item.sig_high) : null,
            sig_low: item.sig_low !== undefined ? Number(item.sig_low) : null,
            at_val: item.at_val !== undefined ? Number(item.at_val) : null,
            atr: item.atr !== undefined ? Number(item.atr) : null
          };

          const signal_bar_time = normalizedItem.signal_time ? new Date(Number(normalizedItem.signal_time)).toISOString() : new Date().toISOString();
          const signal_id = `${normalizedItem.sym}_${normalizedItem.strategy}_${direction}_${normalizedItem.timeframe}_${normalizedItem.signal_time || Date.now()}`;
          const strategy = normalizedItem.strategy;

          // Scoring
          const { score, reasons } = calculateScoreAndReasons(normalizedItem, direction);
          const quality = score >= 80 ? 'A' : (score >= 65 ? 'B' : (score >= 50 ? 'C' : 'R'));

          // Calculations
          const ema9 = Number(normalizedItem.ema9) || 0.0;
          const day_high = Number(normalizedItem.day_high) || price;
          const day_low = Number(normalizedItem.day_low) || price;
          
          const distance_from_vwap_pct = vwap !== 0 ? ((price - vwap) / vwap) * 100 : 0.0;
          const distance_from_ema9_pct = ema9 !== 0 ? ((price - ema9) / ema9) * 100 : 0.0;
          const move_from_day_high_pct = day_high !== 0 ? ((price - day_high) / day_high) * 100 : 0.0;
          const move_from_day_low_pct = day_low !== 0 ? ((price - day_low) / day_low) * 100 : 0.0;
          const move_from_premarket_high_pct = normalizedItem.premarket_high ? ((price - normalizedItem.premarket_high) / normalizedItem.premarket_high) * 100 : null;
          const move_from_premarket_low_pct = normalizedItem.premarket_low ? ((price - normalizedItem.premarket_low) / normalizedItem.premarket_low) * 100 : null;

          // Trade plan fields parsing & calculations
          const recent_swing_high = normalizedItem.sw_high !== undefined && normalizedItem.sw_high !== null ? Number(normalizedItem.sw_high) : null;
          const recent_swing_low = normalizedItem.sw_low !== undefined && normalizedItem.sw_low !== null ? Number(normalizedItem.sw_low) : null;
          const signal_candle_high = normalizedItem.sig_high !== undefined && normalizedItem.sig_high !== null ? Number(normalizedItem.sig_high) : null;
          const signal_candle_low = normalizedItem.sig_low !== undefined && normalizedItem.sig_low !== null ? Number(normalizedItem.sig_low) : null;
          const alphatrend_at_signal = normalizedItem.at_val !== undefined && normalizedItem.at_val !== null ? Number(normalizedItem.at_val) : null;
          const atr = normalizedItem.atr !== undefined && normalizedItem.atr !== null ? Number(normalizedItem.atr) : null;

          const trigger_price = normalizedItem.trigger_price || price;
          const entry_type = "signal_entry";
          const entry_price_est = trigger_price;
          const atr_stop_buffer = 0.25;

          let stop_price = null;
          let risk_per_share = null;
          let target1_price = null;
          let target2_price = null;
          let target3_price = null;
          let close_price_est = null;
          let trade_plan_quality = "invalid";
          let trade_plan_reason = "";
          let invalidation_reason = "";

          if (direction === 'bullish') {
            const supportCandidates = [];
            if (signal_candle_low !== null && !isNaN(signal_candle_low)) supportCandidates.push(signal_candle_low);
            if (recent_swing_low !== null && !isNaN(recent_swing_low)) supportCandidates.push(recent_swing_low);
            if (alphatrend_at_signal !== null && !isNaN(alphatrend_at_signal)) supportCandidates.push(alphatrend_at_signal);

            if (supportCandidates.length > 0) {
              const recent_support = Math.min(...supportCandidates);
              if (atr !== null && !isNaN(atr)) {
                stop_price = recent_support - (atr_stop_buffer * atr);
                risk_per_share = entry_price_est - stop_price;
                
                if (risk_per_share > 0) {
                  target1_price = entry_price_est + (1.0 * risk_per_share);
                  target2_price = entry_price_est + (2.0 * risk_per_share);
                  target3_price = entry_price_est + (3.0 * risk_per_share);
                  close_price_est = target2_price;
                  
                  const risk_pct = (risk_per_share / entry_price_est) * 100;
                  if (risk_pct > 2.0) {
                    trade_plan_quality = "wide_risk";
                    trade_plan_reason = "Stop is more than 2% away from entry";
                  } else {
                    trade_plan_quality = "valid";
                    trade_plan_reason = "";
                  }
                } else {
                  trade_plan_quality = "invalid";
                  trade_plan_reason = "Invalid bullish risk calculation";
                  invalidation_reason = "Stop is not below entry";
                }
              } else {
                trade_plan_quality = "invalid";
                trade_plan_reason = "Missing ATR data for stop buffer";
              }
            } else {
              trade_plan_quality = "invalid";
              trade_plan_reason = "Missing support candidates for stop placement";
            }
          } else if (direction === 'bearish') {
            const resistanceCandidates = [];
            if (signal_candle_high !== null && !isNaN(signal_candle_high)) resistanceCandidates.push(signal_candle_high);
            if (recent_swing_high !== null && !isNaN(recent_swing_high)) resistanceCandidates.push(recent_swing_high);
            if (alphatrend_at_signal !== null && !isNaN(alphatrend_at_signal)) resistanceCandidates.push(alphatrend_at_signal);

            if (resistanceCandidates.length > 0) {
              const recent_resistance = Math.max(...resistanceCandidates);
              if (atr !== null && !isNaN(atr)) {
                stop_price = recent_resistance + (atr_stop_buffer * atr);
                risk_per_share = stop_price - entry_price_est;

                if (risk_per_share > 0) {
                  target1_price = entry_price_est - (1.0 * risk_per_share);
                  target2_price = entry_price_est - (2.0 * risk_per_share);
                  target3_price = entry_price_est - (3.0 * risk_per_share);
                  close_price_est = target2_price;

                  const risk_pct = (risk_per_share / entry_price_est) * 100;
                  if (risk_pct > 2.0) {
                    trade_plan_quality = "wide_risk";
                    trade_plan_reason = "Stop is more than 2% away from entry";
                  } else {
                    trade_plan_quality = "valid";
                    trade_plan_reason = "";
                  }
                } else {
                  trade_plan_quality = "invalid";
                  trade_plan_reason = "Invalid bearish risk calculation";
                  invalidation_reason = "Stop is not above entry";
                }
              } else {
                trade_plan_quality = "invalid";
                trade_plan_reason = "Missing ATR data for stop buffer";
              }
            } else {
              trade_plan_quality = "invalid";
              trade_plan_reason = "Missing resistance candidates for stop placement";
            }
          }

          const reward_to_risk_t1 = 1.0;
          const reward_to_risk_t2 = 2.0;
          const reward_to_risk_t3 = 3.0;

          // Mark as stale if delay is >= 120 minutes (2 hours)
          let status = score < 50 ? 'rejected' : 'fresh';
          const ageMs = Date.now() - new Date(signal_bar_time).getTime();
          if (status === 'fresh' && ageMs >= 120 * 60000) {
            status = 'stale';
          }

          rows.push({
            signal_id,
            symbol: normalizedItem.sym,
            group_name,
            strategy_name: strategy,
            direction,
            timeframe,
            signal_mode: normalizedItem.mode || 'confirmed',
            signal_bar_time,
            alert_received_at: new Date().toISOString(),
            trigger_price,
            current_price: price,
            current_price_updated_at: new Date().toISOString(),
            vwap_at_signal: normalizedItem.vwap,
            ema9_at_signal: normalizedItem.ema9,
            ema21_at_signal: normalizedItem.ema21,
            atr_at_signal: atr,
            volume_at_signal: normalizedItem.volume,
            relative_volume_at_signal: normalizedItem.rvol,
            day_high_at_signal: normalizedItem.day_high,
            day_low_at_signal: normalizedItem.day_low,
            premarket_high: normalizedItem.premarket_high,
            premarket_low: normalizedItem.premarket_low,
            distance_from_vwap_pct,
            distance_from_ema9_pct,
            move_from_day_high_pct,
            move_from_day_low_pct,
            move_from_premarket_high_pct,
            move_from_premarket_low_pct,
            signal_score: score,
            signal_quality: quality,
            status,
            score_reasons: reasons,
            duplicate_of_signal_id: null,
            confirmation_count: 1,
            confirmations: [strategy],
            outcome_15m: null,
            outcome_30m: null,
            outcome_60m: null,
            max_favorable_move: 0.0,
            max_adverse_move: 0.0,
            raw_alert_payload: normalizedItem,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            
            // Storing trade plan details
            entry_type,
            entry_price_est,
            entry_zone_low: direction === 'bullish' ? entry_price_est * 0.998 : entry_price_est * 0.997,
            entry_zone_high: direction === 'bullish' ? entry_price_est * 1.003 : entry_price_est * 1.002,
            stop_price,
            target1_price,
            target2_price,
            target3_price,
            close_price_est,
            risk_per_share,
            reward_to_risk_t1,
            reward_to_risk_t2,
            reward_to_risk_t3,
            trade_plan_quality,
            trade_plan_reason,
            invalidation_reason,
            recent_swing_high,
            recent_swing_low,
            signal_candle_high,
            signal_candle_low,
            alphatrend_at_signal
          });
        }
      };

      processItems(bullish, 'bullish');
      processItems(bearish, 'bearish');
    }
    // ── END SCHEMA ROUTING ────────────────────────────────────────────────

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
          s.signal_id !== row.signal_id &&
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
          s.signal_id !== row.signal_id &&
          s.symbol === row.symbol && 
          s.strategy_name === row.strategy_name &&
          s.direction === row.direction &&
          s.timeframe === row.timeframe &&
          Math.abs(new Date(s.signal_bar_time).getTime() - new Date(row.signal_bar_time).getTime()) < 30 * 60000
        );

        if (duplicateSignal && !row.raw_alert_payload.isReset && !row.raw_alert_payload.is_reset) {
          row.status = 'duplicate';
          row.duplicate_of_signal_id = duplicateSignal.signal_id;
          continue;
        }

        // 3. Multi-confirmation check (different strategy + same direction within 15 minutes)
        const confirmationSignal = activeSignals.find(s => 
          s.signal_id !== row.signal_id &&
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
            atr_at_signal: existing.atr_at_signal,
            recent_swing_high: existing.recent_swing_high,
            recent_swing_low: existing.recent_swing_low,
            signal_candle_high: existing.signal_candle_high,
            signal_candle_low: existing.signal_candle_low,
            alphatrend_at_signal: existing.alphatrend_at_signal,
            entry_type: existing.entry_type,
            entry_price_est: existing.entry_price_est,
            entry_zone_low: existing.entry_zone_low,
            entry_zone_high: existing.entry_zone_high,
            stop_price: existing.stop_price,
            target1_price: existing.target1_price,
            target2_price: existing.target2_price,
            target3_price: existing.target3_price,
            close_price_est: existing.close_price_est,
            risk_per_share: existing.risk_per_share,
            reward_to_risk_t1: existing.reward_to_risk_t1,
            reward_to_risk_t2: existing.reward_to_risk_t2,
            reward_to_risk_t3: existing.reward_to_risk_t3,
            trade_plan_quality: existing.trade_plan_quality,
            trade_plan_reason: existing.trade_plan_reason,
            invalidation_reason: existing.invalidation_reason,
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

module.exports = {
  handler: exports.handler,
  calculateScoreAndReasons,
  processWatchlistV1
};
