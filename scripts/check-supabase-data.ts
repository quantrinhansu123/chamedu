import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

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

async function checkTable(tableName: string) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error querying table "${tableName}":`, error.message);
      return null;
    }
    console.log(`Table "${tableName}": ${count} rows`);
    return count;
  } catch (err: any) {
    console.error(`Failed to query table "${tableName}":`, err.message);
    return null;
  }
}

async function main() {
  console.log('Checking database table row counts...');
  const tables = [
    'users',
    'staff',
    'students',
    'classes',
    'class_sessions',
    'contracts',
    'contract_items',
    'enrollments',
    'centers'
  ];

  for (const table of tables) {
    await checkTable(table);
  }
}

main();
