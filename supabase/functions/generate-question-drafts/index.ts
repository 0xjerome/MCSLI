// Supabase Edge Function: generate-question-drafts
//
// Drafts quiz questions from APPROVED MCSLI curriculum only and stores them as DRAFTS for human
// review. It never approves, never publishes and never shows anything to students.
//
//  1. The gateway requires a valid user JWT (verify_jwt = true).
//  2. public.create_quiz_generation_run() runs AS THE CALLER: it checks that the caller may edit the
//     quiz (admin, or trainer assigned to the course), records the run for the audit trail and hands
//     back only published lessons / published practice signs of the quiz's month.
//  3. If no provider secret is configured (ANTHROPIC_API_KEY), the run is closed as
//     'not_configured' and the function answers 503 – no questions are ever invented.
//  4. Otherwise the provider drafts questions (structured output). This function validates them,
//     then public.complete_quiz_generation_run() validates again, drops anything not grounded in the
//     material that was handed over, and inserts status = 'draft', source = 'ai_draft'.
//
// Nothing from the curriculum, the drafts or the model's reasoning is logged (only counts and
// statuses). Secrets are injected by the platform (Edge Function secrets), never by the browser.
// Optional: AI_MODEL (default claude-opus-5), ALLOWED_ORIGINS (comma separated) to restrict CORS.
//
// Request:  POST { quiz_id, requested_count?, difficulty_mix?, lesson_ids?, include_practice? }
// Response: 200 { run_id, status: 'completed', generated, dropped }
//           422 { run_id, status: 'insufficient_material', message }
//           503 { run_id, status: 'not_configured', message }
//           400 invalid · 401 not signed in · 403 not permitted · 404 unknown quiz · 502 provider failed

import { createClient } from 'npm:@supabase/supabase-js@2';

const NOT_CONFIGURED = 'AI question generation is not configured.';
const INSUFFICIENT = 'Insufficient approved course material to generate questions for this quiz. Publish the relevant lessons (with a description, objectives or a transcript) or practice signs for this month first.';

type Difficulty = 'easy' | 'medium' | 'hard';

interface Material {
  run_id: string;
  course_title: string | null;
  month: { id: string; number: number; title: string; description: string | null };
  quiz: { id: string; title: string; description: string | null; existing_topics: string[] };
  lessons: { id: string; title: string; description: string | null; objectives: string[] | null; transcript: string | null; module: string; module_description: string | null }[];
  practice_items: { id: string; title: string; description: string | null; movement_notes: string | null; has_video: boolean }[];
}

/** One draft as the provider returns it and as complete_quiz_generation_run() expects it. */
interface DraftQuestion {
  question_type: 'multiple_choice';
  prompt: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation: string | null;
  topic: string | null;
  difficulty: Difficulty;
  learning_objective: string | null;
  source_lesson_id: string | null;
  source_practice_item_id: string | null;
}

export interface GenerationRequest {
  course: string | null;
  month: Material['month'];
  quiz: Material['quiz'];
  lessons: Material['lessons'];
  practiceItems: Material['practice_items'];
  requestedCount: number;
  difficultyMix: Partial<Record<Difficulty, number>>;
}

/** Provider abstraction: swap the implementation without touching the workflow or the database. */
export interface QuestionGenerationProvider {
  readonly name: string;
  readonly model: string;
  generateQuestionDrafts(input: GenerationRequest): Promise<{ status: 'ok' | 'insufficient_material'; questions: DraftQuestion[] }>;
}

const SYSTEM_PROMPT = `You write draft quiz questions for MCSLI, an online Ugandan Sign Language (USL) course. Instructors will review, edit, approve or reject every draft; nothing you write reaches students directly.

Rules:
- Use ONLY the course material in the message (lesson titles, descriptions, objectives, transcripts, module descriptions and practice sign titles/descriptions/movement notes). Do not add sign descriptions, hand shapes, movements, vocabulary or grammar that are not stated in the material. Ugandan Sign Language differs from other sign languages; never borrow from ASL, BSL or any other language.
- Every question must cite the lesson (source_lesson_id) or practice sign (source_practice_item_id) it is based on, using the ids given.
- Multiple choice only: 3–5 options with ids "a", "b", "c", "d", "e"; exactly one correct; distractors must be plausible and drawn from the material where possible.
- Write clear, respectful, plain English suitable for adult learners; keep prompts under 200 characters.
- Set topic to a short label (reuse the existing topics when they fit), difficulty as requested, and a one-sentence explanation that points back to the material.
- If the material is too thin to write grounded questions, return status "insufficient_material" with no questions instead of inventing content.`;

