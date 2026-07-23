const { createClient } = require('@supabase/supabase-js');

// Helper to format Date to YYYY-MM-DD in America/New_York
function getETDateString(dateInput) {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

// Helper to determine if it is currently the ET date
function isCurrentETDate(dateStr) {
  const currentET = getETDateString(new Date());
  return currentET === dateStr;
}

// Normalization logic identical to the client-side
function normalizeSignal(row) {
  if (!row) return null;
  let payload = {};
  if (row.raw_alert_payload) {
    if (typeof row.raw_alert_payload === 'string') {
      try {
        payload = JSON.parse(row.raw_alert_payload);
      } catch (e) {
        // fallback
      }
    } else if (typeof row.raw_alert_payload === 'object') {
      payload = row.raw_alert_payload;
    }
  }
  if (!payload) payload = {};

  let action = row.action || payload.event || '';
  if (typeof action === 'string') {
    action = action.toUpperCase();
  }

  if (action !== 'BUY' && action !== 'SHORT' && action !== 'EXIT_LONG' && action !== 'EXIT_SHORT') {
    return null;
  }

  const lifecycle = row.lifecycle || (action === 'EXIT_LONG' || action === 'EXIT_SHORT' ? 'CLOSE' : 'OPEN');
  const tradeId = row.trade_id || payload.tradeId || row.signal_id || '';
  const entrySource = row.entry_source || payload.entrySource || 'FRESH';
  const primaryReason = row.primary_reason || payload.primaryReason || '';
  const positionBefore = row.position_before !== undefined && row.position_before !== null ? row.position_before : (payload.positionBefore !== undefined ? payload.positionBefore : '');
  const positionAfter = row.position_after !== undefined && row.position_after !== null ? row.position_after : (payload.positionAfter !== undefined ? payload.positionAfter : '');
  
  const exitPrice = row.exit_price !== undefined && row.exit_price !== null
    ? Number(row.exit_price)
    : (payload.exitPrice !== undefined && payload.exitPrice !== null ? Number(payload.exitPrice) : null);

  return {
    ...row,
    action,
    lifecycle,
    tradeId,
    entrySource,
    primaryReason,
    positionBefore,
    positionAfter,
    raw_alert_payload: payload,
    exitPrice
  };
}

function getEntryPrice(t) {
  if (t.open) {
    return Number(t.open.trigger_price) || Number(t.open.entry_price_est) || 0;
  }
  if (t.close) {
    return Number(t.close.trigger_price) || 0;
  }
  return 0;
}

function getTargetPrice(open) {
  if (!open) return 0;
  return open.target1_price !== null && Number(open.target1_price) > 0 
    ? Number(open.target1_price) 
    : (Number(open.target2_price) || 0);
}

function resolveReasonCategory(reason) {
  if (!reason) return 'UNKNOWN';
  const r = reason.toUpperCase();
  if (r.includes('TARGET') || r.includes('PROFIT')) return 'TARGET';
  if (r.includes('STOP') || r.includes('LOSS')) return 'STOP';
  if (r.includes('EMA') || r.includes('VWAP') || r.includes('STRUCTURE')) return 'EMA_VWAP_LOSS';
  if (r.includes('DAY') || r.includes('EOD') || r.includes('SESSION')) return 'END_OF_DAY';
  return 'UNKNOWN';
}

function getModeledExitPrice(trade) {
  const open = trade.open;
  const close = trade.close;

  if (close && close.raw_alert_payload?.fillBasis && close.exitPrice !== null && close.exitPrice > 0) {
    return close.exitPrice;
  }

  const reason = close?.primaryReason || '';
  const cat = resolveReasonCategory(reason);

  if (cat === 'TARGET') {
    if (open) {
      if (open.target1_price !== null && Number(open.target1_price) > 0) return Number(open.target1_price);
      if (open.target2_price !== null && Number(open.target2_price) > 0) return Number(open.target2_price);
    }
    return null;
  }

  if (cat === 'STOP') {
    if (open && open.stop_price !== null && Number(open.stop_price) > 0) {
      return Number(open.stop_price);
    }
    return null;
  }

  if (close) {
    return close.exitPrice !== null && close.exitPrice > 0 
      ? close.exitPrice 
      : Number(close.trigger_price);
  }

  return null;
}

function getFillBasis(trade) {
  const open = trade.open;
  const close = trade.close;

  if (close && close.raw_alert_payload?.fillBasis) {
    return close.raw_alert_payload.fillBasis;
  }

  const reason = close?.primaryReason || '';
  const cat = resolveReasonCategory(reason);

  if (cat === 'TARGET') {
    if (open && (open.target1_price || open.target2_price)) {
      return 'TARGET_LEVEL';
    }
  }
  if (cat === 'STOP') {
    if (open && open.stop_price) {
      return 'STOP_LEVEL';
    }
  }
  if (close) {
    return 'EVENT_PRICE';
  }
  return 'UNKNOWN';
}

async function aggregatePerformanceForDate(supabase, tradeDate) {
  console.log(`[performance-shared] Aggregating for date: ${tradeDate}`);

  // 1. Query all smarttrend_core signals
  const { data: rawSignals, error: signalsError } = await supabase
    .from('screener_signals')
    .select('*')
    .eq('strategy_name', 'smarttrend_core');

  if (signalsError) {
    throw new Error(`Failed to query signals: ${signalsError.message}`);
  }

  // 2. Normalize and filter signals (excluding dummy symbols & groups)
  const normalized = (rawSignals || [])
    .map(r => normalizeSignal(r))
    .filter(r => r !== null && r.symbol !== 'STDEMO' && r.group_name !== 'NSS-SmartTrend-Dummy-Test');

  // 3. Deduplicate by signal_id
  const seenSignalIds = new Set();
  const unique = [];
  for (const r of normalized) {
    if (!seenSignalIds.has(r.signal_id)) {
      seenSignalIds.add(r.signal_id);
      unique.push(r);
    }
  }

  // 4. Find all signals whose signal_bar_time is on tradeDate in ET
  const signalsOnDate = unique.filter(r => getETDateString(r.signal_bar_time) === tradeDate);
  
  // 5. Filter for OPEN events to identify trades that opened today
  const openSignalsOnDate = signalsOnDate.filter(r => r.lifecycle === 'OPEN');
  
  // Collect unique tradeIds of trades that opened on this date
  const tradeIds = Array.from(new Set(openSignalsOnDate.map(r => r.tradeId))).filter(Boolean);
  
  console.log(`[performance-shared] Date ${tradeDate}: Found ${tradeIds.length} trades opened on this date.`);

  if (tradeIds.length === 0) {
    // If no trades opened on this date, we do not write anything or return empty list
    return [];
  }

  // 6. Get all signals (OPEN & CLOSE) for these tradeIds
  const relevantSignals = unique.filter(r => tradeIds.includes(r.tradeId));

  // Helper to find newest row
  const getNewest = (a, b) => {
    const timeA = new Date(a.signal_bar_time).getTime();
    const timeB = new Date(b.signal_bar_time).getTime();
    if (timeA !== timeB) return timeA > timeB ? a : b;

    const alertA = new Date(a.alert_received_at || a.created_at || 0).getTime();
    const alertB = new Date(b.alert_received_at || b.created_at || 0).getTime();
    return alertA > alertB ? a : b;
  };

  // 7. Group by tradeId
  const groups = new Map();
  for (const r of relevantSignals) {
    const tId = r.tradeId;
    if (!groups.has(tId)) {
      groups.set(tId, {});
    }
    const g = groups.get(tId);
    if (r.lifecycle === 'OPEN') {
      g.open = g.open ? getNewest(g.open, r) : r;
    } else if (r.lifecycle === 'CLOSE') {
      g.close = g.close ? getNewest(g.close, r) : r;
    }
  }

  // 8. Load allocations from settings
  // Check if we already have daily performance row to use its locked allocation
  const { data: existingPerf } = await supabase
    .from('smarttrend_daily_performance')
    .select('allocation_per_trade')
    .eq('trade_date', tradeDate)
    .eq('strategy_name', 'smarttrend_core');

  let allocation = 10000.00;
  if (existingPerf && existingPerf.length > 0) {
    allocation = Number(existingPerf[0].allocation_per_trade);
  } else {
    // Query default setting
    const { data: defaultSetting } = await supabase
      .from('smarttrend_paper_settings')
      .select('allocation_per_trade')
      .eq('setting_key', 'default')
      .single();
    if (defaultSetting) {
      allocation = Number(defaultSetting.allocation_per_trade);
    }
  }

  // Construct SmartTrendTrade objects
  const trades = [];
  for (const [tId, g] of groups.entries()) {
    if (!g.open) continue; // Must have opened on this date (already filtered by tradeIds)
    
    const side = g.open.action === 'BUY' ? 'LONG' : 'SHORT';
    const symbol = g.open.symbol;
    const openedTime = g.open.signal_bar_time;
    const closedTime = g.close ? g.close.signal_bar_time : null;
    const type = g.close ? 'CLOSED' : 'ACTIVE';

    const entry = getEntryPrice({ open: g.open });
    const quantity = entry > 0 ? Math.floor(allocation / entry) : 0;
    const tradeCapital = quantity * entry;

    let modeledExitPrice = null;
    let fillBasis = 'UNKNOWN';
    let paperPl = 0;
    let plPerShare = 0;
    let resultPct = 0;

    if (g.close) {
      const dummyTrade = { open: g.open, close: g.close, side, symbol };
      modeledExitPrice = getModeledExitPrice(dummyTrade);
      fillBasis = getFillBasis(dummyTrade);
      
      const exit = modeledExitPrice || entry;
      if (side === 'LONG') {
        plPerShare = exit - entry;
        resultPct = entry > 0 ? ((exit - entry) / entry) * 100 : 0;
      } else {
        plPerShare = entry - exit;
        resultPct = entry > 0 ? ((entry - exit) / entry) * 100 : 0;
      }
      paperPl = quantity * plPerShare;
    } else {
      // Active trade unrealized P/L calculation at snapshot
      const current = Number(g.open.current_price) || entry;
      if (side === 'LONG') {
        plPerShare = current - entry;
      } else {
        plPerShare = entry - current;
      }
      paperPl = quantity * plPerShare; // snapshot unrealized P/L
    }

    // Extract version
    const payload = g.open.raw_alert_payload || {};
    const version = payload.version || payload.scanner?.version || 'unknown';

    trades.push({
      tradeId: tId,
      open: g.open,
      close: g.close,
      type,
      side,
      symbol,
      openedTime,
      closedTime,
      version,
      group_name: g.open.group_name || 'Unknown',
      quantity,
      tradeCapital,
      modeledExitPrice,
      fillBasis,
      paperPl,
      plPerShare,
      resultPct,
      signalCount: (g.open ? 1 : 0) + (g.close ? 1 : 0)
    });
  }

  // Group trades by group_name, and also construct one for 'ALL'
  const groupsToAggregate = ['ALL'];
  const uniqueGroups = Array.from(new Set(trades.map(t => t.group_name))).filter(Boolean);
  for (const ug of uniqueGroups) {
    groupsToAggregate.push(ug);
  }

  const results = [];

  for (const targetGroup of groupsToAggregate) {
    const groupTrades = targetGroup === 'ALL' 
      ? trades 
      : trades.filter(t => t.group_name === targetGroup);

    if (groupTrades.length === 0) continue;

    // Daily Metrics Calculations
    const opened_trades = groupTrades.length;
    const closedTradesList = groupTrades.filter(t => t.type === 'CLOSED');
    const closed_trades = closedTradesList.length;
    const active_trades_at_snapshot = groupTrades.filter(t => t.type === 'ACTIVE').length;

    const long_trades = groupTrades.filter(t => t.side === 'LONG').length;
    const short_trades = groupTrades.filter(t => t.side === 'SHORT').length;

    const winning_trades = closedTradesList.filter(t => t.paperPl > 0).length;
    const losing_trades = closedTradesList.filter(t => t.paperPl < 0).length;
    const breakeven_trades = closedTradesList.filter(t => t.paperPl === 0).length;

    let target_exits = 0;
    let stop_exits = 0;
    let structure_exits = 0;
    let eod_exits = 0;
    let unknown_exits = 0;

    for (const t of closedTradesList) {
      const cat = resolveReasonCategory(t.close?.primaryReason);
      if (cat === 'TARGET') target_exits++;
      else if (cat === 'STOP') stop_exits++;
      else if (cat === 'EMA_VWAP_LOSS') structure_exits++;
      else if (cat === 'END_OF_DAY') eod_exits++;
      else unknown_exits++;
    }

    const gross_deployed_capital = groupTrades.reduce((sum, t) => sum + t.tradeCapital, 0);
    const active_capital_at_snapshot = groupTrades
      .filter(t => t.type === 'ACTIVE')
      .reduce((sum, t) => sum + t.tradeCapital, 0);

    // Timeline calculation for peak concurrent capital
    const events = [];
    for (const t of groupTrades) {
      events.push({
        time: new Date(t.openedTime).getTime(),
        value: t.tradeCapital,
        type: 'OPEN'
      });
      if (t.closedTime && getETDateString(t.closedTime) === tradeDate) {
        events.push({
          time: new Date(t.closedTime).getTime(),
          value: -t.tradeCapital,
          type: 'CLOSE'
        });
      }
    }
    events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.type === 'OPEN' ? -1 : 1; // Process OPEN before CLOSE
    });

    let runningCapital = 0;
    let peak_concurrent_capital = 0;
    for (const ev of events) {
      runningCapital += ev.value;
      if (runningCapital > peak_concurrent_capital) {
        peak_concurrent_capital = runningCapital;
      }
    }

    let gross_profit = 0;
    let gross_loss = 0;
    let realized_paper_pl = 0;

    for (const t of closedTradesList) {
      realized_paper_pl += t.paperPl;
      if (t.paperPl > 0) {
        gross_profit += t.paperPl;
      } else if (t.paperPl < 0) {
        gross_loss += t.paperPl; // Stored as negative number
      }
    }

    const unrealized_paper_pl_snapshot = groupTrades
      .filter(t => t.type === 'ACTIVE')
      .reduce((sum, t) => sum + t.paperPl, 0);

    const net_paper_pl_snapshot = realized_paper_pl + unrealized_paper_pl_snapshot;

    const win_rate_pct = closed_trades > 0 
      ? (winning_trades / closed_trades) * 100 
      : null;

    let profit_factor = null;
    if (closed_trades > 0) {
      const absLoss = Math.abs(gross_loss);
      if (absLoss > 0) {
        profit_factor = gross_profit / absLoss;
      } else {
        profit_factor = null;
      }
    }

    const average_trade_return_pct = closed_trades > 0
      ? closedTradesList.reduce((sum, t) => sum + t.resultPct, 0) / closed_trades
      : null;

    const average_winner = winning_trades > 0 ? gross_profit / winning_trades : null;
    const average_loser = losing_trades > 0 ? gross_loss / losing_trades : null;

    const return_on_peak_capital_pct = peak_concurrent_capital > 0
      ? (realized_paper_pl / peak_concurrent_capital) * 100
      : null;

    const eventTimes = groupTrades.map(t => new Date(t.openedTime).getTime());
    for (const t of closedTradesList) {
      eventTimes.push(new Date(t.closedTime).getTime());
    }
    const first_event_time = eventTimes.length > 0 ? new Date(Math.min(...eventTimes)).toISOString() : null;
    const last_event_time = eventTimes.length > 0 ? new Date(Math.max(...eventTimes)).toISOString() : null;

    // Row version
    const version = groupTrades[0].version || 'unknown';

    // Final check: unclosed active trades and target date is not today
    const active_unclosed_count = active_trades_at_snapshot;
    const is_final = active_unclosed_count === 0 && !isCurrentETDate(tradeDate);

    const source_event_count = groupTrades.reduce((sum, t) => sum + t.signalCount, 0);

    results.push({
      trade_date: tradeDate,
      strategy_name: 'smarttrend_core',
      strategy_version: version,
      group_name: targetGroup,
      allocation_per_trade: allocation,
      opened_trades,
      closed_trades,
      active_trades_at_snapshot,
      long_trades,
      short_trades,
      winning_trades,
      losing_trades,
      breakeven_trades,
      target_exits,
      stop_exits,
      structure_exits,
      eod_exits,
      unknown_exits,
      gross_deployed_capital,
      active_capital_at_snapshot,
      peak_concurrent_capital,
      gross_profit,
      gross_loss,
      realized_paper_pl,
      unrealized_paper_pl_snapshot,
      net_paper_pl_snapshot,
      win_rate_pct,
      profit_factor,
      average_trade_return_pct,
      average_winner,
      average_loser,
      return_on_peak_capital_pct,
      first_event_time,
      last_event_time,
      is_final,
      active_unclosed_count,
      source_event_count,
      calculated_at: new Date().toISOString()
    });
  }

  // 9. Execute database upserts
  for (const res of results) {
    const { error: upsertError } = await supabase
      .from('smarttrend_daily_performance')
      .upsert(res, { onConflict: 'trade_date,strategy_name,strategy_version,group_name' });
    
    if (upsertError) {
      console.error(`[performance-shared] Upsert failed for date=${tradeDate} group=${res.group_name}:`, upsertError);
    }
  }

  return results;
}

module.exports = {
  getETDateString,
  isCurrentETDate,
  aggregatePerformanceForDate
};
