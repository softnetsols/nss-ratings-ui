// ────────────────────────────────────────────────────────────────────────────
// SCHWAB & PAPER TRADING EXECUTION ENDPOINT (Netlify Function)
// ────────────────────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { mode, symbol, action, quantity, price, stopLoss, target1, target2, strategy } = payload;

    if (!symbol || !action) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required trade parameters (symbol, action).' })
      };
    }

    const tradeMode = mode || 'PAPER'; // 'PAPER' or 'SCHWAB_LIVE'
    const tradePrice = Number(price) || 0.0;
    const tradeQty = Number(quantity) || 10;

    // ── 1. PAPER TRADING (SIMULATED EXECUTION) ────────────────────────────
    if (tradeMode === 'PAPER') {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const paperOrder = {
        symbol: symbol.toUpperCase(),
        action: action.toUpperCase(), // 'BUY', 'SELL', 'FLAT'
        quantity: tradeQty,
        entry_price: tradePrice,
        stop_loss: Number(stopLoss) || null,
        target_1: Number(target1) || null,
        target_2: Number(target2) || null,
        strategy: strategy || 'screener_v22',
        status: 'EXECUTED',
        mode: 'PAPER_TRADING',
        created_at: new Date().toISOString()
      };

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('paper_trades').insert([paperOrder]).catch(err => {
          console.warn('[schwab-trade] Supabase insert note:', err.message);
        });
      }

      console.log(`[schwab-trade] Paper Trade Executed: ${action} ${tradeQty} ${symbol} @ $${tradePrice}`);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          mode: 'PAPER_TRADING',
          message: `Simulated ${action} ${tradeQty} shares of ${symbol} @ $${tradePrice.toFixed(2)} executed!`,
          trade: paperOrder
        })
      };
    }

    // ── 2. SCHWAB LIVE / SANDBOX API EXECUTION ────────────────────────────
    const schwabToken = event.headers['x-schwab-token'] || process.env.SCHWAB_ACCESS_TOKEN;
    const accountNumber = process.env.SCHWAB_ACCOUNT_NUMBER;

    if (!schwabToken || !accountNumber) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Schwab OAuth token or Account Number missing. Connect Schwab account first.'
        })
      };
    }

    // Construct Schwab Order Payload (Equity / Bracket Order)
    const schwabOrderPayload = {
      orderType: 'MARKET',
      session: 'NORMAL',
      duration: 'DAY',
      orderStrategyType: 'SINGLE',
      orderLegCollection: [
        {
          instruction: action.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
          quantity: tradeQty,
          instrument: {
            symbol: symbol.toUpperCase(),
            assetType: 'EQUITY'
          }
        }
      ]
    };

    const schwabEndpoint = `https://api.schwabapi.com/trader/v1/accounts/${accountNumber}/orders`;

    const response = await fetch(schwabEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${schwabToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schwabOrderPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[schwab-trade] Schwab Order API Error:', errText);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Schwab order placement failed.', details: errText })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        mode: 'SCHWAB_LIVE',
        message: `Schwab ${action} order placed for ${tradeQty} shares of ${symbol}!`,
        orderId: response.headers.get('location') || 'EXECUTED'
      })
    };
  } catch (err) {
    console.error('[schwab-trade] Handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) })
    };
  }
};
