-- Titan Galeria — armazenamento dos arquivos ORIGINAIS no Google Drive
-- (da conta do dono da plataforma), em vez do bucket privado do R2. Os
-- previews com marca d'água continuam no R2 público — só os originais em
-- alta resolução (usados pro download pago) mudam de lugar, pra não pesar
-- no armazenamento pago do R2 conforme a base de fotógrafos cresce.

alter table public.galleries
  add column drive_folder_id text;

alter table public.media
  add column drive_file_id text;

-- a partir de agora o original pode vir do Drive (r2_key_original fica nulo)
-- ou, pra mídia enviada antes dessa migração, continuar no R2.
alter table public.media
  alter column r2_key_original drop not null;
