/**
 * Cohorts as public content + native cohort applications (migration 20260927140000).
 * Runs the real migrations on a real Postgres (see docs/TESTING.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { DEMO, asUser, confirmAllPayments, createUser, expectDenied, requireUrl, resetDatabase, type TestUser } from './helpers';

let client: pg.Client;
let admin: TestUser, trainer: TestUser, s1: TestUser, s2: TestUser;
let methodId: string;
let cohortId: string; // [TEST] Cohort 9 – published, hybrid, applications open
let hiddenId: string; // [TEST] Cohort 8 – unpublished

const rpc = async <T,>(user: TestUser | null, sql: string, params: unknown[] = [], ip = '203.0.113.10') =>
  asUser(client, user, async (q) => {
    await q(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-forwarded-for': ip })]);
    return (await q(sql, params)).rows[0]?.r as T;
  });
const rows = async (user: TestUser | null, sql: string, params: unknown[] = []) => asUser(client, user, async (q) => (await q(sql, params)).rows);
async function hidden(user: TestUser | null, sql: string, params: unknown[] = []) {
  try {
    return (await rows(user, sql, params)).length === 0;
  } catch (e) {
    return /permission denied/.test((e as Error).message);
  }
}
const baseAnswers = { age_group: '25 - 30 years', residence: 'Uganda, Kampala', nationality: 'Ugandan', heard_before: 'Yes', motivation: '[TEST] to communicate with Deaf colleagues', plans: '[TEST] volunteer as an interpreter' };
const apply = (user: TestUser | null, email: string, extra: Record<string, unknown> = {}, ip?: string, slug = 'cohort-9', mode = 'online') =>
  rpc<Receipt>(user, `select public.submit_cohort_application($1, $2, $3, $4, $5, $6::jsonb, true, null) as r`, [slug, extra.full_name ?? '[TEST] Applicant', email, extra.phone ?? '0701234567', mode, JSON.stringify({ ...baseAnswers, ...(extra.answers as object ?? {}) })], ip);
type Receipt = { application_id: string; reference: string; status: string; email_verification_required: boolean; cohort: { slug: string } };

async function activate(user: TestUser, cohort: string | null) {
  const id = await asUser(client, user, async (q) => (await q(`select public.enroll_in_course($1, 'full', $2) as id`, [DEMO.course, cohort])).rows[0].id as string);
  for (const [purpose, amount, inst] of [['registration', 20000, null], ['tuition', 350000, 1]] as const) {
    await asUser(client, user, (q) => q(`select public.submit_payment($1, $2, $3, $4, $5, 'Test Payer', $6, current_date, null)`, [id, purpose, inst, methodId, amount, 'REF-' + Math.random().toString(36).slice(2, 8)]));
  }
  await confirmAllPayments(client, admin, id);
  return id;
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: requireUrl() });
  await client.connect();
  await resetDatabase(client);
  admin = await createUser(client, 'co.admin@example.test', {}, 'ADMIN');
  trainer = await createUser(client, 'co.trainer@example.test', {}, 'TRAINER');
  s1 = await createUser(client, 'co.student.one@example.test', { nationality: 'ugandan', country: 'Uganda' });
  s2 = await createUser(client, 'co.student.two@example.test', { nationality: 'ugandan', country: 'Uganda' });
  await client.query(`insert into public.trainer_assignments (trainer_id, course_id, cohort_id) values ($1, $2, $3)`, [trainer.id, DEMO.course, DEMO.cohort]);
  methodId = (await client.query(`select id from public.payment_methods where method_type = 'mtn'`)).rows[0].id;
});

afterAll(async () => {
  await client?.end();
});

describe('cohorts as public content', () => {
  it('admins create cohorts; only published cohorts are visible to visitors, with derived status', async () => {
    cohortId = await asUser(client, admin, async (q) => (await q(
      `insert into public.cohorts (course_id, name, cohort_number, delivery_mode, is_open, is_published, is_featured, application_deadline, start_date, physical_location, registration_fee, tuition_online, tuition_physical, sources)
       values ($1, '[TEST] Cohort 9', 9, 'hybrid', true, true, true, now() + interval '7 days', current_date + 30, '[TEST] Kampala', 20000, 350000, 300000, '[{"label":"[TEST] announcement","url":"https://example.test/post"}]') returning id`, [DEMO.course])).rows[0].id as string);
    hiddenId = await asUser(client, admin, async (q) => (await q(`insert into public.cohorts (course_id, name, cohort_number, delivery_mode, is_open, is_published) values ($1, '[TEST] Cohort 8', 8, 'online', false, false) returning id`, [DEMO.course])).rows[0].id as string);
    expect(await rpc<number>(admin, `select public.seed_default_cohort_questions($1) as r`, [cohortId])).toBe(17);
    // students cannot create or edit cohorts, trainers cannot either
    expect(await expectDenied(rows(s1, `insert into public.cohorts (course_id, name) values ($1, '[TEST] rogue')`, [DEMO.course]))).toMatch(/row-level security|permission denied/);
    expect(await asUser(client, trainer, async (q) => (await q(`update public.cohorts set is_published = true where id = $1`, [hiddenId])).rowCount)).toBe(0);
    const pub = await rows(null, `select r->>'slug' as slug, r->>'phase' as phase, r->>'applications' as applications, (r->'course'->>'title') as course from public.public_cohorts() r`);
    expect(pub.map((c) => c.slug)).toContain('cohort-9');
    expect(pub.map((c) => c.slug)).not.toContain('cohort-8');
    expect(pub.find((c) => c.slug === 'cohort-9')).toMatchObject({ phase: 'upcoming', applications: 'open' });
    const one = await rpc<{ questions: { key: string; is_sensitive: boolean }[]; capacity: unknown; sources: unknown[] }>(null, `select public.public_cohort('cohort-9') as r`);
    expect(one.questions.length).toBe(17);
    expect(one.sources).toHaveLength(1);
    expect(await rpc(null, `select public.public_cohort('cohort-8') as r`)).toBeNull();
    // the table itself stays closed to visitors
    expect(await expectDenied(rows(null, `select id from public.cohorts`))).toMatch(/permission denied/);
    expect(await expectDenied(rows(null, `select id from public.cohort_questions`))).toMatch(/permission denied/);
    expect(await expectDenied(rows(null, `select id from public.cohort_applications`))).toMatch(/permission denied/);
  });

  it('derives current / upcoming / completed and applications open / closed from dates and overrides', async () => {
    const st = async (patch: string) => (await client.query(`select public.fn_cohort_phase(c) as phase, public.fn_cohort_applications_state(c) as apps from (select (c).* from (select c ${patch} as c from public.cohorts c where id = $1) x) c`, [cohortId])).rows[0];
    expect(await st('')).toEqual({ phase: 'upcoming', apps: 'open' });
    expect((await client.query(`select public.fn_cohort_phase(c) phase, public.fn_cohort_applications_state(c) apps from public.cohorts c where id = $1`, [hiddenId])).rows[0]).toEqual({ phase: 'upcoming', apps: 'closed' });
    await client.query(`update public.cohorts set start_date = current_date - 10, end_date = current_date + 60 where id = $1`, [hiddenId]);
    expect((await client.query(`select public.fn_cohort_phase(c) phase from public.cohorts c where id = $1`, [hiddenId])).rows[0].phase).toBe('in_progress');
    await client.query(`update public.cohorts set start_date = current_date - 100, end_date = current_date - 10 where id = $1`, [hiddenId]);
    expect((await client.query(`select public.fn_cohort_phase(c) phase, public.fn_cohort_applications_state(c) apps from public.cohorts c where id = $1`, [hiddenId])).rows[0]).toEqual({ phase: 'completed', apps: 'closed' });
    await client.query(`update public.cohorts set application_opens_at = now() + interval '1 day', start_date = null, end_date = null where id = $1`, [hiddenId]);
    expect((await client.query(`select public.fn_cohort_applications_state(c) apps from public.cohorts c where id = $1 and is_open`, [hiddenId])).rows[0]?.apps ?? 'closed').toBe('closed'); // is_open is false
    await client.query(`update public.cohorts set is_open = true where id = $1`, [hiddenId]);
    expect((await client.query(`select public.fn_cohort_applications_state(c) apps from public.cohorts c where id = $1`, [hiddenId])).rows[0].apps).toBe('opening_soon');
    await client.query(`update public.cohorts set application_opens_at = null, status_override = 'applications_closed' where id = $1`, [hiddenId]);
    expect((await client.query(`select public.fn_cohort_applications_state(c) apps from public.cohorts c where id = $1`, [hiddenId])).rows[0].apps).toBe('closed');
    await client.query(`update public.cohorts set status_override = null, is_open = false where id = $1`, [hiddenId]);
  });
});

describe('native applications', () => {
  let first: Receipt;
  let token: string;

  it('an open cohort accepts a visitor application: reference, snapshot, confirmation e-mail with a verification link', async () => {
    first = await apply(null, 'Applicant.One@Example.test', { answers: { gender: 'Prefer not to say', heard_about: ['WhatsApp', 'Other: [TEST] radio'] } });
    expect(first.reference).toMatch(/^MCSLI-C9-\d{4}-000001$/);
    expect(first.status).toBe('submitted');
    expect(first.email_verification_required).toBe(true);
    const row = (await client.query(`select email, phone, status, source, user_id, email_verified_at, verify_token_hash, answers from public.cohort_applications where id = $1`, [first.application_id])).rows[0];
    expect(row.email).toBe('applicant.one@example.test');
    expect(row.phone).toBe('+256701234567');
    expect(row.user_id).toBeNull();
    expect(row.verify_token_hash).toHaveLength(64);
    expect(row.answers.find((a: { key: string }) => a.key === 'gender')).toMatchObject({ label: 'Gender', sensitive: true, answer: 'Prefer not to say' });
    expect(row.answers.find((a: { key: string }) => a.key === 'attendance')).toMatchObject({ type: 'delivery_mode', answer: 'online' });
    const mail = (await client.query(`select template, subject, to_email, payload from public.email_outbox where entity_id = $1 order by created_at`, [first.application_id])).rows;
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ template: 'cohort_application_received', to_email: 'applicant.one@example.test' });
    expect(mail[0].subject).toContain(first.reference);
    expect(JSON.stringify(mail[0].payload)).not.toContain('[TEST] to communicate'); // no answers in e-mails
    token = mail[0].payload.verify_token;
    expect(token).toHaveLength(48);
    const events = (await client.query(`select to_status from public.cohort_application_events where application_id = $1`, [first.application_id])).rows;
    expect(events).toEqual([{ to_status: 'submitted' }]);
    expect((await client.query(`select count(*)::int n from public.audit_logs where action = 'cohort_application.submitted' and entity_id = $1`, [first.application_id])).rows[0].n).toBe(1);
  });

  it('the verification link works once', async () => {
    const v = await rpc<{ reference: string }>(null, `select public.verify_cohort_application($1) as r`, [token]);
    expect(v.reference).toBe(first.reference);
    expect((await client.query(`select email_verified_at is not null as v, verify_token_hash from public.cohort_applications where id = $1`, [first.application_id])).rows[0]).toEqual({ v: true, verify_token_hash: null });
    expect(await expectDenied(rpc(null, `select public.verify_cohort_application($1) as r`, [token]))).toMatch(/not valid/);
    expect(await expectDenied(rpc(null, `select public.verify_cohort_application('nope') as r`))).toMatch(/not valid/);
  });

  it('duplicates are blocked safely (case-insensitive e-mail), required questions and choices are validated', async () => {
    expect(await expectDenied(apply(null, 'APPLICANT.ONE@example.test'))).toMatch(/already exists/);
    expect(await expectDenied(apply(null, 'two@example.test', { answers: { motivation: '' } }))).toMatch(/Please answer "Why do you want to learn Sign Language\?"/);
    expect(await expectDenied(apply(null, 'two@example.test', { answers: { age_group: '99' } }))).toMatch(/Invalid choice/);
    expect(await expectDenied(apply(null, 'two@example.test', { phone: '12' }))).toMatch(/valid phone/);
    expect(await expectDenied(apply(null, 'not-an-email'))).toMatch(/valid e-mail/);
    expect(await expectDenied(rpc(null, `select public.submit_cohort_application('cohort-9', '[TEST] Bot', 'bot@example.test', '0701234567', 'online', '{}'::jsonb, true, 'http://spam') as r`))).toMatch(/Spam check/);
    expect(await expectDenied(rpc(null, `select public.submit_cohort_application('cohort-9', '[TEST] No consent', 'noconsent@example.test', '0701234567', 'online', $1::jsonb, false, null) as r`, [JSON.stringify(baseAnswers)]))).toMatch(/declaration/);
    expect((await client.query(`select count(*)::int n from public.cohort_applications where cohort_id = $1`, [cohortId])).rows[0].n).toBe(1);
  });

  it('delivery mode is validated: hybrid cohorts accept any mode, online-only cohorts refuse physical, unknown values fail', async () => {
    expect(await expectDenied(apply(null, 'three@example.test', {}, undefined, 'cohort-9', 'saturday'))).toMatch(/Choose how you want to attend/);
    await client.query(`update public.cohorts set is_published = true, is_open = true, status_override = null where id = $1`, [hiddenId]);
    expect(await expectDenied(apply(null, 'three@example.test', {}, undefined, 'cohort-8', 'physical'))).toMatch(/online only/);
    const ok = await apply(null, 'three@example.test', {}, undefined, 'cohort-8', 'online');
    expect(ok.reference).toMatch(/^MCSLI-C8-/);
    await client.query(`update public.cohorts set is_published = false, is_open = false where id = $1`, [hiddenId]);
  });

  it('deadlines are enforced server-side; staff can reopen explicitly', async () => {
    await client.query(`update public.cohorts set application_deadline = now() - interval '1 minute' where id = $1`, [cohortId]);
    expect(await expectDenied(apply(null, 'late@example.test'))).toMatch(/closed/);
    expect((await rows(null, `select r->>'applications' as a from public.public_cohorts() r where r->>'slug' = 'cohort-9'`))[0].a).toBe('closed');
    await rpc(admin, `select public.set_cohort_applications_open($1, true) as r`, [cohortId]); // clears overrides; deadline still applies
    expect(await expectDenied(apply(null, 'late@example.test'))).toMatch(/closed/);
    await client.query(`update public.cohorts set status_override = 'applications_open' where id = $1`, [cohortId]);
    const reopened = await apply(null, 'late@example.test');
    expect(reopened.reference).toMatch(/000002$/);
    await client.query(`update public.cohorts set status_override = null, application_deadline = now() + interval '7 days' where id = $1`, [cohortId]);
    expect(await expectDenied(rpc(s1, `select public.set_cohort_applications_open($1, false) as r`, [cohortId]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(trainer, `select public.set_cohort_applications_open($1, false) as r`, [cohortId]))).toMatch(/not authorised/);
  });

  it('rate limits application flooding per connection', async () => {
    for (let i = 1; i <= 3; i++) await apply(null, `flood${i}@example.test`, {}, '198.51.100.7');
    // 5 per hour per fingerprint: two earlier submissions from the default IP do not count for this one
    const sixth = await expectDenied((async () => {
      await apply(null, 'flood4@example.test', {}, '198.51.100.7');
      await apply(null, 'flood5@example.test', {}, '198.51.100.7');
      await apply(null, 'flood6@example.test', {}, '198.51.100.7');
    })());
    expect(sixth).toMatch(/Too many applications/);
    expect((await client.query(`select count(*)::int n from public.cohort_applications where email like 'flood%'`)).rows[0].n).toBe(5);
  });

  it('a signed-in applicant is linked to their account and can read only their own application; anon and other students see nothing', async () => {
    const mine = await apply(s1, s1.email, { full_name: '[TEST] Student One' });
    expect(mine.email_verification_required).toBe(false);
    expect((await client.query(`select user_id, email_verified_at is not null v from public.cohort_applications where id = $1`, [mine.application_id])).rows[0]).toEqual({ user_id: s1.id, v: true });
    expect(await expectDenied(apply(s1, 'another@example.test'))).toMatch(/already applied/);
    const own = await rows(s1, `select r->>'reference' as reference, r->>'status' as status, r->'cohort'->>'slug' as slug, r->'answers' as answers from public.my_cohort_applications() r`);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ reference: mine.reference, status: 'submitted', slug: 'cohort-9' });
    expect((own[0].answers as { key: string }[]).some((a) => a.key === 'gender')).toBe(false); // sensitive answers are not echoed back
    expect(await rows(s2, `select * from public.my_cohort_applications()`)).toHaveLength(0);
    expect(await hidden(s1, `select id from public.cohort_applications`)).toBe(true);
    expect(await hidden(s2, `select id from public.cohort_applications where id = $1`, [mine.application_id])).toBe(true);
    expect(await hidden(s1, `select id from public.cohort_application_events`)).toBe(true);
    expect(await expectDenied(rows(null, `select * from public.my_cohort_applications()`))).toMatch(/not authenticated|permission denied/);
    expect(await expectDenied(rows(null, `select internal_notes from public.cohort_applications`))).toMatch(/permission denied/);
  });

  it('an application made before sign-up is linked when the account is created', async () => {
    const late = (await client.query(`select id from public.cohort_applications where email = 'late@example.test'`)).rows[0].id;
    const lateUser = await createUser(client, 'late@example.test', { nationality: 'ugandan' });
    expect((await client.query(`select user_id from public.cohort_applications where id = $1`, [late])).rows[0].user_id).toBe(lateUser.id);
    expect(await rows(lateUser, `select r->>'reference' as reference from public.my_cohort_applications() r`)).toHaveLength(1);
  });

  it('students cannot accept themselves or edit applications; admins review with an audited history and e-mails', async () => {
    const mine = (await client.query(`select id from public.cohort_applications where user_id = $1`, [s1.id])).rows[0].id;
    expect(await expectDenied(rpc(s1, `select public.review_cohort_application($1, 'accept', null) as r`, [mine]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(trainer, `select public.review_cohort_application($1, 'accept', null) as r`, [mine]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(s1, `update public.cohort_applications set status = 'accepted' where id = $1`, [mine]))).toMatch(/permission denied|row-level security/);
    await rpc(admin, `select public.review_cohort_application($1, 'review', null) as r`, [mine]);
    await rpc(admin, `select public.review_cohort_application($1, 'waitlist', '[TEST] full for now') as r`, [mine]);
    await rpc(admin, `select public.review_cohort_application($1, 'accept', '[TEST] a place opened') as r`, [mine]);
    const row = (await client.query(`select status, reviewed_by, reviewed_at from public.cohort_applications where id = $1`, [mine])).rows[0];
    expect(row).toMatchObject({ status: 'accepted', reviewed_by: admin.id });
    expect(row.reviewed_at).not.toBeNull();
    const events = (await client.query(`select from_status, to_status, actor_id from public.cohort_application_events where application_id = $1 order by created_at`, [mine])).rows;
    expect(events.map((e) => e.to_status)).toEqual(['submitted', 'under_review', 'waitlisted', 'accepted']);
    expect(events.slice(1).every((e) => e.actor_id === admin.id)).toBe(true);
    const mails = (await client.query(`select template from public.email_outbox where entity_id = $1 order by created_at`, [mine])).rows.map((m) => m.template);
    expect(mails).toEqual(['cohort_application_received', 'cohort_application_waitlisted', 'cohort_application_accepted']);
    const audit = (await client.query(`select action from public.audit_logs where entity_type = 'cohort_application' and entity_id = $1 order by created_at`, [mine])).rows.map((a) => a.action);
    expect(audit).toEqual(['cohort_application.submitted', 'cohort_application.under_review', 'cohort_application.waitlisted', 'cohort_application.accepted']);
    await rpc(admin, `select public.set_cohort_application_notes($1, '[TEST] internal note') as r`, [mine]);
    expect(await expectDenied(rpc(s1, `select public.set_cohort_application_notes($1, 'x') as r`, [mine]))).toMatch(/not authorised/);
    // reject/reopen on another applicant
    const other = (await client.query(`select id from public.cohort_applications where email = 'flood1@example.test'`)).rows[0].id;
    await rpc(admin, `select public.review_cohort_application($1, 'reject', null) as r`, [other]);
    expect((await client.query(`select status from public.cohort_applications where id = $1`, [other])).rows[0].status).toBe('rejected');
    await rpc(admin, `select public.review_cohort_application($1, 'reopen', null) as r`, [other]);
    expect((await client.query(`select status from public.cohort_applications where id = $1`, [other])).rows[0].status).toBe('submitted');
  });

  it('the accepted applicant enrolls with the cohort pre-selected even after the deadline; others cannot; cohort_id and delivery mode carry over', async () => {
    await client.query(`update public.cohorts set application_deadline = now() - interval '1 hour' where id = $1`, [cohortId]);
    const enrollable = await rows(s1, `select r->>'slug' as slug, (r->>'accepted')::boolean as accepted from public.my_enrollable_cohorts($1) r`, [DEMO.course]);
    expect(enrollable).toEqual(expect.arrayContaining([{ slug: 'cohort-9', accepted: true }]));
    expect((await rows(s2, `select r->>'slug' as slug from public.my_enrollable_cohorts($1) r`, [DEMO.course])).map((r) => r.slug)).not.toContain('cohort-9');
    expect(await expectDenied(asUser(client, s2, (q) => q(`select public.enroll_in_course($1, 'full', $2)`, [DEMO.course, cohortId])))).toMatch(/cohort not open/);
    const enrollmentId = await activate(s1, cohortId);
    const e = (await client.query(`select cohort_id, delivery_mode, status from public.enrollments where id = $1`, [enrollmentId])).rows[0];
    expect(e).toMatchObject({ cohort_id: cohortId, delivery_mode: 'online', status: 'active' });
    const app = (await client.query(`select enrollment_id, status from public.cohort_applications where user_id = $1`, [s1.id])).rows[0];
    expect(app).toEqual({ enrollment_id: enrollmentId, status: 'accepted' });
    expect((await client.query(`select count(*)::int n from public.audit_logs where action = 'cohort_application.enrolled'`)).rows[0].n).toBe(1);
    // once enrolled, the application cannot be rejected by mistake
    expect(await expectDenied(rpc(admin, `select public.review_cohort_application($1, 'reject', null) as r`, [(await client.query(`select id from public.cohort_applications where user_id = $1`, [s1.id])).rows[0].id]))).toMatch(/already enrolled/);
    await client.query(`update public.cohorts set application_deadline = now() + interval '7 days' where id = $1`, [cohortId]);
  });

  it('staff can assign an existing enrollment to a cohort for an accepted applicant (e-mail must match)', async () => {
    const other = await createUser(client, 'assign.me@example.test', { nationality: 'ugandan' });
    const app = await apply(other, other.email);
    await rpc(admin, `select public.review_cohort_application($1, 'accept', null) as r`, [app.application_id]);
    const enrollmentId = await activate(other, null);
    const stranger = await activate(s2, null);
    expect(await expectDenied(rpc(admin, `select public.assign_application_enrollment($1, $2) as r`, [app.application_id, stranger]))).toMatch(/different person/);
    expect(await expectDenied(rpc(s2, `select public.assign_application_enrollment($1, $2) as r`, [app.application_id, enrollmentId]))).toMatch(/not authorised/);
    await rpc(admin, `select public.assign_application_enrollment($1, $2) as r`, [app.application_id, enrollmentId]);
    expect((await client.query(`select cohort_id, delivery_mode from public.enrollments where id = $1`, [enrollmentId])).rows[0]).toEqual({ cohort_id: cohortId, delivery_mode: 'online' });
    expect((await client.query(`select template from public.email_outbox where entity_id = $1 order by created_at desc limit 1`, [app.application_id])).rows[0].template).toBe('cohort_enrollment_ready');
  });

  it('cohort-scoped announcements reach only that cohort; course-wide ones reach everyone', async () => {
    const scoped = await asUser(client, admin, async (q) => (await q(`insert into public.discussion_threads (course_id, cohort_id, author_id, title, body, is_announcement) values ($1, $2, $3, '[TEST] Saturday class starts at 9:00', 'Cohort 9 only', true) returning id`, [DEMO.course, cohortId, admin.id])).rows[0].id);
    const wide = await asUser(client, admin, async (q) => (await q(`insert into public.discussion_threads (course_id, author_id, title, body, is_announcement) values ($1, $2, '[TEST] Everyone', 'Whole course', true) returning id`, [DEMO.course, admin.id])).rows[0].id);
    expect((await rows(s1, `select id from public.discussion_threads where id in ($1, $2)`, [scoped, wide])).map((r) => r.id).sort()).toEqual([scoped, wide].sort());
    expect((await rows(s2, `select id from public.discussion_threads where id in ($1, $2)`, [scoped, wide])).map((r) => r.id)).toEqual([wide]);
    expect((await client.query(`select count(*)::int n from public.notifications where link = '/app/discussions/' || $1`, [scoped])).rows[0].n).toBe(2); // s1 + the assigned applicant
    expect((await client.query(`select count(*)::int n from public.notifications where link = '/app/discussions/' || $1 and user_id = $2`, [scoped, s2.id])).rows[0].n).toBe(0);
  });

  it('question changes never corrupt submitted applications; applications survive cohort completion; cohorts with applications cannot be deleted', async () => {
    const before = (await client.query(`select answers from public.cohort_applications where id = $1`, [first.application_id])).rows[0].answers;
    await asUser(client, admin, (q) => q(`update public.cohort_questions set label = '[TEST] renamed', is_active = false where cohort_id = $1 and key = 'motivation'`, [cohortId]));
    await asUser(client, admin, (q) => q(`delete from public.cohort_questions where cohort_id = $1 and key = 'plans'`, [cohortId]));
    expect((await client.query(`select answers from public.cohort_applications where id = $1`, [first.application_id])).rows[0].answers).toEqual(before);
    expect((await rpc<{ questions: { key: string }[] }>(null, `select public.public_cohort('cohort-9') as r`)).questions.map((q) => q.key)).not.toContain('motivation');
    await rpc(admin, `select public.mark_cohort_completed($1, '[TEST] summary', 12) as r`, [cohortId]);
    expect((await client.query(`select status_override, is_open, verified_participant_count from public.cohorts where id = $1`, [cohortId])).rows[0]).toEqual({ status_override: 'completed', is_open: false, verified_participant_count: 12 });
    expect((await rows(null, `select r->>'phase' as phase from public.public_cohorts() r where r->>'slug' = 'cohort-9'`))[0].phase).toBe('completed');
    expect(await expectDenied(apply(null, 'after@example.test', {}, '203.0.113.99'))).toMatch(/closed/);
    expect((await client.query(`select count(*)::int n from public.cohort_applications where cohort_id = $1`, [cohortId])).rows[0].n).toBeGreaterThanOrEqual(8);
    expect(await expectDenied(asUser(client, admin, (q) => q(`delete from public.cohorts where id = $1`, [cohortId])))).toMatch(/violates foreign key|still referenced/);
    await client.query(`update public.cohorts set status_override = null, is_open = true where id = $1`, [cohortId]);
  });

  it('stats reflect real data only', async () => {
    const s = await rpc<Record<string, number>>(admin, `select public.staff_cohort_stats($1) as r`, [cohortId]);
    expect(s.applications).toBeGreaterThanOrEqual(8);
    expect(s.accepted).toBe(2);
    expect(s.enrolled).toBe(2);
    expect(s.enrollments).toBe(2);
    expect(s.enrolled_online).toBe(2);
    expect(s.payment_confirmed).toBe(2);
    expect(await expectDenied(rpc(s1, `select public.staff_cohort_stats($1) as r`, [cohortId]))).toMatch(/not authorised/);
  });

  it('legacy import: dry run reports duplicates and invalid rows without writing; the real import never accepts or enrolls', async () => {
    const fileRows = [
      { full_name: '[TEST] Imported One', email: 'imported.one@example.test', phone: '0772 000 111', delivery_mode: 'physical', submitted_at: '2026-06-01T10:00:00Z', external_ref: 'gforms:1', answers: { 'Age group': '25 - 30 years', 'Why do you want to learn Sign Language?': '[TEST] work' } },
      { full_name: '[TEST] Dup Of Native', email: 'Applicant.One@example.test', delivery_mode: 'online', external_ref: 'gforms:2' },
      { full_name: '[TEST] Imported One again', email: 'imported.one@example.test', delivery_mode: 'online', external_ref: 'gforms:3' },
      { full_name: 'X', email: 'bad', delivery_mode: 'online' },
      { full_name: '[TEST] Imported Two', email: 'imported.two@example.test', delivery_mode: 'saturday', external_ref: 'gforms:4' },
    ];
    expect(await expectDenied(rpc(s1, `select public.import_cohort_applications($1, $2::jsonb, true) as r`, [cohortId, JSON.stringify(fileRows)]))).toMatch(/not authorised/);
    const dry = await rpc<{ dry_run: boolean; rows: number; importable: number; imported: number; duplicates: { email: string }[]; invalid: { row: number; reason: string }[] }>(admin, `select public.import_cohort_applications($1, $2::jsonb, true) as r`, [cohortId, JSON.stringify(fileRows)]);
    expect(dry).toMatchObject({ dry_run: true, rows: 5, importable: 1, imported: 0 });
    expect(dry.duplicates.map((d) => d.email)).toEqual(['applicant.one@example.test', 'imported.one@example.test']);
    expect(dry.invalid.map((i) => i.row)).toEqual([4, 5]);
    expect((await client.query(`select count(*)::int n from public.cohort_applications where source = 'google_forms_import'`)).rows[0].n).toBe(0);
    const real = await rpc<{ imported: number }>(admin, `select public.import_cohort_applications($1, $2::jsonb, false) as r`, [cohortId, JSON.stringify(fileRows)]);
    expect(real.imported).toBe(1);
    const imported = (await client.query(`select status, source, enrollment_id, email_verified_at, phone, submitted_at, answers from public.cohort_applications where source = 'google_forms_import'`)).rows;
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ status: 'submitted', source: 'google_forms_import', enrollment_id: null, email_verified_at: null, phone: '+256772000111' });
    expect(new Date(imported[0].submitted_at).toISOString()).toBe('2026-06-01T10:00:00.000Z');
    expect(imported[0].answers).toHaveLength(2);
    const again = await rpc<{ importable: number; duplicates: unknown[] }>(admin, `select public.import_cohort_applications($1, $2::jsonb, true) as r`, [cohortId, JSON.stringify(fileRows)]);
    expect(again.importable).toBe(0);
    expect(again.duplicates).toHaveLength(3);
    expect((await client.query(`select count(*)::int n from public.audit_logs where action = 'cohort.import_executed'`)).rows[0].n).toBe(3);
    expect((await client.query(`select count(*)::int n from public.email_outbox where template = 'cohort_application_received' and to_email like 'imported.%'`)).rows[0].n).toBe(0);
  });
});
