-- Titan Galeria — corrige o default de share_token: Postgres não tem
-- encoding 'base64url' em encode(), só 'base64'/'hex'/'escape'. Troca pra
-- hex, que é url-safe sem precisar de substituição de caracteres.

alter table public.galleries
  alter column share_token set default encode(gen_random_bytes(16), 'hex');
