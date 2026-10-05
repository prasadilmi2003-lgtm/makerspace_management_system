# Frontend API & RPC Integration Contract

This document provides the definitive guide for the frontend team (`raven` branch) to interact with the Supabase backend.

## 1. Authentication & User Profile
**Library:** `@supabase/supabase-js`

### Register
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'student@ruhuna.ac.lk',
  password: 'SecurePassword123!',
  options: {
    data: { full_name: 'John Doe', student_id: 'EG/2026/1234' }
  }
});
```
*Note: A database trigger automatically creates the `public.users` profile.*

### Login
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'student@ruhuna.ac.lk',
  password: 'SecurePassword123!'
});
```

### Current User Profile (Role & Status)
```javascript
// Fetch the currently authenticated user's profile
const { data: profile } = await supabase
  .from('users')
  .select('id, full_name, student_id, role, status, penalty_box')
  .eq('id', (await supabase.auth.getUser()).data.user.id)
  .single();
```

---

## 2. Liability Agreement
Users with `status = 'Pending_Signature'` cannot create requests.

### Get Active Procedure
```javascript
const { data: procs } = await supabase
  .from('procedure_versions')
  .select('*')
  .eq('active', true)
  .limit(1);
```

### Sign Liability
```javascript
await supabase.rpc('sign_liability', {
  p_procedure_version_id: procs[0].id,
  p_signed_name: 'John Doe',
  p_signed_student_id: 'EG/2026/1234',
  p_ip_address: '127.0.0.1' // Can be omitted or filled by frontend
});
```
- **Role:** `Authenticated` (Any)
- **Effect:** Changes user `status` to `Active`.

---

## 3. Request Lifecycle

### Create Request
```javascript
await supabase.from('requests').insert([{
  student_id: user.id,
  title: 'Robotics Project',
  preferred_date: '2026-10-10',
  estimated_duration_mins: 120
}]);
```
- **Role:** `Authenticated` (Must have `status = 'Active'`, not in penalty box)

### Claim Request
```javascript
await supabase.rpc('claim_request', { p_request_id: 'uuid' });
```
- **Role:** `Keyholder` or `Superadmin`
- **Effect:** Status `Pending` -> `Claimed`. Sets `claimed_by`.

### Cancel Request
```javascript
await supabase.rpc('cancel_request', { p_request_id: 'uuid', p_reason: 'Optional' });
```
- **Role:** `Owner`, `Keyholder`, or `Superadmin`
- **Effect:** Sets status to `Cancelled`.

### Retrieve Key
```javascript
await supabase.rpc('retrieve_key', { p_request_id: 'uuid', p_officer_name: 'Sgt. Silva' });
```
- **Role:** `Keyholder` or `Superadmin`
- **Effect:** Status `Claimed` -> `Active`. Logs handoff.

### Return Key
```javascript
await supabase.rpc('return_key', { p_request_id: 'uuid', p_officer_name: 'Sgt. Silva' });
```
- **Role:** `Keyholder` or `Superadmin`
- **Effect:** Status `Active`/`Overdue` -> `Completed`. Calculates penalties if late.

### Check Overdue Requests (Cron/Manual)
```javascript
await supabase.rpc('check_overdue_requests');
```
- **Role:** `Superadmin` (or triggered by cron)

---

## 4. Penalty Box
If `penalty_box = true`, the user is barred from creating requests.

### Penalty Status
Check `user.penalty_box`. To see why, query:
```javascript
const { data: penalties } = await supabase
  .from('penalty_events')
  .select('*')
  .eq('student_id', user.id);
```

### Override Penalty
```javascript
await supabase.rpc('override_penalty', { p_keyholder_id: 'uuid', p_reason: 'Forgiven' });
```
- **Role:** `Superadmin`

---

## 5. Inventory Operations

### Checkout
```javascript
await supabase.rpc('checkout_inventory', { p_item_id: 'uuid', p_request_id: 'req_uuid', p_quantity: 1 });
```
- **Role:** `Keyholder` or `Superadmin`

### Return
```javascript
await supabase.rpc('return_inventory', { p_item_id: 'uuid', p_request_id: 'req_uuid', p_quantity: 1 });
```
- **Role:** `Keyholder` or `Superadmin`

### Report Issue
```javascript
await supabase.rpc('report_inventory_issue', { p_item_id: 'uuid', p_condition: 'Damaged' });
```
- **Role:** `Keyholder` or `Superadmin`

---

## 6. Floor Allocation
```javascript
await supabase.rpc('allocate_floor', {
  p_request_id: 'uuid',
  p_zone: 'Zone A',
  p_bench: 'Bench 1',
  p_start_time: '2026-10-10T10:00:00Z',
  p_end_time: '2026-10-10T12:00:00Z'
});
```
- **Role:** `Keyholder` or `Superadmin`

---

## 7. Projects Repository

### Create Project
```javascript
await supabase.from('projects').insert([{
  owner_id: user.id,
  title: 'My Project',
  description: 'Details',
  materials_used: ['Wood'],
  image_urls: ['url1.png']
}]);
```
- **Role:** `Authenticated`

### Update Project
```javascript
await supabase.from('projects').update({ description: 'New' }).eq('id', 'uuid');
```
- **Role:** Owner or `Superadmin`.

---

## 8. Administration

### Publish Procedure
```javascript
await supabase.rpc('publish_procedure_version', { p_version_string: 'v2.0', p_document_url: 'url', p_content: 'text' });
```
- **Role:** `Superadmin`

### Bulk Role Reset
```javascript
await supabase.rpc('bulk_role_reset', { p_user_ids: ['uuid1'], p_new_role: 'User' });
```
- **Role:** `Superadmin`

---

## 9. Error Handling Guide

When making requests, you may encounter the following error classes:

### 42501 - Permission Denied (RLS Rejection)
- **Cause:** The user attempted to read/write a table they don't have access to. 
- **Frontend Action:** Check if the user is authenticated. If they are, check if their `status` is `Pending_Signature` or if they are in the `penalty_box`. Ensure they have the correct `role` for the view. Show: *"You do not have permission to view or modify this resource."*

### P0001 - Raise Exception (Business Logic Violation)
- **Cause:** An RPC function actively rejected the operation (e.g., "Insufficient inventory available").
- **Frontend Action:** The `error.message` returned by the RPC is safe for users. Display it directly in a toast or alert (e.g., *"Cannot claim a request that is not pending"*).

### 42P01 - Undefined Table (Environment / Cache)
- **Cause:** The PostgREST API cache is stale.
- **Frontend Action:** This is a backend deployment issue. Show: *"Service temporarily unavailable (Schema Sync). Please try again shortly."*

### Auth Rate Limiting (429)
- **Cause:** Too many `signUp` attempts from the same IP.
- **Frontend Action:** Show: *"Too many registration attempts. Please wait an hour or contact the administrator."*

Never expose raw JSON or Postgres error stacks (like `line 42 at PL/pgSQL`) to the end-user.
