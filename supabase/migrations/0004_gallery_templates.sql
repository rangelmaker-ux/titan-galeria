-- Titan Galeria — templates de layout pra galeria pública. O fotógrafo
-- escolhe entre 3 modelos visuais na configuração da galeria.

alter table public.galleries
  add column template text not null default 'grid'
    check (template in ('grid', 'masonry', 'minimal'));
