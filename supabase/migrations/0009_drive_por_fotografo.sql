-- Cada fotógrafo passa a conectar o próprio Google Drive (OAuth), em vez de
-- usar a conta única do administrador. Dentro do Drive dele nasce a pasta
-- raiz "Titan Galeria", e as tags que ele digitar ao criar uma galeria
-- (aniversário, casamento...) viram subpastas reaproveitáveis ali dentro.
-- Fotógrafos que ainda não conectaram continuam usando a conta do admin
-- (GOOGLE_REFRESH_TOKEN), sem quebrar nada já enviado.
begin;

alter table public.photographers add column if not exists drive_refresh_token text;
alter table public.photographers add column if not exists drive_root_folder_id text;
alter table public.photographers add column if not exists drive_email text;
alter table public.photographers add column if not exists drive_connected_at timestamptz;
-- drive_refresh_token é uma credencial (equivalente a uma senha do Drive do
-- fotógrafo). O UPDATE já fica de fora por padrão (migration 0008 só libera
-- colunas específicas pro fotógrafo); o código nunca seleciona essa coluna
-- fora de rotas internas com service_role.

create table if not exists public.drive_tags (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  name text not null,
  drive_folder_id text not null,
  created_at timestamptz not null default now(),
  unique (photographer_id, name)
);
alter table public.drive_tags enable row level security;

-- o fotógrafo só vê as próprias tags (autocompletar ao criar galeria); criar
-- uma tag exige chamar a API do Drive, então isso fica só com o backend.
create policy "drive_tags_owner_select" on public.drive_tags
  for select using (photographer_id = auth.uid());
revoke insert, update, delete on public.drive_tags from authenticated, anon;
grant select on public.drive_tags to authenticated;

alter table public.galleries add column if not exists drive_tag_id uuid references public.drive_tags(id) on delete set null;

commit;
