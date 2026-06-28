import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const CONFIG_ERROR =
  'Chưa cấu hình Supabase. Tạo file .env.local với VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY, sau đó chạy lại: npm run dev';

if (!isSupabaseConfigured) {
  console.error(`[Supabase] ${CONFIG_ERROR}`);
}

if (import.meta.env.DEV && !isSupabaseConfigured) {
  console.error(
    '[Supabase] Dev server thiếu biến môi trường. Dừng tất cả npm run dev, chạy lại một lần sau khi có .env.local'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'invalid-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const assertSupabaseConfigured = (): void => {
  if (!isSupabaseConfigured) {
    throw new Error(CONFIG_ERROR);
  }
};
