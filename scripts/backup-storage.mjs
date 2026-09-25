#!/usr/bin/env node
/**
 * Downloads every object from the MCSLI private Storage buckets to a local folder, preserving paths.
 * Database backups (Pro plan) do NOT include Storage files, so run this on a schedule from a trusted,
 * encrypted machine (the output contains identity scans and payment receipts – treat it as sensitive).
 *
 *   node scripts/backup-storage.mjs [--out ./storage-backup-YYYY-MM-DD] [--buckets identity-documents,payment-proofs,course-media,lesson-resources,certificates,avatars]
 *
 * Keys come from the logged-in Supabase CLI (or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and are never printed.
 * Restore: upload the folder tree back into the same buckets (Storage API / S3 protocol) – object paths are
 * what the database references, so keep them unchanged.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const ref = arg('project-ref', 'midvngbooepderxboqru');
const out = arg('out', `./storage-backup-${new Date().toISOString().slice(0, 10)}`);
const buckets = arg('buckets', 'identity-documents,payment-proofs,course-media,lesson-resources,certificates,avatars').split(',');

let url = process.env.SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  const env = execFileSync('npx', ['supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'env', '--agent', 'no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  key = env.match(/^SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/m)?.[1];
  url = `https://${ref}.supabase.co`;
}
if (!key) {
  console.error('No service key available (run `npx supabase login`).');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function walk(bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await walk(bucket, path)));
      else files.push({ path, size: item.metadata?.size ?? 0 });
    }
    if (!data || data.length < 1000) break;
  }
  return files;
}

let total = 0;
for (const bucket of buckets) {
  const files = await walk(bucket);
  let n = 0;
  for (const f of files) {
    const target = join(out, bucket, f.path);
    if (existsSync(target) && statSync(target).size === f.size) continue; // incremental
    const { data, error } = await sb.storage.from(bucket).download(f.path);
    if (error) {
      console.error(`skip ${bucket}/${f.path}: ${error.message}`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await data.arrayBuffer()));
    n++;
  }
  total += n;
  console.log(`${bucket}: ${files.length} objects, ${n} downloaded`);
}
console.log(`Done: ${total} files written to ${out}`);
