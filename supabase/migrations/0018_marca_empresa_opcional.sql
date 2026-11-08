-- Nome da empresa nas fotos da entrega gratuita: opcional, desligado por padrão.
-- (Antes isso usava watermark_previews, que é true por padrão em todas as galerias.)
ALTER TABLE public.galleries ADD COLUMN IF NOT EXISTS show_brand_name boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.galleries.show_brand_name IS 'true = mostra o nome da empresa sobre as fotos (só na tela) em galerias de entrega gratuita.';
