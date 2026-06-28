import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function main() {
  const { data: students } = await supabase.from('students').select('*');
  console.log('--- Students ---');
  console.log(students?.map(s => ({ id: s.id, name: s.full_name, class_name: s.class_name })));

  const { data: classes } = await supabase.from('classes').select('*');
  console.log('--- Classes ---');
  console.log(classes?.map(c => ({ id: c.id, name: c.name, code: c.code })));
}

main();
