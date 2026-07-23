import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { environment } from '../environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_ANON_KEY
    );
  }

  getMostActive(): Observable<any[]> {
    const fetchData = this.supabase
      .from('mostActive')
      .select('*')
      .order('volume', { ascending: false })
      .limit(100);

    return from(fetchData.then(({ data, error }) => {
      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      return data ?? [];
    }));
  }

  getScreenerSetups(): Observable<any[]> {
    const fetchData = this.supabase
      .from('screener_signals')
      .select('*')
      .order('signal_score', { ascending: false });

    return from(fetchData.then(({ data, error }) => {
      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      return data ?? [];
    }));
  }

  getSmartTrendSignals(): Observable<any[]> {
    const fetchData = this.supabase
      .from("screener_signals")
      .select("*")
      .eq("strategy_name", "smarttrend_core")
      .order("signal_bar_time", { ascending: false })
      .limit(500);

    return from(fetchData.then(({ data, error }) => {
      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      return data ?? [];
    }));
  }

  getSmartTrendDailyPerformance(days: number, groupName = 'ALL'): Observable<any[]> {
    let query = this.supabase
      .from('smarttrend_daily_performance')
      .select('*')
      .eq('strategy_name', 'smarttrend_core')
      .eq('group_name', groupName)
      .order('trade_date', { ascending: false });

    if (days > 0) {
      query = query.limit(days);
    }

    return from(query.then(({ data, error }) => {
      if (error) {
        console.error('Supabase performance fetch error:', error);
        throw error;
      }
      return data ?? [];
    }));
  }
}
