begin;
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
alter function public.save_hq_profile(jsonb,bigint,uuid) set schema private;
create function public.save_hq_profile(p_profile jsonb,p_expected_revision bigint,p_mutation_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_hq_profile(p_profile,p_expected_revision,p_mutation_id);
$$;
revoke all on function public.save_hq_profile(jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_hq_profile(jsonb,bigint,uuid) to authenticated;
revoke all on function private.save_hq_profile(jsonb,bigint,uuid) from public,anon;
grant execute on function private.save_hq_profile(jsonb,bigint,uuid) to authenticated;
commit;
