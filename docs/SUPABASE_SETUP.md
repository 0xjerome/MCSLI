# Supabase setup – MCSLI learning platform

How this repository's backend is configured, deployed and verified. Everything here refers to
files in this repo; nothing is generic boilerplate.

**Current status (2026-09-25, final readiness phase)** – launch steps that need MCSLI are in
[LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md).

| Item | Status |
|---|---|
| Hosted project | Connected: ref `midvngbooepderxboqru`, eu-west-1 (Ireland), Postgres 17.6, organisation *MasterCLass* (1 member: admin@mcsli.org, Owner). **Free plan** – no backups (verified). |
| Migrations `0001`–`0015` | Applied with `supabase db push`; local and hosted schemas identical (types regenerated from production). |
| Edge Functions | `identity-document-url`, `invite-staff`, `email-dispatch` deployed. |
| Auth | Site URL `https://mcsli.org`; 12 redirect URLs (`/login`, `/reset-password`, `/accept-invite` on `mcsli.org`, `www.`, `learn.` and `mcsli.vercel.app`); 8-char passwords; e-mail confirmation; TOTP MFA; DB SSL enforced. **Production e-mail (Resend SMTP) not yet connected** (§6). |
| Tests | 63 database tests; E2E 45/45 locally (real e-mails incl. invitations) and 45/45 on the hosted project. Security advisor: only intentional items + *leaked password protection* (Pro-plan feature – enable after the upgrade: Authentication → Attack Protection). |
| Production data | No legitimate data yet. Test courses, enrollments, files, tickets and payment methods from the E2E runs were deleted; 5 banned + suspended `[TEST]` accounts and their audit rows remain (audit log is immutable). |

## 1. What is in `supabase/`

```
supabase/
  config.toml                       CLI config: auth (e-mail confirmation, 8-char passwords, redirect
                                    URLs, templates), storage, functions, production override block
  migrations/0001 … 0015            ordered schema history (below)
  functions/identity-document-url   audited short-lived URLs for identity scans
  functions/invite-staff            staff invitation e-mails (ADMIN/TRAINER)
  functions/email-dispatch          sends queued transactional e-mails through Resend
  templates/confirmation.html       "Confirm your MCSLI account" e-mail
  templates/recovery.html           "Reset your MCSLI password" e-mail
  seed/dev_seed.sql                 [DEMO] course – LOCAL ONLY (loaded by `supabase db reset`)
```

| Migration | Contents |
|---|---|
| `0001_types` | pgcrypto, 19 enums |
| `0002_tables` | 36 tables, indexes, FKs, checks, RLS enabled on every table, `updated_at` triggers |
| `0003_helpers` | role helpers, audit/notify helpers, profile-on-signup trigger, role-escalation guard, views |
| `0004_business` | progression (`fn_month_access`), enrollment + price snapshot, payments, lessons, quizzes, assessments, overrides, exams, certificates, identity, moderation, support, dashboards |
| `0005_policies` | RLS policies, column grants (answers/scores hidden), student-safe views |
| `0006_storage` | 6 private buckets + object policies |
| `0007_defaults` | 3 **disabled, empty** payment methods; platform settings |
| `0008_security_hardening` | RLS audit fixes (see §7) |
| `0009_identity_encryption` | NIN/passport numbers encrypted with a Vault key (see §9) |
| `0010_public_endpoints` | rate limits on certificate verification + contact form; verified-only public impact stats |
| `0011_enforce_registration_open` | the Admin → Settings "Registration open" switch now blocks new enrollments server-side |
| `0012_advisor_fixes` | Supabase advisor follow-ups: pinned search_path on 6 helpers, no EXECUTE on trigger functions, documented intentional SECURITY DEFINER views |
| `0013_staff_invitations_and_launch_safety` | staff invitations; optional staff MFA enforcement (`require_staff_mfa`); super-admin-only critical settings; bootstrap requires confirmed e-mail; payment methods need details before enabling; publish validation; delete protection for content with student history; lesson/practice thumbnails; course-media MIME whitelist |
| `0014_transactional_email_outbox` | `email_outbox` + payment e-mail triggers + pg_cron → `email-dispatch` |
| `0015_pg_net_schema` | pg_net moved to the `extensions` schema (advisor lint) |

