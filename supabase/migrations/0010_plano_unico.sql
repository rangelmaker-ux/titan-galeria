-- Como cada fotógrafo agora usa o próprio Google Drive (migration 0009), a
-- Titan Galeria deixa de cobrar por nível de recurso. Passa a existir um
-- único plano pago ("titan") com acesso completo a tudo, e o que varia é só
-- o ciclo de cobrança: mensal (R$37), trimestral (R$97) ou anual (R$197).
-- O "gratuito" continua existindo apenas como o estado de quem ainda não
-- assinou (mesmos limites de antes: 5 fotos ou 1 vídeo de até 15MB/mês) —
-- não é mais vendido/anunciado como plano, só o ponto de partida da conta.
begin;

-- Contas que já pagavam Essencial, Profissional ou Estúdio passam a ter o
-- único plano Titan (acesso completo) — ninguém perde recurso na troca.
alter table public.photographers drop constraint if exists photographers_plan_check;
alter table public.photographers drop constraint if exists photographers_manual_plan_check;

update public.photographers set plan = 'titan' where plan in ('essencial', 'profissional', 'estudio');
update public.photographers set billing_plan = 'titan' where billing_plan in ('essencial', 'profissional', 'estudio');
update public.photographers set manual_plan = 'titan' where manual_plan in ('essencial', 'profissional', 'estudio');

alter table public.photographers add constraint photographers_plan_check check (plan in ('gratuito', 'titan'));
alter table public.photographers add constraint photographers_manual_plan_check check (manual_plan in ('gratuito', 'titan'));

-- Ciclo de cobrança da assinatura Stripe ativa (mensal/trimestral/anual),
-- só pra exibir no painel — não afeta nenhum limite.
alter table public.photographers add column if not exists billing_interval text check (billing_interval in ('mensal', 'trimestral', 'anual'));

create or replace function private.enforce_titan_account_plan()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.billing_plan is not distinct from old.billing_plan
    and new.manual_plan is not distinct from old.manual_plan and new.plan is distinct from old.plan then
    new.billing_plan := new.plan;
  end if;
  if exists (select 1 from auth.users where id=new.id and lower(email)='rangelmaker@gmail.com') then
    new.plan := 'titan'; new.plan_source := 'admin';
  elsif new.manual_plan is not null then
    new.plan := new.manual_plan; new.plan_source := 'manual';
  else
    new.plan := new.billing_plan; new.plan_source := 'stripe';
  end if;
  return new;
end $$;

create or replace function private.admin_grant_plan(target_id uuid, actor_id uuid, granted_plan text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare previous_plan text;
begin
  if not exists (select 1 from auth.users where id=actor_id and lower(email)='rangelmaker@gmail.com') then raise exception 'acesso_restrito'; end if;
  if exists (select 1 from auth.users where id=target_id and lower(email)='rangelmaker@gmail.com') then raise exception 'administrador_permanente'; end if;
  if granted_plan is not null and granted_plan not in ('gratuito','titan') then raise exception 'plano_invalido'; end if;
  select manual_plan into previous_plan from public.photographers where id=target_id for update;
  if not found then raise exception 'conta_nao_encontrada'; end if;
  update public.photographers set manual_plan=granted_plan,
    manual_granted_by=case when granted_plan is null then null else actor_id end,
    manual_granted_at=case when granted_plan is null then null else now() end where id=target_id;
  insert into public.plan_grants_log (photographer_id,previous_manual_plan,new_manual_plan,granted_by) values (target_id,previous_plan,granted_plan,actor_id);
end $$;

-- força o recálculo de `plan` pra quem ficou com billing_plan/manual_plan antigo
update public.photographers set plan = plan;

commit;
