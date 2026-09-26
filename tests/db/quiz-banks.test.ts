/**
 * Randomized quiz question banks: selection, snapshots, fairness, review workflow, practice mode.
 * Runs the real migrations on a real Postgres (see docs/TESTING.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { DEMO, asUser, confirmAllPayments, createUser, expectDenied, requireUrl, resetDatabase, type TestUser } from './helpers';

let client: pg.Client;
let s1: TestUser, s2: TestUser, s3: TestUser, s4: TestUser;
let trainer: TestUser, otherTrainer: TestUser, admin: TestUser;
let methodId: string;
const enrollment: Record<string, string> = {};

type StudentQuestion = { id: string; position: number; question_type: string; prompt: string; options: unknown; topic: string | null; points: number; correct_answer?: unknown; explanation?: unknown; correct?: unknown };
type Started = { attempt_id: string; attempt_number: number; status: string; resumed: boolean; questions: StudentQuestion[]; answers: Record<string, unknown> };
type Result = Started & { score: number; passed: boolean; answers_revealed: boolean; attempts_used: number; max_attempts: number | null };

const rpc = async <T,>(user: TestUser, sql: string, params: unknown[] = []) => asUser(client, user, async (q) => (await q(sql, params)).rows[0]?.r as T);
const rows = async (user: TestUser, sql: string, params: unknown[] = []) => asUser(client, user, async (q) => (await q(sql, params)).rows);
/** Rows a student may not see: either RLS filters them (0 rows) or the column grant is gone (permission denied). */
async function hidden(user: TestUser, sql: string, params: unknown[] = []) {
  try {
    return (await rows(user, sql, params)).length === 0;
  } catch (e) {
    return /permission denied/.test((e as Error).message);
  }
}
const start = (user: TestUser, quizId: string) => rpc<Started>(user, `select public.start_quiz_attempt($1) as r`, [quizId]);
const get = (user: TestUser, attemptId: string) => rpc<Result>(user, `select public.get_quiz_attempt($1) as r`, [attemptId]);
const submit = (user: TestUser, attemptId: string, answers: Record<string, unknown> | null) => rpc<Result>(user, `select public.submit_quiz_attempt($1, $2::jsonb) as r`, [attemptId, answers ? JSON.stringify(answers) : null]);
/** The snapshot as the database owner (what the student must never read directly). */
const snapshot = async (attemptId: string) => (await client.query(`select id, question_id, question_version, prompt, options, correct_answer, topic, difficulty, answer, is_correct from public.quiz_attempt_questions where attempt_id = $1 order by position`, [attemptId])).rows;
const correctAnswers = async (attemptId: string) => Object.fromEntries((await snapshot(attemptId)).map((r) => [r.id, r.correct_answer]));
const questionIds = (a: { questions: StudentQuestion[] }) => a.questions.map((q) => q.id);
const bankIds = async (attemptId: string) => (await snapshot(attemptId)).map((r) => r.question_id as string).sort();

async function activate(user: TestUser) {
  const id = await asUser(client, user, async (q) => (await q(`select public.enroll_in_course($1, 'full', $2) as id`, [DEMO.course, DEMO.cohort])).rows[0].id as string);
  for (const [purpose, amount, inst] of [['registration', 20000, null], ['tuition', 350000, 1]] as const) {
    await asUser(client, user, (q) => q(`select public.submit_payment($1, $2, $3, $4, $5, 'Test Payer', $6, current_date, null)`, [id, purpose, inst, methodId, amount, 'REF-' + Math.random().toString(36).slice(2, 8)]));
  }
  await confirmAllPayments(client, admin, id);
  const access = (await client.query(`select public.fn_month_access($1, 1) as a`, [id])).rows[0].a;
  expect(access.allowed, JSON.stringify(access.reasons)).toBe(true);
  enrollment[user.id] = id;
}

const mc = (n: number, correct = 'a') => ({
  options: [{ id: 'a', text: `Option A ${n}` }, { id: 'b', text: `Option B ${n}` }, { id: 'c', text: `Option C ${n}` }, { id: 'd', text: `Option D ${n}` }],
  correct,
});

