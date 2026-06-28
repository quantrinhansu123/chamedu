import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const envPath = path.resolve('.env.local');
dotenv.config({ path: envPath });

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
  console.log('Testing campaigns table query...');
  const { data, error } = await supabase.from('campaigns').select('*').limit(1);
  if (error) {
    console.error('Campaigns query error:', error.message);
  } else {
    console.log('Campaigns query success! Data:', data);
  }

  console.log('Testing leads table query...');
  const { data: leadData, error: leadError } = await supabase.from('leads').select('*').limit(1);
  if (leadError) {
    console.error('Leads query error:', leadError.message);
  } else {
    console.log('Leads query success! Data:', leadData);
  }
}

main();
