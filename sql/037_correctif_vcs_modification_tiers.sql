-- WAPI One V35.1.1
-- Correctif : conserver une VCS lorsque l'identite d'un coproprietaire est modifiee.

BEGIN;

-- Une meme personne peut avoir plusieurs cles d'identite historiques
-- (ancienne/nouvelle adresse mail, changement d'adresse, presence dans plusieurs ACP)
-- tout en conservant une seule communication VCS.
ALTER TABLE IF EXISTS public.wapi_owner_vcs_registry
  DROP CONSTRAINT IF EXISTS wapi_owner_vcs_registry_vcs_key;

DROP INDEX IF EXISTS public.wapi_owner_vcs_registry_vcs_key;

CREATE INDEX IF NOT EXISTS wapi_owner_vcs_registry_vcs_idx
  ON public.wapi_owner_vcs_registry(vcs);

-- Le trigger conserve OLD.vcs lors d'une modification et enregistre la nouvelle
-- cle comme alias. Pour une creation, il recherche d'abord une identite connue,
-- sinon il genere une nouvelle VCS via la sequence.
CREATE OR REPLACE FUNCTION public.wapi_assign_owner_vcs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  wanted_key text;
  existing_vcs text;
  next_value bigint;
BEGIN
  wanted_key := public.wapi_owner_identity_key(
    NEW.email, NEW.display_name, NEW.street, NEW.street_number, NEW.postal_code, NEW.city
  );
  NEW.identity_key := wanted_key;

  SELECT r.vcs INTO existing_vcs
  FROM public.wapi_owner_vcs_registry r
  WHERE r.identity_key = wanted_key;

  IF existing_vcs IS NOT NULL THEN
    NEW.vcs := existing_vcs;
  ELSE
    IF TG_OP = 'UPDATE' AND OLD.vcs IS NOT NULL AND trim(OLD.vcs) <> '' THEN
      existing_vcs := OLD.vcs;
    ELSIF NEW.vcs IS NOT NULL AND trim(NEW.vcs) <> '' THEN
      existing_vcs := NEW.vcs;
    ELSE
      next_value := nextval('public.wapi_vcs_sequence');
      existing_vcs := public.wapi_format_vcs(next_value);
    END IF;

    INSERT INTO public.wapi_owner_vcs_registry(identity_key, vcs)
    VALUES (wanted_key, existing_vcs)
    ON CONFLICT (identity_key) DO UPDATE SET vcs = EXCLUDED.vcs
    RETURNING vcs INTO existing_vcs;
    NEW.vcs := existing_vcs;
  END IF;

  NEW.address := trim(concat_ws(' ', nullif(NEW.street, ''), nullif(NEW.street_number, '')))
    || CASE WHEN coalesce(NEW.postal_code, '') <> '' OR coalesce(NEW.city, '') <> ''
       THEN ', ' || trim(concat_ws(' ', nullif(NEW.postal_code, ''), nullif(NEW.city, ''))) ELSE '' END
    || CASE WHEN coalesce(NEW.country, '') <> '' THEN ', ' || NEW.country ELSE '' END;
  RETURN NEW;
END;
$$;

COMMIT;
