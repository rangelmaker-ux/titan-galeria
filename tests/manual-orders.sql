-- Teste real transacional: todos os registros de teste são revertidos.
begin;
do $$
declare
  g uuid; p uuid; m uuid; o uuid; again uuid; bad_request uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid(); payload jsonb; items jsonb;
begin
  select galleries.id into g from public.galleries join auth.users u on u.id = galleries.photographer_id
    where lower(u.email) = 'rangelmaker@gmail.com' order by galleries.created_at limit 1;
  if g is null then raise exception 'galeria de teste indisponivel'; end if;
  insert into public.products (photographer_id, gallery_id, type, name, price_cents, active)
    select photographer_id, g, 'download_single', 'Teste transacional - rollback', 2000, false from public.galleries where id=g returning id into p;
  insert into public.media (gallery_id, type, r2_key_preview, drive_file_id)
    values (g, 'photo', 'test-only-rollback.jpg', 'test-only-rollback') returning id into m;
  payload := jsonb_build_object('gallery_id',g,'client_identifier','Cliente Teste Rollback','total_cents',2000,
    'access_token_hash',repeat('a',64),'client_request_id',request_id,'pix_key_snapshot','teste@exemplo.invalid','whatsapp_snapshot','11999999999');
  items := jsonb_build_array(jsonb_build_object('product_id',p,'media_id',m,'unit_price_cents',2000,'product_name','Teste','product_type','download_single'));
  o := public.create_manual_order(payload,items);
  again := public.create_manual_order(payload,items);
  if o <> again then raise exception 'idempotencia falhou'; end if;
  if (select count(*) from public.order_items where order_id=o) <> 1 then raise exception 'selecao duplicada'; end if;
  if (select payment_method from public.orders where id=o) <> 'manual_pix' then raise exception 'metodo incorreto'; end if;
  begin
    perform public.create_manual_order(payload || jsonb_build_object('client_request_id',bad_request),
      jsonb_build_array(jsonb_build_object('product_id',p,'media_id',gen_random_uuid(),'unit_price_cents',2000)));
    raise exception 'deveria falhar a referencia da midia';
  exception when foreign_key_violation then null;
  end;
  if exists (select 1 from public.orders where client_request_id=bad_request) then raise exception 'pedido parcial persistiu'; end if;
end $$;
rollback;
select 'PASS: idempotencia, selecao e atomicidade; fixtures revertidas' as verification;
