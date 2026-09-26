# Quiz question banks

Since migration `20260927090000_quiz_question_banks.sql` every student draws their **own** question set
from an approved question bank. This document explains how it works and what instructors do.

## What a student experiences

1. Opens a quiz → **Start quiz**. The server picks the questions for this attempt, shuffles them
   (and their answer options) and stores a snapshot. Questions never leave the server until then.
2. Answers are autosaved. Refreshing, losing connection or opening a second tab returns the **same
   attempt with the same questions in the same order** (`start_quiz_attempt` is idempotent).
3. **Submit** grades the attempt against the snapshot. Retrying a submission never re-grades.
4. Correct answers/explanations are shown only when the quiz's reveal policy allows it
   (default: after passing, or on the final permitted attempt – unchanged from before).
5. A retake prefers questions the student has not seen in their previous attempt; when the pool is
   small it repeats questions rather than failing.
6. **Practice mode** (`/app/practice/quiz`) serves short rounds with instant feedback. It never
   creates quiz attempts and never affects month unlocking or certificates; it only records a
   per-topic accuracy that suggests what to revise.

Progression rules are unchanged: required quizzes still gate the next month through
`fn_month_requirements_incomplete` (a quiz counts once any attempt has `passed = true`).

## Schema

| Object | Purpose |
|---|---|
| `quizzes.questions_per_attempt` | `null` = every approved question (the old behaviour); otherwise how many the server picks. |
| `quizzes.randomize_questions / randomize_options / avoid_recent_questions` | Selection switches. |
| `quizzes.blueprint` | `{"topics": {"Alphabet": 3}, "difficulty": {"easy": 2, "hard": 1}}` – quotas every attempt satisfies; remaining slots are random. |
| `quizzes.reveal_policy` | `after_pass_or_final` (default) · `always` · `never`. |
| `quizzes.version` | Bumped (and audited as `quiz.blueprint_changed`) whenever selection rules change; recorded on each attempt. |
| `quiz_questions.topic / difficulty / learning_objective / lesson_id / practice_item_id / allow_practice` | Bank metadata. |
| `quiz_questions.status` | `draft` → `approved` → `retired`; `rejected` for drafts. **Only `approved` questions can reach students.** |
| `quiz_questions.source` | `instructor` · `ai_draft` · `imported`. AI and imported questions are always created as drafts. |
| `quiz_questions.version` | Bumped when prompt/options/answer/points/video change. Attempts keep the version they were given. |
| `quiz_attempts.status` | `in_progress` → `submitted`. `score`/`passed`/`submitted_at` are null while in progress. |
| `quiz_attempt_questions` | The permanent per-attempt snapshot: prompt, shuffled options, correct answer, points, question version, the student's answer and correctness. Students read it only through `get_quiz_attempt()`. |
| `quiz_generation_runs` | Audit of AI drafting requests: who, when, counts, provider/model, outcome. No prompts or reasoning. |
| `practice_events` | Practice answers (topic, difficulty, correct) feeding `my_topic_progress()`. |

Existing questions were backfilled as `approved`; existing attempts as `submitted`.

## Server functions

Student (all `SECURITY DEFINER`, all check `auth.uid()` + enrollment + month access + account status):

- `start_quiz_attempt(quiz_id)` – idempotent; advisory lock per (quiz, enrollment) so concurrent
  starts return one attempt; refuses locked months, suspended accounts, exhausted attempts and quizzes
  whose checklist is not clean.
- `save_quiz_answers(attempt_id, answers)` – autosave; keys outside the snapshot are dropped.
- `submit_quiz_attempt(attempt_id, answers)` – grades against the snapshot; idempotent.
- `get_quiz_attempt(attempt_id)` – resume or review own attempt (reveal policy applied).
- `practice_questions(month_id, count, topic)`, `check_practice_answer(question_id, answer)`,
  `my_topic_progress(enrollment_id)`.

Staff (admin, or trainer assigned to the course – `can_edit_quiz()`):

- `get_quiz_publish_problems(quiz_id)` – human-readable checklist, e.g.
  `requires 3 approved "Alphabet" questions but only 2 exist`. The same checklist is enforced by a
  trigger when publishing/changing a blueprint, by `start_quiz_attempt`, and in
  `fn_course_publish_problems`.
- `review_quiz_question(id, 'approve' | 'reject' | 'retire' | 'draft', note)` – audited
  (`quiz_question.<status>`); approval validates the question content.
- `preview_quiz_selection(quiz_id)` – instructor preview without creating an attempt.
- `staff_quiz_stats(quiz_id)`, `staff_question_stats(quiz_id)` – analytics; flags (`too_easy`,
  `too_hard`) are hints, nothing is deleted automatically.
- `staff_quiz_attempt_detail(attempt_id)` – exactly what a student saw and answered.
- `import_quiz_questions(quiz_id, jsonb)` – validated rows become drafts.
- `create_quiz_generation_run(...)` / `complete_quiz_generation_run(...)` – used by the Edge Function.

Questions that appear in any snapshot cannot be deleted (`tg_protect_curriculum_history`); retire
them instead.

## Instructor workflow (Admin → Courses → month → Quizzes)

1. **Add quiz** (starts unpublished). Set pass mark, attempts, *questions per attempt*, reveal
   policy and optionally a blueprint (topic quotas, difficulty quotas).
2. **Question bank** → add questions with topic/difficulty/objective, import (JSON/CSV) or generate AI
   drafts. Review each draft: approve, reject, edit. Video questions pick a *published* lesson or
   practice-sign video; students receive short-lived signed URLs through the existing storage policy.
3. Watch the **bank health** badge: aim for at least 3× `questions_per_attempt` approved questions
   (red < 1.5×, amber < 3×, green ≥ 3×) and use **Preview** to see sample attempts.
4. Tick **Published** – the database refuses if the checklist is not clean.
5. **Analytics** shows attempts, pass rate, average score, most-missed topics and per-question
   correct rates with flags.

## AI-assisted drafting

Edge Function `generate-question-drafts` (JWT required). Flow: `create_quiz_generation_run` (as the
caller; returns only published lessons and practice signs of the quiz's month) → provider →
validation → `complete_quiz_generation_run` (drops anything not grounded in the material handed
over; inserts `status = 'draft'`, `source = 'ai_draft'`).

- Provider abstraction: `QuestionGenerationProvider.generateQuestionDrafts({ course, month, quiz,
  lessons, practiceItems, requestedCount, difficultyMix })`. The shipped implementation uses the
  Anthropic SDK with structured output (`AI_MODEL`, default `claude-opus-5`).
- **Configuration:** set the secret `ANTHROPIC_API_KEY` on the Supabase project
  (`supabase secrets set ANTHROPIC_API_KEY=…` or Dashboard → Edge Functions → Secrets). Without it
  the function answers `503 { status: "not_configured" }`, the run is logged as `not_configured`
  and the UI shows "AI question generation is not configured." No questions are ever fabricated.
- The system prompt restricts the model to the material provided and forbids inventing USL
  content; drafts must cite a lesson or practice-sign id from the run. The model's reasoning is not
  stored.
- Course-approved media is separate from AI-training approval (`ai_training_assets`); this feature
  reads curriculum text only.

## Tests

- `tests/db/quiz-banks.test.ts` (20 scenarios) + updated `progression.test.ts` / `security.test.ts`
  – run with `TEST_DATABASE_URL=… npm run test:db`.
- `scripts/e2e-supabase.mjs` – the quiz step now exercises start/resume/autosave/submit/replay and
  the question-bank step covers review, preview, analytics, practice mode and the AI
  "not configured" path.
