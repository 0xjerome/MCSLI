# MCSLI – Website & Online Sign Language Learning Platform

The public website of the **Master Class Sign Language Initiative (MCSLI)** — a Deaf-led
organisation in Kampala, Uganda promoting Ugandan Sign Language (USL) — together with an
integrated online learning platform where students register, verify their identity, enroll,
pay, learn month by month, practise signs, take quizzes and examinations, are assessed by
MCSLI trainers, and receive verifiable certificates.

| Area | Path | Who |
|---|---|---|
| Public website | `/`, `/about`, `/programs`, `/online-learning`, `/impact`, `/events`, `/gallery`, `/resources`, `/contact`, `/donate`, `/shop`, `/certificate/:number` | everyone |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | everyone |
| Student app | `/app/**` | `STUDENT` |
| Trainer app | `/trainer/**` | `TRAINER`, admins |
| Admin app | `/admin/**` | `ADMIN`, `SUPER_ADMIN` |

Read **[docs/FINDINGS.md](docs/FINDINGS.md)** first: it records what the original repository
and the live site contained, where they contradicted each other, and what was preserved.
Backend setup, security model and deployment: **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**.

---

## Contents

1. [Architecture](#architecture)
2. [Technology stack](#technology-stack)
3. [Local setup](#local-setup)
4. [Environment variables](#environment-variables)
5. [Database setup & migrations](#database-setup--migrations)
6. [Seed data](#seed-data)
7. [Authentication & roles](#authentication--roles)
8. [Payment workflow](#payment-workflow)
9. [Course progression rules](#course-progression-rules)
10. [Assessment & examination workflow](#assessment--examination-workflow)
11. [Certificates](#certificates)
12. [Storage](#storage)
13. [Security notes](#security-notes)
14. [Public website content](#public-website-content)
15. [Testing](#testing)
16. [Deployment](#deployment)
17. [Future AI integration points](#future-ai-integration-points)

---

## Architecture

```
Browser  (React 18 · TypeScript · Vite · Tailwind)
 ├─ Public website        src/pages/public        content from src/content + site_content table
 ├─ Student app           src/features/student, payments, support, discussions, notifications
 ├─ Trainer app           src/features/trainer, staff
 ├─ Admin app             src/features/admin
 ├─ Design system         src/components/ui       Button, Input, Select, Textarea, Card, Badge,
 │                                                Progress, Tabs, Dialog, Dropdown, Toast, Avatar,
 │                                                DataTable, Pagination, EmptyState, Skeleton,
 │                                                Breadcrumb, Alert; VideoPlayer, LockedCard,
 │                                                status badges in src/components
 ├─ Pure business rules   src/domain              pricing · progression · certificates · roles
 └─ Data access           src/services            typed wrappers around supabase-js
            │ supabase-js (anon key + the user's JWT)
Supabase
 ├─ Postgres   supabase/migrations   schema · RLS on every table · SECURITY DEFINER RPCs that
 │                                   hold the business rules and write audit_logs
 ├─ Auth       e-mail + password, e-mail verification, password reset (PKCE)
 ├─ Storage    private buckets only (identity-documents, payment-proofs, course-media,
 │                                   lesson-resources, certificates, avatars)
 └─ Edge Fn    supabase/functions/identity-document-url  – audited signed URLs for ID scans
```

**Principles**

* **Authorisation lives in the database.** Every table has row-level security. Anything with
  business meaning (confirming a payment, recording an assessment, overriding a lock, issuing a
  certificate, changing a role) is a Postgres function that re-checks the caller's role and
  writes an audit row. Hiding a button in React is never the only protection.
* **One rule, two implementations, one test suite.** `src/domain/progression.ts` mirrors
  `fn_month_access()` in SQL. The TypeScript version gives instant UI explanations; the SQL
  version is authoritative and gates RLS. `tests/db` runs the real SQL and asserts the same
  outcomes as the TypeScript unit tests.
* **Content is data.** Contact details, statistics, programmes, stories, team, announcements,
  events, FAQ, donation and shop details are editable in **Admin → Website** and stored in
  `site_content`; typed defaults in `src/content/defaults.ts` keep the public site working
  with no database at all.
* **Mobile first and data-frugal.** Route-level code splitting (the admin bundle never loads for
  a student), lazy images, no autoplay, skeleton states, no chart/UI framework.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technology stack

| Concern | Choice |
|---|---|
| UI | React 18, TypeScript 5, Vite 6, Tailwind CSS 3, lucide-react icons |
| Routing / data | react-router v7, TanStack Query v5 |
| Validation | zod (forms and site-content schemas) |
| Backend | Supabase (Postgres 15+, Auth, Storage, Edge Functions) |
| Certificates | pdf-lib + qrcode (PDF rendered in the browser from the server-issued record) |
| Tests | Vitest 5, Testing Library, `pg` for database integration tests |
| Lint | ESLint 9 (typescript-eslint, react-hooks, jsx-a11y) |

## Local setup

```bash
git clone https://github.com/0xjerome/MCSLI.git
cd MCSLI
npm install
cp .env.example .env.local        # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                       # http://localhost:5173
```

Without Supabase credentials the **public website runs fully** (it uses the built-in content
defaults); login, registration and the learning platform show a clear "not connected" screen.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | anon (public) key – safe to ship, RLS governs access |
| `VITE_SITE_URL` | browser | canonical site URL for SEO, e-mail redirects and certificate QR codes |
| `DATABASE_URL` / `TEST_DATABASE_URL` | scripts & tests only | Postgres connection for `scripts/db-apply.mjs`, `scripts/bootstrap-super-admin.mjs` and `npm run test:db` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions, `scripts/seed-demo-users.mjs` (local), `scripts/e2e-supabase.mjs` | **never** prefixed with `VITE_`, never committed |

## Database setup & migrations

Migrations live in `supabase/migrations/` and are ordered:

| File | Contents |
|---|---|
| `0001_types.sql` | extensions and enumerated types |
| `0002_tables.sql` | all tables, indexes, RLS enabled, `updated_at` triggers |
| `0003_helpers.sql` | role helpers, audit/notification helpers, profile-creation trigger, privilege-escalation guard, masking view, certificate-number generator |
| `0004_business.sql` | progression (`fn_month_access`), enrollment, payments, lesson progress, quiz scoring, assessments, overrides, examinations, certificates, identity, moderation, support, dashboards |
| `0005_policies.sql` | row-level security policies for every table, column-level grants, student-safe views |
| `0006_storage.sql` | private buckets and storage object policies |
| `0007_defaults.sql` | baseline rows: three **disabled** payment methods and platform settings |
| `0008_security_hardening.sql` | RLS audit fixes: function EXECUTE whitelist, scoped trainer access, moderation guards, append-only audit log, month completion rule, quiz answer withholding, audited super-admin bootstrap |
| `0009_identity_encryption.sql` | NIN/passport numbers encrypted with a Vault key (pgcrypto AES-256) + HMAC lookup; plaintext column removed |
| `0010_public_endpoints.sql` | rate-limited certificate verification and contact form; public site content serves only verified statistics |
| `0011_enforce_registration_open.sql` | "Registration open" setting enforced in `enroll_in_course()` |
| `0012_advisor_fixes.sql` | Supabase security-advisor follow-ups (pinned search_path, no EXECUTE on trigger functions) |
| `0013_staff_invitations_and_launch_safety.sql` | staff invitations, optional staff MFA enforcement, publish validation, delete protection |
| `0014_transactional_email_outbox.sql` | payment e-mail queue + dispatcher schedule |
| `0015_pg_net_schema.sql` | pg_net moved to `extensions` |
| `0016_advisor_views_and_anon_surface.sql` | definer views → checked functions; anonymous surface reduced to the public catalogue |

**Hosted Supabase** – the production project `midvngbooepderxboqru` (eu-west-1) is linked and all migrations and the Edge Function are deployed; status and remaining steps are in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). The
Supabase CLI is a dev dependency, so no global install is needed:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --dry-run && npx supabase db push   # applies supabase/migrations in order
npx supabase functions deploy identity-document-url      # audited signed URLs for identity documents
npx supabase config push                                  # auth settings, redirect URLs, e-mail templates
```

Auth settings (confirmation required, 8-character passwords, redirect allow-list, templates) live
in `supabase/config.toml`; fill in `[remotes.production]` with the project ref before
`config push`. Production e-mail needs MCSLI's own SMTP credentials.

**Bootstrap the first super administrator** (one time, audited, refused through the API or once a
super admin exists): the person registers through `/register`, confirms the e-mail, then run
`select public.bootstrap_super_admin('you@mcsli.org');` in the SQL editor, or
`DATABASE_URL=… node scripts/bootstrap-super-admin.mjs you@mcsli.org`. Every other role is granted
in **Admin → Trainers & staff**.

**Local Supabase stack** (Docker): `npx supabase start` runs Postgres, Auth, Storage, the Edge
Runtime and a mail catcher, applies all migrations and the `[DEMO]` seed.

**Plain Postgres (no CLI/Docker)** – used by the integration tests:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/mcsli node scripts/db-apply.mjs --local --reset --seed
```

`--local` first applies `tests/db/shim.sql`, which emulates the `auth`/`storage` schemas.

## Seed data

`supabase/seed/dev_seed.sql` creates a **clearly labelled `[DEMO]` course** (3 months, modules,
lessons pointing at a placeholder video in `public/demo/`, practice signs, sample quiz and exam
questions) and enables the payment methods with obviously fake `000000` merchant codes. Everything
is removable:

```sql
delete from public.courses where slug like 'demo-%';
update public.payment_methods set is_enabled = false, display_name = replace(display_name, '[DEMO] ', ''),
  bank_name = null, account_name = null, account_number = null, merchant_code = null;
```

Demo **accounts** must be created through Auth:
`SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo-users.mjs`
(creates `demo.student@mcsli.test`, `demo.intl@`, `demo.trainer@`, `demo.admin@`, `demo.super@`).

**Never run either on production.**

## Authentication & roles

Supabase Auth with e-mail + password. Registration is a three-step form (details → residency
classification → password + consent). The `on_auth_user_created` trigger creates the
`profiles` row from the sign-up metadata (name, phone, nationality, country).

| Role | Can |
|---|---|
| `STUDENT` | own enrollment, lessons of unlocked months, own payments/identity/progress, discussions of own course, support tickets |
| `TRAINER` | students of assigned courses/cohorts: schedule & record assessments, grade exams, quiz results, moderate discussions, announcements |
| `ADMIN` | everything operational: identity & payment verification, courses & curriculum, enrollments, overrides, certificates, content, settings, audit log; may promote STUDENT ↔ TRAINER |
| `SUPER_ADMIN` | as ADMIN, plus granting/revoking ADMIN and SUPER_ADMIN |

Role changes go through `admin_set_user_role()`; a trigger blocks any other path (including a
student editing their own row). Suspended accounts are blocked in RLS helpers and in the UI.

## Payment workflow

Fees are configured **per course** (Admin → Courses): tuition for Ugandan and non-Ugandan
students, a separate registration fee, whether installments are allowed, how many, optional
custom amounts, and which month requires installment 2. The current MCSLI structure
(UGX 350,000 / 400,000 tuition, UGX 20,000 registration, two installments) is the default.

At enrollment the prices are **snapshotted** onto the enrollment, so later changes never affect
existing students. Students see their fee schedule on `/app/payments`, pay through one of the
enabled channels (bank, MTN MoMo Pay, Airtel Pay — details entered by admins in
**Admin → Settings → Payment methods**; the platform ships them **disabled and empty**), then
submit method, amount, payer name, reference, date and an optional private proof upload.

Statuses: `pending → under_review → confirmed | rejected`. Admins review in **Admin → Payments**;
`review_payment()` writes an audit row, issues a receipt number, notifies the student, activates
the enrollment when Month 1's financial requirement is met, and notifies when a later month is
unlocked. No payment gateway is simulated; the schema (`payments.method_type`, `reference`,
`reviewed_by`) is ready for an automated Mobile Money callback to call the same function.

## Course progression rules

Implemented once in SQL (`fn_month_access`) and mirrored in `src/domain/progression.ts`:

```
Month N is accessible  ⇔
   enrollment is active
 ∧ FINANCIAL GATE: registration fee confirmed
                   ∧ every installment with due_before_month ≤ N is confirmed
                     (full plan: the whole tuition before Month 1)
 ∧ ACADEMIC GATE:  N = 1, or Month N-1's latest assessment attempt is PASS
                   (or the month does not require an assessment),
                   or an active admin override exists for (enrollment, month N)
```

* A full-tuition student has no installment condition after Month 1 but still needs the pass.
* An installment student needs **both** the pass **and** the confirmed installment for Month 2.
* A NOT PASSED result keeps the next month locked regardless of payment and opens a reassessment.
* An override bypasses only the academic gate, requires a reason (≥ 10 chars), notifies the
  student and is written to `audit_logs` with actor, student, course/month, reason and time.
* Lessons, modules, quizzes, practice items and course media are **unreadable** (RLS) while their
  month is locked, so changing a URL cannot reveal content; `save_lesson_progress()` and
  `submit_quiz_attempt()` re-check access.

The UI always shows *why* something is locked (`LockedCard`) with the relevant next action.

## Assessment & examination workflow

**Monthly assessments** (trainer-led, live): a trainer or admin schedules an assessment for a
student/month (`schedule_assessment`), then records the outcome (`record_assessment_result`)
with score, PASS / NOT PASSED, feedback, notes; attempt numbers increment automatically.
PASS → progression evaluates and the student is told the next month is open when it is.
NOT PASSED → a reassessment row is created and the student sees "Assessment requires another
attempt".

**Examinations**: timed, with availability window, attempt limit, optional randomisation,
autosave every 10 s, resume after disconnect, auto-submit when time runs out. Multiple-choice,
video and matching questions are auto-graded; practical questions are graded by a trainer
(`grade_exam_attempt`). Scores are hidden from students until `release_exam_results()`.

**Quizzes**: scored server-side; correct answers are never sent to the browser before an attempt
(column grants + the `quiz_questions_student` view).

## Certificates

`fn_certificate_eligibility()` requires: enrollment active, all required lessons complete, all
required quizzes passed, every month's assessment passed, the final examination passed (if the
course requires one), registration + tuition fully confirmed, and final approval by a trainer or
admin. `issue_certificate()` (admin) generates a number `MCSLI-YYYY-XXXXXX`, stores the record,
notifies the student and audits. Revoke and reissue (with corrected name) are supported.
The PDF is rendered in the browser from the record (logo, names, dates, QR code) and the
public page `/certificate/:number` shows only name, course, dates and status.

## Storage

All buckets are private. Object policies key on the first path segment (`<user_id>/…`) for
uploads, and on course access for media. Identity documents are only reachable by the owner
(short-lived link) or by admins through the audited Edge Function; admins may delete documents
to honour the retention policy (`identity_retention_days` setting).

## Security notes

* RLS on every table; default deny; column-level grants hide `correct_answer`, `explanation` and
  unreleased exam scores from the shared `authenticated` role.
* Identification numbers are **encrypted at rest** (Vault key + pgcrypto AES-256, HMAC for exact
  search); no direct SELECT for anyone; students see `••••••••••1234` through `identity_summary`;
  admins reveal the full number only through `admin_reveal_identity_number()`, which writes an
  audit row without the number. Numbers never appear in URLs, logs or browser storage.
* Identity scans: owner-only storage access; staff open them only through the
  `identity-document-url` Edge Function, which authorises and audits in SQL before signing a
  120-second URL.
* Function EXECUTE is an explicit whitelist: internal helpers (notifications, audit, payment
  totals) cannot be called through the API. The audit log is append-only.
* All uploads validated by MIME type and size in the browser, in SQL and by bucket configuration.
* Storage paths are namespaced by user id and checked in RLS; no public buckets.
* Business mutations are SECURITY DEFINER functions with explicit role checks, `search_path`
  pinned, and `audit_logs` entries.
* Privilege escalation blocked by trigger; admins cannot grant admin roles; nobody can change
  their own role or suspend themselves.
* Sessions: Supabase PKCE flow, auto-refresh; protected routes redirect and remember the target.
* Error messages are normalised (`friendlyError`) so raw database errors never reach users.
* Rate limiting: Supabase Auth's built-in limits apply to sign-up, login and password reset;
  `verify_certificate` (30 / 10 min per client) and the contact form (5 / 10 min) are limited in
  the database. Edge rules need a Supabase custom domain behind Cloudflare – see
  docs/SUPABASE_SETUP.md §13.
* Secrets: only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` reach the browser; `.env*.local`
  is git-ignored; the service-role key is used only in Edge Functions and the demo-user script.

Recommended before public launch: escrow the Vault identity key (docs/SUPABASE_SETUP.md §9),
configure SMTP, choose a plan with backups, and connect an error reporter
(`src/lib/observability.ts`).

## Public website content

Editable in **Admin → Website**: contact details, impact statistics (each with a *verified*
flag — unverified numbers are not shown publicly), announcements, homepage hero, events, and
every other block (organisation, programmes, stories, team, donation, shop, FAQ, gallery
captions) through a schema-validated JSON editor. Course fees are on the course; payment
instructions are in Settings.

Photos: `public/media/` holds the 53 authentic images retrieved from mcsli.org (gallery, team,
stories, shop) with `manifest.json` describing them. Add new photos there and reference them
from content.

## Testing

```bash
npm run lint          # ESLint (TypeScript, hooks, jsx-a11y)
npm run typecheck     # tsc --noEmit
npm test              # Vitest: domain rules + UI/auth flows (jsdom)
npm run build         # typecheck + production build
npm run check         # all of the above

# Database integration tests – real Postgres, real migrations, RLS as each role
createdb mcsli_test
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/mcsli_test npm run test:db

# End-to-end through the real Supabase HTTP APIs (Auth, PostgREST, Storage, Edge Functions)
npx supabase start
npm run test:e2e
```

What is covered:

* `src/domain/*.test.ts` – Ugandan vs international pricing, registration fee separation,
  installment splitting and admin-configured amounts, full vs installment flows, second
  installment requirement, academic progression, pass / fail / reassessment, admin override
  (never waives payment), certificate eligibility, role authorisation.
* `tests/db/progression.test.ts` – the same rules executed in Postgres through the SECURITY
  DEFINER functions as student / trainer / admin / super-admin / anonymous: enrollment snapshot,
  payment submission and review, month-1 activation, locked-URL access denied (RLS + RPC),
  assessment recording, reassessment, second-installment unlock, override audit trail, quiz
  scoring with hidden answers, identity masking / reveal audit / document permissions, role
  escalation blocked, exam lifecycle with hidden scores and release, certificate issue / verify /
  revoke / reissue, discussion permissions and moderation, support tickets, notifications,
  site-content permissions, dashboards.
* `tests/db/security.test.ts` – negative security tests: forged notifications/audit rows,
  cross-student reads, self-promotion, suspended/demoted staff, payment self-confirmation, fee
  tampering, assessment tampering, locked content via direct calls, exam question leakage, expired
  exam reopening, certificate self-issue, identity storage bypass (IDOR), moderation bypass,
  notification rewriting, audit log immutability, admin settings, verification rate limiting.
* `scripts/e2e-supabase.mjs` – 43 steps: registration → e-mail confirmation → identity → admin
  verification → enrollment → payments → month 1 → lesson → quiz → failed assessment →
  reassessment → month 2 lock/unlock with installment 2 → exam → grading → certificate issue /
  verify / revoke / reissue, support, discussions, notifications, and cross-user attacks.
* `src/**/*.test.tsx` – registration wizard validation and payload, login errors and redirect,
  LockedCard explanations, responsive DataTable, Dialog accessibility, content merging.
* `src/lib/supabase.test.ts` – raw Postgres/RLS errors are never shown to users; log redaction.

## Deployment

The frontend is static. Any host that serves `dist/` with SPA fallback works (Netlify, Vercel,
Cloudflare Pages, Render, a plain Nginx). Build with the production environment variables:

```bash
VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… VITE_SITE_URL=https://mcsli.org npm run build
```

Add a rewrite of all paths to `/index.html` (e.g. Netlify `_redirects`: `/* /index.html 200`).
Update `public/sitemap.xml` / `robots.txt` if the domain changes. Point Supabase Auth redirect
URLs at the deployed domain (`[remotes.production.auth]` in `supabase/config.toml`) and deploy the
Edge Function. Moving to e.g. `https://learn.mcsli.org` only needs `VITE_SITE_URL` and those URLs.

## Future AI integration points

Nothing AI-related is implemented or simulated. The intended extension points are:

* **Practice feedback** – a `practice_feedback` table (enrollment, practice item, result JSON,
  model version) written by an Edge Function that receives an *explicitly submitted* clip; the
  Practice page already has the "AI-assisted practice feedback — Coming Soon" slot and never
  uploads camera video automatically.
* **Revision suggestions** – computed from `quiz_attempts` / `assessment_attempts` and shown on
  the dashboard; no schema change needed.
* **Sign dictionary search** – index `practice_items` (title, description) in Postgres full-text
  search first; embeddings later.

Trainer assessment and certification remain human decisions by design.
