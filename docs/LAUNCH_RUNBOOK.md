# MCSLI launch runbook

Everything the codebase and the hosted backend can do is done and tested. The steps below need
MCSLI's own accounts, money or DNS, so they must be done by an MCSLI owner. Follow them **in order**;
each says exactly where to click and how to check it worked.

State on 2026-09-25: Supabase project `midvngbooepderxboqru` (Free plan) fully migrated; Vercel
project `mcsli/mcsli` (Hobby) auto-deploys `main` to https://mcsli.vercel.app; `mcsli.org` still
serves the **old** website from an Apache server at 169.58.183.41; Resend team *mcsli* has the
domain `mcsli.org` added but not verified.

---

## 1. Vercel environment variables (unblocks the live app)

Vercel → project **mcsli** → Settings → Environment Variables → add for **Production** (and Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://midvngbooepderxboqru.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → the **anon / publishable** key (public by design; never the `service_role`/secret key) |
| `VITE_SITE_URL` | `https://mcsli.org` |
| `VITE_MAX_UPLOAD_MB` | `50` on Free; the new Storage limit after step 8 |
| `VITE_TURNSTILE_SITE_KEY` | only after step 9 |

Then Deployments → latest → ⋯ → **Redeploy**. Check: https://mcsli.vercel.app/login shows the login
form (not "The learning platform is not connected yet").

## 2. DNS at Contabo (my.contabo.com → DNS Zone Management → mcsli.org)

The live site keeps serving the old website until these are done.

| Action | Type | Name | Value |
|---|---|---|---|
| **delete** (stale, breaks ~50 % of visits) | A | `mcsli.org` | `169.58.183.41` |
| keep | A | `mcsli.org` | `216.198.79.1` (Vercel) |
| replace the A/wildcard answer for www with | CNAME | `www` | `75115f14f8e9067b.vercel-dns-017.com.` |
| add (Resend DKIM) | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDoS814eza0s7AosWjg7r78fAfbMakktIqxme8BdO6ra+0QmtpX3mHoFQSn449LVQzBV+dly5DliVIkFYnpEKymoBEtDeELB7PSr9ut8SbneHEpwmzfRf/ThkdgX53MDjZvI4xU7MG4XEI2Bst3zbn/s3Jf/ZOBplB4OCopBlE/pwIDAQAB` |
| add (Resend sending) | CNAME | `rsend` | `rsend-euw1.forge.rmta.net` |
| add (Resend sending) | CNAME | `send` | `send.forge.rmta.net` |
| add (DMARC, monitoring) | TXT | `_dmarc` | `v=DMARC1; p=none;` |

Do **not** remove `MX 10 mail.mcsli.org` or the address `mail.mcsli.org` → 169.58.183.41 (MCSLI's
mailboxes). If the zone uses a wildcard `*` A record, give `mail` an explicit A record before changing
the wildcard.

Check (after propagation): Vercel → Domains shows **Valid Configuration** for `www.mcsli.org`;
`https://mcsli.org/login` loads the new app; Resend → Domains → mcsli.org → **Verify DNS Records** →
*Verified*.

## 3. Resend: tracking off, then connect Supabase

1. Resend → Domains → mcsli.org → Configuration: **Click tracking OFF, Open tracking OFF** (auth links
   must not be rewritten).
2. Resend → Settings → Integrations → **Supabase → Connect to Supabase** → authorise → project
   `admin@mcsli.org's Project` → sender `no-reply@mcsli.org`, name `MCSLI`. (This OAuth grant creates a
   sending-only key and fills in Supabase SMTP; nothing is copied by hand.)
3. Resend → API Keys → **Create API key** `mcsli-transactional`, permission *Sending access*, domain
   `mcsli.org` → Supabase → Edge Functions → **Secrets** → add `RESEND_API_KEY` with that value
   (payment e-mails; they are already queueing).
4. Ask the developer to run: uncomment the four `[auth.email.template.*]` blocks in
   `supabase/config.toml`, `npx supabase config push`, and set Auth rate limit *e-mails per hour* to 100.

Check: Supabase → Authentication → Emails → SMTP shows `smtp.resend.com`; register a test account
with an inbox you control and the "Confirm your MCSLI account" e-mail arrives from
`no-reply@mcsli.org`; Resend → Logs shows it *Delivered*.

## 4. First super administrator – admin@mcsli.org

Needs step 1 (a working app URL). Before DNS is switched, use the Vercel URL:

```bash
node scripts/invite-first-super-admin.mjs --site https://mcsli.vercel.app   # or https://mcsli.org after step 2
```

1. The owner of admin@mcsli.org opens the e-mail *You have been invited* → lands on
   `/accept-invite` → **chooses their own password** (nobody else ever sees it).
2. Then: `npx supabase db query --linked "select public.bootstrap_super_admin('admin@mcsli.org')"`
   (refused if the address is unconfirmed or a super admin exists; audited).
3. Sign in → Profile → **Two-factor authentication → Start set-up** → scan the QR code with an
   authenticator app on your own phone → enter the code.
4. Admin → Settings → **Require two-factor authentication for staff → on** (only possible from a
   session that has passed MFA).

Check: Admin → Audit log shows `profile.super_admin_bootstrapped` and
`platform_setting.updated (require_staff_mfa)`.

## 5. Invite real staff

Admin → **Staff → Invite staff** (name, e-mail, role). Administrators: only the super admin can
invite them. Trainers: then Admin → Trainers → *Assign trainer* to course/cohort. Invitations
expire after 7 days; *Cancel* stops a link immediately.

## 6. Payment details

Admin → Settings → Payment methods: enter the real MCSLI bank account, MTN MoMo Pay and Airtel Pay
merchant codes and registered merchant names; tick *Enabled* only when complete (the database
refuses otherwise). Every change is in the audit log.

## 7. Curriculum and USL videos

Admin → Courses → New course (draft) → months → modules → lessons (upload video, WebVTT captions,
transcript, duration, thumbnail) → practice signs → quizzes → final examination → publish when the
checklist on *Settings & fees* is empty.

**USL video guidance**

* Encode as MP4 (H.264 + AAC), 720p, ~1–1.5 Mbit/s, 2–10 minutes per lesson (≈ 20–110 MB). Students
  on mobile data in Uganda benefit from short lessons; the player never autoplays, loads only metadata
  until play is pressed, and shows the thumbnail as poster.
* Free plan: 50 MB per upload. After Pro (step 8) raise Supabase → Storage → Settings → *Upload file
  size limit* (e.g. 500 MB) and `VITE_MAX_UPLOAD_MB`.
* Videos are served from the private `course-media` bucket through 1-hour signed URLs only to students
  whose month is unlocked. Supabase egress counts against the plan (Pro: 250 GB/month included;
  ~3,000 hours of 720p viewing). If viewing grows beyond that, or adaptive streaming (HLS) is needed for
  weak connections, move lesson videos to a streaming service (Cloudflare Stream or Mux) and store the
  playback URL in the lesson's *video* field – the data model already accepts external URLs.

## 8. Supabase Pro + account security

1. Supabase → Organization *MasterCLass* → Billing → **Change subscription plan → Pro** (adds daily
   backups kept 7 days, no inactivity pausing, larger quotas). Keep the spend cap on at first.
2. Next day: Database → Backups → confirm a scheduled backup is listed; note the date here.
3. Account (avatar) → **Security → enable MFA** for admin@mcsli.org's Supabase login (currently
   *Disabled*); Organization → Team → invite a **second trusted owner** (currently 1 member).
