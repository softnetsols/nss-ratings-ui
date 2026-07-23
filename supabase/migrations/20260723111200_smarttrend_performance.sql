-- Migration: SmartTrend Paper Settings and Daily Performance Tables

-- smarttrend_paper_settings table
CREATE TABLE IF NOT EXISTS public.smarttrend_paper_settings (
    setting_key text PRIMARY KEY,
    allocation_per_trade numeric(18,2) not null,
    effective_from date not null,
    updated_at timestamptz not null default now()
);

-- Insert default settings row
INSERT INTO public.smarttrend_paper_settings (setting_key, allocation_per_trade, effective_from)
VALUES ('default', 10000.00, (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date)
ON CONFLICT (setting_key) DO NOTHING;

-- smarttrend_daily_performance table
CREATE TABLE IF NOT EXISTS public.smarttrend_daily_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_date date not null,
    strategy_name text not null default 'smarttrend_core',
    strategy_version text not null default 'unknown',
    group_name text not null default 'ALL',
    allocation_per_trade numeric(18,2) not null,
    opened_trades integer not null default 0,
    closed_trades integer not null default 0,
    active_trades_at_snapshot integer not null default 0,
    long_trades integer not null default 0,
    short_trades integer not null default 0,
    winning_trades integer not null default 0,
    losing_trades integer not null default 0,
    breakeven_trades integer not null default 0,
    target_exits integer not null default 0,
    stop_exits integer not null default 0,
    structure_exits integer not null default 0,
    eod_exits integer not null default 0,
    unknown_exits integer not null default 0,
    gross_deployed_capital numeric(18,2) not null default 0,
    active_capital_at_snapshot numeric(18,2) not null default 0,
    peak_concurrent_capital numeric(18,2) not null default 0,
    gross_profit numeric(18,2) not null default 0,
    gross_loss numeric(18,2) not null default 0,
    realized_paper_pl numeric(18,2) not null default 0,
    unrealized_paper_pl_snapshot numeric(18,2),
    net_paper_pl_snapshot numeric(18,2),
    win_rate_pct numeric(10,4),
    profit_factor numeric(12,6),
    average_trade_return_pct numeric(12,6),
    average_winner numeric(18,2),
    average_loser numeric(18,2),
    return_on_peak_capital_pct numeric(12,6),
    first_event_time timestamptz,
    last_event_time timestamptz,
    calculated_at timestamptz not null default now(),
    is_final boolean not null default false,
    active_unclosed_count integer not null default 0,
    source_event_count integer not null default 0,
    CONSTRAINT unique_daily_performance UNIQUE (trade_date, strategy_name, strategy_version, group_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_st_daily_perf_date ON public.smarttrend_daily_performance(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_st_daily_perf_strat ON public.smarttrend_daily_performance(strategy_name);
CREATE INDEX IF NOT EXISTS idx_st_daily_perf_ver ON public.smarttrend_daily_performance(strategy_version);

-- Enable RLS and define policies
ALTER TABLE public.smarttrend_paper_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smarttrend_daily_performance ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for everyone (authenticated & anonymous)
CREATE POLICY select_smarttrend_paper_settings ON public.smarttrend_paper_settings
    FOR SELECT TO public USING (true);

CREATE POLICY select_smarttrend_daily_performance ON public.smarttrend_daily_performance
    FOR SELECT TO public USING (true);
