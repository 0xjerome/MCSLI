# Testing

| Command | What runs |
|---|---|
| `npm run lint` | ESLint 9 with typescript-eslint, react-hooks and jsx-a11y |
| `npm run typecheck` | `tsc --noEmit` against `tsconfig.app.json` |
| `npm test` | Vitest (jsdom): `src/domain/*.test.ts` business rules and `src/**/*.test.tsx` UI/auth flows |
| `npm run build` | typecheck + Vite production build |
| `npm run test:db` | Postgres integration tests in `tests/db` (needs `TEST_DATABASE_URL`) |

## Database integration tests

They recreate the schema from `supabase/migrations` on a real Postgres, apply the dev seed and
then act as different users by setting `request.jwt.claims` and `set role authenticated`,
exactly as PostgREST does. `tests/db/shim.sql` provides the minimal `auth`/`storage` schemas.

```bash
# any Postgres 15/16 works; no Docker or Supabase CLI required
initdb -D /tmp/pg && pg_ctl -D /tmp/pg -o "-p 5433" start
createdb -p 5433 mcsli_test
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/mcsli_test npm run test:db
```

## Visual checks

`docs/screenshots/` contains captures of the public site and the student/trainer/admin apps at
375 px and 1440 px produced with Playwright against a mocked Supabase API. Re-create them with
`npx vite build && npx vite preview` plus your own Playwright script; the app pages need either a
real Supabase project or request interception.
