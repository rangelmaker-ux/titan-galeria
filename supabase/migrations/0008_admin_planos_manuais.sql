begin;
-- Mantém separadas a cobrança Stripe e a concessão negociada fora da plataforma.
alter table public.photographers add column if not exists billing_plan text;
update public.photographers set billing_plan = plan where billing_plan is null;
alter table public.photographers alter column billing_plan set default 'gratuito';
alter table public.photographers alter column billing_plan set not null;
alter table public.photographers add column if not exists manual_plan text check (manual_plan in ('gratuito','essencial','profissional','estudio'));
alter table public.photographers add column if not exists manual_granted_by uuid references auth.users(id);
alter table public.photographers add column if not exists manual_granted_at timestamptz;
alter table public.photographers add column if not exists plan_source text not null default 'stripe';

create schema if not exists private;
create or replace function private.enforce_titan_account_plan()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Compatibilidade durante o deploy com a versão anterior do webhook Stripe.
  if tg_op = 'UPDATE' and new.billing_plan is not distinct from old.billing_plan
    and new.manual_plan is not distinct from old.manual_plan and new.plan is distinct from old.plan then
    new.billing_plan := new.plan;
  end if;
  if exists (select 1 from auth.users where id=new.id and lower(email)='rangelmaker@gmail.com') then
    new.plan := 'estudio'; new.plan_source := 'admin';
  elsif new.manual_plan is not null then
    new.plan := new.manual_plan; new.plan_source := 'manual';
  else
    new.plan := new.billing_plan; new.plan_source := 'stripe';
  end if;
  return new;
end $$;
revoke all on function private.enforce_titan_account_plan() from public, anon, authenticated;
drop trigger if exists enforce_titan_account_plan on public.photographers;
create trigger enforce_titan_account_plan before insert or update on public.photographers for each row execute function private.enforce_titan_account_plan();
update public.photographers set plan=plan;

-- O navegador só pode editar o próprio perfil, nunca conceder um plano a si mesmo.
revoke insert, update on public.photographers from anon, authenticated;
grant update (slug, display_name, bio, avatar_url, cover_url, instagram, whatsapp, pix_key) on public.photographers to authenticated;

create table if not exists public.plan_grants_log (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.photographers(id),
  previous_manual_plan text, new_manual_plan text,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.plan_grants_log enable row level security;
revoke all on public.plan_grants_log from anon, authenticated;
grant select, insert on public.plan_grants_log to service_role;

create or replace function private.admin_list_accounts()
returns table (id uuid, display_name text, slug text, email text, plan text, billing_plan text, manual_plan text, plan_source text, subscription_status text, manual_granted_at timestamptz)
language sql security definer set search_path = public, pg_temp as $$
 select p.id,p.display_name,p.slug,u.email::text,p.plan,p.billing_plan,p.manual_plan,p.plan_source,p.subscription_status,p.manual_granted_at
 from public.photographers p join auth.users u on u.id=p.id order by p.created_at desc limit 500;
$$;
revoke all on function private.admin_list_accounts() from public, anon, authenticated;
grant execute on function private.admin_list_accounts() to service_role;

create or replace function private.admin_grant_plan(target_id uuid, actor_id uuid, granted_plan text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare previous_plan text;
begin
  if not exists (select 1 from auth.users where id=actor_id and lower(email)='rangelmaker@gmail.com') then raise exception 'acesso_restrito'; end if;
  if exists (select 1 from auth.users where id=target_id and lower(email)='rangelmaker@gmail.com') then raise exception 'administrador_permanente'; end if;
  if granted_plan is not null and granted_plan not in ('gratuito','essencial','profissional','estudio') then raise exception 'plano_invalido'; end if;
  select manual_plan into previous_plan from public.photographers where id=target_id for update;
  if not found then raise exception 'conta_nao_encontrada'; end if;
  update public.photographers set manual_plan=granted_plan,
    manual_granted_by=case when granted_plan is null then null else actor_id end,
    manual_granted_at=case when granted_plan is null then null else now() end where id=target_id;
  insert into public.plan_grants_log (photographer_id,previous_manual_plan,new_manual_plan,granted_by) values (target_id,previous_plan,granted_plan,actor_id);
end $$;
revoke all on function private.admin_grant_plan(uuid,uuid,text) from public, anon, authenticated;
grant execute on function private.admin_grant_plan(uuid,uuid,text) to service_role;
-- Wrappers da API exposta; as funções privilegiadas ficam no schema privado.
grant usage on schema private to service_role;
create or replace function public.admin_list_accounts()
returns table (id uuid, display_name text, slug text, email text, plan text, billing_plan text, manual_plan text, plan_source text, subscription_status text, manual_granted_at timestamptz)
language sql security invoker set search_path = public as $$
 select * from private.admin_list_accounts();
$$;
revoke all on function public.admin_list_accounts() from public, anon, authenticated;
grant execute on function public.admin_list_accounts() to service_role;
create or replace function public.admin_grant_plan(target_id uuid, actor_id uuid, granted_plan text)
returns void language sql security invoker set search_path = public as $$
 select private.admin_grant_plan(target_id, actor_id, granted_plan);
$$;
revoke all on function public.admin_grant_plan(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_grant_plan(uuid,uuid,text) to service_role;
commit;
