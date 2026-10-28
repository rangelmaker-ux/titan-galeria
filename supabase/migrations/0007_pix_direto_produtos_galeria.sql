-- Pix direto ao profissional. Preserva pedidos, produtos e repasses históricos.
begin;
alter table public.products add column if not exists gallery_id uuid references public.galleries(id) on delete set null;
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists payment_method text not null default 'stripe';
alter table public.orders add column if not exists access_token_hash text;
alter table public.orders add column if not exists client_request_id uuid;
alter table public.orders add column if not exists pix_key_snapshot text;
alter table public.orders add column if not exists whatsapp_snapshot text;
alter table public.orders add column if not exists approved_by uuid references auth.users(id);
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists product_type text;
create unique index if not exists orders_client_request_id_idx on public.orders(client_request_id);
create index if not exists products_gallery_idx on public.products(gallery_id) where deleted_at is null;

-- Executada exclusivamente pelo servidor autenticado como service_role.
-- Pedido e seleção são gravados juntos; repetir a mesma requisição não duplica.
create or replace function public.create_manual_order(order_data jsonb, items_data jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare order_id uuid;
begin
  insert into public.orders (gallery_id, client_identifier, client_email, total_cents, currency,
    payment_method, access_token_hash, client_request_id, pix_key_snapshot, whatsapp_snapshot)
  values ((order_data->>'gallery_id')::uuid, order_data->>'client_identifier', order_data->>'client_email',
    (order_data->>'total_cents')::int, 'brl', 'manual_pix', order_data->>'access_token_hash',
    (order_data->>'client_request_id')::uuid, order_data->>'pix_key_snapshot', order_data->>'whatsapp_snapshot')
  on conflict (client_request_id) do nothing returning id into order_id;
  if order_id is null then
    select id into order_id from public.orders where client_request_id = (order_data->>'client_request_id')::uuid
      and access_token_hash = order_data->>'access_token_hash' and gallery_id = (order_data->>'gallery_id')::uuid;
    if order_id is null then raise exception 'pedido_invalido'; end if;
    return order_id;
  end if;
  insert into public.order_items (order_id, product_id, media_id, unit_price_cents, product_name, product_type)
    select order_id, (i->>'product_id')::uuid, (i->>'media_id')::uuid, (i->>'unit_price_cents')::int,
      i->>'product_name', i->>'product_type' from jsonb_array_elements(items_data) i;
  return order_id;
end; $$;
revoke all on function public.create_manual_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_manual_order(jsonb, jsonb) to service_role;
commit;
