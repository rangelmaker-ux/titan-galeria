-- Transactional integration: no customer or payment data survives rollback.
begin;
do $$ declare u uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at,confirmation_sent_at,raw_user_meta_data) values(u,'trial-'||u||'@example.invalid',now(),now(),'{"display_name":"Teste temporario"}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('titan.fixture_uid',u::text,true);
end $$;
set local role authenticated;
do $$ declare a timestamptz; b timestamptz; begin
 if public.can_use_titan() then raise exception 'pending trial granted access'; end if;
 a:=public.start_titan_trial(); b:=public.start_titan_trial();
 if a is distinct from b or a is distinct from now()+interval '72 hours' then raise exception 'trial duration or idempotency failed'; end if;
 if not public.can_use_titan() then raise exception 'active trial denied'; end if;
 insert into public.galleries(photographer_id,title,slug) values(auth.uid(),'Teste temporario','trial-check');
 begin update public.photographers set trial_ends_at=now()+interval '99 days' where id=auth.uid(); raise exception 'client extended trial'; exception when insufficient_privilege then null; end;
 begin perform public.sync_titan_subscription('{}'); raise exception 'client granted billing'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.photographers set trial_started_at=now()-interval '73 hours',trial_ends_at=now()-interval '1 hour' where id=current_setting('titan.fixture_uid')::uuid;
set local role authenticated;
do $$ begin
 if public.can_use_titan() then raise exception 'expired trial still active'; end if;
 if exists(select 1 from public.galleries where photographer_id=auth.uid()) then raise exception 'expired direct read allowed'; end if;
 begin insert into public.galleries(photographer_id,title,slug) values(auth.uid(),'Blocked','blocked'); raise exception 'expired write allowed'; exception when insufficient_privilege then null; end;
 perform public.start_titan_trial();
 if public.can_use_titan() then raise exception 'trial restarted'; end if;
end $$;
reset role;
do $$ declare u uuid:=current_setting('titan.fixture_uid')::uuid; email text; begin
 select u1.email into email from auth.users u1 where id=u;
 perform set_config('titan.fixture_email',email,true);
end $$;
set local role service_role;
select public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_trial_fixture','customerId','cus_trial_fixture','email',current_setting('titan.fixture_email'),'status','active','eventCreated',100));
reset role;
do $$ begin if (select paid_until>now() from public.photographers where id=current_setting('titan.fixture_uid')::uuid) then raise exception 'unpaid subscription granted access'; end if; end $$;
set local role service_role;
select public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_trial_fixture','customerId','cus_trial_fixture','email',current_setting('titan.fixture_email'),'status','active','paidUntil',now()+interval '30 days','interval','mensal','eventCreated',101));
reset role;
set local role authenticated;
do $$ begin if not public.can_use_titan() then raise exception 'confirmed purchase failed'; end if; end $$;
reset role;
set local role service_role;
select public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_trial_fixture','customerId','cus_trial_fixture','email',current_setting('titan.fixture_email'),'status','canceled','eventCreated',102));
select public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_trial_fixture','customerId','cus_trial_fixture','email',current_setting('titan.fixture_email'),'status','active','paidUntil',now()+interval '30 days','eventCreated',101));
reset role;
set local role authenticated;
do $$ begin if public.can_use_titan() then raise exception 'stale event restored canceled access'; end if; end $$;
reset role;
-- Purchase before registration: verification is required, then the new account claims it.
do $$ declare u uuid:=gen_random_uuid(); email text; begin
 email:='prepurchase-'||u||'@example.invalid';
 perform public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_preaccount_fixture','customerId','cus_preaccount_fixture','email',email,'status','active','paidUntil',now()+interval '30 days','interval','mensal','eventCreated',200));
 insert into auth.users(id,email,confirmation_sent_at,raw_user_meta_data) values(u,email,now(),'{}');
 if (select paid_until>now() from public.photographers where id=u) then raise exception 'unverified email claimed purchase'; end if;
 update auth.users set email_confirmed_at=now() where id=u;
 if (select paid_until>now() from public.photographers where id=u) is not true then raise exception 'verified signup did not claim purchase'; end if;
 if (select photographer_id from public.billing_entitlements where subscription_id='sub_preaccount_fixture') is distinct from u then raise exception 'purchase matched wrong account'; end if;
 perform set_config('titan.paid_uid',u::text,true);
end $$;
-- Autoconfirm alone is not proof that a pending purchaser owns the email.
do $$ declare u uuid:=gen_random_uuid(); email text; begin
 email:='autoconfirm-'||u||'@example.invalid';
 perform public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_autoconfirm_fixture','customerId','cus_autoconfirm_fixture','email',email,'status','active','paidUntil',now()+interval '30 days','eventCreated',300));
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(u,email,now(),'{}');
 if (select paid_until>now() from public.photographers where id=u) then raise exception 'automatic confirmation stole pending purchase'; end if;
 if (select photographer_id from public.billing_entitlements where subscription_id='sub_autoconfirm_fixture') is not null then raise exception 'unverified account claimed pending purchase'; end if;
 -- An authenticated checkout binds the server-verified user ID AND matching Stripe email.
 perform public.sync_titan_subscription(jsonb_build_object('subscriptionId','sub_own_checkout_fixture','customerId','cus_own_checkout_fixture','email',email,'accountId',u::text,'status','active','paidUntil',now()+interval '30 days','eventCreated',301));
 if (select paid_until>now() from public.photographers where id=u) is not true then raise exception 'own authenticated checkout not fulfilled'; end if;
end $$;
-- Manual and administrator grants survive trial expiry and Stripe events.
update public.photographers set manual_plan='titan' where id=current_setting('titan.fixture_uid')::uuid;
set local role authenticated;
do $$ begin if not public.can_use_titan() then raise exception 'manual grant blocked'; end if; end $$;
reset role;
do $$ declare admin_id uuid; begin
 select id into admin_id from auth.users where lower(email)='rangelmaker@gmail.com';
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
end $$;
set local role authenticated;
do $$ begin if not public.can_use_titan() then raise exception 'administrator blocked'; end if; end $$;
reset role;
select 'PASS: 72h trial, single start, expiry, direct RLS/column protection, confirmed payment, email before signup, stale events, manual/admin' as result;
rollback;