Database objects after `0012` (identical on the local stack and the hosted project): 36 tables (all with RLS enabled),
6 views (`identity_summary`, `public_profiles`, `quiz_questions_student`, `exam_questions_student`,
`exam_attempts_student`, `site_content_public`), 19 enums, 84 functions, 94 table policies,
13 storage policies, 31 triggers, 70 indexes, 6 buckets (0 public), 1 Vault secret
(`mcsli_identity_key`), and a `private` schema (not exposed through the API) for the encryption
helpers and the rate-limit table.

## 2. Create and link the project

1. Create a project at supabase.com (region closest to Uganda: **eu-west-2 London** or
   **af-south-1 Cape Town** if offered). Choose a strong database password and store it in MCSLI's
   password manager.
2. On the machine that deploys:

```bash
npm ci
npx supabase login                         # opens the browser; or export SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref <ref>      # asks for the database password
```

`supabase/.temp/` (link state) is git-ignored.

## 3. Environment variables

| Variable | Used by | Exposure |
|---|---|---|
| `VITE_SUPABASE_URL` | browser (`src/lib/supabase.ts`) | public |
| `VITE_SUPABASE_ANON_KEY` | browser | public – every request is governed by RLS |
| `VITE_SITE_URL` | browser – auth e-mail redirects, SEO canonical, certificate QR codes | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (injected by Supabase), `scripts/seed-demo-users.mjs` (local), `scripts/e2e-supabase.mjs` | **server only** – never `VITE_`-prefixed, never committed |
| `DATABASE_URL` | `scripts/bootstrap-super-admin.mjs`, `scripts/db-apply.mjs` | **server only** (contains the DB password) |
| `TEST_DATABASE_URL` | `npm run test:db` (disposable Postgres) | local |
| `ALLOWED_ORIGINS` | Edge Function CORS (optional, `supabase secrets set`) | server |

Verified: only the three `VITE_*` values are referenced from `src/`; a production build was scanned
and does not contain the service-role key. `.env`, `.env.*` (except `.env.example`) and
`*.local` are git-ignored; `.env.example` holds placeholders only.

Local development: `npx supabase start` then write `.env.local` with the local API URL and anon
key printed by `npx supabase status` (the E2E script reads them itself).

## 4. Migrations

```bash
npx supabase db push --dry-run     # shows exactly which migrations will run
npx supabase db push               # applies them in order, records them in supabase_migrations
```

* Never use `supabase db reset --linked` or `scripts/db-apply.mjs --reset` against production.
  `db-apply.mjs` refuses `--reset`/`--seed` for any non-local host.
* If a migration was applied by hand (SQL editor), reconcile history instead of re-running:
  `npx supabase migration repair --status applied 00NN`.
* `0008`–`0010` only use `create or replace`, `drop policy if exists`, `revoke/grant` and guarded
  `do` blocks. `0009` encrypts existing identity rows before dropping the plaintext column; this
  was tested on a database containing plaintext rows.
* **Before any production migration:** take a backup (§15), run `--dry-run`, apply to a staging
  project first when one exists.
* Hosted Supabase runs migrations with `search_path = "$user", public` (no `extensions`), unlike the
  local stack. Always schema-qualify extension functions (`extensions.gen_random_bytes`, …). The
  test shim (`tests/db/shim.sql`) now uses the hosted search path so this fails in `npm run test:db`.

## 5. Auth configuration

Configured in `supabase/config.toml` and applied to the hosted project with `npx supabase config push`
after filling in `[remotes.production]` (bottom of the file) with the project ref:

