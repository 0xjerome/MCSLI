-- MCSLI Learning Platform – 0009: encrypt identification numbers (NIN / passport) at rest
--
-- Design (see docs/SUPABASE_SETUP.md → "Identity-document security"):
--  * A random 256-bit key is generated INSIDE the database and stored in Supabase Vault
--    (secret name `mcsli_identity_key`). It never appears in the repository, the frontend,
--    Edge Function environment variables or logs.
--  * id_number_encrypted = pgp_sym_encrypt(number, key, aes256)   – reversible, admin reveal only
--  * id_number_hash      = HMAC-SHA256(number, key)               – exact-match search / duplicates
--  * id_number_last4     = last four characters                    – masked display
--  * The plaintext column is removed after existing rows are encrypted.
--  * Only SECURITY DEFINER functions in the non-exposed `private` schema touch the key.
--
-- Why not pgsodium Transparent Column Encryption: Supabase has deprecated TCE; Vault + pgcrypto is
-- the supported route and keeps the existing schema/RPC contract unchanged for the frontend.
--
-- Re-runnable: every step checks the current state first. Existing rows are preserved (encrypted
-- in place before the plaintext column is dropped).

create schema if not exists private;
revoke all on schema private from public;
do $$ begin
  execute 'revoke all on schema private from anon, authenticated';
exception when undefined_object then null; end $$;

-- 1. Key in Vault (created once; never rotated without re-encrypting – see docs)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'mcsli_identity_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'mcsli_identity_key',
      'MCSLI: encrypts identity numbers (NIN/passport). Do not delete or rotate without re-encrypting identity_verifications.'
    );
  end if;
end $$;

create or replace function private.identity_key() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select decrypted_secret into v from vault.decrypted_secrets where name = 'mcsli_identity_key';
  if v is null then
    raise exception 'identity encryption key is not configured' using errcode = 'P0001';
  end if;
  return v;
end $$;

create or replace function private.normalize_identifier(p text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'));
$$;

create or replace function private.encrypt_identifier(p text) returns bytea
language sql volatile security definer set search_path = '' as $$
  select extensions.pgp_sym_encrypt(private.normalize_identifier(p), private.identity_key(), 'cipher-algo=aes256, compress-algo=0');
$$;

create or replace function private.decrypt_identifier(p bytea) returns text
language sql stable security definer set search_path = '' as $$
  select extensions.pgp_sym_decrypt(p, private.identity_key());
$$;

create or replace function private.hash_identifier(p text) returns text
language sql stable security definer set search_path = '' as $$
  select encode(extensions.hmac(private.normalize_identifier(p), private.identity_key(), 'sha256'), 'hex');
$$;

revoke all on all functions in schema private from public;
do $$ begin
  execute 'revoke all on all functions in schema private from anon, authenticated';
exception when undefined_object then null; end $$;

-- 2. New columns
alter table public.identity_verifications add column if not exists id_number_encrypted bytea;
alter table public.identity_verifications add column if not exists id_number_hash text;
create index if not exists identity_verifications_hash_idx on public.identity_verifications(id_number_hash);

-- 3. Encrypt existing rows, then drop the plaintext column (only if it still exists)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'identity_verifications' and column_name = 'id_number') then
    -- the last-4 column was GENERATED from id_number; keep its values as a plain column
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'identity_verifications'
               and column_name = 'id_number_last4' and is_generated = 'ALWAYS') then
      execute 'alter table public.identity_verifications alter column id_number_last4 drop expression';
    end if;
    execute $sql$
      update public.identity_verifications
         set id_number_encrypted = private.encrypt_identifier(id_number),
             id_number_hash = private.hash_identifier(id_number),
             id_number_last4 = right(private.normalize_identifier(id_number), 4)
       where id_number_encrypted is null
    $sql$;
    execute 'drop view if exists public.identity_summary';
    execute 'alter table public.identity_verifications drop column id_number';
  end if;
end $$;

alter table public.identity_verifications alter column id_number_encrypted set not null;
alter table public.identity_verifications alter column id_number_hash set not null;
comment on column public.identity_verifications.id_number_encrypted is 'pgp_sym_encrypt(aes256) with the Vault key mcsli_identity_key. Decrypt only via admin_reveal_identity_number().';
comment on column public.identity_verifications.id_number_hash is 'HMAC-SHA256 of the normalised number (Vault key). Exact-match search via admin_find_identity_by_number().';

-- 4. Masked summary (students: own row; admins: all). Never exposes more than the last 4 characters.
create or replace view public.identity_summary
with (security_invoker = false) as
  select
    v.id,
    v.user_id,
    v.doc_type,
    case when v.id_number_last4 is null then null else '••••••••••' || v.id_number_last4 end as id_number_masked,
    v.full_name_on_document,
    v.issuing_country,
    v.status,
    v.submitted_at,
    v.reviewed_at,
    v.reviewed_by,
    v.rejection_reason,
    v.consent_given_at
  from public.identity_verifications v
  where v.user_id = auth.uid() or public.is_admin();
