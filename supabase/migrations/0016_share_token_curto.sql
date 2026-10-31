-- O link público ficava feio porque o token aleatório é longo demais pra
-- aparecer numa URL (a migration 0005 trocou o default pra
-- gen_random_bytes(16) em hex = 32 caracteres). Daqui pra frente, toda
-- galeria NOVA recebe um token bem mais curto (8 bytes em base64url = 11
-- caracteres) — continua imprevisível (64 bits de entropia, de sobra pra
-- isso), só que cabe numa URL sem parecer lixo.
--
-- Galerias já existentes NÃO são alteradas — o token delas continua do jeito
-- que está (16 ou 32 caracteres, dependendo de quando foram criadas) e os
-- links que já foram compartilhados continuam funcionando normalmente. Ver
-- src/lib/share-link.ts (shareTokenCandidates) pra como o código lida com os
-- três formatos possíveis na hora de resolver um link.
--
-- Postgres não tem o encoding 'base64url' em encode() (só 'base64'/'hex'/
-- 'escape' — a migration 0005 já teve que corrigir esse mesmo engano antes),
-- então gera em base64 normal e troca os caracteres não url-safe (+ / =)
-- igual o base64url faria.
alter table public.galleries
  alter column share_token set default rtrim(replace(replace(encode(gen_random_bytes(8), 'base64'), '+', '-'), '/', '_'), '=');