async function anthropicProvider(apiKey: string, model: string): Promise<QuestionGenerationProvider> {
  // Imported lazily so the "not configured" path never needs the SDK.
  const [{ default: Anthropic }, { z }, { zodOutputFormat }] = await Promise.all([
    import('npm:@anthropic-ai/sdk'),
    import('npm:zod'),
    import('npm:@anthropic-ai/sdk/helpers/zod'),
  ]);
  const client = new Anthropic({ apiKey });
  const Draft = z.object({
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })),
    correct_answer: z.string(),
    explanation: z.string(),
    topic: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    learning_objective: z.string(),
    source_lesson_id: z.string().nullable(),
    source_practice_item_id: z.string().nullable(),
  });
  const Output = z.object({ status: z.enum(['ok', 'insufficient_material']), questions: z.array(Draft) });
  return {
    name: 'anthropic',
    model,
    async generateQuestionDrafts(input) {
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Draft ${input.requestedCount} questions. Difficulty mix (counts): ${JSON.stringify(input.difficultyMix)}.\n\nCourse material (JSON):\n${JSON.stringify({ course: input.course, month: input.month, quiz: input.quiz, lessons: input.lessons, practice_signs: input.practiceItems })}`,
          },
        ],
        output_config: { format: zodOutputFormat(Output) },
      });
      if (response.stop_reason === 'refusal') throw new Error('provider declined the request');
      const parsed = response.parsed_output;
      if (!parsed) throw new Error('provider returned no structured output');
      return {
        status: parsed.status,
        questions: parsed.questions.map((q) => ({
          question_type: 'multiple_choice' as const,
          prompt: q.prompt,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          topic: q.topic || null,
          difficulty: q.difficulty,
          learning_objective: q.learning_objective || null,
          source_lesson_id: q.source_lesson_id,
          source_practice_item_id: q.source_practice_item_id,
        })),
      };
    },
  };
}

/** Picks the configured provider, or null when no provider secret exists. */
async function resolveProvider(): Promise<QuestionGenerationProvider | null> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (anthropicKey) return anthropicProvider(anthropicKey, Deno.env.get('AI_MODEL') ?? 'claude-opus-5');
  return null;
}

/** Server-side validation of what the provider returned (the database validates again). */
function validateDrafts(drafts: DraftQuestion[], material: Material): { valid: DraftQuestion[]; dropped: number } {
  const lessonIds = new Set(material.lessons.map((l) => l.id));
  const practiceIds = new Set(material.practice_items.map((p) => p.id));
  const valid: DraftQuestion[] = [];
  let dropped = 0;
  for (const d of drafts) {
    const ids = d.options.map((o) => o.id);
    const grounded = (d.source_lesson_id && lessonIds.has(d.source_lesson_id)) || (d.source_practice_item_id && practiceIds.has(d.source_practice_item_id));
    const ok = typeof d.prompt === 'string' && d.prompt.trim().length >= 5 && d.prompt.length <= 500
      && Array.isArray(d.options) && d.options.length >= 2 && d.options.length <= 8
      && d.options.every((o) => typeof o.id === 'string' && o.id && typeof o.text === 'string' && o.text.trim())
      && new Set(ids).size === ids.length && ids.includes(d.correct_answer)
      && ['easy', 'medium', 'hard'].includes(d.difficulty) && grounded;
    if (ok) {
      valid.push({
        ...d,
        prompt: d.prompt.trim(),
        topic: d.topic ? d.topic.trim().slice(0, 60) : null,
        learning_objective: d.learning_objective ? d.learning_objective.trim().slice(0, 200) : null,
        explanation: d.explanation ? d.explanation.trim().slice(0, 500) : null,
        source_lesson_id: d.source_lesson_id && lessonIds.has(d.source_lesson_id) ? d.source_lesson_id : null,
        source_practice_item_id: d.source_practice_item_id && practiceIds.has(d.source_practice_item_id) ? d.source_practice_item_id : null,
      });
    } else dropped++;
  }
  return { valid, dropped };
}

function hasUsableMaterial(m: Material): boolean {
  const lessonText = m.lessons.some((l) => (l.description ?? '').trim().length > 20 || (l.objectives?.length ?? 0) > 0 || (l.transcript ?? '').trim().length > 50);
  return lessonText || m.practice_items.length > 0;
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0]!;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function log(level: 'info' | 'warn' | 'error', event: string, extra: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ fn: 'generate-question-drafts', event, ...extra }));
}

/** Map database errors from the caller-scoped RPCs to HTTP statuses without leaking internals. */
function rpcStatus(message: string, code?: string): number {
  if (code === '42501' || /not authori[sz]ed/i.test(message)) return 403;
  if (code === 'P0002' || /not found/i.test(message)) return 404;
  return 400;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/.test(authHeader)) return json(req, { error: 'unauthorised' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    log('error', 'misconfigured');
    return json(req, { error: 'service unavailable' }, 500);
  }

  let body: { quiz_id?: unknown; requested_count?: unknown; difficulty_mix?: unknown; lesson_ids?: unknown; include_practice?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid request' }, 400);
  }
  const quizId = typeof body.quiz_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.quiz_id) ? body.quiz_id : '';
  if (!quizId) return json(req, { error: 'invalid request' }, 400);
  const requested = Math.max(1, Math.min(20, Number(body.requested_count) || 5));
  const mix: Partial<Record<Difficulty, number>> = {};
  if (body.difficulty_mix && typeof body.difficulty_mix === 'object') {
    for (const k of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const v = Number((body.difficulty_mix as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v > 0) mix[k] = Math.min(20, Math.floor(v));
    }
  }
  const lessonIds = Array.isArray(body.lesson_ids) ? body.lesson_ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : null;
  const includePractice = body.include_practice !== false;

  // Everything below runs as the caller: the database decides who may draft for which quiz.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json(req, { error: 'unauthorised' }, 401);

  const created = await asUser.rpc('create_quiz_generation_run', {
    p_quiz_id: quizId, p_requested_count: requested, p_difficulty_mix: mix, p_lesson_ids: lessonIds && lessonIds.length ? lessonIds : null, p_include_practice: includePractice,
  });
  if (created.error) {
    const status = rpcStatus(created.error.message, (created.error as { code?: string }).code);
    log('warn', 'run_refused', { status });
    return json(req, { error: status === 403 ? 'not permitted' : status === 404 ? 'quiz not found' : 'invalid request' }, status);
  }
  const material = created.data as Material;
  const runId = material.run_id;

  const complete = (status: 'completed' | 'failed' | 'not_configured' | 'insufficient_material', drafts: DraftQuestion[] = [], provider?: QuestionGenerationProvider | null, error?: string) =>
    asUser.rpc('complete_quiz_generation_run', { p_run_id: runId, p_status: status, p_drafts: drafts, p_provider: provider?.name ?? null, p_model: provider?.model ?? null, p_error: error ?? null });

  let provider: QuestionGenerationProvider | null;
  try {
    provider = await resolveProvider();
  } catch (e) {
    log('error', 'provider_init_failed', { message: (e as Error).message.slice(0, 200) });
    await complete('failed', [], null, 'The AI provider could not be initialised.');
    return json(req, { run_id: runId, status: 'failed', message: 'The AI provider could not be initialised.' }, 502);
  }
  if (!provider) {
    await complete('not_configured', [], null, NOT_CONFIGURED);
    log('info', 'not_configured', { run_id: runId });
    return json(req, { run_id: runId, status: 'not_configured', message: NOT_CONFIGURED }, 503);
  }
  if (!hasUsableMaterial(material)) {
    await complete('insufficient_material', [], provider, INSUFFICIENT);
    return json(req, { run_id: runId, status: 'insufficient_material', message: INSUFFICIENT }, 422);
  }

  let result: Awaited<ReturnType<QuestionGenerationProvider['generateQuestionDrafts']>>;
  try {
    result = await provider.generateQuestionDrafts({
      course: material.course_title, month: material.month, quiz: material.quiz, lessons: material.lessons, practiceItems: material.practice_items, requestedCount: requested, difficultyMix: mix,
    });
  } catch (e) {
    log('error', 'provider_failed', { provider: provider.name, message: (e as Error).message.slice(0, 200) });
    await complete('failed', [], provider, 'The AI provider request failed.');
    return json(req, { run_id: runId, status: 'failed', message: 'The AI provider request failed. Try again later.' }, 502);
  }
  if (result.status === 'insufficient_material' || result.questions.length === 0) {
    await complete('insufficient_material', [], provider, INSUFFICIENT);
    return json(req, { run_id: runId, status: 'insufficient_material', message: INSUFFICIENT }, 422);
  }

  const { valid, dropped } = validateDrafts(result.questions.slice(0, requested), material);
  const done = await complete(valid.length ? 'completed' : 'insufficient_material', valid, provider, valid.length ? undefined : INSUFFICIENT);
  if (done.error) {
    log('error', 'complete_failed', { message: done.error.message.slice(0, 200) });
    return json(req, { run_id: runId, status: 'failed', message: 'The drafts could not be stored.' }, 500);
  }
  const summary = done.data as { status: string; generated: number; dropped: number };
  log('info', 'completed', { run_id: runId, provider: provider.name, generated: summary.generated, dropped: summary.dropped + dropped });
  if (summary.status === 'insufficient_material') return json(req, { run_id: runId, status: 'insufficient_material', message: INSUFFICIENT }, 422);
  return json(req, { run_id: runId, status: 'completed', generated: summary.generated, dropped: summary.dropped + dropped });
});