async function createQuiz(title: string, spec: { topic: string; difficulty: string }[], extra = '') {
  const quizId = await asUser(client, admin, async (q) => (await q(`insert into public.quizzes (month_id, title, passing_score, is_required ${extra ? ',' + extra.split('=')[0] : ''}) values ($1, $2, 70, true ${extra ? ',' + extra.split('=')[1] : ''}) returning id`, [DEMO.month1, title])).rows[0].id as string);
  for (let i = 0; i < spec.length; i++) {
    const { options, correct } = mc(i + 1);
    await asUser(client, admin, (q) => q(
      `insert into public.quiz_questions (quiz_id, position, question_type, prompt, options, correct_answer, explanation, points, topic, difficulty) values ($1, $2, 'multiple_choice', $3, $4::jsonb, $5::jsonb, $6, 1, $7, $8)`,
      [quizId, i + 1, `[TEST] ${title} question ${i + 1}`, JSON.stringify(options), JSON.stringify(correct), `[TEST] explanation ${i + 1}`, spec[i]!.topic, spec[i]!.difficulty],
    ));
  }
  return quizId;
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: requireUrl() });
  await client.connect();
  await resetDatabase(client);
  admin = await createUser(client, 'qb.admin@example.test', {}, 'ADMIN');
  trainer = await createUser(client, 'qb.trainer@example.test', {}, 'TRAINER');
  otherTrainer = await createUser(client, 'qb.other@example.test', {}, 'TRAINER');
  await client.query(`insert into public.trainer_assignments (trainer_id, course_id, cohort_id) values ($1, $2, $3)`, [trainer.id, DEMO.course, DEMO.cohort]);
  methodId = (await client.query(`select id from public.payment_methods where method_type = 'mtn'`)).rows[0].id;
  [s1, s2, s3, s4] = await Promise.all(['one', 'two', 'three', 'four'].map((n) => createUser(client, `qb.student.${n}@example.test`, { nationality: 'ugandan', country: 'Uganda' })));
  for (const s of [s1, s2, s3, s4]) await activate(s);
});

afterAll(async () => {
  await client?.end();
});

// A blueprint quiz: 10 approved questions across 3 topics and 3 difficulties, 4 per attempt.
let quizQ: string;
// A plain random quiz: 9 questions, 3 per attempt, no quotas (optional, so it does not gate progression).
let quizR: string;
// A tiny quiz: 3 questions, 3 per attempt (optional).
let quizS: string;
const specQ = [
  { topic: 'Alphabet', difficulty: 'easy' }, { topic: 'Alphabet', difficulty: 'easy' }, { topic: 'Alphabet', difficulty: 'medium' }, { topic: 'Alphabet', difficulty: 'medium' }, { topic: 'Alphabet', difficulty: 'hard' },
  { topic: 'Numbers', difficulty: 'easy' }, { topic: 'Numbers', difficulty: 'medium' }, { topic: 'Numbers', difficulty: 'hard' },
  { topic: 'Greetings', difficulty: 'medium' }, { topic: 'Greetings', difficulty: 'medium' },
];

