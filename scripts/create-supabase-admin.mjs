/**
 * Tạo admin trong bảng public.users (email + password)
 * Usage: npm run setup:admin
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL || 'admin@chamedu.vn';
const password = process.env.ADMIN_PASSWORD || 'Chamedu@2026';
const userId = process.env.ADMIN_USER_ID || '2823f0f1-c6a6-4560-95da-93d849830a83';

if (!url || !serviceKey) {
  console.error('Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  const id = existing?.id || userId || randomUUID();

  const { error: userError } = await supabase.from('users').upsert(
    {
      id,
      email,
      password,
      full_name: 'Quản trị viên',
      role: 'Quản trị viên',
      status: 'active',
      branch: 'Trung tâm',
    },
    { onConflict: 'id' }
  );
  if (userError) throw userError;

  const { error: staffError } = await supabase.from('staff').upsert(
    {
      code: 'ADMIN001',
      name: 'Quản trị viên',
      email,
      department: 'Văn phòng',
      position: 'Quản trị viên',
      role: 'Quản trị viên',
      roles: ['Quản trị viên'],
      branch: 'Trung tâm',
      status: 'Đang làm việc',
      uid: id,
    },
    { onConflict: 'code' }
  );
  if (staffError) console.warn('staff:', staffError.message);

  console.log('\n=== Admin (bảng users) ===');
  console.log('Email:   ', email);
  console.log('Mật khẩu:', password);
  console.log('User ID: ', id);
  console.log('\nChạy docs/supabase-users-auth-migration.sql nếu chưa có RPC authenticate_user');
}

main().catch((err) => {
  console.error('Lỗi:', err.message || err);
  process.exit(1);
});
