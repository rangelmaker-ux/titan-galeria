-- Titan Galeria — plano gratuito permanente (5 fotos ou 1 vídeo até 15MB por
-- mês), chave Pix do fotógrafo e ledger manual de repasses.

-- ───────────────────────────────────────────────────────────────────────────
-- Plano gratuito vira o default de conta nova.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.photographers drop constraint photographers_plan_check;
alter table public.photographers add constraint photographers_plan_check
  check (plan in ('gratuito', 'essencial', 'profissional', 'estudio'));
alter table public.photographers alter column plan set default 'gratuito';
alter table public.photographers add column pix_key text;

-- ───────────────────────────────────────────────────────────────────────────
-- Tamanho do arquivo, pra poder reforçar o limite de 15MB por vídeo no
-- plano gratuito.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.media add column size_bytes bigint;

-- ───────────────────────────────────────────────────────────────────────────
-- Limite de uploads do plano gratuito: 5 fotos/mês e 1 vídeo de até 15MB/mês.
-- Reforçado no banco, não só na UI.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_free_plan_upload_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  fotografo_id uuid;
  plano text;
  total int;
begin
  select photographer_id into fotografo_id from public.galleries where id = new.gallery_id;
  select plan into plano from public.photographers where id = fotografo_id;

  if plano = 'gratuito' then
    if new.type = 'video' then
      if coalesce(new.size_bytes, 0) > 15 * 1024 * 1024 then
        raise exception 'limite_tamanho_video_gratuito'
          using hint = 'O plano gratuito permite vídeos de até 15MB. Faça upgrade pra enviar vídeos maiores.';
      end if;

      select count(*) into total from public.media m
        join public.galleries g on g.id = m.gallery_id
        where g.photographer_id = fotografo_id
          and m.type = 'video'
          and date_trunc('month', m.created_at) = date_trunc('month', now());

      if total >= 1 then
        raise exception 'limite_video_gratuito'
          using hint = 'O plano gratuito permite 1 vídeo por mês. Faça upgrade pra enviar mais.';
      end if;
    else
      select count(*) into total from public.media m
        join public.galleries g on g.id = m.gallery_id
        where g.photographer_id = fotografo_id
          and m.type = 'photo'
          and date_trunc('month', m.created_at) = date_trunc('month', now());

      if total >= 5 then
        raise exception 'limite_fotos_gratuito'
          using hint = 'O plano gratuito permite 5 fotos por mês. Faça upgrade pra enviar mais.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger media_limit_gratuito
  before insert on public.media
  for each row execute procedure public.enforce_free_plan_upload_limit();

-- ───────────────────────────────────────────────────────────────────────────
-- Repasses — registro manual de quanto já foi pago (via Pix) a cada
-- fotógrafo. Saldo a receber = soma dos pedidos pagos das galerias dele
-- menos a soma dos repasses já feitos. Só o painel admin (service role)
-- insere aqui.
-- ───────────────────────────────────────────────────────────────────────────
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.photographers(id) on delete cascade,
  amount_cents int not null,
  note text,
  created_at timestamptz not null default now()
);

create index payouts_photographer_idx on public.payouts(photographer_id);

alter table public.payouts enable row level security;

create policy "payouts_owner_read" on public.payouts
  for select using (photographer_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────
-- Modo "ao vivo" — a galeria pública fica atualizando sozinha enquanto o
-- fotógrafo sobe fotos durante o evento (estilo Banlek). A precificação por
-- foto/pacote já existe via products + allow_downloads, isso só liga o
-- auto-refresh na página pública.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.galleries add column realtime_mode boolean not null default false;