revoke all on public.identity_summary from anon;
grant select on public.identity_summary to authenticated;

-- 5. Submission stores ciphertext + hash + last4 only
create or replace function public.submit_identity(
  p_doc_type public.identity_doc_type, p_id_number text, p_full_name text, p_issuing_country text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; p record; v_norm text := private.normalize_identifier(p_id_number);
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not coalesce(p_consent, false) then raise exception 'consent is required' using errcode = '22023'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.account_status <> 'active' then raise exception 'account suspended' using errcode = '42501'; end if;
  if p.nationality = 'ugandan' and p_doc_type <> 'national_id' then raise exception 'Ugandan students must provide a National ID (NIN)' using errcode = '22023'; end if;
  if p.nationality = 'international' and p_doc_type = 'national_id' then raise exception 'Non-Ugandan students must provide a passport or other approved identification' using errcode = '22023'; end if;
  if length(v_norm) < 5 or length(coalesce(p_id_number, '')) > 40 then raise exception 'invalid identification number' using errcode = '22023'; end if;
  if p_doc_type = 'national_id' and v_norm !~ '^[A-Z0-9]{14}$' then raise exception 'A Ugandan NIN has 14 characters' using errcode = '22023'; end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then raise exception 'name on document is required' using errcode = '22023'; end if;
  if exists (select 1 from public.identity_verifications where user_id = auth.uid() and status in ('pending', 'verified')) then
    raise exception 'identity already submitted' using errcode = '23505';
  end if;
  insert into public.identity_verifications (user_id, doc_type, id_number_encrypted, id_number_hash, id_number_last4, full_name_on_document, issuing_country, status)
  values (auth.uid(), p_doc_type, private.encrypt_identifier(v_norm), private.hash_identifier(v_norm), right(v_norm, 4), trim(p_full_name), trim(p_issuing_country), 'pending')
  on conflict (user_id) do update set doc_type = excluded.doc_type, id_number_encrypted = excluded.id_number_encrypted, id_number_hash = excluded.id_number_hash,
    id_number_last4 = excluded.id_number_last4, full_name_on_document = excluded.full_name_on_document,
    issuing_country = excluded.issuing_country, status = 'pending', submitted_at = now(), reviewed_by = null, reviewed_at = null, rejection_reason = null, consent_given_at = now()
  returning id into v_id;
  perform public.fn_audit('identity.submitted', 'identity_verification', v_id::text, auth.uid(), jsonb_build_object('doc_type', p_doc_type));
  return v_id;
end $$;

-- 6. Audited reveal (admins only). The number is returned to the caller and never written to the audit row.
drop function if exists public.admin_reveal_identity_number(uuid);
create or replace function public.admin_reveal_identity_number(p_verification_id uuid, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select id, user_id, id_number_encrypted into v from public.identity_verifications where id = p_verification_id;
  if v.id is null then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;
  perform public.fn_audit('identity.number_revealed', 'identity_verification', v.id::text, v.user_id,
    jsonb_strip_nulls(jsonb_build_object('reason', nullif(left(trim(coalesce(p_reason, '')), 200), ''))));
  return private.decrypt_identifier(v.id_number_encrypted);
end $$;

-- 7. Exact-match lookup for verification/duplicate checks (admins only, audited, number not logged)
create or replace function public.admin_find_identity_by_number(p_id_number text)
returns table (verification_id uuid, user_id uuid, full_name_on_document text, status public.identity_status, submitted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_hash text := private.hash_identifier(p_id_number); v_count int;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select count(*) into v_count from public.identity_verifications where id_number_hash = v_hash;
  perform public.fn_audit('identity.number_searched', 'identity_verification', null, null, jsonb_build_object('matches', v_count));
  return query
    select iv.id, iv.user_id, iv.full_name_on_document, iv.status, iv.submitted_at
    from public.identity_verifications iv where iv.id_number_hash = v_hash
    order by iv.submitted_at;
end $$;

revoke execute on function public.submit_identity(public.identity_doc_type, text, text, text, boolean) from public, anon;
revoke execute on function public.admin_reveal_identity_number(uuid, text) from public, anon;
revoke execute on function public.admin_find_identity_by_number(text) from public, anon;
grant execute on function public.submit_identity(public.identity_doc_type, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.admin_reveal_identity_number(uuid, text) to authenticated, service_role;
grant execute on function public.admin_find_identity_by_number(text) to authenticated, service_role;
