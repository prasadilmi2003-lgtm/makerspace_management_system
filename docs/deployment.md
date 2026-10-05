# Supabase Deployment & Configuration

This document outlines the required configuration for the Makerspace backend beyond the SQL schema.

## 1. Edge Functions

We use Supabase Edge Functions to process the `notification_queue` reliably without exposing email API keys to the frontend.

### Deploying the `process-notifications` Function

1. Ensure you have the Supabase CLI installed.
2. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
3. Set Secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=your_resend_api_key
   supabase secrets set WEBHOOK_SECRET=your_custom_secret_string
   ```
4. Deploy the function:
   ```bash
   supabase functions deploy process-notifications
   ```

## 2. Database Webhooks

To wire the `notification_queue` table to the Edge Function:

1. Go to **Database > Webhooks** in the Supabase Dashboard.
2. Create a new webhook:
   - **Name:** `Process Notifications`
   - **Table:** `notification_queue`
   - **Events:** `Insert`
   - **Type:** HTTP Request
   - **URL:** `https://your-project-ref.supabase.co/functions/v1/process-notifications`
   - **Method:** `POST`
3. Add HTTP Headers:
   - `Content-type`: `application/json`
   - `x-webhook-secret`: (The value you used for WEBHOOK_SECRET above)

## 3. Email Provider

This system is scaffolded for **Resend** (api.resend.com), but you can swap out the fetch call in the Edge Function for SendGrid, AWS SES, or any SMTP service. 

- Update the "From" address in `supabase/functions/process-notifications/index.ts` to an authorized domain for your provider.

## 4. Auth Rate Limiting (Important for Testing)

Supabase limits email signups to **3 per hour** by default.
- For production, keep this enabled to prevent abuse.
- For local/testing phases, you can configure a custom SMTP provider in the Supabase Dashboard (`Authentication > Settings > SMTP`) to lift this restriction, or configure the rate limits in `Authentication > Rate Limits`.
