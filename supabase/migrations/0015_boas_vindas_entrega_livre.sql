-- Mensagem de boas-vindas animada (fade in/out) exibida antes do fluxo
-- atual (nome do pagador / galeria) e opção de dispensar o nome obrigatório
-- em galerias de entrega gratuita, onde o cliente só visualiza/baixa, sem
-- comprar nada. Presentation only; RLS de owner já existente continua
-- valendo.
ALTER TABLE public.galleries ADD COLUMN IF NOT EXISTS welcome_message jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.galleries ADD CONSTRAINT galleries_welcome_message_object CHECK (jsonb_typeof(welcome_message) = 'object' AND octet_length(welcome_message::text) <= 2048);
COMMENT ON COLUMN public.galleries.welcome_message IS 'Título, texto e fonte da tela animada mostrada antes da galeria. Vazio = pula direto pro fluxo atual.';

-- true (padrão, mantém o comportamento atual) = pede nome e sobrenome do
-- pagador antes de mostrar as fotos. false = pula esse formulário, o
-- cliente entra direto nas fotos (pensado pra entregas gratuitas, sem
-- venda, onde não existe comprovante de Pix pra conferir).
ALTER TABLE public.galleries ADD COLUMN IF NOT EXISTS require_client_name boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.galleries.require_client_name IS 'false = entrega gratuita: cliente entra direto nas fotos, sem informar nome/sobrenome.';
