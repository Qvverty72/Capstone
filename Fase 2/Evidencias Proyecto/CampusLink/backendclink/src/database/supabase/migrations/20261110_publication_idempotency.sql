-- Additive: existing publications/clients remain valid. The primary key already serializes operation IDs.
ALTER TABLE public.publicacion_recurso ADD COLUMN IF NOT EXISTS creation_payload_hash text;
