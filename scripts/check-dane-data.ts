// Quick script to check if DANE data exists in shipping_coverage
// Run with: npx tsx scripts/check-dane-data.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ysdcsqsfnckeuafjyrbc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  // Try reading from .env or supabase config
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  // Count total rows
  const { count: totalCount } = await supabase
    .from('shipping_coverage')
    .select('*', { count: 'exact', head: true });
  console.log(`Total rows in shipping_coverage: ${totalCount}`);

  // Count by organization
  const { data: orgCounts } = await supabase
    .from('shipping_coverage')
    .select('organization_id')
    .limit(5);
  console.log('Sample org IDs:', orgCounts?.map(r => r.organization_id).filter((v, i, a) => a.indexOf(v) === i));

  // Check for Bogotá specifically
  const { data: bogota, error: bogErr } = await supabase
    .from('shipping_coverage')
    .select('municipality, department, dane_code, organization_id, municipality_normalized')
    .ilike('municipality', '%bogot%')
    .limit(10);

  if (bogErr) console.error('Error querying Bogotá:', bogErr);
  console.log('Bogotá rows:', bogota);

  // Check if municipality_normalized column exists
  const { data: normTest, error: normErr } = await supabase
    .from('shipping_coverage')
    .select('municipality_normalized')
    .limit(1);

  if (normErr) {
    console.log('municipality_normalized column ERROR:', normErr.message);
  } else {
    console.log('municipality_normalized exists:', normTest?.[0]?.municipality_normalized);
  }
}

check().catch(console.error);
