# Architecture

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + TypeScript + Vite + Tailwind)                    │
│                                                                      │
│  Public website ─┐   Student app ─┐   Trainer app ─┐   Admin app ─┐  │
│  (/, /about …)   │   (/app/**)    │   (/trainer/**)│   (/admin/**)│  │
│                  ▼                ▼                ▼              ▼  │
│         shared design system · route guards · TanStack Query         │
│                          src/services/* (typed data access)          │
│                          src/domain/*   (pure business rules)        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ supabase-js (anon key + user JWT)
┌───────────────────────────────▼──────────────────────────────────────┐
│  Supabase                                                            │
│  • Postgres  – schema, RLS on every table, SECURITY DEFINER RPCs     │
│                that hold the progression / payment / assessment /    │
│                certificate rules (server-side enforcement)           │
│  • Auth      – email+password, e-mail verification, password reset   │
│  • Storage   – private buckets (identity-documents, payment-proofs,  │
│                course-media, lesson-resources, certificates)         │
│  • Edge Fns  – signed-URL brokers that authorise + audit access to   │
│                private documents (service role never reaches browser)│
└──────────────────────────────────────────────────────────────────────┘
```

## Principles

1. **Authorisation lives in the database.** Every table has RLS. Mutations that
   carry business meaning (confirming a payment, recording an assessment,
   overriding a month lock, issuing a certificate) are Postgres functions that
   re-check the caller's role and write an `audit_logs` row. The React app can
   only *ask*; the database decides.
2. **One source of truth for rules.** `src/domain/` contains pure, unit-tested
   TypeScript versions of the pricing and progression rules used for instant
   UI feedback. The authoritative implementation is `progression.sql` /
   `payments.sql`; integration tests run both against a real Postgres and
   assert they agree.
3. **Content is data.** Contact details, statistics, programmes, stories,
   announcements, payment instructions and fees are rows in `site_content`,
   `platform_settings`, `courses` and `payment_methods`, editable in
   `/admin/content` and `/admin/settings`. `src/content/defaults.ts` provides
   typed fallbacks so the public site renders even before Supabase is
   configured.
4. **Sensitive data is minimised.** Identification numbers are stored in a
   separate table that students can insert but not read back in full; the UI
   only ever receives a masked value (`****1234`) computed in SQL. Documents
   are in private buckets and are reached only through an audited Edge
   Function that issues short-lived signed URLs.
5. **Mobile-first, low-bandwidth.** Route-level code splitting, lazy media,
   no autoplay, `loading="lazy"` images, skeleton states, and small
   dependency footprint (no UI framework, no chart library).

## Folder layout

```
src/
  app/            router, providers, layouts, route guards
  components/ui/  design-system primitives (Button, Input, Dialog, DataTable …)
  components/     composite components (VideoPlayer, LockedCard, StatusBadge …)
  content/        typed default content + media manifest types
  domain/         pure business logic (pricing, progression, certificates, roles)
  features/       feature modules (auth, registration, identity, payments,
                  learning, practice, quizzes, assessments, exams, discussions,
                  progress, certificates, support, notifications, trainer, admin)
  lib/            supabase client, query client, formatting, SEO helpers
  pages/public/   public website pages
  services/       data-access functions (one file per aggregate)
  types/          generated-style Database types
supabase/
  migrations/     ordered SQL migrations (schema → policies → functions → storage)
  seed/           clearly labelled development seed
  functions/      Edge Functions (Deno)
tests/db/         Postgres integration tests (vitest + pg)
docs/             findings, architecture, security, operations
```

## Course progression (the most important rule)

```
month N is accessible ⇔
    enrollment.status = active
  ∧ financial gate:   required_paid_amount(N) ≤ confirmed_total
                      – full plan: registration fee + full tuition before month 1
                      – installments: registration + installment 1 before month 1,
                        installment 2 before the month configured as
                        `installment_2_due_before_month` (default 2)
  ∧ academic gate:    N = 1, or month N-1 has a PASSED assessment attempt,
                      or an active admin override exists for (enrollment, N)
```

`fn_month_access(enrollment_id, month_number)` returns `{allowed, reasons[]}`
and is used both by RLS (lessons/quizzes are unreadable when locked) and by the
UI to explain *why* something is locked.
