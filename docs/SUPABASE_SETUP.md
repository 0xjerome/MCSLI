# Supabase setup – MCSLI learning platform

How this repository's backend is configured, deployed and verified. Everything here refers to
files in this repo; nothing is generic boilerplate.

**Current status (2026-09-25)**

| Item | Status |
|---|---|
| Hosted Supabase project | **Not connected.** No Supabase account/token exists on the build machine; see [Remaining external setup](#remaining-external-setup). |
| Migrations `0001`–`0011` | Applied and verified on the Supabase local stack (Postgres 17, CLI 2.117). Deterministic from scratch (`supabase db reset`), re-runnable, and upgrade-safe (existing plaintext ID numbers are encrypted in place). |
| RLS / security | Audited; 11 classes of issues fixed in `0008`–`0010`; 55 database tests + 43-step HTTP end-to-end test pass. |
| Edge Function `identity-document-url` | Served and tested on the local stack (owner / other student / trainer / anonymous / admin). |

---

## 1. What is in `supabase/`

```
supabase/
  config.toml                       CLI config: auth (e-mail confirmation, 8-char passwords, redirect
                                    URLs, templates), storage, functions, production override block
  migrations/0001 … 0011            ordered schema history (below)
  functions/identity-document-url   audited short-lived URLs for identity scans
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

Database objects after `0011` (counted on the local stack): 36 tables (all with RLS enabled),
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
* **Before any production migration:** take a backup (§14), run `--dry-run`, apply to a staging
  project first when one exists.

## 5. Auth configuration

Configured in `supabase/config.toml` and applied to the hosted project with `npx supabase config push`
after filling in `[remotes.production]` (bottom of the file) with the project ref:

| Setting | Value |
|---|---|
| E-mail confirmation | required (`enable_confirmations = true`) |
| Minimum password length | 8 (matches the registration form) |
| Resend throttle | 60 s |
| Site URL | `https://mcsli.org` (production), `http://localhost:5173` (local) |
| Redirect allow-list | `<site>/login`, `<site>/reset-password` (+ `www.` and localhost variants) |
| Templates | `supabase/templates/confirmation.html`, `recovery.html` |
| Flow | PKCE (`src/lib/supabase.ts`), session persisted + auto-refreshed |

The app builds redirect links from `VITE_SITE_URL` (`src/features/auth/AuthProvider.tsx`):
confirmation → `<site>/login?verified=1`, reset → `<site>/reset-password`. To move to
`https://learn.mcsli.org`, change `VITE_SITE_URL` and the `[remotes.production.auth]` URLs; no
code change.

Role safety: the `on_auth_user_created` trigger creates the `profiles` row from name/phone/
nationality/country only. Any `role` sent by a manipulated form is ignored; every account starts as
`STUDENT` (tested). Profile creation happens in the same transaction as the auth user, so a failed
insert fails the sign-up instead of leaving an orphan.

## 6. SMTP (required for production e-mail)

Supabase's built-in mailer is for testing only (heavily rate-limited, not for real users). MCSLI
must provide an SMTP service and enter it in **Dashboard → Authentication → SMTP**, or in
`config.toml` `[auth.email.smtp]` with the password from an environment variable:

| Field | Example / note |
|---|---|
| Host | e.g. `smtp.resend.com`, `smtp.sendgrid.net`, `smtp.zoho.com` |
| Port | 587 (STARTTLS) or 465 (TLS) |
| Username | provider-specific |
| Password / API key | from the provider – never committed |
| Sender e-mail | e.g. `no-reply@mcsli.org` |
| Sender name | `MCSLI` |
| DNS | SPF, DKIM and DMARC records for `mcsli.org` as instructed by the provider |

Then raise **Auth → Rate limits → e-mails per hour** to suit enrolment volume.

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
npx supabase secrets set ALLOWED_ORIGINS=https://mcsli.org,https://www.mcsli.org   # optional CORS lock
```

`verify_jwt = true` (config.toml) makes the gateway reject unsigned calls. `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

## 11. First super admin and staff

1. The person registers at `<site>/register` and confirms their e-mail.
2. One of (both audited as `profile.super_admin_bootstrapped`; refused if a super admin exists or
   if called through the API):
   * SQL editor: `select public.bootstrap_super_admin('you@mcsli.org');`
   * `DATABASE_URL='<direct connection string>' node scripts/bootstrap-super-admin.mjs you@mcsli.org`
3. Everyone else: register normally, then **Admin → Trainers & staff** (`admin_set_user_role`).
   Admins can grant TRAINER; only super admins grant ADMIN/SUPER_ADMIN. Assign trainers to a
   course/cohort in the same screen.

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
* **Course content**: Admin → Courses → create course, months (1..N), modules, lessons (video in
  `course-media` or external URL + captions + transcript), practice items, quizzes/questions,
  final exam. The `[DEMO]` seed is local-only.

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

## 15. Backups and recovery

Not verified – no project exists yet. Per Supabase's plans at the time of writing: **Free** has no
downloadable backups; **Pro** keeps daily backups for 7 days; **Point-in-Time Recovery** is a paid
add-on. Check Dashboard → Database → Backups once the project exists.

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
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/mcsli_test npm run test:db   # 55 SQL tests
npx supabase start && npm run test:e2e                               # 43-step HTTP end-to-end
npm run db:types                                                     # regenerate src/types/supabase.generated.ts
```

`src/types/schema-contract.ts` makes `npm run typecheck` fail if a hand-written row type or an RPC
name used by the app no longer exists in the generated schema.

Against staging/production (creates `[TEST]` records, cleans up privileged ones):

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
E2E_ALLOW_REMOTE=1 E2E_EMAIL_DOMAIN=<domain you control> E2E_SITE_URL=https://mcsli.org \
node scripts/e2e-supabase.mjs
```

## 18. Deployment

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon> VITE_SITE_URL=https://mcsli.org npm run build
```

Serve `dist/` with an SPA fallback (all paths → `/index.html`). Then: `db push`,
`functions deploy`, `config push`, SMTP, bootstrap the super admin, enter payment methods, create
the course, run the E2E script against staging.

## Remaining external setup

1. **Supabase access** – a project and a way to authenticate the CLI (`npx supabase login` on the
   deploying machine, or `SUPABASE_ACCESS_TOKEN`), plus the database password for `link`.
2. **SMTP credentials** for `no-reply@mcsli.org` (§6) and the DNS records.
3. **Real payment details** (bank account, MTN and Airtel merchant codes) entered by an admin.
4. **The first super admin's e-mail address.**
5. **Production domain decision** (`mcsli.org` vs `learn.mcsli.org`) and the frontend host.
6. **Plan choice** for backups/PITR (§15).
