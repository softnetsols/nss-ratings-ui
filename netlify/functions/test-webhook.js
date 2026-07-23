// ============================================================
// Test Suite for screener-webhook-v2.js
// Runs focused unit tests targeting all key webhook requirements.
// ============================================================

const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Setup mock state
let dbRecords = [];
let upsertedData = [];
let selectResponse = [];

const mockSupabaseClient = {
  from: () => ({
    select: () => {
      const query = {
        resultData: null,
        in: function(field, values) {
          if (field === 'signal_id') {
            query.resultData = dbRecords.filter(r => values.includes(r.signal_id));
          } else if (field === 'symbol') {
            query.resultData = dbRecords.filter(r => values.includes(r.symbol));
          }
          return this;
        },
        gt: function() { return this; },
        not: function() { return this; },
        then: function(resolve) {
          resolve({ data: query.resultData !== null ? query.resultData : (selectResponse || []), error: null });
        }
      };
      return query;
    },
    upsert: (data) => {
      upsertedData = data;
      return Promise.resolve({ data, error: null });
    },
    delete: () => {
      return {
        lt: () => ({
          then: (resolve) => resolve({ error: null })
        })
      };
    }
  })
};

// Intercept @supabase/supabase-js import
Module.prototype.require = function(path) {
  if (path === '@supabase/supabase-js') {
    return {
      createClient: () => mockSupabaseClient
    };
  }
  return originalRequire.apply(this, arguments);
};

// Set environment variables required by the webhook
process.env.WEBHOOK_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'https://mock-supabase.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Require the handler under test
const { handler } = require('./screener-webhook-v2');

