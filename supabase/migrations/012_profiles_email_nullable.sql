-- profiles.email must be nullable so that permanently-deleted accounts can have
-- their email freed (set to NULL) while preserving the history row.
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
