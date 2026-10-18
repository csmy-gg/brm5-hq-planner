-- Run in a test project or a rollback-capable SQL session. No test users survive.
begin;
insert into auth.users(id,aud,role,email) values
 ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','hq-test-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','hq-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare r jsonb; begin
 r:=public.save_hq_profile('{"version":1,"cash":10}',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if (r->>'revision')::int<>1 then raise exception 'Initial revision failed'; end if;
 r:=public.save_hq_profile('{"version":1,"cash":10}',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if (r->>'revision')::int<>1 then raise exception 'Retry was not idempotent'; end if;
 begin
  perform public.save_hq_profile('{"version":1,"cash":999}',0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Stale save was accepted';
 exception when serialization_failure then null; end;
 if (select count(*) from public.hq_profiles)<>1 then raise exception 'Own read failed'; end if;
 begin
  update public.hq_profiles set profile='{"version":1,"cash":999}';
  raise exception 'Direct write bypassed CAS';
 exception when insufficient_privilege then null; end;
end;$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
 if (select count(*) from public.hq_profiles)<>0 then raise exception 'Account B can see A'; end if;
 perform public.save_hq_profile('{"version":1,"cash":20}',0,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 if exists(select 1 from public.hq_profiles where user_id='11111111-1111-4111-8111-111111111111') then raise exception 'Cross-account read succeeded'; end if;
 if (select profile->>'cash' from public.hq_profiles)<>'20' then raise exception 'B owns the wrong row'; end if;
end;$$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin perform 1 from public.hq_profiles;raise exception 'Guest read succeeded';exception when insufficient_privilege then null;end;
 begin perform public.save_hq_profile('{"version":1}',0,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');raise exception 'Guest write succeeded';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select 'passed: owner read/write, isolation, no guest access, direct-write denial, stale-save rejection, idempotent retry' as security_result;
rollback;
