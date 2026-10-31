-- Continuação da 0016: aplica o token curto (8 bytes em base64url = 11
-- caracteres) retroativamente em TODAS as galerias que já existem, não só
-- nas novas. Isso GERA UM TOKEN NOVO pra cada galeria — qualquer link que
-- já foi compartilhado com um token antigo (16 ou 32 caracteres) para de
-- funcionar depois disso, porque o valor do token muda. A tela de
-- compartilhar link no painel (ShareLink) sempre lê o valor atual do banco,
-- então o fotógrafo não precisa fazer nada — só precisa reenviar o link pro
-- cliente se já tinha enviado antes.
update public.galleries
set share_token = encode(gen_random_bytes(8), 'base64url')
where deleted_at is null;
