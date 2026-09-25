/**
 * Negative security tests: every attack path found in the RLS audit (migration 0008–0010)
 * plus the explicit bypass attempts from the production-readiness checklist.
 * Runs the real migrations on a real Postgres (see docs/TESTING.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { DEMO, asUser, confirmAllPayments, createUser, expectDenied, requireUrl, resetDatabase, type TestUser } from './helpers';

let client: pg.Client;
let alice: TestUser; // student (Ugandan, installments)
let bob: TestUser; // student (Ugandan, full)
let trainer: TestUser; // assigned to the demo course
let outsider: TestUser; // trainer with no assignment
let admin: TestUser;
let superAdmin: TestUser;
let aliceEnrollment: string;
let bobEnrollment: string;
let methodId: string;

const rows = async (user: TestUser | null, sql: string, params: unknown[] = []) => asUser(client, user, async (q) => (await q(sql, params)).rows);

async function enrollAndPay(user: TestUser, plan: 'full' | 'installments', tuition: number) {
  const id = await asUser(client, user, async (q) => (await q(`select public.enroll_in_course($1, $2, $3) as id`, [DEMO.course, plan, DEMO.cohort])).rows[0].id as string);
  await asUser(client, user, (q) => q(`select public.submit_payment($1, 'registration', null, $2, 20000, 'Payer', 'REF-REG-1', current_date, null)`, [id, methodId]));
  await asUser(client, user, (q) => q(`select public.submit_payment($1, 'tuition', 1, $2, $3, 'Payer', 'REF-TUI-1', current_date, null)`, [id, methodId, tuition]));
  await confirmAllPayments(client, admin, id);
  return id;
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: requireUrl() });
  await client.connect();
  await resetDatabase(client);
  alice = await createUser(client, 'alice@example.test', { nationality: 'ugandan' });
  bob = await createUser(client, 'bob@example.test', { nationality: 'ugandan' });
  trainer = await createUser(client, 'trainer@example.test', {}, 'TRAINER');
  outsider = await createUser(client, 'outsider@example.test', {}, 'TRAINER');
  admin = await createUser(client, 'admin@example.test', {}, 'ADMIN');
  superAdmin = await createUser(client, 'super@example.test', {}, 'SUPER_ADMIN');
  await client.query(`insert into public.trainer_assignments (trainer_id, course_id, cohort_id) values ($1, $2, $3)`, [trainer.id, DEMO.course, DEMO.cohort]);
  methodId = (await client.query(`select id from public.payment_methods where method_type = 'mtn'`)).rows[0].id;
  aliceEnrollment = await enrollAndPay(alice, 'installments', 175000);
  bobEnrollment = await enrollAndPay(bob, 'full', 350000);
});

afterAll(async () => {
  await client?.end();
});

describe('internal functions are not callable through the API', () => {
  it('students cannot forge notifications or audit entries', async () => {
    expect(await expectDenied(rows(alice, `select public.fn_notify($1, 'payment_confirmed', 'Payment confirmed', 'fake')`, [bob.id]))).toMatch(/permission denied/);
    expect(await expectDenied(rows(alice, `select public.fn_audit('payment.confirmed', 'payment', 'x')`))).toMatch(/permission denied/);
    expect(await expectDenied(rows(alice, `insert into public.notifications (user_id, type, title) values ($1, 'system', 'MCSLI: send your PIN')`, [bob.id]))).toMatch(/permission denied|row-level security/);
  });

  it("students cannot read another student's payment totals or lock state", async () => {
    expect(await expectDenied(rows(alice, `select * from public.fn_confirmed_totals($1)`, [bobEnrollment]))).toMatch(/permission denied/);
    expect(await expectDenied(rows(alice, `select public.fn_month_access($1, 1)`, [bobEnrollment]))).toMatch(/permission denied/);
    expect(await expectDenied(rows(alice, `select public.get_my_course_map($1)`, [bobEnrollment]))).toMatch(/not authorised/);
  });

  it('anonymous callers cannot use protected RPCs', async () => {
    for (const sql of [
      `select public.enroll_in_course('${DEMO.course}', 'full')`,
      `select public.review_payment(gen_random_uuid(), 'confirmed')`,
      `select public.admin_dashboard_stats()`,
      `select public.admin_reveal_identity_number(gen_random_uuid())`,
      `select public.issue_certificate(gen_random_uuid())`,
    ]) {
      expect(await expectDenied(rows(null, sql))).toMatch(/permission denied|not authorised|not authenticated/);
    }
  });
});

describe('profiles and roles', () => {
  it("a student cannot read another student's profile or the directory of all users", async () => {
    expect(await rows(alice, `select id from public.profiles where id = $1`, [bob.id])).toHaveLength(0);
    // classmates appear by name only; anonymous callers see nobody
    const dir = await rows(alice, `select * from public.public_profiles where id = $1`, [bob.id]);
    expect(Object.keys(dir[0]).sort()).toEqual(['avatar_path', 'full_name', 'id', 'role']);
    expect(await expectDenied(rows(null, `select * from public.public_profiles`))).toMatch(/permission denied/);
  });

  it('trainers see only students of their assigned courses', async () => {
    expect(await rows(trainer, `select id from public.profiles where id = $1`, [alice.id])).toHaveLength(1);
    expect(await rows(outsider, `select id from public.profiles where id = $1`, [alice.id])).toHaveLength(0);
    expect(await rows(outsider, `select id from public.enrollments`)).toHaveLength(0);
    expect(await rows(outsider, `select id from public.payments`)).toHaveLength(0);
  });

  it('nobody can promote themselves; a signup cannot choose its role', async () => {
    expect(await expectDenied(rows(alice, `update public.profiles set role = 'SUPER_ADMIN' where id = $1`, [alice.id]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(trainer, `update public.profiles set role = 'ADMIN' where id = $1`, [trainer.id]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(alice, `select public.admin_set_user_role($1, 'ADMIN')`, [alice.id]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(admin, `select public.admin_set_user_role($1, 'SUPER_ADMIN')`, [admin.id]))).toMatch(/not authorised|cannot change your own role|only a super admin/);
    // metadata sent by a manipulated sign-up form is ignored for authorisation
    const sneaky = await createUser(client, 'sneaky@example.test', { role: 'ADMIN', nationality: 'ugandan' } as Record<string, string>);
    expect((await client.query(`select role from public.profiles where id = $1`, [sneaky.id])).rows[0].role).toBe('STUDENT');
  });

  it('a suspended admin loses every privilege immediately', async () => {
    const temp = await createUser(client, 'temp.admin@example.test', {}, 'ADMIN');
    expect(await rows(temp, `select public.is_admin() as a`)).toEqual([{ a: true }]);
    await asUser(client, superAdmin, (q) => q(`select public.admin_set_account_status($1, 'suspended', 'left MCSLI')`, [temp.id]));
    expect(await rows(temp, `select public.is_admin() as a`)).toEqual([{ a: false }]);
    expect(await expectDenied(rows(temp, `select public.admin_dashboard_stats()`))).toMatch(/not authorised/);
    expect(await rows(temp, `select id from public.payments`)).toHaveLength(0);
  });

  it('a demoted trainer keeps no access through old assignments', async () => {
    const t2 = await createUser(client, 'former.trainer@example.test', {}, 'TRAINER');
    await client.query(`insert into public.trainer_assignments (trainer_id, course_id) values ($1, $2)`, [t2.id, DEMO.course]);
    expect(await rows(t2, `select id from public.enrollments`)).not.toHaveLength(0);
    await asUser(client, admin, (q) => q(`select public.admin_set_user_role($1, 'STUDENT')`, [t2.id]));
    expect(await rows(t2, `select id from public.enrollments`)).toHaveLength(0);
  });

  it('admins cannot act on super admins; nobody changes their own role; bootstrap works once and only from SQL', async () => {
    expect(await expectDenied(rows(admin, `select public.admin_set_user_role($1, 'STUDENT')`, [superAdmin.id]))).toMatch(/only a super admin/);
    expect(await expectDenied(rows(admin, `select public.admin_set_account_status($1, 'suspended')`, [superAdmin.id]))).toMatch(/only a super admin/);
    expect(await expectDenied(rows(admin, `update public.profiles set account_status = 'suspended' where id = $1`, [superAdmin.id]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(superAdmin, `select public.admin_set_user_role($1, 'STUDENT')`, [superAdmin.id]))).toMatch(/own role/);
    // bootstrap: refused through the API, and once a super admin exists
    expect(await expectDenied(rows(alice, `select public.bootstrap_super_admin('alice@example.test')`))).toMatch(/permission denied|direct database session/);
    expect(await expectDenied(client.query(`select public.bootstrap_super_admin('alice@example.test')`))).toMatch(/already exists/);
  });
});

describe('payments', () => {
  it('a student cannot mark their own payment confirmed or read other payments', async () => {
    const pid = await asUser(client, alice, async (q) => (await q(`select public.submit_payment($1, 'tuition', 2, $2, 175000, 'Alice', 'REF-TUI-2', current_date, null) as id`, [aliceEnrollment, methodId])).rows[0].id);
    expect(await asUser(client, alice, async (q) => (await q(`update public.payments set status = 'confirmed' where id = $1`, [pid])).rowCount)).toBe(0);
    expect(await expectDenied(rows(alice, `select public.review_payment($1, 'confirmed')`, [pid]))).toMatch(/not authorised/);
    expect(await rows(bob, `select id from public.payments where user_id = $1`, [alice.id])).toHaveLength(0);
    // a proof path pointing into someone else's folder is refused
    expect(await expectDenied(rows(alice, `select public.submit_payment($1, 'tuition', 2, $2, 1000, 'Alice', 'REF-X', current_date, $3)`, [aliceEnrollment, methodId, `payment-proofs/${bob.id}/r.pdf`]))).toMatch(/invalid proof path/);
    // disabled / unconfigured methods cannot be used
    const disabled = (await client.query(`update public.payment_methods set is_enabled = false where method_type = 'bank' returning id`)).rows[0].id;
    expect(await expectDenied(rows(alice, `select public.submit_payment($1, 'tuition', 2, $2, 1000, 'Alice', 'REF-Y', current_date, null)`, [aliceEnrollment, disabled]))).toMatch(/not available/);
  });

  it('"Registration open = off" blocks new enrollments server-side; existing ones continue', async () => {
    const late = await createUser(client, 'late@example.test', { nationality: 'ugandan' });
    expect(await expectDenied(rows(admin, `select public.set_platform_setting('registration_open', 'false'::jsonb)`))).toMatch(/only a super admin/);
    await asUser(client, superAdmin, (q) => q(`select public.set_platform_setting('registration_open', 'false'::jsonb)`));
    expect(await expectDenied(rows(late, `select public.enroll_in_course($1, 'full')`, [DEMO.course]))).toMatch(/Enrollment is currently closed/);
    expect(await rows(alice, `select id from public.enrollments where id = $1`, [aliceEnrollment])).toHaveLength(1);
    await asUser(client, superAdmin, (q) => q(`select public.set_platform_setting('registration_open', 'true'::jsonb)`));
    expect(await rows(late, `select public.enroll_in_course($1, 'full') as id`, [DEMO.course])).toHaveLength(1);
  });

  it('the fee snapshot cannot be altered by the student and later price changes do not apply retroactively', async () => {
    expect(await asUser(client, alice, async (q) => (await q(`update public.enrollments set tuition_amount = 1 where id = $1`, [aliceEnrollment])).rowCount)).toBe(0);
    await asUser(client, admin, (q) => q(`update public.courses set tuition_national = 500000 where id = $1`, [DEMO.course]));
    expect(Number((await client.query(`select tuition_amount from public.enrollments where id = $1`, [aliceEnrollment])).rows[0].tuition_amount)).toBe(350000);
    const audit = await client.query(`select metadata from public.audit_logs where action = 'courses.update' order by id desc limit 1`);
    expect(audit.rows[0].metadata.tuition_national).toBe(500000);
    await asUser(client, admin, (q) => q(`update public.courses set tuition_national = 350000 where id = $1`, [DEMO.course]));
  });
});

describe('assessments, locked content and certificates', () => {
  it('a student cannot alter an assessment result or unlock a month', async () => {
    const aid = await asUser(client, trainer, async (q) => (await q(`select public.schedule_assessment($1, $2, now()) as id`, [aliceEnrollment, DEMO.month1])).rows[0].id);
    await asUser(client, trainer, (q) => q(`select public.record_assessment_result($1, 40, 'not_passed', 'Needs practice')`, [aid]));
    expect(await asUser(client, alice, async (q) => (await q(`update public.assessment_attempts set result = 'pass' where enrollment_id = $1`, [aliceEnrollment])).rowCount)).toBe(0);
    expect(await expectDenied(rows(alice, `insert into public.assessment_attempts (assessment_id, enrollment_id, month_id, attempt_number, result, assessed_by) values ($1, $2, $3, 9, 'pass', $4)`, [aid, aliceEnrollment, DEMO.month1, alice.id]))).toMatch(/row-level security|permission denied/);
    expect(await expectDenied(rows(alice, `select public.record_assessment_result($1, 100, 'pass')`, [aid]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(alice, `insert into public.month_overrides (enrollment_id, month_id, reason, created_by) values ($1, $2, 'I unlock myself please', $3)`, [aliceEnrollment, DEMO.month2, alice.id]))).toMatch(/row-level security|permission denied/);
    expect(await expectDenied(rows(alice, `select public.override_month_unlock($1, $2, 'I unlock myself please')`, [aliceEnrollment, DEMO.month2]))).toMatch(/not authorised/);
    // every attempt stays visible to the student
    expect(await rows(alice, `select result from public.assessment_attempts where enrollment_id = $1`, [aliceEnrollment])).toEqual([{ result: 'not_passed' }]);
  });

  it('locked month content is unreadable and unusable through direct API calls', async () => {
    expect(await rows(alice, `select id from public.lessons where id = $1`, [DEMO.lesson21])).toHaveLength(0);
    expect(await rows(alice, `select id from public.modules where month_id = $1`, [DEMO.month2])).toHaveLength(0);
    expect(await rows(alice, `select id from public.quizzes where month_id = $1`, [DEMO.month2])).toHaveLength(0);
    expect(await rows(alice, `select id from public.practice_items where month_id = $1`, [DEMO.month2])).toHaveLength(0);
    expect(await expectDenied(rows(alice, `select public.save_lesson_progress($1, 1, true)`, [DEMO.lesson21]))).toMatch(/locked/);
    expect(await expectDenied(rows(alice, `select public.submit_quiz_attempt('55555555-5555-5555-5555-555555555502', '{}'::jsonb)`))).toMatch(/locked/);
  });

  it("exam questions of an exam are only readable by students who started that exam", async () => {
    const secondExam = (await client.query(`insert into public.exams (course_id, title, status, is_final) values ($1, 'Mid-course exam', 'draft', false) returning id`, [DEMO.course])).rows[0].id;
    await client.query(`insert into public.exam_questions (exam_id, prompt, options, correct_answer) values ($1, 'Secret question', '[]', '"a"')`, [secondExam]);
    await asUser(client, bob, (q) => q(`select public.start_exam_attempt($1)`, [DEMO.finalExam]));
    // bob has an attempt on the final exam, not on the draft exam
    expect(await rows(bob, `select id from public.exam_questions where exam_id = $1`, [secondExam])).toHaveLength(0);
    expect(await rows(bob, `select id from public.exam_questions_student where exam_id = $1`, [secondExam])).toHaveLength(0);
    expect(await rows(bob, `select id from public.exam_questions where exam_id = $1`, [DEMO.finalExam])).toHaveLength(3);
    expect(await expectDenied(rows(bob, `select correct_answer from public.exam_questions`))).toMatch(/permission denied/);
    // an expired attempt cannot be reopened by the browser
    await client.query(`update public.exam_attempts set deadline_at = now() - interval '1 minute' where exam_id = $1`, [DEMO.finalExam]);
    const att = (await client.query(`select id from public.exam_attempts where exam_id = $1`, [DEMO.finalExam])).rows[0].id;
    expect(await rows(bob, `select public.save_exam_answers($1, '{}'::jsonb) as r`, [att])).toEqual([{ r: { saved: false, status: 'submitted', reason: 'time_limit' } }]);
    expect(await asUser(client, bob, async (q) => (await q(`update public.exam_attempts set status = 'in_progress', deadline_at = now() + interval '1 day' where id = $1`, [att])).rowCount)).toBe(0);
    expect((await client.query(`select status from public.exam_attempts where id = $1`, [att])).rows[0].status).not.toBe('in_progress');
  });

  it('a student cannot issue, revoke or reissue certificates; reissue re-checks eligibility', async () => {
    expect(await expectDenied(rows(bob, `select public.issue_certificate($1)`, [bobEnrollment]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(bob, `insert into public.certificates (enrollment_id, user_id, certificate_number, student_name, course_title, certificate_title, completion_date) values ($1, $2, 'MCSLI-2026-AAAAAA', 'Bob', 'x', 'x', current_date)`, [bobEnrollment, bob.id]))).toMatch(/row-level security|permission denied/);
    // a certificate that exists for an ineligible enrollment cannot be re-validated by reissue
    const cert = (await client.query(`insert into public.certificates (enrollment_id, user_id, certificate_number, student_name, course_title, certificate_title, completion_date, status) values ($1, $2, 'MCSLI-2026-BBBBBB', 'Bob', 'x', 'x', current_date, 'revoked') returning id`, [bobEnrollment, bob.id])).rows[0].id;
    expect(await expectDenied(rows(admin, `select public.reissue_certificate($1, 'please reissue')`, [cert]))).toMatch(/not eligible/);
  });
});

describe('identity documents and storage', () => {
  it('only the owner can read identity scans from storage; admins must use the audited function', async () => {
    await asUser(client, alice, (q) => q(`select public.submit_identity('national_id', 'CF12345678WXYZ', 'Alice', 'Uganda', true)`));
    const path = `${alice.id}/scan.jpg`;
    await asUser(client, alice, (q) => q(`insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)`, [path, alice.id]));
    const docId = await asUser(client, alice, async (q) => (await q(`select public.register_identity_document($1, 'scan.jpg', 'image/jpeg', 1000) as id`, [`identity-documents/${path}`])).rows[0].id);
    expect(await rows(alice, `select name from storage.objects where bucket_id = 'identity-documents'`)).toHaveLength(1);
    expect(await rows(bob, `select name from storage.objects where bucket_id = 'identity-documents'`)).toHaveLength(0);
    expect(await rows(trainer, `select name from storage.objects where bucket_id = 'identity-documents'`)).toHaveLength(0);
    expect(await rows(admin, `select name from storage.objects where bucket_id = 'identity-documents'`)).toHaveLength(0);
    // bob cannot upload into alice's folder
    expect(await expectDenied(rows(bob, `insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)`, [`${alice.id}/evil.jpg`, bob.id]))).toMatch(/row-level security/);
    // authorize_identity_document_access: IDOR-safe, audited before a URL can exist
    expect(await expectDenied(rows(bob, `select public.authorize_identity_document_access($1)`, [docId]))).toMatch(/not found/);
    expect(await expectDenied(rows(trainer, `select public.authorize_identity_document_access($1)`, [docId]))).toMatch(/not found/);
    expect(await expectDenied(rows(null, `select public.authorize_identity_document_access($1)`, [docId]))).toMatch(/permission denied|not authorised/);
    expect(await rows(alice, `select public.authorize_identity_document_access($1) as p`, [docId])).toEqual([{ p: path }]);
    expect(await rows(admin, `select public.authorize_identity_document_access($1) as p`, [docId])).toEqual([{ p: path }]);
    const audit = await client.query(`select action, actor_id from public.audit_logs where entity_id = $1 and action like 'identity.document_viewed%' order by id`, [docId]);
    expect(audit.rows).toEqual([
      { action: 'identity.document_viewed_by_owner', actor_id: alice.id },
      { action: 'identity.document_viewed', actor_id: admin.id },
    ]);
  });

  it("students cannot see another student's identity data or masked number", async () => {
    expect(await rows(bob, `select * from public.identity_summary`)).toHaveLength(0);
    expect(await rows(bob, `select * from public.identity_documents`)).toHaveLength(0);
    expect(await expectDenied(rows(bob, `select * from public.identity_verifications`))).toMatch(/permission denied/);
    const vid = (await client.query(`select id from public.identity_verifications where user_id = $1`, [alice.id])).rows[0].id;
    expect(await expectDenied(rows(trainer, `select public.admin_reveal_identity_number($1)`, [vid]))).toMatch(/not authorised/);
    expect(await expectDenied(rows(bob, `select public.admin_reveal_identity_number($1)`, [vid]))).toMatch(/not authorised/);
  });
});

describe('discussions, tickets, notifications, audit log, settings', () => {
  it('authors cannot un-hide, unlock or move moderated content', async () => {
    const tid = await asUser(client, alice, async (q) => (await q(`insert into public.discussion_threads (course_id, author_id, title, body) values ($1, $2, 'Spam thread', 'buy now') returning id`, [DEMO.course, alice.id])).rows[0].id);
    await asUser(client, trainer, (q) => q(`select public.moderate_discussion(p_thread_id => $1, p_hidden => true, p_locked => true)`, [tid]));
    expect(await expectDenied(rows(alice, `update public.discussion_threads set is_hidden = false where id = $1`, [tid]))).toMatch(/only moderators/);
    expect(await expectDenied(rows(alice, `update public.discussion_threads set is_locked = false, is_pinned = true where id = $1`, [tid]))).toMatch(/only moderators/);
    // other students cannot edit or delete alice's content
    expect(await asUser(client, bob, async (q) => (await q(`update public.discussion_threads set body = 'hacked' where id = $1`, [tid])).rowCount)).toBe(0);
    expect(await asUser(client, bob, async (q) => (await q(`delete from public.discussion_threads where id = $1`, [tid])).rowCount)).toBe(0);
    // reports cannot be filed as already handled
    expect(await expectDenied(rows(bob, `insert into public.discussion_reports (thread_id, reporter_id, reason, status) values ($1, $2, 'abuse', 'dismissed')`, [tid, bob.id]))).toMatch(/row-level security/);
    // assigned trainer may delete (audited)
    await asUser(client, trainer, (q) => q(`delete from public.discussion_threads where id = $1`, [tid]));
    expect((await client.query(`select count(*)::int as n from public.audit_logs where action = 'discussion.thread_deleted' and entity_id = $1`, [tid])).rows[0].n).toBe(1);
  });

  it('support tickets: other students and unassigned trainers cannot see them', async () => {
    const t = await asUser(client, alice, async (q) => (await q(`insert into public.support_tickets (user_id, category, subject) values ($1, 'identity', 'Please check my NIN') returning id`, [alice.id])).rows[0].id);
    expect(await rows(bob, `select id from public.support_tickets`)).toHaveLength(0);
    expect(await rows(trainer, `select id from public.support_tickets where id = $1`, [t])).toHaveLength(0);
    expect(await rows(admin, `select id from public.support_tickets where id = $1`, [t])).toHaveLength(1);
    expect(await expectDenied(rows(alice, `insert into public.support_tickets (user_id, subject, status, assigned_to) values ($1, 'self-assigned', 'resolved', $2)`, [alice.id, admin.id]))).toMatch(/row-level security/);
    await asUser(client, admin, (q) => q(`select public.update_ticket_status($1, 'in_progress')`, [t]));
    expect((await client.query(`select assigned_to from public.support_tickets where id = $1`, [t])).rows[0].assigned_to).toBe(admin.id);
  });

  it('notification text cannot be rewritten by the recipient; only read_at', async () => {
    const n = (await client.query(`select id from public.notifications where user_id = $1 limit 1`, [alice.id])).rows[0].id;
    expect(await expectDenied(rows(alice, `update public.notifications set title = 'Certificate issued' where id = $1`, [n]))).toMatch(/permission denied/);
    expect(await asUser(client, alice, async (q) => (await q(`update public.notifications set read_at = now() where id = $1`, [n])).rowCount)).toBe(1);
  });

  it('the audit log is append-only, even for admins', async () => {
    const id = (await client.query(`select id from public.audit_logs order by id limit 1`)).rows[0].id;
    expect(await expectDenied(rows(admin, `update public.audit_logs set action = 'x' where id = $1`, [id]))).toMatch(/permission denied|cannot be modified/);
    expect(await expectDenied(rows(admin, `delete from public.audit_logs where id = $1`, [id]))).toMatch(/permission denied|cannot be deleted/);
    // the append-only trigger also stops privileged code paths that act for a signed-in user
    expect(await expectDenied(asUser(client, admin, async (q) => {
      await q(`reset role`);
      return q(`update public.audit_logs set action = 'x' where id = $1`, [id]);
    }))).toMatch(/cannot be modified/);
    expect(await rows(alice, `select * from public.audit_logs`)).toHaveLength(0);
  });

  it('platform settings are admin-only; the public subset excludes sensitive keys', async () => {
    expect(await rows(alice, `select * from public.platform_settings`)).toHaveLength(0);
    expect(await rows(null, `select * from public.platform_settings`)).toHaveLength(0);
    expect(await expectDenied(rows(alice, `select public.set_platform_setting('registration_open', 'false')`))).toMatch(/not authorised/);
    const pub = (await rows(null, `select public.get_public_settings() as s`))[0].s;
    expect(Object.keys(pub)).not.toContain('identity_retention_days');
    // unconfigured payment methods are invisible to students
    await client.query(`update public.payment_methods set is_enabled = false where method_type = 'airtel'`);
    expect(await rows(alice, `select id from public.payment_methods where method_type = 'airtel'`)).toHaveLength(0);
  });
});

describe('public endpoints', () => {
  it('certificate verification is rate limited per client', async () => {
    const call = () => asUser(client, null, async (q) => {
      await q(`select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true)`);
      return (await q(`select public.verify_certificate('MCSLI-2026-ZZZZZZ') as v`)).rows[0].v;
    });
    for (let i = 0; i < 30; i++) expect(await call()).toEqual({ found: false });
    expect(await expectDenied(call())).toMatch(/Too many verification requests/);
    // a different client is unaffected
    const other = await asUser(client, null, async (q) => {
      await q(`select set_config('request.headers', '{"x-forwarded-for":"198.51.100.4"}', true)`);
      return (await q(`select public.verify_certificate('not-a-number') as v`)).rows[0].v;
    });
    expect(other).toEqual({ found: false });
    // the limiter stores hashed client ids only
    expect(JSON.stringify((await client.query(`select subject from private.rate_limits`)).rows)).not.toContain('203.0.113.9');
  });

  it('the public contact form is rate limited and cannot pre-set message status', async () => {
    const send = (i: number) => asUser(client, null, async (q) => {
      await q(`select set_config('request.headers', '{"x-forwarded-for":"203.0.113.77"}', true)`);
      return q(`insert into public.contact_messages (full_name, email, body, status) values ('[TEST] Visitor', 'visitor@example.test', $1, 'archived')`, [`[TEST] message ${i}`]);
    });
    for (let i = 0; i < 5; i++) await send(i);
    expect(await expectDenied(send(5))).toMatch(/Too many messages/);
    const statuses = (await client.query(`select distinct status from public.contact_messages where full_name = '[TEST] Visitor'`)).rows.map((r) => r.status);
    expect(statuses).toEqual(['new']);
  });

  it('anonymous users cannot read private tables', async () => {
    for (const t of ['profiles', 'enrollments', 'payments', 'identity_documents', 'assessment_attempts', 'certificates', 'support_tickets', 'notifications', 'audit_logs', 'contact_messages', 'platform_settings']) {
      const r = await asUser(client, null, async (q) => {
        try {
          return (await q(`select * from public.${t}`)).rows.length;
        } catch {
          return 0;
        }
      });
      expect([t, r]).toEqual([t, 0]);
    }
  });
});

describe('staff invitations', () => {
  const invite = (who: TestUser, email: string, role: 'ADMIN' | 'TRAINER') =>
    asUser(client, who, async (q) => (await q(`select public.create_staff_invitation($1, $2, $3) as r`, [email, '[TEST] Invitee', role])).rows[0].r as { invitation_id: string; token: string });

  it('SUPER_ADMIN invites ADMIN; ADMIN invites TRAINER but never ADMIN; students and trainers cannot invite', async () => {
    expect(await expectDenied(invite(admin, 'x.admin@example.test', 'ADMIN'))).toMatch(/only a super admin/);
    expect(await expectDenied(invite(trainer, 'x.trainer@example.test', 'TRAINER'))).toMatch(/not authorised/);
    expect(await expectDenied(invite(alice, 'x.trainer@example.test', 'TRAINER'))).toMatch(/not authorised/);
    expect(await expectDenied(asUser(client, superAdmin, (q) => q(`select public.create_staff_invitation('x@example.test', 'X', 'SUPER_ADMIN')`)))).toMatch(/ADMIN or TRAINER/);
    const a = await invite(superAdmin, 'new.admin@example.test', 'ADMIN');
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    const t = await invite(admin, 'new.trainer@example.test', 'TRAINER');
    // only a hash is stored and the token column is not readable through the API
    const stored = (await client.query(`select token_hash from public.staff_invitations where id = $1`, [a.invitation_id])).rows[0].token_hash;
    expect(stored).not.toBe(a.token);
    expect(await expectDenied(rows(superAdmin, `select token_hash from public.staff_invitations`))).toMatch(/permission denied/);
    // ADMINs see trainer invitations only; students see none
    expect((await rows(admin, `select id from public.staff_invitations`)).map((r) => r.id)).toEqual([t.invitation_id]);
    expect(await rows(alice, `select id from public.staff_invitations`)).toHaveLength(0);
    const audit = (await client.query(`select metadata from public.audit_logs where action = 'staff_invitation.created'`)).rows;
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toContain(a.token);
  });

  it('acceptance requires the invited, confirmed address; tokens are single-use; role changes are audited', async () => {
    const t = await invite(admin, 'invited.trainer@example.test', 'TRAINER');
    const wrong = await createUser(client, 'someone.else@example.test');
    const acc = async (u: TestUser, tok: string) => (await rows(u, `select public.accept_staff_invitation($1) as r`, [tok]))[0].r as { ok: boolean; reason?: string; role?: string };
    expect(await acc(wrong, t.token)).toMatchObject({ ok: false, reason: 'wrong_account' });
    expect((await client.query(`select count(*)::int as n from public.audit_logs where action = 'staff_invitation.rejected_wrong_account'`)).rows[0].n).toBe(1);
    expect(await expectDenied(rows(null, `select public.accept_staff_invitation($1)`, [t.token]))).toMatch(/permission denied|sign in/);
    const invitee = await createUser(client, 'invited.trainer@example.test');
    await client.query(`update auth.users set email_confirmed_at = null where id = $1`, [invitee.id]);
    expect(await acc(invitee, t.token)).toMatchObject({ ok: false, reason: 'unconfirmed' });
    await client.query(`update auth.users set email_confirmed_at = now() where id = $1`, [invitee.id]);
    expect(await acc(invitee, '0'.repeat(64))).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await acc(invitee, 'not-a-token')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await acc(invitee, t.token)).toEqual({ ok: true, role: 'TRAINER' });
    expect((await client.query(`select role from public.profiles where id = $1`, [invitee.id])).rows[0].role).toBe('TRAINER');
    expect(await acc(invitee, t.token)).toMatchObject({ ok: false, reason: 'used' });
    const actions = (await client.query(`select action from public.audit_logs where target_user_id = $1 order by id`, [invitee.id])).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['staff_invitation.accepted', 'staff.trainer_created']));
    // the accepted role cannot be escalated by the invitee afterwards
    expect(await expectDenied(rows(invitee, `update public.profiles set role = 'ADMIN' where id = $1`, [invitee.id]))).toMatch(/not authorised/);
  });

  it('expired and cancelled invitations cannot be used', async () => {
    const e = await invite(superAdmin, 'late.admin@example.test', 'ADMIN');
    await client.query(`update public.staff_invitations set expires_at = now() - interval '1 minute' where id = $1`, [e.invitation_id]);
    const late = await createUser(client, 'late.admin@example.test');
    expect((await rows(late, `select public.accept_staff_invitation($1) as r`, [e.token]))[0].r).toMatchObject({ ok: false, reason: 'expired' });
    expect((await client.query(`select count(*)::int as n from public.audit_logs where action = 'staff_invitation.expired' and entity_id = $1`, [e.invitation_id])).rows[0].n).toBe(1);
    const c = await invite(admin, 'cancel.me@example.test', 'TRAINER');
    await asUser(client, admin, (q) => q(`select public.cancel_staff_invitation($1)`, [c.invitation_id]));
    const cm = await createUser(client, 'cancel.me@example.test');
    expect((await rows(cm, `select public.accept_staff_invitation($1) as r`, [c.token]))[0].r).toMatchObject({ ok: false, reason: 'cancelled' });
    expect((await client.query(`select role from public.profiles where id = $1`, [cm.id])).rows[0].role).toBe('STUDENT');
    // ADMIN cannot cancel an ADMIN invitation
    const a2 = await invite(superAdmin, 'another.admin@example.test', 'ADMIN');
    expect(await expectDenied(rows(admin, `select public.cancel_staff_invitation($1)`, [a2.invitation_id]))).toMatch(/only a super admin/);
    // direct writes are impossible
    expect(await expectDenied(rows(admin, `update public.staff_invitations set status = 'pending' where id = $1`, [c.invitation_id]))).toMatch(/permission denied/);
  });

  it('staff suspension/reactivation is audited as staff actions', async () => {
    const t = await createUser(client, 'susp.trainer@example.test', {}, 'TRAINER');
    await asUser(client, admin, (q) => q(`select public.admin_set_account_status($1, 'suspended', '[TEST]')`, [t.id]));
    await asUser(client, admin, (q) => q(`select public.admin_set_account_status($1, 'active', '[TEST]')`, [t.id]));
    const actions = (await client.query(`select action from public.audit_logs where target_user_id = $1 order by id`, [t.id])).rows.map((r) => r.action);
    expect(actions).toEqual(['staff.suspended', 'staff.reactivated']);
  });
});

describe('staff MFA enforcement, payment methods, curriculum safety', () => {
  it('require_staff_mfa: only a super admin with an aal2 session can enable it; then staff need aal2', async () => {
    expect(await expectDenied(rows(admin, `select public.set_platform_setting('require_staff_mfa', 'true'::jsonb)`))).toMatch(/only a super admin/);
    expect(await expectDenied(rows(superAdmin, `select public.set_platform_setting('require_staff_mfa', 'true'::jsonb)`))).toMatch(/two-factor/);
    const aal2 = (u: TestUser, sql: string) => asUser(client, u, async (q) => {
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.id, role: 'authenticated', email: u.email, aal: 'aal2' })]);
      return (await q(sql)).rows;
    });
    await aal2(superAdmin, `select public.set_platform_setting('require_staff_mfa', 'true'::jsonb)`);
    expect(await rows(admin, `select public.is_admin() as a`)).toEqual([{ a: false }]);        // aal1 session
    expect(await aal2(admin, `select public.is_admin() as a`)).toEqual([{ a: true }]);          // after TOTP
    expect(await rows(alice, `select id from public.enrollments`)).toHaveLength(1);              // students unaffected
    await aal2(superAdmin, `select public.set_platform_setting('require_staff_mfa', 'false'::jsonb)`);
    expect(await rows(admin, `select public.is_admin() as a`)).toEqual([{ a: true }]);
  });

  it('payment methods cannot be enabled without their details', async () => {
    const bank = (await client.query(`select id from public.payment_methods where method_type = 'bank'`)).rows[0].id;
    await asUser(client, admin, (q) => q(`update public.payment_methods set is_enabled = false, account_number = null where id = $1`, [bank]));
    expect(await expectDenied(rows(admin, `update public.payment_methods set is_enabled = true where id = $1`, [bank]))).toMatch(/account number/);
    expect(await asUser(client, trainer, async (q) => (await q(`update public.payment_methods set is_enabled = true where id = $1`, [bank])).rowCount)).toBe(0);
  });

  it('a course cannot be published incomplete, and content with student history cannot be deleted', async () => {
    const course = await asUser(client, admin, async (q) => (await q(`insert into public.courses (slug, title, duration_months, tuition_national, tuition_international) values ('test-draft', '[TEST] Draft', 1, 350000, 400000) returning id`)).rows[0].id);
    expect(await expectDenied(rows(admin, `update public.courses set is_published = true where id = $1`, [course]))).toMatch(/cannot be published yet.*published month/);
    expect(await expectDenied(rows(admin, `insert into public.courses (slug, title, duration_months, tuition_national, tuition_international, is_published) values ('test-pub', '[TEST] Pub', 1, 1, 1, true)`))).toMatch(/draft/);
    const problems = (await rows(admin, `select public.get_course_publish_problems($1) as p`, [course]))[0].p;
    expect(problems.length).toBeGreaterThan(0);
    // lesson 11 of the demo course has student progress (alice)
    await asUser(client, alice, (q) => q(`select public.save_lesson_progress($1, 5, false)`, [DEMO.lesson11]));
    expect(await expectDenied(rows(admin, `delete from public.lessons where id = $1`, [DEMO.lesson11]))).toMatch(/student history/);
    expect(await expectDenied(rows(admin, `delete from public.course_months where id = $1`, [DEMO.month1]))).toMatch(/student history/);
  });
});

describe('transactional e-mail outbox', () => {
  it('payment submission/confirmation/rejection queue e-mails that students cannot read', async () => {
    const before = (await client.query(`select count(*)::int as n from public.email_outbox where user_id = $1`, [bob.id])).rows[0].n;
    const pid = await asUser(client, bob, async (q) => (await q(`select public.submit_payment($1, 'tuition', 1, $2, 1000, 'Bob', 'REF-OUTBOX', current_date, null) as id`, [bobEnrollment, methodId])).rows[0].id);
    await asUser(client, admin, (q) => q(`select public.review_payment($1, 'rejected', '[TEST] wrong amount')`, [pid]));
    const rows = (await client.query(`select template, status, payload from public.email_outbox where user_id = $1 order by created_at`, [bob.id])).rows.slice(before);
    expect(rows.map((r) => r.template)).toEqual(['payment_received', 'payment_rejected']);
    expect(rows.every((r) => r.status === 'queued')).toBe(true);
    expect(rows[1].payload.note).toBe('[TEST] wrong amount');
    expect(await rows_(bob)).toHaveLength(0);
    expect((await rows_(admin)).length).toBeGreaterThan(0);
    expect(await expectDenied(asUser(client, bob, (q) => q(`insert into public.email_outbox (to_email, template, subject) values ('x@y.z', 'payment_confirmed', 'fake')`)))).toMatch(/permission denied/);
    expect(await expectDenied(asUser(client, admin, (q) => q(`select * from public.claim_email_batch(5)`)))).toMatch(/permission denied/);
  });
  const rows_ = (u: TestUser) => rows(u, `select id from public.email_outbox`);
});
