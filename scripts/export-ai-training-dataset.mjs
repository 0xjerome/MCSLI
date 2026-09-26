import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const output = process.argv[2] || 'mcsli-ai-training-manifest.jsonl';

if (!url || !serviceRole) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb
  .from('ai_training_assets')
  .select('id,source_kind,lesson_id,practice_item_id,label,sign_language,media_ref,quality_status,training_approved,updated_at')
  .eq('active', true)
  .eq('training_approved', true)
  .eq('signer_consent_confirmed', true)
  .eq('training_rights_confirmed', true)
  .eq('quality_status', 'approved')
  .order('label');

if (error) throw error;

const rows = data ?? [];
const body = rows
  .map((row) =>
    JSON.stringify({
      asset_id: row.id,
      source_kind: row.source_kind,
      source_id: row.lesson_id ?? row.practice_item_id,
      label: row.label,
      sign_language: row.sign_language,
      media_ref: row.media_ref,
      reviewed_at: row.updated_at,
    }),
  )
  .join('\n');

await writeFile(output, body ? `${body}\n` : '', 'utf8');
console.log(`Wrote ${rows.length} approved AI training assets to ${output}`);
