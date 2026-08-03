-- ============================================================
-- WAPI One V34.4.1
-- Génération idempotente des VCS manquantes
-- ============================================================

CREATE OR REPLACE FUNCTION public.wapi_generate_missing_owner_vcs(
  p_copro_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  missing_before integer := 0;
  missing_after integer := 0;
BEGIN
  SELECT count(*) INTO missing_before
  FROM public.compta_owners
  WHERE (vcs IS NULL OR trim(vcs) = '')
    AND (p_copro_id IS NULL OR copro_id = p_copro_id);

  -- Le trigger V34.4 attribue une VCS uniquement aux lignes manquantes.
  -- Une VCS existante n'est donc jamais remplacée.
  UPDATE public.compta_owners
  SET vcs = NULL
  WHERE (vcs IS NULL OR trim(vcs) = '')
    AND (p_copro_id IS NULL OR copro_id = p_copro_id);

  SELECT count(*) INTO missing_after
  FROM public.compta_owners
  WHERE (vcs IS NULL OR trim(vcs) = '')
    AND (p_copro_id IS NULL OR copro_id = p_copro_id);

  RETURN jsonb_build_object(
    'generated', missing_before - missing_after,
    'already_present', (
      SELECT count(*)
      FROM public.compta_owners
      WHERE vcs IS NOT NULL AND trim(vcs) <> ''
        AND (p_copro_id IS NULL OR copro_id = p_copro_id)
    ),
    'remaining', missing_after
  );
END;
$$;
