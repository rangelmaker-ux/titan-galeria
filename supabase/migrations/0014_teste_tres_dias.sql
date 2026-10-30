begin;
alter table public.photographers add column trial_started_at timestamptz;
alter table public.photographers add column trial_ends_at timestamptz;
alter table public.photographers add column paid_until timestamptz;
alter table public.photographers add constraint photographers_trial_duration check ((trial_started_at is null and trial_ends_at is null) or (trial_started_at is not null and trial_ends_at = trial_started_at + interval '72 hours'));
-- Preserve existing paid periods; the new trial begins once, on Testar.
update public.photographers set paid_until=subscription_current_period_end where billing_plan='titan' and subscription_status='active' and subscription_current_period_end>now();
drop trigger if exists media_limit_gratuito on public.media;

create table public.billing_entitlements (
  subscription_id text primary key,
  customer_id text not null,
  email text not null check (email=lower(btrim(email)) and position('@' in email)>1),
  photographer_id uuid references public.photographers(id) on delete set null,
  status text not null,
  paid_until timestamptz,
  billing_interval text,
  event_created bigint not null,
  updated_at timestamptz not null default now()
);
create index billing_entitlements_email_idx on public.billing_entitlements(email);
create index billing_entitlements_photographer_idx on public.billing_entitlements(photographer_id);
alter table public.billing_entitlements enable row level security;
revoke all on public.billing_entitlements from public, anon, authenticated;
grant all on public.billing_entitlements to service_role;

