# MCSLI AI Training Roadmap

## Principle

MCSLI should accumulate training data continuously, but models must not retrain themselves from raw production uploads.

Every lesson/practice video with media is automatically queued in `ai_training_assets`. It becomes eligible for a training dataset only when:

1. the visible signer has consented to model-training use;
2. MCSLI owns or has the necessary training rights;
3. a reviewer approves the quality and label; and
4. an administrator explicitly marks the asset `training_approved`.

Replacing a video's media resets those approvals.

## Phase 1 — Data collection and retrieval

Start immediately.

- Record real Ugandan Sign Language demonstrations for each curriculum/practice label.
- Prefer multiple approved examples of the same sign from different consenting signers, camera angles and natural signing speeds.
- Add clear labels, transcripts/meaning, movement notes and context.
- Keep ambiguous source terminology out of the approved dataset until an MCSLI language expert resolves it.
- Export approved manifests with `node scripts/export-ai-training-dataset.mjs`.

The first useful AI experience should be retrieval: given a known word/topic, return an approved human-recorded MCSLI demonstration. This is safer and more accurate than synthesising a sign before a validated generation model exists.

## Phase 2 — Isolated sign recognition

Train/evaluate a model on short labelled sign clips. Track signer-independent validation so the model is tested on people it did not train on.

Do not report "accuracy" only on clips from the same signer/session as training.

## Phase 3 — Continuous signing understanding

Move from isolated vocabulary to phrases/sentences. Annotate timing, gloss/meaning and non-manual features where relevant. Evaluation must include MCSLI sign-language experts.

## Phase 4 — Assisted lesson generation

Language models may draft lesson descriptions, quizzes, captions and teacher notes from approved curriculum text, but a human instructor must review them before publication.

## Phase 5 — Sign generation

Do not build sign generation by simply concatenating isolated clips. Natural sign language depends on grammar, transitions, facial/non-manual information and context.

A future avatar/video generation model should be trained only on consented, rights-cleared material and evaluated by MCSLI sign-language experts before any learner sees generated signing.

## Model governance

Use `ai_model_versions` to record model version, task, dataset snapshot and evaluation metrics. A model should move from `draft` → `evaluating` → `approved` only after review.

Never silently replace an approved production model with a newly trained checkpoint.

## Current state

The application currently implements the data-governance foundation only. It does not claim that a sign-recognition or sign-generation model is active.