async function runTests() {
  console.log('--- STARTING WEBHOOK UNIT TESTS ---');

  // Helper to call handler
  const callHandler = async (bodyString, headers = { Authorization: 'test-secret' }) => {
    upsertedData = [];
    return await handler({
      httpMethod: 'POST',
      body: bodyString,
      headers: headers
    }, {});
  };

  // 1. Test: BUY Event (SMARTTREND_CORE)
  {
    console.log('Test 1: BUY Event Mapping...');
    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      signalTf: '15',
      events: [{
        eventId: 'ST_BUY_AAPL_123',
        strategy: 'SMARTTREND_CORE',
        event: 'BUY',
        score: 50,
        tradePlan: { valid: true, stop: 150, target1: 155, target2: 160, risk: 2, atr: 1.5 }
      }]
    };

    const res = await callHandler(JSON.stringify(payload));
    assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    assert.strictEqual(upsertedData.length, 1, 'Expected 1 upserted row');
    
    const row = upsertedData[0];
    assert.strictEqual(row.strategy_name, 'smarttrend_core');
    assert.strictEqual(row.direction, 'bullish');
    assert.strictEqual(row.lifecycle, 'OPEN');
    assert.strictEqual(row.action, 'BUY');
    assert.strictEqual(row.signal_score, 50, 'Preserve Pine score 50');
    assert.strictEqual(row.status, 'fresh', 'Pine score 50 must be fresh (not rejected)');
    assert.strictEqual(row.group_name, 'NSS_SmartTrend_NASDAQ');
    assert.strictEqual(row.stop_price, 150);
    assert.strictEqual(row.target2_price, 160);
    console.log('✓ BUY Event Mapping Passed');
  }

  // 2. Test: SHORT Event (SMARTTREND_CORE)
  {
    console.log('Test 2: SHORT Event Mapping...');
    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      signalTf: '15',
      events: [{
        eventId: 'ST_SHORT_AAPL_123',
        strategy: 'SMARTTREND_CORE',
        event: 'SHORT',
        score: 80,
        tradePlan: { valid: true, stop: 170, target1: 165, target2: 160, risk: 2, atr: 1.5 }
      }]
    };

    const res = await callHandler(JSON.stringify(payload));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(upsertedData.length, 1);
    
    const row = upsertedData[0];
    assert.strictEqual(row.strategy_name, 'smarttrend_core');
    assert.strictEqual(row.direction, 'bearish');
    assert.strictEqual(row.lifecycle, 'OPEN');
    assert.strictEqual(row.action, 'SHORT');
    assert.strictEqual(row.group_name, 'NSS_SmartTrend_NASDAQ');
    console.log('✓ SHORT Event Mapping Passed');
  }

  // 3. Test: EXIT_LONG Event (SMARTTREND_CORE)
  {
    console.log('Test 3: EXIT_LONG Event Mapping...');
    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      signalTf: '15',
      events: [{
        eventId: 'ST_EXIT_LONG_AAPL_123',
        strategy: 'SMARTTREND_CORE',
        event: 'EXIT_LONG',
        tradeId: 'T123',
        primaryReason: 'MOMENTUM_WEAKNESS'
      }]
    };

    const res = await callHandler(JSON.stringify(payload));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(upsertedData.length, 1);
    
    const row = upsertedData[0];
    assert.strictEqual(row.strategy_name, 'smarttrend_core');
    assert.strictEqual(row.direction, 'flat', 'EXIT_LONG must be flat (not bearish)');
    assert.strictEqual(row.lifecycle, 'CLOSE');
    assert.strictEqual(row.action, 'EXIT_LONG');
    assert.strictEqual(row.signal_score, 100, 'Exits score must be 100');
    assert.strictEqual(row.status, 'fresh');
    assert.strictEqual(row.trade_plan_quality, 'not_applicable');
    assert.strictEqual(row.stop_price, null);
    assert.strictEqual(row.target1_price, null);
    assert.strictEqual(row.group_name, 'NSS_SmartTrend_NASDAQ');
    assert.strictEqual(row.raw_alert_payload.tradeId, 'T123');
    assert.strictEqual(row.raw_alert_payload.primaryReason, 'MOMENTUM_WEAKNESS');
    console.log('✓ EXIT_LONG Event Mapping Passed');
  }

  // 4. Test: EXIT_SHORT Event (SMARTTREND_CORE)
  {
    console.log('Test 4: EXIT_SHORT Event Mapping...');
    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      signalTf: '15',
      events: [{
        eventId: 'ST_EXIT_SHORT_AAPL_123',
        strategy: 'SMARTTREND_CORE',
        event: 'EXIT_SHORT',
        tradeId: 'T123',
        primaryReason: 'FULL_PROFIT_TARGET'
      }]
    };

    const res = await callHandler(JSON.stringify(payload));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(upsertedData.length, 1);
    
    const row = upsertedData[0];
    assert.strictEqual(row.strategy_name, 'smarttrend_core');
    assert.strictEqual(row.direction, 'flat', 'EXIT_SHORT must be flat (not bearish)');
    assert.strictEqual(row.lifecycle, 'CLOSE');
    assert.strictEqual(row.action, 'EXIT_SHORT');
    assert.strictEqual(row.signal_score, 100);
    assert.strictEqual(row.status, 'fresh');
    assert.strictEqual(row.trade_plan_quality, 'not_applicable');
    assert.strictEqual(row.stop_price, null);
    assert.strictEqual(row.target1_price, null);
    assert.strictEqual(row.group_name, 'NSS_SmartTrend_NASDAQ');
    console.log('✓ EXIT_SHORT Event Mapping Passed');
  }

  // 5. Test: Duplicate eventId (Uses original immutable values)
  {
    console.log('Test 5: Duplicate eventId Merging...');
    dbRecords = [{
      signal_id: 'ST_BUY_AAPL_123',
      symbol: 'AAPL',
      trigger_price: 145.0,
      created_at: '2026-07-22T12:00:00.000Z',
      signal_bar_time: '2026-07-22T11:45:00.000Z',
      stop_price: 140.0
    }];

    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      signalTf: '15',
      events: [{
        eventId: 'ST_BUY_AAPL_123',
        strategy: 'SMARTTREND_CORE',
        event: 'BUY',
        score: 50,
        triggerPrice: 148.0, // Different trigger price in incoming payload
        tradePlan: { valid: true, stop: 142.0, target1: 155, target2: 160, risk: 2, atr: 1.5 }
      }]
    };

    const res = await callHandler(JSON.stringify(payload));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(upsertedData.length, 1);
    
    const row = upsertedData[0];
    assert.strictEqual(row.trigger_price, 145.0, 'Must preserve original trigger price on duplicate');
    assert.strictEqual(row.stop_price, 140.0, 'Must preserve original stop price on duplicate');
    assert.strictEqual(row.created_at, '2026-07-22T12:00:00.000Z', 'Must preserve original created_at time');
    dbRecords = []; // reset mock db
    console.log('✓ Duplicate eventId Merging Passed');
  }

  // 6. Test: test=true Payload Skipped
  {
    console.log('Test 6: test=true Payload Skipped...');
    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      signalTf: '15',
      test: true, // test mode
      events: [{
        eventId: 'ST_BUY_AAPL_123',
        strategy: 'SMARTTREND_CORE',
        event: 'BUY',
        score: 50
      }]
    };

    const res = await callHandler(JSON.stringify(payload));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(upsertedData.length, 0, 'No rows should be generated or upserted for test payload');
    console.log('✓ test=true Payload Skipped Passed');
  }

  // 7. Test: Malformed JSON
  {
    console.log('Test 7: Malformed JSON Failure...');
    const res = await callHandler('{"schema": "nss-watchlist-v1", invalid_json}');
    assert.strictEqual(res.statusCode, 400, 'Malformed JSON must return 400 Bad Request');
    console.log('✓ Malformed JSON Failure Passed');
  }

  // 8. Test: Unauthorized Request
  {
    console.log('Test 8: Unauthorized Request...');
    const payload = {
      schema: 'nss-watchlist-v1',
      symbolId: 'NASDAQ:AAPL',
      events: [{ eventId: '123', strategy: 'SMARTTREND_CORE', event: 'BUY' }]
    };
    const res = await callHandler(JSON.stringify(payload), { Authorization: 'wrong-secret' });
    assert.strictEqual(res.statusCode, 401, 'Wrong authorization token must return 401');
    console.log('✓ Unauthorized Request Passed');
  }

  console.log('--- ALL UNIT TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test Suite Failed with Error:');
  console.error(err);
  process.exit(1);
});
