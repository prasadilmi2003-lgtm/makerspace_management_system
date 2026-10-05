# Frontend Integration Contract

This document outlines how the frontend should communicate with the Supabase Backend for the Makerspace Management System.

## General Rules
1. Do not update sensitive states (like `status`, `role`, or `penalty_box` on the user, or `status` on a request) via direct `supabase.from('table').update()`. 
2. Use the provided RPCs for any operational state changes.
3. Handle standard Supabase errors gracefully.

## Available Tables (Read Access)
- `users`: Can view profiles (role, name, etc.).
- `procedure_versions`: Can view active procedures.
- `requests`: Users can view their own. Keyholders/Admins view all.
- `inventory_items`: Public view of available stock.
- `floor_allocations`: View current bookings.
- `projects`: Public view.

## Core RPCs (Functions)

### 1. Onboarding
```javascript
// Sign Liability Agreement
await supabase.rpc('sign_liability', {
  p_procedure_version_id: 'uuid',
  p_signed_name: 'Exact Full Name',
  p_signed_student_id: 'EG/2026/1234',
  p_ip_address: '0.0.0.0'
});
```

### 2. Request Lifecycle
```javascript
// Create a new request (Standard Insert - No RPC needed)
await supabase.from('requests').insert([{
  student_id: user.id,
  title: 'Project XYZ',
  preferred_date: '2026-10-10',
  estimated_duration_mins: 120
}]);

// Cancel a request (Only if Pending)
await supabase.rpc('cancel_request', {
  p_request_id: 'uuid',
  p_reason: 'Optional reason'
});
```

### 3. Keyholder Operations
```javascript
// Claim a Request (Status: Pending -> Claimed)
await supabase.rpc('claim_request', {
  p_request_id: 'uuid'
});

// Retrieve Key (Status: Claimed -> Active)
await supabase.rpc('retrieve_key', {
  p_request_id: 'uuid',
  p_officer_name: 'Sgt. Perera'
});

// Return Key (Status: Active/Overdue -> Completed)
await supabase.rpc('return_key', {
  p_request_id: 'uuid',
  p_officer_name: 'Sgt. Perera'
});
```

### 4. Inventory
```javascript
// Checkout Items
await supabase.rpc('checkout_inventory', {
  p_item_id: 'uuid',
  p_request_id: 'uuid', // The active request ID
  p_quantity: 1
});

// Return Items
await supabase.rpc('return_inventory', {
  p_item_id: 'uuid',
  p_request_id: 'uuid',
  p_quantity: 1
});

// Flag Issue
await supabase.rpc('report_inventory_issue', {
  p_item_id: 'uuid',
  p_condition: 'Damaged' // or 'Missing', 'Needs Maintenance'
});
```

### 5. Floor Allocations
```javascript
await supabase.rpc('allocate_floor', {
  p_request_id: 'uuid',
  p_zone: 'Zone A',
  p_bench: 'Bench 1',
  p_start_time: '2026-10-10T10:00:00Z',
  p_end_time: '2026-10-10T12:00:00Z'
});
```

### 6. Administration (Superadmin Only)
```javascript
// Publish New Procedure
await supabase.rpc('publish_procedure_version', {
  p_version_string: 'v2.0',
  p_document_url: 'storage/path.pdf',
  p_content: 'Markdown text'
});

// Override Penalty Box
await supabase.rpc('override_penalty', {
  p_keyholder_id: 'uuid',
  p_reason: 'Valid manual override reason'
});

// Bulk Role Reset
await supabase.rpc('bulk_role_reset', {
  p_user_ids: ['uuid1', 'uuid2'],
  p_new_role: 'User'
});
```

## Realtime Channels
Enable standard Supabase realtime listeners for the dashboard:
```javascript
supabase.channel('dashboard_updates')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, payload => {
    console.log('Request updated!', payload);
  })
  .subscribe();
```


### 7. Projects Repository
```javascript
// Create a new project documentation entry
await supabase.from('projects').insert([{
  owner_id: user.id,
  title: 'My Project',
  description: 'Project details',
  materials_used: ['Wood', 'Acrylic'],
  image_urls: ['storage/url1.png']
}]);

// Update a project (Owner or Superadmin)
await supabase.from('projects').update({
  description: 'Updated details'
}).eq('id', 'uuid');
```

## Error Handling
The backend uses standard PostgreSQL exceptions and RLS blocks. 
- **42501 Permission Denied**: The user lacks role permissions (RLS blocked them). Ensure they have signed the liability agreement and have the correct role.
- **P0001 Raise Exception**: A business logic rule was violated (e.g., trying to return a key for a request that isn't Active). Display `error.message` directly to the user.

## Notifications
The backend automatically queues email notifications via the `notification_queue` table (e.g., when a request is created).
- Frontend does not need to send emails manually.
- Frontend does not need to poll the queue.
- Ensure the Supabase Edge Function `process-notifications` is deployed to handle the actual delivery.
