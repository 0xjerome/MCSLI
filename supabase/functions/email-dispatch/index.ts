// Supabase Edge Function: email-dispatch
//
// Sends queued transactional e-mails (public.email_outbox) through Resend. Invoked every minute by
// pg_cron (private.kick_email_dispatch) while messages are queued, with the x-dispatch-secret header.
//
// Secrets (Supabase → Edge Functions → Secrets; never in the repository):
//   RESEND_API_KEY   – Resend API key with "sending access" (entered by MCSLI)
//   DISPATCH_SECRET  – shared secret matching the Vault secret mcsli_dispatch_secret
//   EMAIL_FROM       – optional, default "MCSLI <no-reply@mcsli.org>"
//   EMAIL_REPLY_TO   – optional, default "info@mcsli.org"
//   APP_SITE_URL     – links in the e-mails (e.g. https://mcsli.org)
// Without RESEND_API_KEY the function returns 503 and messages stay queued.
// Recipient addresses and payment details are never logged.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Outbox = { id: string; to_email: string; template: string; subject: string; payload: Record<string, string | number | null> };

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function render(m: Outbox, site: string): { html: string; text: string } {
  const p = m.payload;
  const what = `${p.purpose === 'registration' ? 'registration fee' : p.installment ? `tuition installment ${p.installment}` : 'tuition'} of ${p.currency} ${p.amount}`;
  const lines: string[] =
    m.template === 'payment_received'
      ? [`We have received your payment details for the ${what} (reference ${p.reference}).`, 'MCSLI staff will check the payment and confirm it. You will receive another e-mail when it is confirmed.', 'This is not a receipt: the payment is not confirmed yet.']
      : m.template === 'payment_confirmed'
        ? [`Your ${what} has been confirmed.`, `Receipt number: ${p.receipt_number}.`, 'You can see all your payments and receipts in your MCSLI account.']
        : [`We could not confirm your ${what} (reference ${p.reference}).`, p.note ? `Note from MCSLI: ${p.note}` : 'Please check the reference and amount, then submit the payment details again.', 'If you need help, reply to this e-mail or contact info@mcsli.org.'];
  const link = `${site}/app/payments`;
  const text = `${lines.join('\n\n')}\n\nView your payments: ${link}\n\nMaster Class Sign Language Initiative (MCSLI) · Kampala, Uganda`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.5">
<h2 style="color:#0f5132;font-size:20px">${esc(m.subject)}</h2>
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
<p><a href="${esc(link)}" style="display:inline-block;background:#0f5132;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">View my payments</a></p>
<p style="font-size:13px;color:#6b7280">Master Class Sign Language Initiative (MCSLI) · Kampala, Uganda</p>
</div>`;
  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const expected = Deno.env.get('DISPATCH_SECRET');
  if (!expected || req.headers.get('x-dispatch-secret') !== expected) return new Response('unauthorised', { status: 401 });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.warn(JSON.stringify({ fn: 'email-dispatch', event: 'not_configured' }));
    return new Response(JSON.stringify({ skipped: 'RESEND_API_KEY not configured' }), { status: 503 });
  }
  const from = Deno.env.get('EMAIL_FROM') ?? 'MCSLI <no-reply@mcsli.org>';
  const replyTo = Deno.env.get('EMAIL_REPLY_TO') ?? 'info@mcsli.org';
  const site = (Deno.env.get('APP_SITE_URL') ?? 'https://mcsli.org').replace(/\/$/, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: batch, error } = await admin.rpc('claim_email_batch', { p_limit: 20 });
  if (error) {
    console.error(JSON.stringify({ fn: 'email-dispatch', event: 'claim_failed', code: error.code }));
    return new Response('claim failed', { status: 500 });
  }
  let sent = 0;
  let failed = 0;
  for (const m of (batch ?? []) as Outbox[]) {
    const { html, text } = render(m, site);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': m.id },
        body: JSON.stringify({ from, to: [m.to_email], reply_to: replyTo, subject: m.subject, html, text, tags: [{ name: 'template', value: m.template }] }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        sent++;
        await admin.rpc('complete_email', { p_id: m.id, p_ok: true, p_provider_id: body.id ?? null });
      } else {
        failed++;
        await admin.rpc('complete_email', { p_id: m.id, p_ok: false, p_error: `resend ${res.status}: ${String(body.name ?? body.message ?? '').slice(0, 120)}` });
      }
    } catch (e) {
      failed++;
      await admin.rpc('complete_email', { p_id: m.id, p_ok: false, p_error: `network: ${(e as Error).message.slice(0, 120)}` });
    }
  }
  console.info(JSON.stringify({ fn: 'email-dispatch', event: 'batch', sent, failed }));
  return new Response(JSON.stringify({ sent, failed }), { headers: { 'Content-Type': 'application/json' } });
});
