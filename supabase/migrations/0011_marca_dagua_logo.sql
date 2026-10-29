-- Marca d'água com a logo do próprio fotógrafo (em vez de só o nome em
-- texto), com posição, tamanho e opacidade ajustáveis e prévia ao vivo no
-- painel. Fica salvo por fotógrafo (vale pra todas as galerias dele).
begin;

alter table public.photographers add column if not exists watermark_logo_url text;
alter table public.photographers add column if not exists watermark_pos_x real not null default 50;  -- % da largura, 0=esquerda 100=direita
alter table public.photographers add column if not exists watermark_pos_y real not null default 50;  -- % da altura, 0=topo 100=base
alter table public.photographers add column if not exists watermark_scale real not null default 20;  -- largura da logo em % da largura da foto
alter table public.photographers add column if not exists watermark_opacity real not null default 70; -- 0-100

-- Grants são aditivos (não dá pra "excluir" uma coluna de um grant já
-- existente) — isso só ACRESCENTA estas 5 colunas ao que migration 0008 já
-- libera pro próprio fotógrafo editar (slug, display_name, bio, avatar_url,
-- cover_url, instagram, whatsapp, pix_key).
grant update (watermark_logo_url, watermark_pos_x, watermark_pos_y, watermark_scale, watermark_opacity)
  on public.photographers to authenticated;

commit;
