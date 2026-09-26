# Cohorts and native applications

Since migration `20260927140000_cohorts_and_applications.sql` a cohort is first-class website
content and applicants apply on **mcsli.org** – no Google Forms in the normal path.

```
mcsli.org → /cohorts → /cohorts/cohort-9 → Apply → MCSLI-branded application → "Application received"
        → staff review (Admin → Cohorts) → accepted → account → enroll (cohort pre-selected) → payment → course access
```

**COURSE = curriculum** (one row per program, reused by every intake). **COHORT = one intake** of a
course (dates, format, fees, questions, applicants). Never create a course per cohort.

## Public pages

| Route | Purpose |
|---|---|
| `/cohorts` | Current cohort (applications open / opening soon / featured), upcoming cohorts, archive of previous cohorts (only verified facts; a minimal card is fine) |
| `/cohorts/:slug` | Cohort page: status, course, dates, duration, format, location, schedule, eligibility, fees, certificate, sources; Apply CTA; canonical URL and `Course`/`CourseInstance` JSON-LD |
| `/cohorts/:slug/apply` | Branded application: name, e-mail, WhatsApp, attendance preference, configurable questions, declaration; draft saved on the device; honeypot; server-side validation |
| `/cohorts/:slug/applied` | Receipt: reference number, cohort, name, date, next steps, contact |
| `/cohorts/verify?token=…` | E-mail confirmation link for visitors without an account |

The `CurrentCohort` component shows one tasteful CTA on the home page, the Programs page and the
Online Learning page while a cohort is open (or opening soon). The navigation has a "Cohorts" item.

## Data model (extends `public.cohorts`)

- `cohorts`: `cohort_number`, `slug` (auto `cohort-<number>`), `tagline`, `description`,
  `delivery_mode` (`online` | `physical` | `hybrid`), `physical_location`, `online_details`,
  `schedule_notes`, `application_opens_at`, `application_deadline`, `status_override`
  (`applications_open` | `applications_closed` | `completed` | null), `capacity`, `is_published`,
  `is_featured`, `hero_image_path`, `announcement_url`, `certificate_description`, `eligibility`,
  `registration_fee`, `tuition_online`, `tuition_physical`, `currency`, `auto_accept`,
  `fallback_form_url`, `verified_participant_count`, `completion_summary`, `sources` (provenance),
  plus the existing `is_open`, `start_date`, `end_date`.
- Derived status (`fn_cohort_phase`, `fn_cohort_applications_state`, mirrored in
  `src/domain/cohorts.ts`): phase upcoming / in_progress / completed from dates; applications
  open / closed / opening_soon from `is_open`, opening time, deadline and end date; staff overrides
  win. Timestamps are `timestamptz`; the UI presents them in the device's (Kampala) time.
- `cohort_questions`: configurable per cohort – key, label, help text, type (short_text, long_text,
  email, phone, date, single_choice, multiple_choice, yes_no, country, location, delivery_mode),
  options, required, active, sensitive, position. `seed_default_cohort_questions()` installs the
  MCSLI set derived from the Cohort 9 form; `copy_cohort_questions()` copies between cohorts.
- `cohort_applications`: reference `MCSLI-C<number>-<year>-<000001>` (human-readable; the UUID is
  the identifier), `user_id` (linked account, may be null), name, normalised e-mail/phone,
  `delivery_mode`, status (`submitted` → `under_review` → `accepted` | `waitlisted` | `rejected`,
  `withdrawn`), `answers` snapshot (`[{key,label,type,answer,sensitive}]` – question edits never
  change it), `source` (`native` | `google_forms_import` | `staff`), consent time, e-mail
  verification, reviewer, internal notes, `enrollment_id`. Unique per cohort + e-mail and per
  cohort + account (withdrawn excluded). A cohort with applications cannot be deleted.
- `cohort_application_events`: status history (who, when, note).
- `enrollments.delivery_mode`; `discussion_threads.cohort_id` (cohort-scoped announcements).

## Server functions

