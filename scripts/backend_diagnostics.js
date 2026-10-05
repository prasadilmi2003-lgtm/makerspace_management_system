import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), 'frontend/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log("======================================");
  console.log("🛠️  MAKERSAPCE BACKEND DIAGNOSTICS");
  console.log("======================================");

  let issues = 0;

  function report(status, category, message) {
    if (status === 'PASS') {
      console.log(`✅ [PASS] ${message}`);
    } else {
      console.error(`❌ [${category}] ${message}`);
      issues++;
    }
  }

  // 1. Env & Config Checks
  console.log("\n--- 1. CONFIGURATION ---");
  if (!supabaseUrl || !supabaseUrl.includes('supabase.co')) {
    report('FAIL', 'SUPABASE ENVIRONMENT ISSUE', 'VITE_SUPABASE_URL is missing or invalid.');
  } else {
    report('PASS', 'CONFIG', 'VITE_SUPABASE_URL is configured.');
  }

  if (fs.existsSync(path.resolve(process.cwd(), 'supabase/config.toml'))) {
    const config = fs.readFileSync(path.resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    if (config.includes('verify_jwt = false') && config.includes('[functions.process-notifications]')) {
      report('PASS', 'CONFIG', 'Edge Function verify_jwt=false is correctly configured locally.');
    } else {
      report('FAIL', 'CODE ISSUE', 'Edge Function config is missing verify_jwt=false.');
    }
  } else {
    report('FAIL', 'CODE ISSUE', 'supabase/config.toml does not exist.');
  }

  // 2. Database Connectivity & PostgREST Cache
  console.log("\n--- 2. DATABASE CONNECTIVITY & CACHE ---");
  const { data: inv, error: invErr } = await supabase.from('inventory_items').select('id').limit(1);
  
  if (invErr) {
    if (invErr.code === '42501') {
      report('FAIL', 'POSTGREST CACHE ISSUE', 'Permission denied reading inventory_items. PostgREST cache is likely stale (Run NOTIFY pgrst, "reload schema").');
    } else if (invErr.code === 'PGRST116' || invErr.message.includes('Could not find')) {
      report('FAIL', 'POSTGREST CACHE ISSUE', 'Table not found in schema cache. PostgREST cache is stale.');
    } else {
      report('FAIL', 'DATABASE ISSUE', `Failed to query inventory: ${invErr.message}`);
    }
  } else {
    report('PASS', 'DATABASE', 'Successfully queried inventory_items anonymously (Grants & Cache OK).');
  }

  const { error: projErr } = await supabase.from('projects').select('id').limit(1);
  if (projErr && projErr.message.includes('Could not find')) {
    report('FAIL', 'POSTGREST CACHE ISSUE', 'Projects table missing from PostgREST cache.');
  } else if (!projErr) {
    report('PASS', 'DATABASE', 'Projects table is accessible in the schema cache.');
  }

  // 3. Auth Rate Limit Check
  console.log("\n--- 3. AUTHENTICATION & RATE LIMITS ---");
  // We do a dummy sign in to check connectivity, not signup
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'diagnostic_ping@example.com', password: 'PingPassword123!' });
  if (authErr && authErr.message.toLowerCase().includes('rate limit')) {
    report('FAIL', 'AUTH RATE LIMIT', 'Supabase Auth is currently rate limiting requests.');
  } else if (authErr && authErr.message.includes('Invalid login')) {
    report('PASS', 'AUTH', 'Supabase Auth is reachable and responding correctly (No rate limit hit on ping).');
  } else {
    report('PASS', 'AUTH', 'Supabase Auth responded.');
  }

  // 4. Edge Function Availability (Ping)
  console.log("\n--- 4. EDGE FUNCTION DEPLOYMENT ---");
  try {
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (fnRes.status === 404) {
      report('FAIL', 'SUPABASE ENVIRONMENT ISSUE', 'Edge Function process-notifications is not deployed (404).');
    } else if (fnRes.status === 401) {
      report('PASS', 'EDGE FUNCTION', 'Edge Function deployed and actively rejecting unauthorized webhooks (401).');
    } else {
      report('PASS', 'EDGE FUNCTION', `Edge Function reached (Status: ${fnRes.status}).`);
    }
  } catch (e) {
    report('FAIL', 'SUPABASE ENVIRONMENT ISSUE', `Could not reach Edge Function endpoint: ${e.message}`);
  }

  // Summary
  console.log("\n======================================");
  if (issues === 0) {
    console.log("✅ ALL DIAGNOSTICS PASSED. Backend is healthy and cache is fresh.");
  } else {
    console.log(`⚠️  FOUND ${issues} DIAGNOSTIC WARNING(S). Review output above.`);
  }
  console.log("======================================");
}

runDiagnostics();
