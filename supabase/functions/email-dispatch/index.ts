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

/** Cohort e-mails never contain application answers – only the reference, cohort name and next steps. */
function renderCohort(m: Outbox, site: string): { lines: string[]; link: string; cta: string } | null {
  const p = m.payload;
  const who = p.full_name ? `Dear ${p.full_name},` : 'Hello,';
  const ref = `Your application reference is ${p.reference}. Keep it for any correspondence.`;
  switch (m.template) {
    case 'cohort_application_received':
      return {
        lines: [who, `We have received your application for MCSLI ${p.cohort_name}.`, ref,
          p.verify_token ? 'Please confirm your e-mail address with the button below so we can reach you about your application.' : 'Your e-mail address is confirmed.',
          p.auto_accepted ? 'Your place is confirmed – a separate e-mail explains the next steps.' : 'MCSLI staff review every application and will e-mail you the outcome. You can also create an MCSLI account with this e-mail address to follow your application online.',
          'Questions? Reply to this e-mail or write to info@mcsli.org.'],
        link: p.verify_token ? `${site}/cohorts/verify?token=${encodeURIComponent(String(p.verify_token))}` : `${site}/cohorts`,
        cta: p.verify_token ? 'Confirm my e-mail address' : 'View cohort details',
      };
    case 'cohort_application_accepted':
      return {
        lines: [who, `Good news – you have been accepted into MCSLI ${p.cohort_name}.`, ref, p.note ? `Note from MCSLI: ${p.note}` : '',
          'Next steps: create your MCSLI account (or sign in) with this e-mail address, enroll in the course and submit your registration fee and first tuition payment. Your place is confirmed once MCSLI confirms the payment.'].filter(Boolean),
        link: `${site}/register`,
        cta: 'Create my MCSLI account',
      };
    case 'cohort_application_waitlisted':
      return {
        lines: [who, `Thank you for applying to MCSLI ${p.cohort_name}. The cohort is currently full, so your application is on the waiting list.`, ref, p.note ? `Note from MCSLI: ${p.note}` : '', 'We will e-mail you as soon as a place becomes available. No payment is needed now.'].filter(Boolean),
        link: `${site}/cohorts`,
        cta: 'View MCSLI cohorts',
      };
    case 'cohort_application_rejected':
      return {
        lines: [who, `Thank you for your interest in MCSLI ${p.cohort_name}. Unfortunately we cannot offer you a place in this cohort.`, ref, p.note ? `Note from MCSLI: ${p.note}` : '', 'You are welcome to apply for a future cohort – new intakes are announced on mcsli.org.'].filter(Boolean),
        link: `${site}/cohorts`,
        cta: 'See upcoming cohorts',
      };
    case 'cohort_enrollment_ready':
      return {
        lines: [who, `Your enrollment for MCSLI ${p.cohort_name} is ready.`, ref, 'Sign in to your MCSLI account to submit your registration fee and first tuition payment. Your months unlock once MCSLI confirms the payment.'],
        link: `${site}/app/payments`,
        cta: 'Go to my payments',
      };
    case 'cohort_starting_soon':
      return {
        lines: [who, `MCSLI ${p.cohort_name} is starting soon${p.start_date ? ` (${p.start_date})` : ''}.`,
          p.physical_location ? `Physical classes: ${p.physical_location}.` : '', p.schedule_notes ? `Schedule: ${p.schedule_notes}` : '', p.message ? `Message from MCSLI: ${p.message}` : '',
          'Make sure your payment is confirmed and sign in to see your cohort announcements.'].filter(Boolean),
        link: `${site}/app`,
        cta: 'Open my dashboard',
      };
    default:
      return null;
  }
}

function render(m: Outbox, site: string): { html: string; text: string } {
  const p = m.payload;
  const cohort = renderCohort(m, site);
  const what = `${p.purpose === 'registration' ? 'registration fee' : p.installment ? `tuition installment ${p.installment}` : 'tuition'} of ${p.currency} ${p.amount}`;
  const lines: string[] = cohort
    ? cohort.lines
    : m.template === 'payment_received'
      ? [`We have received your payment details for the ${what} (reference ${p.reference}).`, 'MCSLI staff will check the payment and confirm it. You will receive another e-mail when it is confirmed.', 'This is not a receipt: the payment is not confirmed yet.']
      : m.template === 'payment_confirmed'
        ? [`Your ${what} has been confirmed.`, `Receipt number: ${p.receipt_number}.`, 'You can see all your payments and receipts in your MCSLI account.']
        : [`We could not confirm your ${what} (reference ${p.reference}).`, p.note ? `Note from MCSLI: ${p.note}` : 'Please check the reference and amount, then submit the payment details again.', 'If you need help, reply to this e-mail or contact info@mcsli.org.'];
  const link = cohort ? cohort.link : `${site}/app/payments`;
  const cta = cohort ? cohort.cta : 'View my payments';
  const text = `${lines.join('\n\n')}\n\n${cta}: ${link}\n\nMaster Class Sign Language Initiative (MCSLI) · Kampala, Uganda`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.5">
<h2 style="color:#0f5132;font-size:20px">${esc(m.subject)}</h2>
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
<p><a href="${esc(link)}" style="display:inline-block;background:#0f5132;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">${esc(cta)}</a></p>
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