Public (anon + authenticated): `public_cohorts()`, `public_cohort(slug)` (adds active questions),
`submit_cohort_application(slug, name, email, phone, mode, answers, consent, honeypot)`,
`verify_cohort_application(token)`.

`submit_cohort_application` enforces: published cohort, applications open (deadline!), 5
applications per hour per connection (`private.rate_limit`), honeypot, name/e-mail/phone/mode
validation, delivery mode allowed by the cohort, required questions and valid choices, consent,
duplicate e-mail/account. It stores the snapshot, logs an event and an audit row, and queues the
"application received" e-mail (with an e-mail-confirmation link when the applicant has no account).

Signed-in: `my_cohort_applications()` (links applications made before sign-up by e-mail),
`my_enrollable_cohorts(course)`. `enroll_in_course(course, plan, cohort)` accepts a cohort while
applications are open **or** when the student has an accepted application; the trigger
`link_application_enrollment` then links the application and copies the delivery mode.

Admin (audited): `review_cohort_application(id, review|accept|waitlist|reject|reopen|withdraw, note)`
(e-mails the applicant for accept/waitlist/reject), `set_cohort_application_notes`,
`assign_application_enrollment(application, enrollment)` (e-mail must match; sets
`enrollments.cohort_id`), `set_cohort_applications_open`, `mark_cohort_completed`,
`staff_cohort_stats`, `seed_default_cohort_questions`, `copy_cohort_questions`,
`import_cohort_applications(cohort, rows, dry_run)`, `send_cohort_start_reminder`.

Audit actions: `cohort_application.submitted|under_review|accepted|waitlisted|rejected|withdrawn|enrolled`,
`cohort.applications_opened|closed|completed|import_executed|start_reminder_sent`, plus the generic
`cohorts.insert|update|delete` from the admin-change trigger. Answers are never written to audit rows.

## E-mails (existing Resend outbox)

Templates `cohort_application_received`, `cohort_application_accepted`,
`cohort_application_waitlisted`, `cohort_application_rejected`, `cohort_enrollment_ready`,
`cohort_starting_soon` – rendered by `supabase/functions/email-dispatch`, sent from
`MCSLI <no-reply@mcsli.org>` with reply-to `info@mcsli.org`. They contain the reference, cohort and
next steps only – never application answers.

## Admin → Cohorts

Create/edit cohorts (all fields above, provenance sources), open/close applications, mark
completed, send the "starting soon" e-mail, manage application questions (add / edit / order /
deactivate, seed defaults, copy from another cohort), review applications (filters, detail with
answers – sensitive ones flagged – history, internal notes, decisions with confirmation, assign an
enrollment), export CSV (restricted answers excluded unless ticked), and the one-time Google Forms
import (paste the responses CSV → dry run → import; duplicates skipped, nothing accepted or
enrolled automatically).

## Google Forms → native

1. Leave the Google Form open only as a fallback (`fallback_form_url` shows a small link) until
   the native page is live; then clear the field.
2. In the Google Form: Responses → ⋮ → *Download responses (.csv)*.
3. Admin → Cohorts → the cohort → *Import (Google Forms)* → paste → **Dry run** → check counts and
   duplicates → get Jerome's go-ahead → *Import*. Imported applications are `submitted` with source
   `google_forms_import`; review them like native ones.

## Privacy

The public form collects only what the review needs. Gender and emergency-contact questions are
optional and flagged *restricted* (excluded from exports by default, not echoed back to applicants).
Identity numbers are never collected here – the existing encrypted identity-verification step
handles them after enrollment.

## Tests

`tests/db/cohorts.test.ts` (17 scenarios): public visibility, derived status, submission and
confirmation e-mail, verification link, duplicates/validation, delivery-mode rules, server-side
deadline and reopening, rate limiting, own-application isolation, pre-signup linking, review
workflow + audit + e-mails, enrollment integration (`cohort_id`, delivery mode), staff
assignment, cohort-scoped announcements, question edits vs. snapshots, completion/deletion
protection, stats, importer dry-run/duplicates. `src/domain/cohorts.test.ts` covers the status
helper.
