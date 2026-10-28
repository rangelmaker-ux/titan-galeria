-- Titan Galeria — assinatura SaaS (o fotógrafo paga a Titan Galeria pra usar
-- a ferramenta; isso é separado do checkout que o cliente final paga pelas
-- fotos, que já existia antes). Ver README.md > "Configurando o Stripe
-- (assinaturas)".

alter table public.photographers
  add column plan text not null default 'essencial'
    check (plan in ('essencial', 'profissional', 'estudio')),
  add column subscription_status text not null default 'inactive'
    check (subscription_status in (
      'inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
    )),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column subscription_current_period_end timestamptz;

create index photographers_stripe_customer_idx
  on public.photographers(stripe_customer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Limite de galerias ativas no plano Essencial (até 5). Profissional e
-- Estúdio são ilimitados. Reforçado no banco (não só na UI) pra não dar pra
-- burlar inserindo direto via API/Supabase client.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_gallery_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  plano text;
  total int;
begin
  select plan into plano from public.photographers where id = new.photographer_id;

  if plano = 'essencial' then
    select count(*) into total from public.galleries
      where photographer_id = new.photographer_id;

    if total >= 5 then
      raise exception 'limite_galerias_essencial'
        using hint = 'O plano Essencial permite até 5 galerias. Faça upgrade pra criar mais.';
    end if;
  end if;

  return new;
end;
$$;

create trigger galleries_limit_essencial
  before insert on public.galleries
  for each row execute procedure public.enforce_gallery_limit();

-- ───────────────────────────────────────────────────────────────────────────
-- Limite de tipo de produto no plano Essencial (só 1 tipo ativo por vez:
-- download avulso, OU download de tudo, OU print — não os três).
-- Profissional e Estúdio liberam todos os tipos.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_product_type_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  plano text;
  outros_tipos int;
begin
  if new.active is not true then
    return new;
  end if;

  select plan into plano from public.photographers where id = new.photographer_id;

  if plano = 'essencial' then
    select count(*) into outros_tipos from public.products
      where photographer_id = new.photographer_id
        and active = true
        and type <> new.type
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if outros_tipos > 0 then
      raise exception 'limite_tipo_produto_essencial'
        using hint = 'O plano Essencial permite só um tipo de produto ativo. Faça upgrade pra liberar todos.';
    end if;
  end if;

  return new;
end;
$$;

create trigger products_type_limit_essencial
  before insert or update on public.products
  for each row execute procedure public.enforce_product_type_limit();
