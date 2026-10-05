import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'frontend/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Use a static test account so we don't trigger Auth email rate limits on repeat runs
const testEmail = `reusable_test_user@ruhuna.ac.lk`;
const testPassword = `TestPass123!`;
const testName = `Reusable Test User`;
const testStudentId = `TEST/0000`;
let testUserId = null;
let testRequestId = null;

async function runTests() {
  console.log("======================================");
  console.log("STARTING COMPREHENSIVE BACKEND TESTS");
  console.log("======================================");

  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, testName, errorDetails = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      results.push({ name: testName, status: 'PASS' });
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${errorDetails ? '-> ' + errorDetails : ''}`);
      results.push({ name: testName, status: 'FAIL', error: errorDetails });
      failed++;
    }
  }

  // --- 1. AUTH & ONBOARDING (REUSE OR CREATE) ---
  console.log("\n--- AUTH & REGISTRATION ---");
  
  // Try to sign in first to avoid rate limits
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInData?.user) {
    console.log("✅ Reusing existing test account");
    testUserId = signInData.user.id;
  } else {
    console.log("Test account not found. Attempting to create one...");
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: testName,
          student_id: testStudentId,
          academic_year: '2026',
          department: 'Test Dept'
        }
      }
    });
    
    assert(!authErr && authData?.user, "User Registration (handle_new_user trigger)", authErr?.message);
    if (authErr) {
      console.error("CRITICAL: Cannot proceed with tests without an authenticated user.");
      console.error("Please apply migration 009 to fix permission errors, or wait out the rate limit.");
      return;
    }
    testUserId = authData.user?.id;
    // Wait briefly for the DB trigger to finish inserting into public.users
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', testUserId)
    .single();

  if (profileErr) {
    console.error("❌ FAIL: Cannot fetch profile. Have you applied Migration 009? Error:", profileErr.message);
    return;
  }

  // Assert starting status (might be already Active if reused)
  if (profile?.status === 'Pending_Signature') {
    assert(profile?.role === 'Pending', "User starts with Pending role");
  } else {
    console.log("ℹ️ Test user is already active from a previous run.");
  }

  // --- 2. RLS VERIFICATION (Pre-signature) ---
  console.log("\n--- RLS PERMISSION CHECKS ---");
  if (profile?.status === 'Pending_Signature') {
    const { error: insertReqErr1 } = await supabase.from('requests').insert([{
      student_id: testUserId, title: 'Early Request', preferred_date: '2026-10-10', estimated_duration_mins: 60
    }]);
    assert(insertReqErr1, "Pending_Signature user is blocked from inserting requests (RLS)");
  }

  // --- 3. LIABILITY SIGNING ---
  console.log("\n--- LIABILITY SIGNATURE ---");
  if (profile?.status === 'Pending_Signature') {
    const { data: procs } = await supabase.from('procedure_versions').select('id').eq('active', true).limit(1);
    const procId = procs?.[0]?.id;
    
    if (!procId) {
      console.warn("⚠️ No active procedure version found. Skipping signature test.");
    } else {
      // Attempt good signature
      const { error: goodSigErr } = await supabase.rpc('sign_liability', {
        p_procedure_version_id: procId,
        p_signed_name: testName,
        p_signed_student_id: testStudentId,
        p_ip_address: '127.0.0.1'
      });
      assert(!goodSigErr, "sign_liability succeeds with correct data", goodSigErr?.message);
    }
  } else {
     console.log("✅ User already signed liability.");
  }

  // --- 4. REQUEST LIFECYCLE ---
  console.log("\n--- REQUEST LIFECYCLE ---");
  const { data: reqData, error: reqErr } = await supabase.from('requests').insert([{
    student_id: testUserId,
    title: 'Test Request',
    preferred_date: '2026-10-10',
    estimated_duration_mins: 60
  }]).select('id').single();
  
  assert(!reqErr && reqData, "Active user can create a request", reqErr?.message);
  testRequestId = reqData?.id;

  // --- 5. ADMIN/KEYHOLDER AUTHORIZATION CHECKS ---
  console.log("\n--- UNAUTHORIZED ROLE CHECKS ---");
  if (testRequestId) {
    // Ordinary user tries to claim request
    const { error: claimErr } = await supabase.rpc('claim_request', { p_request_id: testRequestId });
    assert(claimErr?.message.includes('Keyholders or Superadmins'), "Ordinary user blocked from claim_request");
    
    // Ordinary user tries to cancel request (Allowed for own pending requests)
    const { error: cancelErr } = await supabase.from('requests').update({ status: 'Cancelled' }).eq('id', testRequestId);
    assert(!cancelErr, "Ordinary user can cancel their own pending request", cancelErr?.message);
  }

  const { error: overrideErr } = await supabase.rpc('override_penalty', { p_keyholder_id: testUserId, p_reason: 'test' });
  assert(overrideErr?.message.includes('Superadmins'), "Ordinary user blocked from override_penalty");

  // --- 6. READ ISOLATION (AUDIT/HANDOFFS) ---
  console.log("\n--- STRICT IMMUTABILITY & READ ISOLATION CHECKS ---");
  const { data: auditData, error: auditErr } = await supabase.from('audit_log').select('*').limit(1);
  assert(auditData?.length === 0, "Ordinary user cannot read audit_log");

  const { data: handoffData, error: handoffErr } = await supabase.from('key_handoffs').select('*').limit(1);
  assert(handoffData?.length === 0, "Ordinary user cannot read key_handoffs");

  const { data: penaltyData, error: penaltyErr } = await supabase.from('penalty_events').select('*').limit(1);
  assert(penaltyData?.length === 0, "Ordinary user cannot read other penalty_events");

  // Attempt direct API delete on immutable table
  const { error: delAuditErr } = await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  assert(delAuditErr, "API explicitly prevents DELETE on audit_log");

  console.log("\n======================================");
  console.log(`TESTS COMPLETED: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("======================================");
}

runTests();
