# Testing

| Command | What runs |
|---|---|
| `npm run lint` | ESLint 9 with typescript-eslint, react-hooks and jsx-a11y |
| `npm run typecheck` | `tsc --noEmit` against `tsconfig.app.json` |
| `npm test` | Vitest (jsdom): `src/domain/*.test.ts` business rules and `src/**/*.test.tsx` UI/auth flows |
| `npm run build` | typecheck + Vite production build |
| `npm run test:db` | Postgres integration tests in `tests/db` (needs `TEST_DATABASE_URL`): business rules + negative security tests |
| `npm run test:e2e` | End-to-end through the real Supabase HTTP APIs on the local stack (`npx supabase start`) |
| `npm run db:types` | Regenerate `src/types/supabase.generated.ts`; `src/types/schema-contract.ts` then fails typecheck on schema drift |

## Database integration tests

They recreate the schema from `supabase/migrations` on a real Postgres, apply the dev seed and
then act as different users by setting `request.jwt.claims` and `set role authenticated`,
exactly as PostgREST does. `tests/db/shim.sql` provides the minimal `auth`/`storage`/`vault`
schemas and installs pgcrypto in `extensions` with Supabase's search_path, so search_path bugs
that would only appear on hosted Supabase fail here too.

```bash
# any Postgres 15–17 works (e.g. docker run -e POSTGRES_HOST_AUTH_METHOD=trust -p 5433:5432 postgres:17-alpine)
initdb -D /tmp/pg && pg_ctl -D /tmp/pg -o "-p 5433" start
createdb -p 5433 mcsli_test
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/mcsli_test npm run test:db
```

## Visual checks

`docs/screenshots/` contains captures of the public site and the student/trainer/admin apps at
375 px and 1440 px produced with Playwright against a mocked Supabase API. Re-create them with
`npx vite build && npx vite preview` plus your own Playwright script; the app pages need either a
real Supabase project or request interception.

## End-to-end (real Supabase services)

```bash
npx supabase start          # Postgres 17, GoTrue, PostgREST, Storage, Edge Runtime, Mailpit
npm run test:e2e            # reads URL/keys from `supabase status`; confirmation and reset e-mails are read from Mailpit
```

Hosted staging/production: see docs/SUPABASE_SETUP.md §17 (`E2E_ALLOW_REMOTE=1`; creates `[TEST]`
records only, demotes and suspends its `[TEST]` staff accounts and unpublishes its course at the end).