| Setting | Value |
|---|---|
| E-mail confirmation | required (`enable_confirmations = true`) |
| Minimum password length | 8 (matches the registration form) |
| Resend throttle | 60 s |
| Site URL | `https://mcsli.org` (production), `http://localhost:5173` (local) |
| Redirect allow-list | `<site>/login`, `<site>/reset-password`, `<site>/accept-invite` for `mcsli.org`, `www.`, `learn.`, `mcsli.vercel.app` (localhost only in the local config) |
| DB SSL | enforced for direct Postgres connections (`[remotes.production.db.ssl_enforcement]`) |
| Templates | `supabase/templates/confirmation.html`, `recovery.html` – **commented out** in `config.toml` until SMTP exists: Supabase rejects template changes on free-tier projects using the built-in mailer |
| MFA | TOTP enrol/verify enabled (hosted default kept) |
| OTP length | 8 (hosted default kept) |
| Flow | PKCE (`src/lib/supabase.ts`), session persisted + auto-refreshed |

The app builds redirect links from `VITE_SITE_URL` (`src/features/auth/AuthProvider.tsx`):
confirmation → `<site>/login?verified=1`, reset → `<site>/reset-password`. To move to
`https://learn.mcsli.org`, change `VITE_SITE_URL` and the `[remotes.production.auth]` URLs; no
code change.

Role safety: the `on_auth_user_created` trigger creates the `profiles` row from name/phone/
nationality/country only. Any `role` sent by a manipulated form is ignored; every account starts as
`STUDENT` (tested). Profile creation happens in the same transaction as the auth user, so a failed
insert fails the sign-up instead of leaving an orphan.

## 6. Production e-mail: Resend

**Provider:** Resend, team *mcsli* (signed in as admin@mcsli.org). **Domain `mcsli.org` added**
(region eu-west-1), status *Not Started* until the DNS records below exist. Sender
`MCSLI <no-reply@mcsli.org>`, replies to `info@mcsli.org` (`admin@mcsli.org` is a login, not a sender).

Exact records supplied by Resend (add at the DNS host – Contabo – then click *Verify DNS Records*):

| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDoS814eza0s7AosWjg7r78fAfbMakktIqxme8BdO6ra+0QmtpX3mHoFQSn449LVQzBV+dly5DliVIkFYnpEKymoBEtDeELB7PSr9ut8SbneHEpwmzfRf/ThkdgX53MDjZvI4xU7MG4XEI2Bst3zbn/s3Jf/ZOBplB4OCopBlE/pwIDAQAB` |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` (start in monitoring mode; tighten to `quarantine` after a few weeks of clean reports) |

