# Realtime Subscriptions Guide

The Makerspace Management System uses Supabase Realtime to broadcast database changes to connected clients instantly. This removes the need for frontend polling and ensures Keyholders and Users see immediate updates when requests are claimed, keys are retrieved, or inventory is depleted.

## 1. Enabled Publications
Migration `008_realtime_notifications.sql` explicitly enabled realtime broadcasts for the following tables:
- `requests`
- `inventory_items`
- `floor_allocations`
- `penalty_events`

*Note: Tables like `users` or `audit_log` are intentionally excluded from realtime broadcasts to minimize data exposure and network noise.*

## 2. Frontend Integration

To subscribe to realtime events, use the Supabase JS client in your React components.

### 2.1 Subscribing to Request Lifecycle Updates
Useful for the `Dashboard` and `Keyholder Queue`.

```javascript
const requestSubscription = supabase.channel('public:requests')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'requests' }, 
    (payload) => {
      console.log('Request changed:', payload);
      // Depending on payload.eventType ('INSERT', 'UPDATE', 'DELETE')
      // Update local React state (e.g., move request from Pending to Claimed)
    }
  )
  .subscribe();
```
**Auth Requirement:** None to establish the channel, but RLS governs what actual rows the user can see if they execute a subsequent `select()` based on the trigger. Payload bodies generally mirror RLS policies if configured securely, though often the frontend re-fetches the specific row upon receiving a broadcast to ensure security boundaries are respected.

### 2.2 Subscribing to Inventory Depletion
Useful for the `Inventory Catalog` view.

```javascript
const inventorySubscription = supabase.channel('public:inventory_items')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'inventory_items' }, 
    (payload) => {
      // payload.new contains the updated available_quantity
      updateItemStockInState(payload.new.id, payload.new.available_quantity);
    }
  )
  .subscribe();
```

### 2.3 Cleanup
Always remember to unsubscribe when the React component unmounts:
```javascript
useEffect(() => {
  const channel = supabase.channel('...').on(...).subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## 3. Best Practices
1. **Listen Globally, Fetch Locally:** Use the realtime payload to know *when* something changed, but if the data is highly sensitive, use the payload ID to run a fresh `supabase.from().select()` to ensure RLS is correctly evaluated for the current user.
2. **Handle Reconnection:** Supabase client handles auto-reconnection natively, but ensure your UI handles loading states properly if the connection drops.