describe('blueprints and the publish checklist', () => {
  it('a new quiz starts unpublished and cannot be published until the blueprint is satisfiable', async () => {
    quizQ = await createQuiz('[TEST] Blueprint quiz', specQ);
    expect((await client.query(`select is_published from public.quizzes where id = $1`, [quizQ])).rows[0].is_published).toBe(false);
    // quotas larger than the attempt
    let msg = await expectDenied(asUser(client, admin, (q) => q(`update public.quizzes set is_published = true, questions_per_attempt = 4, blueprint = '{"topics":{"Alphabet":3,"Numbers":2}}' where id = $1`, [quizQ])));
    expect(msg).toMatch(/topic quotas add up to 5, more than 4 questions per attempt/);
    // more questions of a topic than exist
    msg = await expectDenied(asUser(client, admin, (q) => q(`update public.quizzes set is_published = true, questions_per_attempt = 4, blueprint = '{"topics":{"Alphabet":6}}' where id = $1`, [quizQ])));
    expect(msg).toMatch(/requires 6 approved "Alphabet" questions but only 5 exist/);
    // more questions per attempt than approved
    msg = await expectDenied(asUser(client, admin, (q) => q(`update public.quizzes set is_published = true, questions_per_attempt = 11 where id = $1`, [quizQ])));
    expect(msg).toMatch(/11 questions per attempt but only 10 approved/);
    // the checklist is readable by staff who can edit the quiz, nobody else
    const problems = await rpc<string[]>(admin, `select public.get_quiz_publish_problems($1) as r`, [quizQ]);
    expect(problems).toEqual([]);
    await client.query(`update public.quizzes set blueprint = '{"topics":{"Alphabet":9}}' where id = $1`, [quizQ]);
    expect(await rpc<string[]>(trainer, `select public.get_quiz_publish_problems($1) as r`, [quizQ])).toEqual(['requires 9 approved "Alphabet" questions but only 5 exist']);
    expect(await expectDenied(rpc(otherTrainer, `select public.get_quiz_publish_problems($1) as r`, [quizQ]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(s1, `select public.get_quiz_publish_problems($1) as r`, [quizQ]))).toMatch(/not authorised/);
    // a valid blueprint publishes and bumps the quiz version (audited)
    await asUser(client, admin, (q) => q(`update public.quizzes set is_published = true, questions_per_attempt = 4, blueprint = '{"topics":{"Alphabet":2,"Numbers":1},"difficulty":{"easy":1,"hard":1}}' where id = $1`, [quizQ]));
    const q = (await client.query(`select is_published, version from public.quizzes where id = $1`, [quizQ])).rows[0];
    expect(q.is_published).toBe(true);
    expect(q.version).toBeGreaterThan(1);
    expect((await client.query(`select count(*)::int as n from public.audit_logs where action = 'quiz.blueprint_changed' and entity_id = $1`, [quizQ])).rows[0].n).toBeGreaterThan(0);
    // creating a quiz as published outright is refused with guidance
    expect(await expectDenied(asUser(client, admin, (q) => q(`insert into public.quizzes (month_id, title, is_published) values ($1, '[TEST] eager', true)`, [DEMO.month1])))).toMatch(/Create the quiz first/);
    quizR = await createQuiz('[TEST] Random quiz', Array.from({ length: 9 }, () => ({ topic: 'Mixed', difficulty: 'medium' })));
    quizS = await createQuiz('[TEST] Tiny quiz', Array.from({ length: 3 }, () => ({ topic: 'Mixed', difficulty: 'medium' })));
    await asUser(client, admin, (q) => q(`update public.quizzes set is_published = true, is_required = false, questions_per_attempt = 3 where id in ($1, $2)`, [quizR, quizS]));
  });
});

describe('server-side selection and attempt snapshots', () => {
  const started: Record<string, Started> = {};

  it('two (four) students get valid attempts that satisfy the blueprint, and not everyone gets the same set', async () => {
    for (const s of [s1, s2, s3, s4]) {
      const a = await start(s, quizQ);
      started[s.id] = a;
      expect(a.status).toBe('in_progress');
      expect(a.resumed).toBe(false);
      expect(a.attempt_number).toBe(1);
      expect(a.questions).toHaveLength(4);
      for (const q of a.questions) {
        expect(q).not.toHaveProperty('correct_answer');
        expect(q).not.toHaveProperty('explanation');
        expect(q).not.toHaveProperty('question_id');
      }
      const snap = await snapshot(a.attempt_id);
      expect(snap.filter((r) => r.topic === 'Alphabet').length).toBeGreaterThanOrEqual(2);
      expect(snap.filter((r) => r.topic === 'Numbers').length).toBeGreaterThanOrEqual(1);
      expect(snap.filter((r) => r.difficulty === 'easy').length).toBeGreaterThanOrEqual(1);
      expect(snap.filter((r) => r.difficulty === 'hard').length).toBeGreaterThanOrEqual(1);
      expect(new Set(snap.map((r) => r.question_id)).size).toBe(4);
    }
    const sets = await Promise.all([s1, s2, s3, s4].map((s) => bankIds(started[s.id]!.attempt_id).then((x) => x.join(','))));
    expect(new Set(sets).size).toBeGreaterThan(1);
    // the audit trail records the start, with the quiz version in force
    expect((await client.query(`select count(*)::int as n from public.audit_logs where action = 'quiz.attempt_started'`)).rows[0].n).toBe(4);
  });

  it('reloading returns the same attempt with the same questions in the same order', async () => {
    const again = await start(s1, quizQ);
    expect(again.attempt_id).toBe(started[s1.id]!.attempt_id);
    expect(again.resumed).toBe(true);
    expect(questionIds(again)).toEqual(questionIds(started[s1.id]!));
    const fetched = await get(s1, again.attempt_id);
    expect(questionIds(fetched)).toEqual(questionIds(again));
    expect(fetched.questions.every((q) => q.correct_answer === null && q.explanation === null && q.correct === null)).toBe(true);
    expect((await client.query(`select count(*)::int as n from public.quiz_attempts where enrollment_id = $1 and quiz_id = $2`, [enrollment[s1.id], quizQ])).rows[0].n).toBe(1);
  });

  it('autosave keeps only answers for this attempt and survives a refresh', async () => {
    const a = started[s1.id]!;
    const saved = await rpc<{ saved: boolean }>(s1, `select public.save_quiz_answers($1, $2::jsonb) as r`, [a.attempt_id, JSON.stringify({ [a.questions[0]!.id]: 'b', 'not-a-question': 'x', [a.questions[1]!.id]: 'c' })]);
    expect(saved.saved).toBe(true);
    const fetched = await get(s1, a.attempt_id);
    expect(fetched.answers).toEqual({ [a.questions[0]!.id]: 'b', [a.questions[1]!.id]: 'c' });
  });

  it('options are shuffled per attempt while grading uses the stable option ids', async () => {
    let differsFromBank = 0;
    for (const s of [s1, s2, s3, s4]) {
      for (const r of await snapshot(started[s.id]!.attempt_id)) {
        const bank = (await client.query(`select options from public.quiz_questions where id = $1`, [r.question_id])).rows[0].options;
        expect([...r.options].map((o: { id: string }) => o.id).sort()).toEqual([...bank].map((o: { id: string }) => o.id).sort());
        if (JSON.stringify(r.options) !== JSON.stringify(bank)) differsFromBank++;
      }
    }
    expect(differsFromBank).toBeGreaterThan(0);
    const a = started[s1.id]!;
    const result = await submit(s1, a.attempt_id, await correctAnswers(a.attempt_id));
    expect(result.status).toBe('submitted');
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.answers_revealed).toBe(true);
    expect(result.questions.every((q) => q.correct === true && q.correct_answer !== null && typeof q.explanation === 'string')).toBe(true);
    // replaying the submission never re-grades
    const replay = await submit(s1, a.attempt_id, { [a.questions[0]!.id]: 'd' });
    expect(replay.score).toBe(100);
    expect((await snapshot(a.attempt_id)).every((r) => r.is_correct === true)).toBe(true);
  });

  it('a modified payload cannot alter the score, and guessed bank ids are ignored', async () => {
    const a = started[s2.id]!;
    const bank = (await client.query(`select id from public.quiz_questions where quiz_id = $1`, [quizQ])).rows.map((r) => r.id);
    const payload: Record<string, unknown> = { score: 100, passed: true, earned_points: 4 };
    for (const id of bank) payload[id] = 'a';
    const result = await submit(s2, a.attempt_id, payload);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.answers).toEqual({});
    // before the reveal policy allows it: which were wrong, never what is right
    expect(result.answers_revealed).toBe(false);
    expect(result.questions.every((q) => q.correct === false && q.correct_answer === null && q.explanation === null)).toBe(true);
    // no direct writes: attempts and snapshots are only written by the server functions
    expect(await asUser(client, s2, async (q) => (await q(`update public.quiz_attempts set score = 100, passed = true where id = $1`, [a.attempt_id])).rowCount)).toBe(0);
    expect(await expectDenied(rows(s2, `insert into public.quiz_attempt_questions (attempt_id, position, question_type, prompt, options, correct_answer, points) values ($1, 99, 'multiple_choice', 'x', '[]', '"a"', 1)`, [a.attempt_id]))).toMatch(/permission denied|row-level security/);
    expect(await expectDenied(rows(s2, `insert into public.quiz_attempts (quiz_id, enrollment_id, attempt_number, answers, score, passed) values ($1, $2, 9, '{}', 100, true)`, [quizQ, enrollment[s2.id]]))).toMatch(/permission denied|row-level security/);
    expect((await client.query(`select score, passed from public.quiz_attempts where id = $1`, [a.attempt_id])).rows[0]).toEqual({ score: 0, passed: false });
  });

  it('a retake prefers questions the student has not seen; a small pool repeats safely', async () => {
    const first = await start(s3, quizR);
    await submit(s3, first.attempt_id, {});
    const second = await start(s3, quizR);
    expect(second.attempt_number).toBe(2);
    const a = await bankIds(first.attempt_id);
    const b = await bankIds(second.attempt_id);
    expect(b.filter((x) => a.includes(x))).toEqual([]);
    await submit(s3, second.attempt_id, {});
    const third = await start(s3, quizR);
    const c = await bankIds(third.attempt_id);
    expect(c.filter((x) => b.includes(x))).toEqual([]);
    await submit(s3, third.attempt_id, {});
    // tiny pool: every question has been seen, the attempt is still complete
    const t1 = await start(s3, quizS);
    expect(t1.questions).toHaveLength(3);
    await submit(s3, t1.attempt_id, {});
    const t2 = await start(s3, quizS);
    expect(t2.questions).toHaveLength(3);
    expect(await bankIds(t2.attempt_id)).toEqual(await bankIds(t1.attempt_id));
    await submit(s3, t2.attempt_id, {});
  });

  it('instructor preview runs the selection without creating an attempt, and randomizes order', async () => {
    const before = (await client.query(`select count(*)::int as n from public.quiz_attempts`)).rows[0].n;
    const previews: string[] = [];
    for (let i = 0; i < 6; i++) {
      const p = await rpc<{ questions: { id: string; correct_answer: unknown }[]; problems: string[] }>(trainer, `select public.preview_quiz_selection($1) as r`, [quizR]);
      expect(p.questions).toHaveLength(3);
      expect(p.problems).toEqual([]);
      expect(p.questions[0]!.correct_answer).toBeDefined();
      previews.push(p.questions.map((q) => q.id).join(','));
    }
    expect(new Set(previews).size).toBeGreaterThan(1);
    expect((await client.query(`select count(*)::int as n from public.quiz_attempts`)).rows[0].n).toBe(before);
    expect(await expectDenied(rpc(s1, `select public.preview_quiz_selection($1) as r`, [quizR]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(otherTrainer, `select public.preview_quiz_selection($1) as r`, [quizR]))).toMatch(/not authorised/);
  });

  it('drafts, rejected, retired and AI-draft questions never reach students', async () => {
    const insert = (status: string, source: string) => client.query(
      `insert into public.quiz_questions (quiz_id, position, question_type, prompt, options, correct_answer, points, topic, status, source) values ($1, 90, 'multiple_choice', $2, $3::jsonb, '"a"', 1, 'Mixed', $4, $5) returning id`,
      [quizR, `[TEST] ${status} ${source}`, JSON.stringify(mc(90).options), status, source],
    );
    const unseen = [
      (await insert('draft', 'ai_draft')).rows[0].id, (await insert('draft', 'imported')).rows[0].id,
      (await insert('rejected', 'ai_draft')).rows[0].id, (await insert('retired', 'instructor')).rows[0].id,
    ];
    for (let i = 0; i < 8; i++) {
      const p = await rpc<{ questions: { id: string }[] }>(trainer, `select public.preview_quiz_selection($1) as r`, [quizR]);
      expect(p.questions.filter((q) => unseen.includes(q.id))).toEqual([]);
    }
    const a = await start(s4, quizR);
    expect((await bankIds(a.attempt_id)).filter((x) => unseen.includes(x))).toEqual([]);
    await submit(s4, a.attempt_id, {});
    const practice = await rpc<{ id: string }[]>(s4, `select public.practice_questions($1, 20) as r`, [DEMO.month1]);
    expect(practice.filter((q) => unseen.includes(q.id))).toEqual([]);
    // the bank itself is closed to students (drafts, answers, everything)
    expect(await hidden(s4, `select id, prompt from public.quiz_questions where quiz_id = $1`, [quizR])).toBe(true);
    expect(await expectDenied(rows(s4, `select correct_answer from public.quiz_questions where quiz_id = $1`, [quizR]))).toMatch(/permission denied/);
    expect(await hidden(s4, `select id from public.quiz_attempt_questions`)).toBe(true);
    expect(await hidden(s4, `select id from public.quiz_generation_runs`)).toBe(true);
    expect(await expectDenied(rpc(s4, `select public.check_practice_answer($1, '"a"'::jsonb) as r`, [unseen[0]]))).toMatch(/not found/);
  });

  it('editing or retiring a bank question after an attempt started does not change the attempt; history cannot be deleted', async () => {
    const a = started[s3.id]!;
    const snap = await snapshot(a.attempt_id);
    const edited = snap[0]!;
    const retired = snap[1]!;
    await asUser(client, admin, (q) => q(`update public.quiz_questions set prompt = '[TEST] EDITED prompt', correct_answer = '"d"' where id = $1`, [edited.question_id]));
    await rpc(admin, `select public.review_quiz_question($1, 'retire', 'no longer taught') as r`, [retired.question_id]);
    expect((await client.query(`select version, status from public.quiz_questions where id = $1`, [edited.question_id])).rows[0].version).toBe(2);
    expect((await client.query(`select status from public.quiz_questions where id = $1`, [retired.question_id])).rows[0].status).toBe('retired');
    const fetched = await get(s3, a.attempt_id);
    expect(fetched.questions[0]!.prompt).toBe(edited.prompt);
    expect(fetched.questions).toHaveLength(4);
    // grading uses the snapshot's correct answer and version, not the edited bank row
    const result = await submit(s3, a.attempt_id, { [edited.id]: edited.correct_answer, [retired.id]: retired.correct_answer });
    expect(result.questions[0]!.correct).toBe(true);
    expect(result.questions[1]!.correct).toBe(true);
    expect(result.score).toBe(50);
    expect((await snapshot(a.attempt_id))[0]!.question_version).toBe(1);
    expect(await expectDenied(asUser(client, admin, (q) => q(`delete from public.quiz_questions where id = $1`, [edited.question_id])))).toMatch(/student history/);
    // a new attempt sees the edited question (if selected) at version 2 and never the retired one
    await asUser(client, admin, (q) => q(`update public.quiz_questions set correct_answer = '"a"' where id = $1`, [edited.question_id]));
  });

  it('a published quiz whose approved pool shrinks below the blueprint cannot be started and appears in the course checklist', async () => {
    await submit(s4, started[s4.id]!.attempt_id, {});
    const numbers = (await client.query(`select id from public.quiz_questions where quiz_id = $1 and topic = 'Numbers'`, [quizQ])).rows.map((r) => r.id);
    for (const id of numbers) await rpc(admin, `select public.review_quiz_question($1, 'retire', null) as r`, [id]);
    expect(await expectDenied(start(s4, quizQ))).toMatch(/not ready yet/);
    const problems = (await client.query(`select public.fn_course_publish_problems($1) as p`, [DEMO.course])).rows[0].p as string[];
    expect(problems.join('\n')).toMatch(/Blueprint quiz.*requires 1 approved "Numbers" questions but only 0 exist/);
    for (const id of numbers) await rpc(admin, `select public.review_quiz_question($1, 'approve', null) as r`, [id]);
    expect(await rpc<string[]>(admin, `select public.get_quiz_publish_problems($1) as r`, [quizQ])).toEqual([]);
  });

  it('simultaneous starts create one attempt', async () => {
    const second = new pg.Client({ connectionString: requireUrl() });
    await second.connect();
    try {
      const [a, b] = await Promise.all([
        asUser(client, s4, async (q) => (await q(`select public.start_quiz_attempt($1) as r`, [quizQ])).rows[0].r as Started),
        asUser(second, s4, async (q) => (await q(`select public.start_quiz_attempt($1) as r`, [quizQ])).rows[0].r as Started),
      ]);
      expect(a.attempt_id).toBe(b.attempt_id);
      expect(questionIds(a)).toEqual(questionIds(b));
      expect((await client.query(`select count(*)::int as n from public.quiz_attempts where enrollment_id = $1 and quiz_id = $2 and status = 'in_progress'`, [enrollment[s4.id], quizQ])).rows[0].n).toBe(1);
      await submit(s4, a.attempt_id, {});
    } finally {
      await second.end();
    }
  });

  it('guessed attempt ids and other students’ attempts are unreachable; assigned staff can review', async () => {
    const theirs = started[s2.id]!.attempt_id;
    expect(await expectDenied(get(s1, theirs))).toMatch(/not found/);
    expect(await expectDenied(get(s1, '00000000-0000-0000-0000-00000000dead'))).toMatch(/not found/);
    expect(await expectDenied(rpc(s1, `select public.save_quiz_answers($1, '{}'::jsonb) as r`, [theirs]))).toMatch(/not authorised/);
    expect(await expectDenied(submit(s1, theirs, {}))).toMatch(/not authorised/);
    const detail = await rpc<{ attempt: { id: string }; questions: { correct_answer: unknown }[] }>(trainer, `select public.staff_quiz_attempt_detail($1) as r`, [theirs]);
    expect(detail.attempt.id).toBe(theirs);
    expect(detail.questions).toHaveLength(4);
    expect(detail.questions[0]!.correct_answer).toBeDefined();
    expect(await expectDenied(rpc(otherTrainer, `select public.staff_quiz_attempt_detail($1) as r`, [theirs]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(s2, `select public.staff_quiz_attempt_detail($1) as r`, [theirs]))).toMatch(/not authorised/);
    expect(await rows(trainer, `select id from public.quiz_attempt_questions where attempt_id = $1`, [theirs])).toHaveLength(4);
    expect(await rows(otherTrainer, `select id from public.quiz_attempt_questions where attempt_id = $1`, [theirs])).toHaveLength(0);
  });

  it('suspended students and locked months cannot start; staff cannot take quizzes', async () => {
    await client.query(`update public.profiles set account_status = 'suspended' where id = $1`, [s3.id]);
    expect(await expectDenied(start(s3, quizR))).toMatch(/suspended/);
    await client.query(`update public.profiles set account_status = 'active' where id = $1`, [s3.id]);
    expect(await expectDenied(start(s1, '55555555-5555-5555-5555-555555555502'))).toMatch(/locked/);
    expect(await expectDenied(start(trainer, quizR))).toMatch(/locked|not enrolled/);
    expect(await expectDenied(rpc(s1, `select public.practice_questions($1, 5) as r`, [DEMO.month2]))).toMatch(/locked/);
  });

  it('a required randomized quiz gates progression until it is passed', async () => {
    const e = enrollment[s2.id]!;
    const lessons = (await client.query(`select l.id from public.lessons l join public.modules mo on mo.id = l.module_id where mo.month_id = $1 and l.is_required`, [DEMO.month1])).rows;
    for (const l of lessons) await asUser(client, s2, (q) => q(`select public.save_lesson_progress($1, 0, true)`, [l.id]));
    const demo = await start(s2, DEMO.quiz1);
    await submit(s2, demo.attempt_id, await correctAnswers(demo.attempt_id));
    const before = (await client.query(`select public.fn_month_access($1, 2) as a`, [e])).rows[0].a;
    const incomplete = before.reasons.find((r: { code: string }) => r.code === 'previous_month_incomplete');
    expect(incomplete?.meta?.quizzes_missing).toBe(1);
    const retake = await start(s2, quizQ);
    expect(retake.attempt_number).toBe(2);
    const result = await submit(s2, retake.attempt_id, await correctAnswers(retake.attempt_id));
    expect(result.passed).toBe(true);
    const after = (await client.query(`select public.fn_month_access($1, 2) as a`, [e])).rows[0].a;
    expect(after.reasons.find((r: { code: string }) => r.code === 'previous_month_incomplete')).toBeUndefined();
    const map = (await rows(s2, `select to_jsonb(x) as r from public.get_my_course_map($1) x`, [e])).flatMap((r) => (Array.isArray(r.r) ? r.r : [r.r])) as { month_number: number; quizzes_total: number; quizzes_passed: number }[];
    const m1 = map.find((m) => Number(m.month_number) === 1)!;
    // the demo quiz and the blueprint quiz are passed; the optional random/tiny quizzes are not required
    expect(Number(m1.quizzes_total)).toBeGreaterThanOrEqual(4);
    expect(Number(m1.quizzes_passed)).toBe(2);
  });
});

describe('practice mode', () => {
  it('serves approved questions of unlocked months with immediate feedback and never touches quiz attempts', async () => {
    const attemptsBefore = (await client.query(`select count(*)::int as n from public.quiz_attempts`)).rows[0].n;
    const qs = await rpc<{ id: string; options: { id: string }[]; correct_answer?: unknown }[]>(s1, `select public.practice_questions($1, 5, 'Alphabet') as r`, [DEMO.month1]);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(5);
    expect(qs.every((q) => !('correct_answer' in q))).toBe(true);
    const feedback = await rpc<{ correct: boolean; correct_answer: unknown; explanation: string | null }>(s1, `select public.check_practice_answer($1, '"a"'::jsonb) as r`, [qs[0]!.id]);
    expect(feedback.correct).toBe(true);
    expect(feedback.correct_answer).toBe('a');
    const wrong = await rpc<{ correct: boolean }>(s1, `select public.check_practice_answer($1, '"b"'::jsonb) as r`, [qs[0]!.id]);
    expect(wrong.correct).toBe(false);
    expect((await client.query(`select count(*)::int as n from public.practice_events where enrollment_id = $1`, [enrollment[s1.id]])).rows[0].n).toBe(2);
    expect((await client.query(`select count(*)::int as n from public.quiz_attempts`)).rows[0].n).toBe(attemptsBefore);
    const progress = await rows(s1, `select * from public.my_topic_progress($1)`, [enrollment[s1.id]]);
    expect(progress.map((r) => r.topic)).toContain('Alphabet');
    expect(await rows(s2, `select * from public.my_topic_progress($1)`, [enrollment[s1.id]])).toHaveLength(0);
    expect(await rows(s2, `select id from public.practice_events where enrollment_id = $1`, [enrollment[s1.id]])).toHaveLength(0);
  });
});

describe('review workflow, import and AI drafts', () => {
  let runId: string;
  let lessonId: string;

  it('imports create drafts only; broken rows are reported, not stored', async () => {
    const result = await rpc<{ imported: number; skipped: { reason: string }[] }>(trainer, `select public.import_quiz_questions($1, $2::jsonb) as r`, [quizR, JSON.stringify([
      { prompt: '[TEST] imported ok', options: mc(1).options, correct_answer: 'a', topic: 'Mixed', difficulty: 'easy' },
      { prompt: '[TEST] bad answer', options: mc(2).options, correct_answer: 'z' },
      { prompt: '[TEST] matching ok', question_type: 'matching', options: { left: [{ id: 'l1', text: 'A' }, { id: 'l2', text: 'B' }], right: [{ id: 'r1', text: '1' }, { id: 'r2', text: '2' }] }, correct_answer: { l1: 'r1', l2: 'r2' } },
      { prompt: 'x', options: [] },
    ])]);
    expect(result.imported).toBe(2);
    expect(result.skipped.map((s) => s.reason).join(' | ')).toMatch(/correct answer must be one of the option ids/);
    const imported = (await client.query(`select status, source, created_by from public.quiz_questions where quiz_id = $1 and source = 'imported' and prompt like '[TEST] imported%'`, [quizR])).rows;
    expect(imported).toEqual([{ status: 'draft', source: 'imported', created_by: trainer.id }]);
    expect(await expectDenied(rpc(otherTrainer, `select public.import_quiz_questions($1, '[]'::jsonb) as r`, [quizR]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(s1, `select public.import_quiz_questions($1, '[]'::jsonb) as r`, [quizR]))).toMatch(/not authorised/);
  });

  it('review: approval validates content, only drafts can be rejected, decisions are audited', async () => {
    const draft = (await client.query(`select id from public.quiz_questions where quiz_id = $1 and prompt = '[TEST] imported ok'`, [quizR])).rows[0].id;
    const broken = (await client.query(`insert into public.quiz_questions (quiz_id, position, question_type, prompt, options, correct_answer, points, status, source) values ($1, 91, 'multiple_choice', '[TEST] broken draft', '[{"id":"a","text":"only one"}]', '"a"', 1, 'draft', 'imported') returning id`, [quizR])).rows[0].id;
    expect(await expectDenied(rpc(trainer, `select public.review_quiz_question($1, 'approve', null) as r`, [broken]))).toMatch(/Fix the question before approving it: needs 2–8 answer options/);
    await rpc(trainer, `select public.review_quiz_question($1, 'approve', 'looks right') as r`, [draft]);
    const row = (await client.query(`select status, reviewed_by, reviewed_at, review_note from public.quiz_questions where id = $1`, [draft])).rows[0];
    expect(row.status).toBe('approved');
    expect(row.reviewed_by).toBe(trainer.id);
    expect(row.reviewed_at).not.toBeNull();
    expect(await expectDenied(rpc(trainer, `select public.review_quiz_question($1, 'reject', null) as r`, [draft]))).toMatch(/only drafts can be rejected/);
    await rpc(trainer, `select public.review_quiz_question($1, 'reject', 'not curriculum') as r`, [broken]);
    expect((await client.query(`select status from public.quiz_questions where id = $1`, [broken])).rows[0].status).toBe('rejected');
    expect(await expectDenied(rpc(otherTrainer, `select public.review_quiz_question($1, 'retire', null) as r`, [draft]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(s1, `select public.review_quiz_question($1, 'approve', null) as r`, [draft]))).toMatch(/not authorised/);
    const audit = (await client.query(`select action from public.audit_logs where entity_type = 'quiz_question' and entity_id in ($1, $2) order by created_at`, [draft, broken])).rows.map((r) => r.action);
    expect(audit).toEqual(expect.arrayContaining(['quiz_question.approved', 'quiz_question.rejected']));
  });

  it('AI runs hand the model only published curriculum, store validated drafts, and never approve', async () => {
    const run = await rpc<{ run_id: string; lessons: { id: string; title: string; transcript: string | null }[]; practice_items: { id: string }[]; month: { number: number } }>(trainer, `select public.create_quiz_generation_run($1, 3, '{"easy":1,"medium":2}'::jsonb, null, true) as r`, [quizQ]);
    runId = run.run_id;
    expect(run.month.number).toBe(1);
    expect(run.lessons.length).toBeGreaterThan(0);
    const published = (await client.query(`select count(*)::int as n from public.lessons l join public.modules mo on mo.id = l.module_id where mo.month_id = $1 and l.is_published`, [DEMO.month1])).rows[0].n;
    expect(run.lessons).toHaveLength(published);
    lessonId = run.lessons[0]!.id;
    expect(await expectDenied(rpc(s1, `select public.create_quiz_generation_run($1, 3) as r`, [quizQ]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(otherTrainer, `select public.create_quiz_generation_run($1, 3) as r`, [quizQ]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(otherTrainer, `select public.complete_quiz_generation_run($1, 'completed', '[]'::jsonb) as r`, [runId]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(s1, `select public.complete_quiz_generation_run($1, 'completed', '[]'::jsonb) as r`, [runId]))).toMatch(/not authorised/);
    const done = await rpc<{ status: string; generated: number; dropped: number }>(trainer, `select public.complete_quiz_generation_run($1, 'completed', $2::jsonb, 'anthropic', 'test-model') as r`, [runId, JSON.stringify([
      { prompt: '[TEST] AI draft grounded in a lesson', options: mc(1).options, correct_answer: 'b', topic: 'Alphabet', difficulty: 'easy', explanation: 'from the lesson', source_lesson_id: lessonId },
      { prompt: '[TEST] AI draft citing unknown material', options: mc(2).options, correct_answer: 'a', source_lesson_id: '00000000-0000-0000-0000-00000000beef' },
      { prompt: '[TEST] AI draft with a bad answer', options: mc(3).options, correct_answer: 'q', source_lesson_id: lessonId },
      { prompt: '[TEST] AI draft claiming approval', options: mc(4).options, correct_answer: 'a', source_lesson_id: lessonId, status: 'approved' },
    ])]);
    expect(done).toMatchObject({ status: 'completed', generated: 2, dropped: 2 });
    const drafts = (await client.query(`select status, source, generation_id, lesson_id, points from public.quiz_questions where generation_id = $1`, [runId])).rows;
    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.status === 'draft' && d.source === 'ai_draft' && d.lesson_id === lessonId && d.points === 1)).toBe(true);
    expect(await expectDenied(rpc(trainer, `select public.complete_quiz_generation_run($1, 'completed', '[]'::jsonb) as r`, [runId]))).toMatch(/already completed/);
    const runs = await rows(trainer, `select status, generated_count, provider, model from public.list_quiz_generation_runs($1)`, [quizQ]);
    expect(runs[0]).toEqual({ status: 'completed', generated_count: 2, provider: 'anthropic', model: 'test-model' });
    expect(await expectDenied(rows(s1, `select * from public.list_quiz_generation_runs($1)`, [quizQ]))).toMatch(/not authorised/);
    // the not-configured state is recorded as a run outcome, never as fake questions
    const run2 = await rpc<{ run_id: string }>(trainer, `select public.create_quiz_generation_run($1, 5) as r`, [quizQ]);
    await rpc(trainer, `select public.complete_quiz_generation_run($1, 'not_configured', '[]'::jsonb, null, null, 'AI question generation is not configured.') as r`, [run2.run_id]);
    expect((await client.query(`select status, generated_count from public.quiz_generation_runs where id = $1`, [run2.run_id])).rows[0]).toEqual({ status: 'not_configured', generated_count: 0 });
    const audit = (await client.query(`select action from public.audit_logs where entity_type = 'quiz_generation_run' and entity_id = $1 order by created_at`, [runId])).rows.map((r) => r.action);
    expect(audit).toEqual(['quiz.generation_requested', 'quiz.generation_completed']);
  });

  it('analytics are available to assigned staff only and flag, never delete', async () => {
    const stats = await rpc<{ attempts: number; students: number; pass_rate: number; topics: unknown[]; bank: { approved: number; draft: number } }>(trainer, `select public.staff_quiz_stats($1) as r`, [quizQ]);
    expect(stats.attempts).toBeGreaterThanOrEqual(5);
    expect(stats.students).toBe(4);
    expect(stats.bank.draft).toBe(2);
    const perQuestion = await rows(trainer, `select * from public.staff_question_stats($1)`, [quizQ]);
    expect(perQuestion.length).toBeGreaterThan(0);
    expect(perQuestion.every((r) => r.flag === null || ['too_easy', 'too_hard'].includes(r.flag))).toBe(true);
    expect(await expectDenied(rows(otherTrainer, `select * from public.staff_question_stats($1)`, [quizQ]))).toMatch(/not authorised/);
    expect(await expectDenied(rpc(s1, `select public.staff_quiz_stats($1) as r`, [quizQ]))).toMatch(/not authorised/);
    expect((await client.query(`select count(*)::int as n from public.quiz_questions where quiz_id = $1`, [quizQ])).rows[0].n).toBe(12);
  });
});