The existing `MX 10 mail.mcsli.org` (MCSLI's own mailbox server) is untouched. Note: a wildcard A
record currently answers every `*.mcsli.org` name; the explicit `send`/`rsend` CNAMEs take precedence.

**Connecting Supabase Auth** – preferred: Resend → Settings → Integrations → *Connect to Supabase*
(OAuth: Resend creates a sending-only API key and writes the SMTP settings into the project; nothing is
pasted). Choose project `midvngbooepderxboqru`, sender `no-reply@mcsli.org`, name `MCSLI`.
Manual alternative (Supabase → Authentication → SMTP): host `smtp.resend.com`, port `465`, user
`resend`, password = a Resend API key with *sending access* for `mcsli.org`.

**Link tracking:** Resend click/open tracking must stay **off** for `mcsli.org` (Resend → Domains →
mcsli.org → Configuration) so single-use confirmation/reset/invite URLs are not rewritten. New domains
start with tracking off; confirm after verification.

**After SMTP is connected:** uncomment the three `[auth.email.template.*]` blocks in `config.toml`
(confirmation, recovery, invite) and run `npx supabase config push`; set Auth → Rate limits →
e-mails/hour to 100; set the `RESEND_API_KEY` Edge Function secret for transactional e-mails (§6a).

### 6a. Transactional e-mail (payments)

`payments` inserts/status changes queue rows in `email_outbox` (payment received / confirmed with
receipt number / rejected with the reviewer's note). pg_cron job `mcsli-email-dispatch` calls the
`email-dispatch` function every minute while messages are queued; the function sends via the Resend
API and records `sent` / retries up to 5 times / `failed`. Wiring verified on production (the function
answers `RESEND_API_KEY not configured` and messages wait). Activation = add the Edge Function secret
`RESEND_API_KEY` (Supabase → Edge Functions → Secrets). Messages never claim an automated gateway:
"payment received" explicitly says it is not a receipt.

## 7. Row Level Security

RLS is enabled on every table; the default is deny. Business mutations go through SECURITY DEFINER
functions that re-check the caller and write `audit_logs`.

**Audit performed 2026-09-25 – issues found and fixed in `0008`–`0010`:**

1. Internal helpers were executable by every signed-in user (Supabase grants EXECUTE to
   `anon`/`authenticated` by default): anyone could forge notifications/audit rows (`fn_notify`,
   `fn_audit`) or read another student's payment totals (`fn_confirmed_totals`, `fn_month_access`).
   → EXECUTE is now an explicit whitelist.
2. `exam_questions_select_student` compared `ea.exam_id` with itself → any student with any exam
   attempt could read every exam's questions. → fixed.
3. Suspended or demoted staff kept privileges. → role helpers require `account_status = 'active'`
   and the current role.
4. Trainers could read every profile, ticket, report and certificate. → scoped to assigned
   courses/cohorts; tickets to admins or the assignee.
5. Authors could un-hide, unlock, pin or move moderated posts. → guard triggers.
6. Admins could sign identity-document URLs directly (no audit). → owner-only storage read; staff
   use the Edge Function.
7. Recipients could rewrite notification text; audit rows were mutable by definer code. →
   column grant on `read_at` only; append-only trigger on `audit_logs`.
8. Month N+1 unlocked on an assessment pass alone. → also requires Month N's required lessons and
   quizzes (mirrored in `src/domain/progression.ts`).
9. Failed quiz attempts returned the correct answers, so unlimited retries passed any quiz. →
   answers revealed only after a pass or the final attempt.
10. `fn_generate_receipt_number` could not find `gen_random_bytes` on hosted Supabase (pgcrypto
    lives in `extensions`) – payment confirmation would have failed. → search_path fixed; the test
    shim now installs pgcrypto in `extensions` like Supabase.
11. Reissuing a revoked certificate skipped eligibility; ADMINs could suspend SUPER_ADMINs; an
    autosave after the exam deadline rolled back the automatic submission. → fixed.

**Supabase security advisor on the hosted project (after `0012`):** 0 unexpected findings. Remaining
items are intentional: 4 × `security_definer_view` (the four filtered views listed in `0012` – the base
tables deny direct reads, so they cannot be invoker views), 76 × `*_security_definer_function_executable`
(exactly the EXECUTE whitelist; each function re-checks the caller), and 194 performance
warnings (`auth_rls_initplan`, `multiple_permissive_policies`) that are negligible at MCSLI's scale; revisit
by wrapping `auth.uid()` as `(select auth.uid())` if query volume grows.

**Role matrix (enforced in SQL, tested as each role):**

| | Student | Trainer | Admin | Super admin |
|---|---|---|---|---|
| Own profile / enrollment / payments / progress | ✓ | ✓ | ✓ | ✓ |
| Other students' data | – | assigned courses only | ✓ | ✓ |
| Confirm/reject payments | – | – | ✓ | ✓ |
| Schedule/record assessments, grade exams | – | assigned only | ✓ | ✓ |
| Month override (audited, reason ≥ 10 chars) | – | – | ✓ | ✓ |
| Issue/revoke/reissue certificates | – | approve completion only | ✓ | ✓ |
| Identity: masked summary / full reveal / scans | own masked | – | ✓ (audited) | ✓ (audited) |
| Settings, pricing, payment methods, website content | – | – | ✓ | ✓ |
| Grant TRAINER / STUDENT | – | – | ✓ | ✓ |
| Grant ADMIN / SUPER_ADMIN, suspend admins | – | – | – | ✓ |

## 8. Storage

All buckets are private (`public = false`), created by `0006`:

| Bucket | Path rule | Read | Write |
|---|---|---|---|
| `identity-documents` (10 MB, jpg/png/webp/pdf) | `<user_id>/…` | owner only; staff via Edge Function | owner (delete only while not verified); admins delete for retention |
| `payment-proofs` (10 MB) | `<user_id>/…` | owner, admins | owner |
| `course-media` (2 GB) | any | students only for lessons/practice/questions of **unlocked** months; staff | admins |
| `lesson-resources` (50 MB) | any | students of unlocked lessons; staff | admins |
| `certificates` (5 MB, pdf) | `<user_id>/…` | owner, staff | admins |
| `avatars` (2 MB) | `<user_id>/…` | signed-in users | owner |

Files are reached only through signed URLs (identity scans: 120 s). Tested: a student cannot list,
download, sign or upload into another student's folder; an admin cannot sign an identity scan
directly.

## 9. Identity-document security

* **Numbers**: `identity_verifications.id_number_encrypted` = `pgp_sym_encrypt(aes256)` with the
  Vault secret `mcsli_identity_key` (generated inside the database by `0009`; it never exists in the
  repo, the frontend or function env vars). `id_number_hash` = HMAC-SHA256 for exact-match lookup
  (`admin_find_identity_by_number`, audited). `id_number_last4` for masking. No plaintext column.
* **Normal API responses** show `••••••••••1234` (`identity_summary`). The full number is returned
  only by `admin_reveal_identity_number(id, reason)` – admins only, audited with actor, time and
  reason, never with the number. The admin UI clears it after 60 s and never stores it.
* **Scans**: private bucket; staff access only through `identity-document-url`, which calls
  `authorize_identity_document_access()` as the caller (owner or active admin), writes the audit
  row first, then signs a 120 s URL. Not-found and not-permitted both return 404 (no IDOR oracle).
  Logs contain event names and error codes only.
* Why Vault + pgcrypto and not pgsodium column encryption: Supabase has deprecated pgsodium TCE;
  Vault is the supported secret store and the RPC contract used by the frontend did not change.
* **Key escrow (recommended):** Vault secrets are encrypted with a project-specific root key. A
  backup restored *into the same project* decrypts; restoring into a *different* project does not.
  A super admin should export the key once (SQL editor:
  `select decrypted_secret from vault.decrypted_secrets where name = 'mcsli_identity_key';`) into
  MCSLI's offline password manager. Never rotate or delete the secret without re-encrypting.

## 10. Edge Functions

```bash
npx supabase functions deploy identity-document-url
npx supabase functions deploy invite-staff
npx supabase functions deploy email-dispatch --no-verify-jwt     # pg_cron calls it with x-dispatch-secret
npx supabase secrets set APP_SITE_URL=https://mcsli.org          # links in invitation/transactional e-mails
npx supabase secrets set ALLOWED_ORIGINS=https://mcsli.org,https://www.mcsli.org   # optional CORS lock
```

Secrets set on production: `APP_SITE_URL`, `DISPATCH_SECRET` (random; same value as the Vault
secret `mcsli_dispatch_secret`; never printed). To be added by MCSLI: `RESEND_API_KEY`.

`verify_jwt = true` (config.toml) makes the gateway reject unsigned calls. `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

## 11. First super admin and staff

**First super admin – `admin@mcsli.org`** (step-by-step in LAUNCH_RUNBOOK.md):
1. Create/confirm the Auth account through the normal secure mechanism: an invitation e-mail
   (`auth.admin.inviteUserByEmail`, redirect `<site>/accept-invite`), where the owner of the mailbox
   chooses the password themself.
2. `select public.bootstrap_super_admin('admin@mcsli.org');` (SQL editor or
   `scripts/bootstrap-super-admin.mjs`). Refused through the API, refused while the e-mail is
   unconfirmed, refused once a super admin exists; audited as `profile.super_admin_bootstrapped`.
3. The super admin enrols TOTP (Profile → Two-factor authentication), then turns on
   *Require two-factor authentication for staff* (Admin → Settings; super admin only, and only from a
   session that has passed MFA, so nobody can lock themselves out).

**Everyone else – Admin → Staff → Invite staff.** SUPER_ADMIN invites ADMIN or TRAINER; ADMIN
invites TRAINER only. The `invite-staff` function creates the invitation (7-day, single-use token;
only its SHA-256 hash is stored) and e-mails a link; the invitee sets their own password on
`/accept-invite` and `accept_staff_invitation()` grants the role only to the invited, confirmed
address. Audited: `staff_invitation.created / accepted / cancelled / expired /
rejected_wrong_account`, `staff.admin_created / trainer_created`, `profile.role_changed`,
`staff.suspended / reactivated`. Assign trainers to courses/cohorts in Admin → Trainers.
ADMINs cannot create, promote, demote or suspend a SUPER_ADMIN or promote themselves (tested).
Sessions: 1-hour access tokens, rotating refresh tokens; sign-out is global.

## 12. Payments, pricing and course setup

* **Payment methods** (`MCSLI Bank Account`, `MTN Mobile Money`, `Airtel Money`) are created
  **disabled with no details**. An admin enters the real account number / merchant codes in
  **Admin → Settings → Payment methods** and enables them. Changes are audited. No values are
  invented in this repo.
* **Pricing** lives on each course (Admin → Courses): Ugandan tuition (UGX 350,000),
  non-Ugandan (UGX 400,000), registration fee (UGX 20,000, separate), installments on/off, count,
  optional explicit amounts, and which month needs installment N. `enroll_in_course()` computes
  the price from the student's nationality and **snapshots** it; the browser never sends a price,
  and later course price changes do not touch existing enrollments (tested).
* Payment methods **cannot be enabled until their details exist** (bank: bank, account name and
  number; MTN/Airtel: merchant code and registered merchant name) – enforced in the database.
* **Course content**: Admin → Courses → create course (always a draft first), months (1..N),
  modules, lessons (video upload to private `course-media` or external URL, WebVTT captions,
  transcript, duration, thumbnail/poster, ordering, publish flag), practice items, quizzes, final
  exam. The *Settings & fees* tab shows a publish checklist; the database refuses to publish a course
  without a published month, a published lesson per month, a video per lesson, prices, the required
  final exam, or with demo media. Anything with student history cannot be deleted (unpublish/archive).
  Replacing a video uploads a new file; the previous file stays in storage until removed.
* **Video storage:** see LAUNCH_RUNBOOK.md → "USL video". Free plan: 50 MB per upload; Pro: raise
  the Storage upload limit and set `VITE_MAX_UPLOAD_MB`.

## 13. Rate limiting

* **Database (in place):** `verify_certificate` – 30 lookups / 10 min per client;
  contact form – 5 / 10 min. Clients are identified by `CF-Connecting-IP` / `X-Forwarded-For` and
  stored only as SHA-256 hashes (`private.rate_limits`, self-cleaning).
* **Edge (recommended):** the browser calls `https://<ref>.supabase.co` directly, so a Cloudflare
  rule on `mcsli.org` does **not** see these requests. For edge enforcement, put the API behind a
  Supabase custom domain (e.g. `api.mcsli.org`, paid add-on) proxied through Cloudflare and add:
  *URI path equals `/rest/v1/rpc/verify_certificate` → rate limit 30 requests / 10 minutes per IP →
  managed challenge.* Supabase Auth already rate-limits sign-up, login, OTP and reset e-mails.

## 14. Observability

* **Frontend:** `src/lib/observability.ts` – `reportError()` receives every error shown to a user
  (via `friendlyError`) with an area (`auth`, `payment`, `assessment`, `exam`, `identity`,
  `storage`, `edge-function`…), redacted (no NINs, e-mails, phone numbers, JWTs). No provider is
  configured; connect one with `setErrorReporter()` in `src/main.tsx`.
* **Edge Function:** one JSON log line per request (`issued`, `denied` + SQL error code,
  `sign_failed`, `misconfigured`) in Dashboard → Edge Functions → Logs.
* **Database/Auth:** Dashboard → Logs (Postgres, Auth, Storage, API). Useful saved queries:
  failed logins (`auth` logs, `error_code = invalid_credentials`), `42501` errors in API logs,
  `payment.rejected` / `assessment.recorded` in `audit_logs`.
* **Migration failures:** `supabase db push` stops at the failing file and prints the SQL error;
  nothing after it runs (each file is transactional).
* Log drains to an external provider are a paid-plan feature (Dashboard → Settings → Log drains).
* **E-mail:** Resend → Logs / Metrics (delivered, bounced, complained, suppressed); Supabase Auth logs
  (`smtp` / `mail` errors); `select status, count(*) from email_outbox group by 1` for transactional
  mail (admins can read `email_outbox`; it holds no credentials).
* **Invitations:** `invite-staff` logs `invitation_sent`, `invitation_refused`, `email_failed` (never the
  token or address).

## 15. Backups and recovery

**Verified on the hosted project: no backups.** Dashboard → Database → Backups states "Free Plan does
not include project backups". Upgrading to **Pro** gives 7 days of daily backups; **Point-in-Time
Recovery** is a paid add-on. Until then, take manual dumps (below) before every change and regularly
once real students are enrolled.

* Database backups do **not** include Storage files (identity scans, receipts, videos). Export
  buckets separately (S3-compatible API or `supabase storage` CLI) on a schedule.
* See §9 for the Vault key escrow needed to read identity numbers after a cross-project restore.
* **Before every major migration:** confirm a fresh backup exists (or run
  `npx supabase db dump --linked -f backup-$(date +%F).sql` and
  `npx supabase db dump --linked --data-only -f data-$(date +%F).sql`), run
  `db push --dry-run`, apply during low traffic, then run the E2E script against staging.
* Recovery: Dashboard → Backups → Restore (same project) or restore a dump into a new project with
  `psql`, then redeploy functions and re-enter secrets/SMTP.

## 16. Environments

| | Local | Staging (recommended) | Production |
|---|---|---|---|
| Backend | `npx supabase start` | separate Supabase project | MCSLI project |
| Seed | `[DEMO]` course via `supabase db reset` | none, or `[DEMO]` with `ALLOW_DEMO_SEED=staging` for demo users | **never** |
| Secrets | local defaults | own keys | own keys |
| Frontend env | `.env.local` | host env vars | host env vars |

Safeguards: `db push` never runs seeds; `db-apply.mjs` refuses `--reset/--seed` on non-local hosts;
`seed-demo-users.mjs` refuses non-local URLs unless `ALLOW_DEMO_SEED=staging`; the E2E script
refuses hosted projects unless `E2E_ALLOW_REMOTE=1` and cleans up after itself.

## 17. Testing

```bash
npm run lint && npm run typecheck && npm test && npm run build      # frontend + domain
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/mcsli_test npm run test:db   # 63 SQL tests
npx supabase start && npm run test:e2e                               # 45-step HTTP end-to-end
npm run db:types                                                     # regenerate src/types/supabase.generated.ts
```

`src/types/schema-contract.ts` makes `npm run typecheck` fail if a hand-written row type or an RPC
name used by the app no longer exists in the generated schema.

Against staging/production (creates `[TEST]` records; afterwards all `[TEST]` accounts are banned and
suspended, staff roles removed, the course unpublished and the payment method disabled). Without
SMTP the script creates accounts through the Auth admin API and follows server-generated
confirmation/reset links instead of reading e-mail:

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
E2E_ALLOW_REMOTE=1 E2E_EMAIL_DOMAIN=<domain you control> E2E_SITE_URL=https://mcsli.org \
node scripts/e2e-supabase.mjs
```

Removing all `[TEST]` records later (SQL editor; touches only rows created by the script):

```sql
delete from public.courses where slug like 'test-e2e-%';            -- cascades to months, lessons, enrollments, payments…
delete from public.payment_methods where display_name like '[TEST]%';
-- storage files: remove through the Storage API (direct deletes from storage.objects are blocked)
-- accounts: keep them banned + suspended (audit rows reference them and are immutable)
```

Audit rows referencing these accounts cannot be deleted through the API (append-only); a direct
session can remove them if required.

## 18. Deployment

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon> VITE_SITE_URL=https://mcsli.org npm run build
```

Serve `dist/` with an SPA fallback (all paths → `/index.html`). Then: `db push`,
`functions deploy`, `config push`, SMTP, bootstrap the super admin, enter payment methods, create
the course, run the E2E script against staging.

## Remaining external setup

See [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) – each item lists exactly what to click or add.
