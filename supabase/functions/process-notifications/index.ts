import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
  // 1. FAIL-CLOSED WEBHOOK AUTHENTICATION
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!webhookSecret || req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 2. FIX REQUEST BODY HANDLING
  let payload: any = null;

  try {
    payload = await req.json();

    if (payload.type === 'INSERT' && payload.table === 'notification_queue') {
      const { id, recipient_email, subject, body } = payload.record;

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
        // We throw an Error to trigger the catch block. 
        // We don't include the raw text in the error message to avoid logging it later.
        throw new Error(`Email provider returned status: ${res.status}`);
      }

      // 3. REMOVE NON-EXISTENT processed_at COLUMN
      await supabase
        .from('notification_queue')
        .update({ status: 'sent' })
        .eq('id', id);

      return new Response(JSON.stringify({ message: 'Notification processed.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Ignored', { status: 200 });
  } catch (err: any) {
    // 5. SANITIZE ERROR LOGGING
    console.error('Notification processing failed', {
      errorType: err.name,
      message: err.message
    });
    
    // 4. REMOVE NON-EXISTENT error_log COLUMN
    try {
      if (payload?.record?.id) {
         await supabase
          .from('notification_queue')
          .update({ status: 'failed' })
          .eq('id', payload.record.id);
      }
    } catch(e) {
      // Ignore fallback errors
    }

    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
});
