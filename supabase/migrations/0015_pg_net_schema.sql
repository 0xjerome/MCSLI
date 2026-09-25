-- MCSLI Learning Platform – 0015: install pg_net into the `extensions` schema (advisor lint 0014).
-- pg_net's API stays in the `net` schema, so private.kick_email_dispatch() and the cron job are
-- unaffected. Only the pending-response log (net._http_response) is recreated. Re-runnable.
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
exception when others then
  raise notice 'pg_net relocation skipped: %', sqlerrm;
end $$;
