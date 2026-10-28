-- Titan Galeria — schema inicial
-- Rodar no SQL Editor do Supabase (ou via `supabase db push`).

create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────────────────────
-- Fotógrafos (1 linha por conta, espelha auth.users via trigger)
-- ───────────────────────────────────────────────────────────────────────────
create table public.photographers (
  id uuid primary key references auth.users(id) on delete cascade,
  slug text unique not null,                -- usado na URL pública: /p/<slug>
  display_name text not null,
  bio text,
  avatar_url text,
  cover_url text,
  instagram text,
  whatsapp text,
  created_at timestamptz not null default now()
);

-- cria a linha em photographers automaticamente quando um usuário se cadastra
create or replace function public.handle_new_photographer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.photographers (id, slug, display_name)
  values (
    new.id,
    'f' || substr(replace(new.id::text, '-', ''), 1, 10),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_photographer();

-- ───────────────────────────────────────────────────────────────────────────
-- Galerias
-- ───────────────────────────────────────────────────────────────────────────
create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  title text not null,
  slug text not null,                        -- único por fotógrafo: /p/<slug>/<gallery-slug>
  description text,
  cover_media_id uuid,                        -- setado depois do upload (FK adicionada abaixo)
  client_name text,
  share_token text unique not null default encode(gen_random_bytes(12), 'base64url'),
  password_hash text,                         -- null = sem senha
  is_published boolean not null default false, -- true = aparece no portfólio público
  allow_favorites boolean not null default true,
  allow_downloads boolean not null default false,
  watermark_previews boolean not null default true,
  created_at timestamptz not null default now(),
  unique (photographer_id, slug)
);

create index galleries_photographer_idx on public.galleries(photographer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Mídia (fotos e vídeos de uma galeria)
-- ───────────────────────────────────────────────────────────────────────────
create type media_type as enum ('photo', 'video');

create table public.media (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  type media_type not null default 'photo',
  r2_key_original text not null,              -- chave do arquivo original no bucket R2
  r2_key_preview text,                        -- versão com marca d'água / resolução reduzida
  width int,
  height int,
  duration_s numeric,                         -- só pra vídeo
  position int not null default 0,            -- ordem de exibição
  created_at timestamptz not null default now()
);

create index media_gallery_idx on public.media(gallery_id);

alter table public.galleries
  add constraint galleries_cover_media_fk
  foreign key (cover_media_id) references public.media(id) on delete set null;

-- ───────────────────────────────────────────────────────────────────────────
-- Favoritos / aprovação do cliente (sem precisar de conta — identificado por
-- um "apelido" ou e-mail informado na própria galeria)
-- ───────────────────────────────────────────────────────────────────────────
create table public.media_selections (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  client_identifier text not null,            -- e-mail ou nome informado pelo cliente na galeria
  favorited boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (media_id, client_identifier)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Produtos (o que pode ser vendido numa galeria: download avulso, pacote de
-- downloads, print em tamanhos específicos)
-- ───────────────────────────────────────────────────────────────────────────
create type product_type as enum ('download_single', 'download_all', 'print');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  type product_type not null,
  name text not null,
  description text,
  price_cents int not null,
  currency text not null default 'brl',
  print_size text,                            -- ex: "15x21", "20x30" — só pra type=print
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_photographer_idx on public.products(photographer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Pedidos
-- ───────────────────────────────────────────────────────────────────────────
create type order_status as enum ('pending', 'paid', 'fulfilled', 'canceled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  client_identifier text not null,
  client_email text,
  status order_status not null default 'pending',
  stripe_checkout_session_id text unique,
  total_cents int not null default 0,
  currency text not null default 'brl',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  media_id uuid references public.media(id),  -- null pra produtos tipo "download_all"
  quantity int not null default 1,
  unit_price_cents int not null,
  -- marcado manualmente pelo fotógrafo quando o print físico foi enviado
  -- (integração real com gráfica fica pra uma versão futura, ver README)
  fulfilled boolean not null default false
);

create index orders_gallery_idx on public.orders(gallery_id);
create index order_items_order_idx on public.order_items(order_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ───────────────────────────────────────────────────────────────────────────
alter table public.photographers enable row level security;
alter table public.galleries enable row level security;
alter table public.media enable row level security;
alter table public.media_selections enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- fotógrafo só vê/edita os próprios dados
create policy "photographer_self" on public.photographers
  for all using (id = auth.uid()) with check (id = auth.uid());

-- leitura pública do perfil (portfólio) é feita via view/API server-side com
-- service role, então não precisa de policy pública aqui.

create policy "galleries_owner" on public.galleries
  for all using (photographer_id = auth.uid()) with check (photographer_id = auth.uid());

create policy "media_owner" on public.media
  for all using (
    gallery_id in (select id from public.galleries where photographer_id = auth.uid())
  );

create policy "products_owner" on public.products
  for all using (photographer_id = auth.uid()) with check (photographer_id = auth.uid());

create policy "orders_owner_read" on public.orders
  for select using (
    gallery_id in (select id from public.galleries where photographer_id = auth.uid())
  );

create policy "order_items_owner_read" on public.order_items
  for select using (
    order_id in (
      select o.id from public.orders o
      join public.galleries g on g.id = o.gallery_id
      where g.photographer_id = auth.uid()
    )
  );

-- media_selections e o fluxo de checkout público são acessados pelo backend
-- usando a service role key (rotas /api/*), nunca direto do navegador do
-- cliente final — por isso não precisam de policy pública aqui.
