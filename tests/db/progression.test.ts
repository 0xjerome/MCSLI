/**
 * Integration tests for the server-side business rules.
 * Runs the real migrations on a real Postgres (see docs/TESTING.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { DEMO, asUser, createUser, expectDenied, requireUrl, resetDatabase, confirmAllPayments, type TestUser } from './helpers';

let client: pg.Client;
let ugStudent: TestUser;
let intlStudent: TestUser;
let fullStudent: TestUser;
let trainer: TestUser;
let otherTrainer: TestUser;
let admin: TestUser;
let superAdmin: TestUser;
let methodId: string;

const access = async (user: TestUser, enrollmentId: string, month: number) =>
  asUser(client, user, async (q) => (await q(`select public.fn_month_access($1, $2) as a`, [enrollmentId, month])).rows[0].a as { allowed: boolean; reasons: { code: string }[] });

const codes = (a: { reasons: { code: string }[] }) => a.reasons.map((r) => r.code);

async function enroll(user: TestUser, plan: 'full' | 'installments') {
  return asUser(client, user, async (q) => (await q(`select public.enroll_in_course($1, $2, $3) as id`, [DEMO.course, plan, DEMO.cohort])).rows[0].id as string);
}

async function pay(user: TestUser, enrollmentId: string, purpose: 'registration' | 'tuition', amount: number, installment: number | null = null) {
  return asUser(client, user, async (q) =>
    (await q(`select public.submit_payment($1, $2, $3, $4, $5, $6, $7, current_date, null) as id`, [enrollmentId, purpose, installment, methodId, amount, 'Test Payer', 'REF-' + Math.random().toString(36).slice(2, 8)])).rows[0].id as string,
  );
}

async function scheduleAndRecord(who: TestUser, enrollmentId: string, monthId: string, result: 'pass' | 'not_passed', score = 80) {
  const assessmentId = await asUser(client, who, async (q) => (await q(`select public.schedule_assessment($1, $2, now()) as id`, [enrollmentId, monthId])).rows[0].id as string);
  return asUser(client, who, async (q) => (await q(`select public.record_assessment_result($1, $2, $3, 'feedback') as id`, [assessmentId, score, result])).rows[0].id as string);
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: requireUrl() });
  await client.connect();
  await resetDatabase(client);
  ugStudent = await createUser(client, 'ug.student@example.test', { nationality: 'ugandan', country: 'Uganda' });
  intlStudent = await createUser(client, 'intl.student@example.test', { nationality: 'international', country: 'Kenya' });
  fullStudent = await createUser(client, 'full.student@example.test', { nationality: 'ugandan' });
  trainer = await createUser(client, 'trainer@example.test', {}, 'TRAINER');
  otherTrainer = await createUser(client, 'other.trainer@example.test', {}, 'TRAINER');
  admin = await createUser(client, 'admin@example.test', {}, 'ADMIN');
  superAdmin = await createUser(client, 'super@example.test', {}, 'SUPER_ADMIN');
  await client.query(`insert into public.trainer_assignments (trainer_id, course_id, cohort_id) values ($1, $2, $3)`, [trainer.id, DEMO.course, DEMO.cohort]);
  methodId = (await client.query(`select id from public.payment_methods where method_type = 'mtn'`)).rows[0].id;
});

afterAll(async () => {
  await client?.end();
});

describe('pricing snapshot on enrollment', () => {
  it('Ugandan installment student: 350,000 tuition split 175k/175k + 20,000 registration', async () => {
    const id = await enroll(ugStudent, 'installments');
    const e = (await client.query(`select * from public.enrollments where id = $1`, [id])).rows[0];
    expect(Number(e.tuition_amount)).toBe(350000);
    expect(Number(e.registration_fee)).toBe(20000);
    expect(e.installments).toEqual([
      { number: 1, amount: 175000, due_before_month: 1 },
      { number: 2, amount: 175000, due_before_month: 2 },
    ]);
    expect(e.status).toBe('pending_payment');
  });

  it('international student pays 400,000 tuition', async () => {
    const id = await enroll(intlStudent, 'full');
    const e = (await client.query(`select * from public.enrollments where id = $1`, [id])).rows[0];
    expect(Number(e.tuition_amount)).toBe(400000);
    expect(e.installments).toEqual([{ number: 1, amount: 400000, due_before_month: 1 }]);
  });

  it('rejects duplicate enrollment and direct inserts', async () => {
    await expectDenied(enroll(ugStudent, 'full'));
    const msg = await expectDenied(asUser(client, ugStudent, (q) => q(`insert into public.enrollments (user_id, course_id, plan_type, nationality, currency, registration_fee, tuition_amount, installments) values ($1, $2, 'full', 'ugandan', 'UGX', 0, 0, '[]')`, [ugStudent.id, DEMO.course])));
    expect(msg).toMatch(/row-level security/);
  });
});

describe('payments and month 1 unlock', () => {
  let enrollmentId: string;
  beforeAll(async () => {
    enrollmentId = (await client.query(`select id from public.enrollments where user_id = $1`, [ugStudent.id])).rows[0].id;
  });

  it('month 1 is locked until registration + first installment are confirmed', async () => {
    const a = await access(ugStudent, enrollmentId, 1);
    expect(a.allowed).toBe(false);
    expect(codes(a)).toEqual(expect.arrayContaining(['enrollment_inactive', 'registration_fee_unconfirmed', 'tuition_unconfirmed']));
  });

  it('students cannot see locked lessons through RLS', async () => {
    const rows = await asUser(client, ugStudent, async (q) => (await q(`select id from public.lessons`)).rows);
    expect(rows).toHaveLength(0);
  });

  it('student submits payments; a student cannot confirm their own payment', async () => {
    const regId = await pay(ugStudent, enrollmentId, 'registration', 20000);
    await pay(ugStudent, enrollmentId, 'tuition', 175000, 1);
    const msg = await expectDenied(asUser(client, ugStudent, (q) => q(`select public.review_payment($1, 'confirmed', null)`, [regId])));
    expect(msg).toMatch(/not authorised/);
    // no UPDATE policy exists for students: the statement affects zero rows
    const updated = await asUser(client, ugStudent, async (q) => (await q(`update public.payments set status = 'confirmed' where id = $1`, [regId])).rowCount);
    expect(updated).toBe(0);
    expect((await client.query(`select status from public.payments where id = $1`, [regId])).rows[0].status).toBe('pending');
  });

  it('trainers cannot confirm payments either', async () => {
    const p = (await client.query(`select id from public.payments where enrollment_id = $1 limit 1`, [enrollmentId])).rows[0].id;
    const msg = await expectDenied(asUser(client, trainer, (q) => q(`select public.review_payment($1, 'confirmed', null)`, [p])));
    expect(msg).toMatch(/not authorised/);
  });

  it('admin confirmation activates the enrollment and unlocks month 1 (audited + notified)', async () => {
    await confirmAllPayments(client, admin, enrollmentId);
    const e = (await client.query(`select status from public.enrollments where id = $1`, [enrollmentId])).rows[0];
    expect(e.status).toBe('active');
    const a = await access(ugStudent, enrollmentId, 1);
    expect(a.allowed).toBe(true);
    const audit = await client.query(`select action from public.audit_logs where entity_type = 'payment' and action = 'payment.confirmed'`);
    expect(audit.rowCount).toBeGreaterThanOrEqual(2);
    const notif = await client.query(`select type from public.notifications where user_id = $1 and type in ('payment_confirmed', 'month_unlocked')`, [ugStudent.id]);
    expect(notif.rowCount).toBeGreaterThanOrEqual(2);
    const receipt = await client.query(`select receipt_number from public.payments where enrollment_id = $1 and status = 'confirmed'`, [enrollmentId]);
    receipt.rows.forEach((r) => expect(r.receipt_number).toMatch(/^RCPT-/));
  });

  it('month 1 lessons become visible; month 2 lessons stay hidden', async () => {
    const rows = await asUser(client, ugStudent, async (q) => (await q(`select l.id, mo.month_id from public.lessons l join public.modules mo on mo.id = l.module_id`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.month_id === DEMO.month1)).toBe(true);
  });

  it('a student cannot save progress on a locked lesson (URL tampering)', async () => {
    const msg = await expectDenied(asUser(client, ugStudent, (q) => q(`select public.save_lesson_progress($1, 10, true)`, [DEMO.lesson21])));
    expect(msg).toMatch(/locked/);
    await asUser(client, ugStudent, (q) => q(`select public.save_lesson_progress($1, 10, true)`, [DEMO.lesson11]));
    const lp = await client.query(`select completed_at from public.lesson_progress where lesson_id = $1`, [DEMO.lesson11]);
    expect(lp.rows[0].completed_at).not.toBeNull();
  });
});

describe('academic + financial gates for month 2', () => {
  let enrollmentId: string;
  beforeAll(async () => {
    enrollmentId = (await client.query(`select id from public.enrollments where user_id = $1`, [ugStudent.id])).rows[0].id;
  });

  it('month 2 is locked while the month 1 assessment is pending', async () => {
    const a = await access(ugStudent, enrollmentId, 2);
    expect(a.allowed).toBe(false);
    expect(codes(a)).toEqual(['installment_unconfirmed', 'previous_month_assessment_pending']);
  });

  it('an unassigned trainer cannot assess this student; the assigned trainer can', async () => {
    const msg = await expectDenied(asUser(client, otherTrainer, (q) => q(`select public.schedule_assessment($1, $2, now())`, [enrollmentId, DEMO.month1])));
    expect(msg).toMatch(/not authorised/);
  });

  it('NOT PASSED keeps month 2 locked and opens a reassessment', async () => {
    await scheduleAndRecord(trainer, enrollmentId, DEMO.month1, 'not_passed', 45);
    const a = await access(ugStudent, enrollmentId, 2);
    expect(codes(a)).toContain('previous_month_assessment_not_passed');
    const re = await client.query(`select count(*)::int as n from public.assessments where enrollment_id = $1 and is_reassessment and status = 'scheduled'`, [enrollmentId]);
    expect(re.rows[0].n).toBe(1);
    const n = await client.query(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'reassessment_required'`, [ugStudent.id]);
    expect(n.rows[0].n).toBe(1);
  });

  it('reassessment PASS satisfies the academic gate but installment 2 still blocks month 2', async () => {
    const pending = (await client.query(`select id from public.assessments where enrollment_id = $1 and status = 'scheduled'`, [enrollmentId])).rows[0].id;
    await asUser(client, trainer, (q) => q(`select public.record_assessment_result($1, 82, 'pass', 'Well done')`, [pending]));
    const attempts = await client.query(`select attempt_number, result from public.assessment_attempts where enrollment_id = $1 and month_id = $2 order by attempt_number`, [enrollmentId, DEMO.month1]);
    expect(attempts.rows.map((r) => [r.attempt_number, r.result])).toEqual([[1, 'not_passed'], [2, 'pass']]);
    const a = await access(ugStudent, enrollmentId, 2);
    expect(a.allowed).toBe(false);
    expect(codes(a)).toEqual(['installment_unconfirmed']);
    expect(a.reasons[0]).toMatchObject({ code: 'installment_unconfirmed', message: expect.stringContaining('installment 2 must be confirmed before Month 2') });
  });

  it('confirming installment 2 unlocks month 2 and notifies the student', async () => {
    await pay(ugStudent, enrollmentId, 'tuition', 175000, 2);
    await confirmAllPayments(client, admin, enrollmentId);
    const a = await access(ugStudent, enrollmentId, 2);
    expect(a.allowed).toBe(true);
    const n = await client.query(`select body from public.notifications where user_id = $1 and type = 'month_unlocked' order by created_at desc limit 1`, [ugStudent.id]);
    expect(n.rows[0].body).toMatch(/Month 2/);
    const a3 = await access(ugStudent, enrollmentId, 3);
    expect(a3.allowed).toBe(false);
    expect(codes(a3)).toEqual(['previous_month_assessment_pending']);
  });

  it('a full-tuition student who passes month 1 unlocks month 2 with no installment condition', async () => {
    const id = await enroll(fullStudent, 'full');
    await pay(fullStudent, id, 'registration', 20000);
    await pay(fullStudent, id, 'tuition', 350000);
    await confirmAllPayments(client, admin, id);
    expect((await access(fullStudent, id, 2)).allowed).toBe(false);
    await scheduleAndRecord(admin, id, DEMO.month1, 'pass');
    expect((await access(fullStudent, id, 2)).allowed).toBe(true);
  });
});

describe('admin override', () => {
  it('only admins can override, a reason is required, and the override is audited', async () => {
    const enrollmentId = (await client.query(`select id from public.enrollments where user_id = $1`, [ugStudent.id])).rows[0].id;
    await expectDenied(asUser(client, trainer, (q) => q(`select public.override_month_unlock($1, $2, 'trainer trying to override')`, [enrollmentId, DEMO.month3])));
    await expectDenied(asUser(client, admin, (q) => q(`select public.override_month_unlock($1, $2, 'short')`, [enrollmentId, DEMO.month3])));
    const overrideId = await asUser(client, admin, async (q) => (await q(`select public.override_month_unlock($1, $2, 'Student completed Month 2 assessment in person; recorded late.') as id`, [enrollmentId, DEMO.month3])).rows[0].id);
    const a = await access(ugStudent, enrollmentId, 3);
    expect(a.allowed).toBe(true);
    expect((a as { overridden?: boolean }).overridden).toBe(true);
    const audit = await client.query(`select actor_id, target_user_id, metadata from public.audit_logs where action = 'month.override_unlock' and entity_id = $1`, [overrideId]);
    expect(audit.rows[0].actor_id).toBe(admin.id);
    expect(audit.rows[0].target_user_id).toBe(ugStudent.id);
    expect(audit.rows[0].metadata.month).toBe(3);
    expect(audit.rows[0].metadata.reason).toMatch(/recorded late/);
    await asUser(client, admin, (q) => q(`select public.revoke_month_override($1, 'entered by mistake')`, [overrideId]));
    expect((await access(ugStudent, enrollmentId, 3)).allowed).toBe(false);
  });

  it('an override never waives payment', async () => {
    const id = await enroll(intlStudent === undefined ? ugStudent : (await createUser(client, 'unpaid@example.test', { nationality: 'ugandan' })), 'installments');
    await asUser(client, admin, (q) => q(`select public.override_month_unlock($1, $2, 'Testing that overrides do not waive tuition')`, [id, DEMO.month2]));
    const a = await access(admin, id, 2);
    expect(a.allowed).toBe(false);
    expect(codes(a)).toEqual(expect.arrayContaining(['registration_fee_unconfirmed', 'tuition_unconfirmed']));
  });
});

describe('quizzes', () => {
  it('scores server-side, hides correct answers from students, records attempts', async () => {
    const enrollmentId = (await client.query(`select id from public.enrollments where user_id = $1`, [ugStudent.id])).rows[0].id;
    const msg = await expectDenied(asUser(client, ugStudent, (q) => q(`select correct_answer from public.quiz_questions where quiz_id = $1`, [DEMO.quiz1])));
    expect(msg).toMatch(/permission denied/);
    const qs = await asUser(client, ugStudent, async (q) => (await q(`select id, question_type from public.quiz_questions_student where quiz_id = $1 order by position`, [DEMO.quiz1])).rows);
    expect(qs).toHaveLength(3);
    const answers = { [qs[0].id]: 'a', [qs[1].id]: 'b', [qs[2].id]: { l1: 'r1', l2: 'r2', l3: 'r3' } };
    const result = await asUser(client, ugStudent, async (q) => (await q(`select public.submit_quiz_attempt($1, $2::jsonb) as r`, [DEMO.quiz1, JSON.stringify(answers)])).rows[0].r);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.questions[0].explanation).toBeTruthy();
    const wrong = await asUser(client, ugStudent, async (q) => (await q(`select public.submit_quiz_attempt($1, $2::jsonb) as r`, [DEMO.quiz1, JSON.stringify({ [qs[0].id]: 'd' })])).rows[0].r);
    expect(wrong.score).toBe(0);
    expect(wrong.attempt_number).toBe(2);
    const staffRows = await asUser(client, trainer, async (q) => (await q(`select correct_answer from public.staff_quiz_questions($1)`, [DEMO.quiz1])).rows);
    expect(staffRows).toHaveLength(3);
    const denied = await expectDenied(asUser(client, otherTrainer, (q) => q(`select public.submit_quiz_attempt($1, '{}'::jsonb)`, [DEMO.quiz1])));
    expect(denied).toMatch(/locked|not enrolled/);
    void enrollmentId;
  });
});

describe('identity verification', () => {
  it('stores masked numbers, rejects wrong document types, audits reveals, restricts documents', async () => {
    await expectDenied(asUser(client, ugStudent, (q) => q(`select public.submit_identity('passport', 'AB1234567', 'UG Student', 'Uganda', true)`)));
    await expectDenied(asUser(client, ugStudent, (q) => q(`select public.submit_identity('national_id', 'CM12345678ABCD', 'UG Student', 'Uganda', false)`)));
    await asUser(client, ugStudent, (q) => q(`select public.submit_identity('national_id', 'CM12345678ABCD', 'UG Student', 'Uganda', true)`));
    const denied = await expectDenied(asUser(client, ugStudent, (q) => q(`select id_number from public.identity_verifications`)));
    expect(denied).toMatch(/permission denied/);
    const summary = await asUser(client, ugStudent, async (q) => (await q(`select id_number_masked, status from public.identity_summary`)).rows);
    expect(summary).toHaveLength(1);
    expect(summary[0].id_number_masked).toBe('••••••••••ABCD');
    expect(summary[0].status).toBe('pending');
    // other student sees nothing
    const other = await asUser(client, intlStudent, async (q) => (await q(`select * from public.identity_summary`)).rows);
    expect(other).toHaveLength(0);
    // trainer cannot reveal; admin can and it is audited
    const vid = (await client.query(`select id from public.identity_verifications where user_id = $1`, [ugStudent.id])).rows[0].id;
    await expectDenied(asUser(client, trainer, (q) => q(`select public.admin_reveal_identity_number($1)`, [vid])));
    const full = await asUser(client, admin, async (q) => (await q(`select public.admin_reveal_identity_number($1) as n`, [vid])).rows[0].n);
    expect(full).toBe('CM12345678ABCD');
    const audit = await client.query(`select count(*)::int as n from public.audit_logs where action = 'identity.number_revealed' and actor_id = $1`, [admin.id]);
    expect(audit.rows[0].n).toBe(1);
    // document registration path must be owned
    await expectDenied(asUser(client, ugStudent, (q) => q(`select public.register_identity_document($1, 'id.jpg', 'image/jpeg', 1000)`, [`identity-documents/${intlStudent.id}/x.jpg`])));
    await expectDenied(asUser(client, ugStudent, (q) => q(`select public.register_identity_document($1, 'id.exe', 'application/x-msdownload', 1000)`, [`identity-documents/${ugStudent.id}/x.exe`])));
    await asUser(client, ugStudent, (q) => q(`select public.register_identity_document($1, 'id.jpg', 'image/jpeg', 1000)`, [`identity-documents/${ugStudent.id}/x.jpg`]));
    const docsOther = await asUser(client, intlStudent, async (q) => (await q(`select * from public.identity_documents`)).rows);
    expect(docsOther).toHaveLength(0);
    const docsTrainer = await asUser(client, trainer, async (q) => (await q(`select * from public.identity_documents`)).rows);
    expect(docsTrainer).toHaveLength(0);
    await asUser(client, admin, (q) => q(`select public.review_identity($1, 'verified')`, [vid]));
    const st = await asUser(client, ugStudent, async (q) => (await q(`select status from public.identity_summary`)).rows[0].status);
    expect(st).toBe('verified');
  });
});

describe('role authorisation', () => {
  it('students cannot escalate their own role or read other profiles', async () => {
    const msg = await expectDenied(asUser(client, ugStudent, (q) => q(`update public.profiles set role = 'ADMIN' where id = $1`, [ugStudent.id])));
    expect(msg).toMatch(/not authorised/);
    const others = await asUser(client, ugStudent, async (q) => (await q(`select id from public.profiles`)).rows);
    expect(others).toHaveLength(1);
    const audit = await asUser(client, ugStudent, async (q) => (await q(`select * from public.audit_logs`)).rows);
    expect(audit).toHaveLength(0);
  });
  it('admins cannot grant admin roles; super admins can', async () => {
    await expectDenied(asUser(client, admin, (q) => q(`select public.admin_set_user_role($1, 'ADMIN')`, [trainer.id])));
    await asUser(client, admin, (q) => q(`select public.admin_set_user_role($1, 'TRAINER')`, [intlStudent.id]));
    await asUser(client, superAdmin, (q) => q(`select public.admin_set_user_role($1, 'ADMIN')`, [otherTrainer.id]));
    const roles = await client.query(`select id, role from public.profiles where id = any($1)`, [[intlStudent.id, otherTrainer.id]]);
    expect(Object.fromEntries(roles.rows.map((r) => [r.id, r.role]))).toEqual({ [intlStudent.id]: 'TRAINER', [otherTrainer.id]: 'ADMIN' });
    await asUser(client, superAdmin, (q) => q(`select public.admin_set_user_role($1, 'TRAINER')`, [otherTrainer.id]));
    await asUser(client, superAdmin, (q) => q(`select public.admin_set_user_role($1, 'STUDENT')`, [intlStudent.id]));
  });
  it('a student cannot read another student\'s payments or enrollments', async () => {
    const rows = await asUser(client, intlStudent, async (q) => (await q(`select * from public.payments`)).rows);
    expect(rows.every((r) => r.user_id === intlStudent.id)).toBe(true);
    const enr = await asUser(client, intlStudent, async (q) => (await q(`select user_id from public.enrollments`)).rows);
    expect(enr.every((r) => r.user_id === intlStudent.id)).toBe(true);
  });
});

describe('examinations and certificates', () => {
  let enrollmentId: string;
  beforeAll(async () => {
    enrollmentId = (await client.query(`select id from public.enrollments where user_id = $1`, [fullStudent.id])).rows[0].id;
  });

  it('runs a timed exam with autosave, auto-grading, manual grading and result release', async () => {
    const start = await asUser(client, fullStudent, async (q) => (await q(`select public.start_exam_attempt($1) as r`, [DEMO.finalExam])).rows[0].r);
    expect(start.question_order).toHaveLength(3);
    expect(start.deadline_at).toBeTruthy();
    const qs = await asUser(client, fullStudent, async (q) => (await q(`select id, question_type, requires_manual_grading from public.exam_questions_student where exam_id = $1 order by position`, [DEMO.finalExam])).rows);
    const answers: Record<string, unknown> = { [qs[0].id]: 'a', [qs[1].id]: 'b', [qs[2].id]: 'I signed my name, Kampala, football.' };
    await asUser(client, fullStudent, (q) => q(`select public.save_exam_answers($1, $2::jsonb)`, [start.attempt_id, JSON.stringify(answers)]));
    const resumed = await asUser(client, fullStudent, async (q) => (await q(`select public.start_exam_attempt($1) as r`, [DEMO.finalExam])).rows[0].r);
    expect(resumed.resumed).toBe(true);
    expect(resumed.answers[qs[0].id]).toBe('a');
    const sub = await asUser(client, fullStudent, async (q) => (await q(`select public.submit_exam_attempt($1) as r`, [start.attempt_id])).rows[0].r);
    expect(sub.needs_manual_grading).toBe(true);
    expect(Number(sub.auto_points)).toBe(4);
    // student cannot see a score before release
    const mine = await asUser(client, fullStudent, async (q) => (await q(`select total_score, passed, status from public.exam_attempts_student where id = $1`, [start.attempt_id])).rows[0]);
    expect(mine.status).toBe('submitted');
    expect(mine.total_score).toBeNull();
    const denied = await expectDenied(asUser(client, fullStudent, (q) => q(`select total_score from public.exam_attempts`)));
    expect(denied).toMatch(/permission denied/);
    // trainer grades the practical question
    await asUser(client, trainer, (q) => q(`select public.grade_exam_attempt($1, $2::jsonb, 'Good introduction')`, [start.attempt_id, JSON.stringify({ [qs[2].id]: 5 })]));
    const graded = (await client.query(`select total_score, passed from public.exam_attempts where id = $1`, [start.attempt_id])).rows[0];
    expect(Number(graded.total_score)).toBe(90);
    expect(graded.passed).toBe(true);
    await asUser(client, admin, (q) => q(`select public.release_exam_results($1)`, [DEMO.finalExam]));
    const released = await asUser(client, fullStudent, async (q) => (await q(`select total_score, passed from public.exam_attempts_student where id = $1`, [start.attempt_id])).rows[0]);
    expect(Number(released.total_score)).toBe(90);
    expect(released.passed).toBe(true);
  });

  it('certificate eligibility lists missing requirements; issuing requires eligibility and admin', async () => {
    const elig = (await client.query(`select public.fn_certificate_eligibility($1) as e`, [enrollmentId])).rows[0].e;
    expect(elig.eligible).toBe(false);
    expect(elig.missing).toEqual(expect.arrayContaining(['Month 2: assessment not passed', 'Final approval pending']));
    await expectDenied(asUser(client, admin, (q) => q(`select public.issue_certificate($1)`, [enrollmentId])));
    // complete everything: lessons, quizzes, assessments 2 & 3, approval
    for (const m of [DEMO.month2, DEMO.month3]) {
      await scheduleAndRecord(trainer, enrollmentId, m, 'pass');
    }
    const lessons = (await client.query(`select l.id from public.lessons l`)).rows;
    for (const l of lessons) await asUser(client, fullStudent, (q) => q(`select public.save_lesson_progress($1, 0, true)`, [l.id]));
    const quizzes = (await client.query(`select id from public.quizzes`)).rows;
    for (const qz of quizzes) {
      const full = (await client.query(`select id, correct_answer from public.quiz_questions where quiz_id = $1`, [qz.id])).rows;
      const ans = Object.fromEntries(full.map((r) => [r.id, r.correct_answer]));
      await asUser(client, fullStudent, (q) => q(`select public.submit_quiz_attempt($1, $2::jsonb)`, [qz.id, JSON.stringify(ans)]));
    }
    await asUser(client, trainer, (q) => q(`select public.approve_enrollment_completion($1)`, [enrollmentId]));
    const elig2 = (await client.query(`select public.fn_certificate_eligibility($1) as e`, [enrollmentId])).rows[0].e;
    expect(elig2).toEqual({ eligible: true, missing: [] });
    await expectDenied(asUser(client, trainer, (q) => q(`select public.issue_certificate($1)`, [enrollmentId])));
    const certId = await asUser(client, admin, async (q) => (await q(`select public.issue_certificate($1) as id`, [enrollmentId])).rows[0].id);
    const cert = (await client.query(`select * from public.certificates where id = $1`, [certId])).rows[0];
    expect(cert.certificate_number).toMatch(/^MCSLI-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
    // public verification reveals only safe fields
    const v = await asUser(client, null, async (q) => (await q(`select public.verify_certificate($1) as v`, [cert.certificate_number.toLowerCase()])).rows[0].v);
    expect(v.found).toBe(true);
    expect(v.student_name).toBe(cert.student_name);
    expect(v).not.toHaveProperty('user_id');
    expect(v).not.toHaveProperty('enrollment_id');
    const nf = await asUser(client, null, async (q) => (await q(`select public.verify_certificate('MCSLI-2000-ZZZZZZ') as v`)).rows[0].v);
    expect(nf).toEqual({ found: false });
    // anon cannot read the certificates table
    const anonRows = await asUser(client, null, async (q) => (await q(`select * from public.certificates`)).rows);
    expect(anonRows).toHaveLength(0);
    // revoke + reissue
    await asUser(client, admin, (q) => q(`select public.revoke_certificate($1, 'Name misspelled')`, [certId]));
    expect((await asUser(client, null, async (q) => (await q(`select public.verify_certificate($1) as v`, [cert.certificate_number])).rows[0].v)).status).toBe('revoked');
    const newId = await asUser(client, admin, async (q) => (await q(`select public.reissue_certificate($1, 'corrected name', 'Full Student') as id`, [certId])).rows[0].id);
    const reissued = (await client.query(`select * from public.certificates where id = $1`, [newId])).rows[0];
    expect(reissued.reissued_from).toBe(certId);
    expect(reissued.student_name).toBe('Full Student');
    expect(reissued.status).toBe('issued');
  });
});

describe('discussions, support, notifications', () => {
  it('enforces enrollment for posting, staff-only announcements, moderation and reports', async () => {
    const tid = await asUser(client, ugStudent, async (q) => (await q(`insert into public.discussion_threads (course_id, month_id, author_id, title, body) values ($1, $2, $3, 'How do I sign THANK YOU?', 'I keep mixing it up with GOOD.') returning id`, [DEMO.course, DEMO.month1, ugStudent.id])).rows[0].id);
    const msg = await expectDenied(asUser(client, ugStudent, (q) => q(`insert into public.discussion_threads (course_id, author_id, title, body, is_announcement) values ($1, $2, 'Fake announcement', 'x', true)`, [DEMO.course, ugStudent.id])));
    expect(msg).toMatch(/row-level security/);
    const unenrolled = await createUser(client, 'nobody@example.test');
    await expectDenied(asUser(client, unenrolled, (q) => q(`insert into public.discussion_posts (thread_id, author_id, body) values ($1, $2, 'hi')`, [tid, unenrolled.id])));
    await asUser(client, trainer, (q) => q(`insert into public.discussion_posts (thread_id, author_id, body) values ($1, $2, 'Flat hand from the chin forward.')`, [tid, trainer.id]));
    const n = await client.query(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'discussion_reply'`, [ugStudent.id]);
    expect(n.rows[0].n).toBe(1);
    await asUser(client, trainer, (q) => q(`insert into public.discussion_threads (course_id, author_id, title, body, is_announcement, is_pinned) values ($1, $2, 'Assessments next week', 'Please be ready.', true, true)`, [DEMO.course, trainer.id]));
    const ann = await client.query(`select count(*)::int as n from public.notifications where type = 'trainer_announcement'`);
    expect(ann.rows[0].n).toBeGreaterThanOrEqual(1);
    await asUser(client, fullStudent, (q) => q(`insert into public.discussion_reports (thread_id, reporter_id, reason) values ($1, $2, 'Off topic')`, [tid, fullStudent.id]));
    await expectDenied(asUser(client, otherTrainer, (q) => q(`select public.moderate_discussion(p_thread_id => $1, p_hidden => true)`, [tid])));
    await asUser(client, trainer, (q) => q(`select public.moderate_discussion(p_thread_id => $1, p_hidden => true)`, [tid]));
    const hiddenForOthers = await asUser(client, fullStudent, async (q) => (await q(`select id from public.discussion_threads where id = $1`, [tid])).rows);
    expect(hiddenForOthers).toHaveLength(0);
    const report = await client.query(`select status from public.discussion_reports where thread_id = $1`, [tid]);
    expect(report.rows[0].status).toBe('actioned');
  });

  it('support tickets are private, staff replies notify the student and move status', async () => {
    const t = await asUser(client, ugStudent, async (q) => (await q(`insert into public.support_tickets (user_id, category, subject) values ($1, 'payment', 'My MoMo payment is pending') returning id`, [ugStudent.id])).rows[0].id);
    await asUser(client, ugStudent, (q) => q(`insert into public.support_messages (ticket_id, author_id, is_staff, body) values ($1, $2, false, 'Paid yesterday, still pending.')`, [t, ugStudent.id]));
    await expectDenied(asUser(client, ugStudent, (q) => q(`insert into public.support_messages (ticket_id, author_id, is_staff, body) values ($1, $2, true, 'pretending to be staff')`, [t, ugStudent.id])));
    const otherView = await asUser(client, fullStudent, async (q) => (await q(`select * from public.support_tickets`)).rows);
    expect(otherView).toHaveLength(0);
    await asUser(client, admin, (q) => q(`insert into public.support_messages (ticket_id, author_id, is_staff, body) values ($1, $2, true, 'Confirmed now – sorry for the delay.')`, [t, admin.id]));
    const st = (await client.query(`select status from public.support_tickets where id = $1`, [t])).rows[0].status;
    expect(st).toBe('in_progress');
    const unread = await asUser(client, ugStudent, async (q) => (await q(`select count(*)::int as n from public.notifications where read_at is null`)).rows[0].n);
    expect(unread).toBeGreaterThan(0);
    const marked = await asUser(client, ugStudent, async (q) => (await q(`select public.mark_notifications_read(null) as n`)).rows[0].n);
    expect(marked).toBe(unread);
    // students can't read others' notifications
    const foreign = await asUser(client, fullStudent, async (q) => (await q(`select * from public.notifications where user_id = $1`, [ugStudent.id])).rows);
    expect(foreign).toHaveLength(0);
  });

  it('site content: public read, admin-only write via RPC', async () => {
    await expectDenied(asUser(client, ugStudent, (q) => q(`select public.set_site_content('impact_stats', '[]'::jsonb)`)));
    await asUser(client, admin, (q) => q(`select public.set_site_content('impact_stats', '[{"label":"People trained","value":"150"}]'::jsonb)`));
    const pub = await asUser(client, null, async (q) => (await q(`select value from public.site_content where key = 'impact_stats'`)).rows[0].value);
    expect(pub[0].value).toBe('150');
    const stats = await asUser(client, admin, async (q) => (await q(`select public.admin_dashboard_stats() as s`)).rows[0].s);
    expect(stats.total_students).toBeGreaterThanOrEqual(3);
    expect(stats.certificates_issued).toBe(1);
    await expectDenied(asUser(client, ugStudent, (q) => q(`select public.admin_dashboard_stats()`)));
    const ts = await asUser(client, trainer, async (q) => (await q(`select public.trainer_dashboard_stats() as s`)).rows[0].s);
    expect(ts.students).toBeGreaterThanOrEqual(1);
  });
});
