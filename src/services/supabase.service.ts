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
      environment.SUPABASE_SERVICE_ROLE_KEY
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
      .from('screener_setups')
      .select('*')
      .order('score', { ascending: false });

    return from(fetchData.then(({ data, error }) => {
      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      return data ?? [];
    }));
  }
}