4. Storage files are not in database backups: run `node scripts/backup-storage.mjs` weekly on an
   encrypted machine (it is incremental) and keep the Vault identity key escrowed (SUPABASE_SETUP §9).

## 9. CAPTCHA (bot protection)

Cloudflare → Turnstile → Add widget (`mcsli.org`, `www.mcsli.org`, `mcsli.vercel.app`, mode
*Managed*) → put the **site key** in Vercel `VITE_TURNSTILE_SITE_KEY` → redeploy → **then**
Supabase → Authentication → Attack Protection → CAPTCHA → Turnstile + the **secret key**. (Doing it
in the other order would block sign-ups until the frontend sends tokens.)

## 10. Final acceptance

Run the hosted end-to-end test and a real e-mail test (an inbox you control), then remove test
records:

```bash
SUPABASE_URL=https://midvngbooepderxboqru.supabase.co E2E_ALLOW_REMOTE=1 E2E_SITE_URL=https://mcsli.org \
  node scripts/e2e-supabase.mjs            # keys: see SUPABASE_SETUP §17
```

---

## E-mail health (for staff)

* **Resend → Logs**: every message with status *Delivered / Bounced / Complained / Suppressed*.
  **Metrics**: delivery and bounce rates (keep bounces < 2 %, complaints < 0.1 %).
* **Resend → Domains**: mcsli.org must stay *Verified* (DKIM/SPF). A DNS change can break it.
* **Supabase → Logs → Auth**: SMTP errors when confirmation/reset/invite e-mails fail.
* **Payment e-mails**: `select status, count(*) from email_outbox group by 1;` – `queued` growing
  means the dispatcher or Resend key is not working; `failed` rows carry a short, credential-free reason.
* Credentials never appear in these views; API keys live only in Resend and Supabase secrets.
