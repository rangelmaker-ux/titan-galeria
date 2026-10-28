-- Testes reais de concessão, proteção do administrador e permissões; sem dados persistidos.
begin;
do $$
declare actor uuid; target uuid:=gen_random_uuid(); v_plan text; before_log bigint;
begin
  select id into actor from auth.users where lower(email)='rangelmaker@gmail.com';
  if actor is null then raise exception 'administrador inexistente'; end if;
  insert into auth.users (id,email,raw_user_meta_data) values (target,'titan-test-'||target||'@example.invalid','{"display_name":"Teste transacional de plano"}'::jsonb);
  select plan into v_plan from public.photographers where id=target;
  if v_plan <> 'gratuito' then raise exception 'novo cadastro nao gratuito'; end if;
  select count(*) into before_log from public.plan_grants_log where photographer_id=target;
  perform public.admin_grant_plan(target,actor,'estudio');
  select plan into v_plan from public.photographers where id=target;
  if v_plan <> 'estudio' then raise exception 'concessao nao aplicada'; end if;
  update public.photographers set billing_plan='gratuito',subscription_status='canceled' where id=target;
  select plan into v_plan from public.photographers where id=target;
  if v_plan <> 'estudio' then raise exception 'stripe removeu concessao manual'; end if;
  perform public.admin_grant_plan(target,actor,null);
  select plan into v_plan from public.photographers where id=target;
  if v_plan <> 'gratuito' then raise exception 'remocao nao restaurou gratuito'; end if;
  begin
    perform public.admin_grant_plan(target,target,'estudio');
    raise exception 'usuario comum conseguiu conceder plano';
  exception when raise_exception then
    if sqlerrm <> 'acesso_restrito' then raise; end if;
  end;
  begin
    perform public.admin_grant_plan(actor,actor,'gratuito');
    raise exception 'administrador perdeu acesso';
  exception when raise_exception then
    if sqlerrm <> 'administrador_permanente' then raise; end if;
  end;
  update public.photographers set billing_plan='gratuito',subscription_status='canceled',plan='gratuito' where id=actor;
  select plan into v_plan from public.photographers where id=actor;
  if v_plan <> 'estudio' then raise exception 'admin nao permanente'; end if;
  if (select count(*) from public.plan_grants_log where photographer_id=target) <> before_log+2 then raise exception 'auditoria incompleta'; end if;
  if has_column_privilege('authenticated','public.photographers','manual_plan','update') or has_column_privilege('authenticated','public.photographers','plan','update') then raise exception 'navegador pode elevar proprio plano'; end if;
  if not has_column_privilege('authenticated','public.photographers','avatar_url','update') then raise exception 'perfil ficou bloqueado'; end if;
  if has_function_privilege('authenticated','public.admin_grant_plan(uuid,uuid,text)','execute') then raise exception 'rpc de admin exposta ao navegador'; end if;
end $$;
set local role service_role;
select count(*) as accounts_visible_to_server from public.admin_list_accounts();
reset role;
rollback;
select 'PASS: admin permanente, concessao, revogacao, auditoria e permissoes; testes revertidos' as verification;