create or replace function private.refresh_titan_billing(account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare entitlement public.billing_entitlements%rowtype;
begin
  select * into entitlement from public.billing_entitlements
   where photographer_id=account_id order by
    (status in ('active','past_due') and paid_until>now()) desc nulls last, paid_until desc nulls last, event_created desc limit 1;
  if not found then return; end if;
  update public.photographers set stripe_customer_id=entitlement.customer_id,
   stripe_subscription_id=entitlement.subscription_id,
   subscription_status=case when entitlement.status in ('active','past_due','canceled','unpaid','trialing') then entitlement.status else 'inactive' end,
   subscription_current_period_end=entitlement.paid_until,
   paid_until=case when entitlement.status in ('active','past_due') then entitlement.paid_until else null end,
   billing_plan=case when entitlement.status in ('active','past_due') and entitlement.paid_until>now() then 'titan' else 'gratuito' end,
   billing_interval=entitlement.billing_interval where id=account_id;
end $$;
revoke all on function private.refresh_titan_billing(uuid) from public,anon,authenticated;

create or replace function private.sync_titan_subscription(payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare account_id uuid; saved public.billing_entitlements%rowtype;
begin
  if nullif(payload->>'email','') is null or nullif(payload->>'subscriptionId','') is null then raise exception 'invalid_billing_event'; end if;
  select p.id into account_id from public.photographers p join auth.users u on u.id=p.id
    where lower(btrim(u.email))=lower(btrim(payload->>'email')) and u.email_confirmed_at is not null and (u.confirmation_sent_at is not null or u.id::text=payload->>'accountId') limit 1;
  insert into public.billing_entitlements(subscription_id,customer_id,email,photographer_id,status,paid_until,billing_interval,event_created)
  values(payload->>'subscriptionId',payload->>'customerId',lower(btrim(payload->>'email')),account_id,payload->>'status',
    nullif(payload->>'paidUntil','')::timestamptz,payload->>'interval',(payload->>'eventCreated')::bigint)
  on conflict(subscription_id) do update set
    photographer_id=coalesce(public.billing_entitlements.photographer_id,excluded.photographer_id),
    email=case when public.billing_entitlements.photographer_id is null then excluded.email else public.billing_entitlements.email end,
    status=excluded.status,
    paid_until=greatest(public.billing_entitlements.paid_until,excluded.paid_until),
    billing_interval=coalesce(excluded.billing_interval,public.billing_entitlements.billing_interval),
    event_created=excluded.event_created,updated_at=now()
  where excluded.event_created>=public.billing_entitlements.event_created
    and not (excluded.event_created=public.billing_entitlements.event_created and public.billing_entitlements.status='canceled' and excluded.status<>'canceled');
  select * into saved from public.billing_entitlements where subscription_id=payload->>'subscriptionId';
  if saved.photographer_id is not null then perform private.refresh_titan_billing(saved.photographer_id); end if;
end $$;
revoke all on function private.sync_titan_subscription(jsonb) from public,anon,authenticated;
grant execute on function private.sync_titan_subscription(jsonb) to service_role;
create or replace function public.sync_titan_subscription(payload jsonb) returns void language sql security invoker set search_path='' as $$ select private.sync_titan_subscription(payload); $$;
revoke all on function public.sync_titan_subscription(jsonb) from public,anon,authenticated;
grant execute on function public.sync_titan_subscription(jsonb) to service_role;

create or replace function private.claim_titan_purchase()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is null or new.confirmation_sent_at is null then return new; end if;
  update public.billing_entitlements set photographer_id=new.id
    where photographer_id is null and email=lower(btrim(new.email));
  perform private.refresh_titan_billing(new.id);
  return new;
end $$;
revoke all on function private.claim_titan_purchase() from public,anon,authenticated;
create trigger zz_claim_titan_purchase after insert or update of email,email_confirmed_at on auth.users
  for each row execute function private.claim_titan_purchase();

create or replace function private.claim_own_titan_purchase()
returns void language plpgsql security definer set search_path='' as $$
declare account_email text;
begin
 select lower(btrim(email)) into account_email from auth.users where id=auth.uid() and email_confirmed_at is not null and confirmation_sent_at is not null;
 if account_email is null then return; end if;
 update public.billing_entitlements set photographer_id=auth.uid() where photographer_id is null and email=account_email;
 perform private.refresh_titan_billing(auth.uid());
end $$;
revoke all on function private.claim_own_titan_purchase() from public,anon;
grant execute on function private.claim_own_titan_purchase() to authenticated;
create or replace function public.claim_titan_purchase() returns void language sql security invoker set search_path='' as $$ select private.claim_own_titan_purchase(); $$;
revoke all on function public.claim_titan_purchase() from public,anon;
grant execute on function public.claim_titan_purchase() to authenticated;

create or replace function private.start_titan_trial()
returns timestamptz language plpgsql security definer set search_path='' as $$
declare finish timestamptz;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.photographers set trial_started_at=now(),trial_ends_at=now()+interval '72 hours'
   where id=auth.uid() and trial_started_at is null;
  select trial_ends_at into finish from public.photographers where id=auth.uid();
  return finish;
end $$;
revoke all on function private.start_titan_trial() from public,anon;
grant execute on function private.start_titan_trial() to authenticated;
grant usage on schema private to authenticated;
create or replace function public.start_titan_trial() returns timestamptz language sql security invoker set search_path='' as $$ select private.start_titan_trial(); $$;
revoke all on function public.start_titan_trial() from public,anon;
grant execute on function public.start_titan_trial() to authenticated;

create or replace function private.can_use_titan()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.photographers p where p.id=auth.uid() and
   (p.plan_source='admin' or p.manual_plan='titan' or p.paid_until>now() or p.trial_ends_at>now()));
$$;
revoke all on function private.can_use_titan() from public,anon;
grant execute on function private.can_use_titan() to authenticated;
create or replace function public.can_use_titan() returns boolean language sql stable security invoker set search_path='' as $$ select private.can_use_titan(); $$;
revoke all on function public.can_use_titan() from public,anon;
grant execute on function public.can_use_titan() to authenticated;
-- Add a restrictive condition to existing ownership policies, never replace them.
do $$ declare t text; begin
 foreach t in array array['galleries','media','products','orders','order_items','media_selections'] loop
  execute format('create policy titan_active_account on public.%I as restrictive for all to authenticated using ((select public.can_use_titan())) with check ((select public.can_use_titan()))',t);
 end loop;
end $$;
create policy titan_profile_active_update on public.photographers as restrictive for update to authenticated
 using ((select public.can_use_titan())) with check ((select public.can_use_titan()));
commit;
