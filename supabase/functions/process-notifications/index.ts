import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
  // Verify Webhook Secret to ensure the request came from our database webhook
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (webhookSecret && req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await req.json();

    // The webhook sends the new/updated record in payload.record
    if (payload.type === 'INSERT' && payload.table === 'notification_queue') {
      const { id, recipient_email, subject, body } = payload.record;

      // 1. Send Email via External Provider (e.g., Resend)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Makerspace <no-reply@ruhuna-makerspace.ac.lk>',
          to: [recipient_email],
          subject: subject,
          text: body
        })
      });

      if (!res.ok) {
        throw new Error(`Email provider error: ${await res.text()}`);
      }

      // 2. Mark as sent
      await supabase
        .from('notification_queue')
        .update({ status: 'sent', processed_at: new Date().toISOString() })
        .eq('id', id);

      return new Response(JSON.stringify({ message: 'Notification processed.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Ignored', { status: 200 });
  } catch (err: any) {
    console.error('Error processing notification:', err);
    
    // If we have an ID from the payload but failed to send, mark as failed for potential retry
    // In a real robust system, you might implement an exponential backoff retry cron instead.
    try {
      const payload = await req.clone().json();
      if (payload?.record?.id) {
         await supabase
          .from('notification_queue')
          .update({ status: 'failed', error_log: err.message })
          .eq('id', payload.record.id);
      }
    } catch(e) {
      // Ignore fallback errors
    }

    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
