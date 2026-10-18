begin;
create table public.hq_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 profile jsonb not null,
 revision bigint not null default 0 check (revision >= 0),
 updated_at timestamptz not null default now(),
 last_mutation_id uuid,
 constraint valid_profile check (jsonb_typeof(profile)='object' and profile->>'version'='1' and octet_length(profile::text)<=1000000)
);
alter table public.hq_profiles enable row level security;
revoke all on public.hq_profiles from anon, authenticated;
grant select on public.hq_profiles to authenticated;
create policy owner_reads_hq on public.hq_profiles for select to authenticated using ((select auth.uid())=user_id);

-- All writes use compare-and-swap. The caller cannot supply another user's ID.
create function public.save_hq_profile(p_profile jsonb,p_expected_revision bigint,p_mutation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid := auth.uid();
 saved public.hq_profiles%rowtype;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 or p_mutation_id is null then raise exception 'Invalid save revision' using errcode='22023'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' or p_profile->>'version' is distinct from '1' or octet_length(p_profile::text)>1000000 then raise exception 'Invalid HQ profile' using errcode='22023'; end if;
 if p_expected_revision=0 then
  insert into public.hq_profiles(user_id,profile) values(owner_id,p_profile) on conflict(user_id) do nothing;
 end if;
 select * into saved from public.hq_profiles where user_id=owner_id for update;
 if not found then raise exception 'Save changed. Reload both copies.' using errcode='40001'; end if;
 if saved.last_mutation_id=p_mutation_id then
  return jsonb_build_object('revision',saved.revision,'updated_at',saved.updated_at);
 end if;
 if saved.revision<>p_expected_revision then raise exception 'Save changed. Reload both copies.' using errcode='40001'; end if;
 update public.hq_profiles set profile=p_profile,revision=revision+1,updated_at=clock_timestamp(),last_mutation_id=p_mutation_id where user_id=owner_id returning * into saved;
 return jsonb_build_object('revision',saved.revision,'updated_at',saved.updated_at);
end;
$$;
revoke all on function public.save_hq_profile(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_hq_profile(jsonb,bigint,uuid) to authenticated;
commit;
