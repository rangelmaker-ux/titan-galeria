-- Presentation only; existing RLS ownership policies continue to apply.
ALTER TABLE public.galleries ADD COLUMN IF NOT EXISTS delivery_design jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.galleries ADD CONSTRAINT galleries_delivery_design_object CHECK (jsonb_typeof(delivery_design) = 'object' AND octet_length(delivery_design::text) <= 4096);
COMMENT ON COLUMN public.galleries.delivery_design IS 'Cover photo from the same gallery, opacity, framing, title, message, signature, date and system font choices.';
