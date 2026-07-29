/**
 * Public API — Doanh thu đào tạo (dự kiến vs thực tế)
 *
 * HTTP (dev):     GET http://localhost:3003/api/training-revenue?year=2026&month=7
 * HTTP (prod):    GET https://<project>.supabase.co/functions/v1/training-revenue?year=2026&month=7
 *
 * @example
 * import { fetchTrainingRevenueHttp } from '@/src/api/trainingRevenue';
 * const { data } = await fetchTrainingRevenueHttp({ year: 2026, month: 7 });
 */

export {
  getTrainingRevenueSummary,
  getAttendanceRecordRevenue,
  type TrainingRevenueApiParams,
  type TrainingRevenueApiResponse,
  type TrainingRevenueByClass,
} from '../services/trainingRevenueApiService';

import type {
  TrainingRevenueApiParams,
  TrainingRevenueApiResponse,
} from '../services/trainingRevenueApiService';

export type TrainingRevenueHttpResponse = {
  ok: boolean;
  data?: TrainingRevenueApiResponse;
  error?: string;
};

/** URL gốc của API HTTP (không kèm query string) */
export function getTrainingRevenueApiUrl(): string {
  const custom = import.meta.env.VITE_TRAINING_REVENUE_API_URL as string | undefined;
  if (custom?.trim()) return custom.replace(/\/$/, '');

  if (import.meta.env.DEV) {
    return '/api/training-revenue';
  }

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/training-revenue`;
  }

  return '/api/training-revenue';
}

/** Gọi API HTTP — dùng được từ browser, Postman, hoặc app khác */
export async function fetchTrainingRevenueHttp(
  params: TrainingRevenueApiParams = {}
): Promise<TrainingRevenueHttpResponse> {
  const base = getTrainingRevenueApiUrl();
  const isAbsolute = /^https?:\/\//i.test(base);
  const url = new URL(
    base,
    isAbsolute ? undefined : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3003')
  );

  const now = new Date();
  url.searchParams.set('year', String(params.year ?? now.getFullYear()));
  url.searchParams.set('month', String(params.month ?? now.getMonth() + 1));
  if (params.branch) url.searchParams.set('branch', params.branch);
  if (params.classId) url.searchParams.set('classId', params.classId);

  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (anonKey && isAbsolute) {
    headers.Authorization = `Bearer ${anonKey}`;
    headers.apikey = anonKey;
  }

  const response = await fetch(url.toString(), { method: 'GET', headers });
  const payload = (await response.json()) as TrainingRevenueHttpResponse;

  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || `HTTP ${response.status}`,
    };
  }

  return payload;
}
