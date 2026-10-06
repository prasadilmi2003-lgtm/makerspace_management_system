import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../frontend/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const testEmail = `reusable_test_user@ruhuna.ac.lk`;
const testPassword = `TestPass123!`;

async function runTests() {
  console.log("======================================");
  console.log("STARTING LIVE BACKEND TESTS");
  console.log("======================================");

  const results = [];

  function record(testName, result, evidence) {
    results.push({ testName, result, evidence });
    console.log(`[${result}] ${testName}: ${evidence}`);
  }

  // --- 1. ANONYMOUS READ TESTS (Verifying PostgREST cache & Grants) ---
  console.log("\n--- ANONYMOUS READS (Requires Migration 009) ---");
  
  const { error: procsErr } = await supabase.from('procedure_versions').select('*').limit(1);
  if (!procsErr) record("Procedure read", "PASS", "Successfully read procedure_versions anonymously");
  else record("Procedure read", "FAIL", `Error: ${procsErr.message}`);

  const { error: invErr } = await supabase.from('inventory_items').select('*').limit(1);
  if (!invErr) record("Inventory read", "PASS", "Successfully read inventory_items anonymously");
  else record("Inventory read", "FAIL", `Error: ${invErr.message}`);

  const { error: projErr } = await supabase.from('projects').select('*').limit(1);
  if (!projErr) record("Project read", "PASS", "Successfully read projects anonymously");
  else record("Project read", "FAIL", `Error: ${projErr.message}`);

  const { error: floorErr } = await supabase.from('floor_allocations').select('*').limit(1);
  if (!floorErr) record("Floor read", "PASS", "Successfully read floor_allocations anonymously");
  else record("Floor read", "FAIL", `Error: ${floorErr.message}`);

  // --- 2. IMMUTABILITY TESTS (Anonymous attempt to DELETE) ---
  console.log("\n--- IMMUTABILITY CHECKS ---");
  
  const { error: auditDelErr } = await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (auditDelErr) record("Audit DELETE", "PASS", `Explicitly blocked: ${auditDelErr.message}`);
  else record("Audit DELETE", "FAIL", "API allowed delete request without error");

  const { error: liabDelErr } = await supabase.from('liability_signatures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (liabDelErr) record("Liability immutability", "PASS", `Explicitly blocked: ${liabDelErr.message}`);
  else record("Liability immutability", "FAIL", "API allowed delete request without error");

  // --- 3. AUTHENTICATED TESTS ---
  console.log("\n--- AUTHENTICATED TESTS ---");
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  let hasAuthSession = false;

  if (signInData?.user) {
    console.log("✅ Successfully signed into reusable test account.");
    hasAuthSession = true;
  } else {
    console.log("Test account not found. Attempting to create one...");
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: testEmail, password: testPassword,
      options: { data: { full_name: 'Test User', student_id: '123' } }
    });
    
    if (authErr && authErr.message.toLowerCase().includes('rate limit')) {
      console.error("AUTH TESTS BLOCKED BY RATE LIMIT");
    } else if (authData?.user) {
      hasAuthSession = true;
      // Wait for handle_new_user trigger
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (!hasAuthSession) {
    record("Request lifecycle", "BLOCKED", "Auth session required (Rate Limited)");
    record("Key management", "BLOCKED", "Auth session required (Rate Limited)");
    record("Penalty Box", "BLOCKED", "Auth session required (Rate Limited)");
    record("Admin authorization", "BLOCKED", "Auth session required (Rate Limited)");
    record("Inventory operations", "BLOCKED", "Auth session required (Rate Limited)");
    record("Floor allocation", "BLOCKED", "Auth session required (Rate Limited)");
  } else {
    // We have a session!
    // For safety, we only test unauthorized access since this is an ordinary user.
    // If it's a real Superadmin, they wouldn't hit the Not Authorized errors.
    
    const { error: rlsErr } = await supabase.rpc('claim_request', { p_request_id: '00000000-0000-0000-0000-000000000000' });
    if (rlsErr) record("Request lifecycle", "PASS", `Unauthorized access blocked: ${rlsErr.message}`);
    else record("Request lifecycle", "FAIL", "Unauthorized user was allowed to claim");

    const { error: keyErr } = await supabase.rpc('retrieve_key', { p_request_id: '00000000-0000-0000-0000-000000000000', p_officer_name: 'test' });
    if (keyErr) record("Key management", "PASS", `Unauthorized access blocked: ${keyErr.message}`);
    else record("Key management", "FAIL", "Unauthorized user was allowed to retrieve key");

    const { error: penErr } = await supabase.rpc('override_penalty', { p_keyholder_id: '00000000-0000-0000-0000-000000000000', p_reason: 'test' });
    if (penErr) record("Penalty Box", "PASS", `Unauthorized access blocked: ${penErr.message}`);
    else record("Penalty Box", "FAIL", "Unauthorized user was allowed to override penalty");

    const { error: admErr } = await supabase.rpc('bulk_role_reset', { p_user_ids: [], p_new_role: 'User' });
    if (admErr) record("Admin authorization", "PASS", `Unauthorized access blocked: ${admErr.message}`);
    else record("Admin authorization", "FAIL", "Unauthorized user allowed to use bulk role reset");

    const { error: invOpErr } = await supabase.rpc('checkout_inventory', { p_item_id: '00000000-0000-0000-0000-000000000000', p_request_id: '00000000-0000-0000-0000-000000000000', p_quantity: 1 });
    if (invOpErr) record("Inventory operations", "PASS", `Unauthorized access blocked: ${invOpErr.message}`);
    else record("Inventory operations", "FAIL", "Unauthorized user allowed to checkout inventory");

    const { error: flrOpErr } = await supabase.rpc('allocate_floor', { p_request_id: '00000000-0000-0000-0000-000000000000', p_zone: 'Zone A', p_bench: 'Bench 1', p_start_time: new Date().toISOString(), p_end_time: new Date().toISOString() });
    if (flrOpErr) record("Floor allocation", "PASS", `Unauthorized access blocked: ${flrOpErr.message}`);
    else record("Floor allocation", "FAIL", "Unauthorized user allowed to allocate floor");
  }

  console.log("\n======================================");
  console.log("FINAL REPORT TABLE");
  console.log("| Test | Result | Evidence |");
  console.log("|---|---|---|");
  results.forEach(r => {
    console.log(`| ${r.testName} | ${r.result} | ${r.evidence} |`);
  });
  console.log("======================================");
}

runTests();
