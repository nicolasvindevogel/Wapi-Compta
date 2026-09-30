-- ============================================================
-- WAPI One V34.4
-- Assistant copro, adresses structurées, VCS, archivage
-- ============================================================

ALTER TABLE IF EXISTS public.compta_copros
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Belgique',
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE IF EXISTS public.compta_owners
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Belgique',
  ADD COLUMN IF NOT EXISTS vcs text,
  ADD COLUMN IF NOT EXISTS identity_key text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE IF EXISTS public.compta_suppliers
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Belgique',
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE IF EXISTS public.compta_occupants
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Belgique';

UPDATE public.compta_copros SET active = true WHERE active IS NULL;
UPDATE public.compta_owners SET active = true WHERE active IS NULL;
UPDATE public.compta_suppliers SET active = true WHERE active IS NULL;

CREATE SEQUENCE IF NOT EXISTS public.wapi_vcs_sequence START 1;

CREATE TABLE IF NOT EXISTS public.wapi_owner_vcs_registry (
  identity_key text PRIMARY KEY,
  vcs text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.wapi_normalize_identity(src text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(src, ''))), '[^a-z0-9]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.wapi_format_vcs(seq_value bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_digits text;
  checksum integer;
  all_digits text;
BEGIN
  base_digits := lpad((seq_value % 10000000000)::text, 10, '0');
  checksum := (base_digits::numeric % 97)::integer;
  IF checksum = 0 THEN checksum := 97; END IF;
  all_digits := base_digits || lpad(checksum::text, 2, '0');
  RETURN '+++' || substring(all_digits, 1, 3) || '/' ||
         substring(all_digits, 4, 4) || '/' ||
         substring(all_digits, 8, 5) || '+++';
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_owner_identity_key(
  owner_email text,
  owner_name text,
  owner_street text,
  owner_number text,
  owner_postal text,
  owner_city text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.wapi_normalize_identity(owner_email) <> ''
      THEN 'email:' || public.wapi_normalize_identity(owner_email)
    ELSE 'person:' || public.wapi_normalize_identity(owner_name) || '|addr:' ||
      public.wapi_normalize_identity(concat_ws('|', owner_street, owner_number, owner_postal, owner_city))
  END;
$$;

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
    IF NEW.vcs IS NULL OR trim(NEW.vcs) = '' THEN
      next_value := nextval('public.wapi_vcs_sequence');
      existing_vcs := public.wapi_format_vcs(next_value);
    ELSE
      existing_vcs := NEW.vcs;
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

DROP TRIGGER IF EXISTS trg_wapi_assign_owner_vcs ON public.compta_owners;
CREATE TRIGGER trg_wapi_assign_owner_vcs
BEFORE INSERT OR UPDATE OF email, display_name, street, street_number, postal_code, city, country, vcs
ON public.compta_owners
FOR EACH ROW EXECUTE FUNCTION public.wapi_assign_owner_vcs();

-- Initialise les VCS manquantes. Les doublons reconnus partagent la même VCS.
UPDATE public.compta_owners SET vcs = NULL;

CREATE INDEX IF NOT EXISTS compta_owners_vcs_idx ON public.compta_owners(vcs);
CREATE INDEX IF NOT EXISTS compta_owners_identity_key_idx ON public.compta_owners(identity_key);
CREATE INDEX IF NOT EXISTS compta_copros_active_idx ON public.compta_copros(active);

CREATE OR REPLACE FUNCTION public.wapi_delete_owner_if_unused(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  linked_lots integer := 0;
  linked_calls integer := 0;
  linked_bank integer := 0;
  linked_opening integer := 0;
BEGIN
  SELECT count(*) INTO linked_lots FROM public.compta_lots WHERE owner_id = p_owner_id;
  SELECT count(*) INTO linked_calls FROM public.compta_owner_calls WHERE owner_id = p_owner_id;
  SELECT count(*) INTO linked_bank FROM public.compta_bank_transactions
    WHERE tier_type = 'owner' AND tier_id = p_owner_id;
  SELECT count(*) INTO linked_opening FROM public.compta_third_opening_balances
    WHERE tier_type = 'owner' AND tier_id = p_owner_id;

  IF linked_lots + linked_calls + linked_bank + linked_opening > 0 THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'lots', linked_lots,
      'accounting', linked_calls + linked_bank + linked_opening
    );
  END IF;

  DELETE FROM public.compta_owners WHERE id = p_owner_id;
  RETURN jsonb_build_object('deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_create_copro_structure(
  p_copro jsonb,
  p_year jsonb DEFAULT '{}'::jsonb,
  p_lots jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_copro_id uuid;
  new_year_id uuid;
  default_key_id uuid;
  lot_item jsonb;
  new_lot_id uuid;
  full_address text;
BEGIN
  full_address := trim(concat_ws(' ', nullif(p_copro->>'street', ''), nullif(p_copro->>'street_number', '')))
    || CASE WHEN coalesce(p_copro->>'postal_code', '') <> '' OR coalesce(p_copro->>'city', '') <> ''
       THEN ', ' || trim(concat_ws(' ', nullif(p_copro->>'postal_code', ''), nullif(p_copro->>'city', ''))) ELSE '' END
    || CASE WHEN coalesce(p_copro->>'country', '') <> '' THEN ', ' || (p_copro->>'country') ELSE '' END;

  INSERT INTO public.compta_copros(
    name, code, bce, address, street, street_number, postal_code, city, country,
    manager_user_id, manager_name, optipro_ref, active, created_by
  ) VALUES (
    nullif(p_copro->>'name', ''),
    nullif(upper(p_copro->>'code'), ''),
    nullif(p_copro->>'bce', ''),
    full_address,
    nullif(p_copro->>'street', ''),
    nullif(p_copro->>'street_number', ''),
    nullif(p_copro->>'postal_code', ''),
    nullif(p_copro->>'city', ''),
    coalesce(nullif(p_copro->>'country', ''), 'Belgique'),
    nullif(p_copro->>'manager_user_id', '')::uuid,
    nullif(p_copro->>'manager_name', ''),
    nullif(p_copro->>'optipro_ref', ''),
    true,
    auth.uid()
  ) RETURNING id INTO new_copro_id;

  IF coalesce((p_year->>'create')::boolean, true) THEN
    INSERT INTO public.compta_fiscal_years(
      copro_id, label, code, year_code, starts_on, ends_on, status, created_by
    ) VALUES (
      new_copro_id,
      nullif(p_year->>'label', ''),
      nullif(upper(p_year->>'code'), ''),
      nullif(upper(p_year->>'code'), ''),
      nullif(p_year->>'starts_on', '')::date,
      nullif(p_year->>'ends_on', '')::date,
      'open',
      auth.uid()
    ) RETURNING id INTO new_year_id;
  END IF;

  INSERT INTO public.compta_distribution_keys(copro_id, name, is_default, created_by)
  VALUES (new_copro_id, 'Quotités générales', true, auth.uid())
  RETURNING id INTO default_key_id;

  FOR lot_item IN SELECT value FROM jsonb_array_elements(coalesce(p_lots, '[]'::jsonb))
  LOOP
    INSERT INTO public.compta_lots(
      copro_id, lot_number, lot_type, quotities, active, created_by
    ) VALUES (
      new_copro_id,
      lot_item->>'lot_number',
      coalesce(nullif(lot_item->>'lot_type', ''), 'Appartement'),
      coalesce((lot_item->>'quotities')::numeric, 0),
      true,
      auth.uid()
    ) RETURNING id INTO new_lot_id;

    INSERT INTO public.compta_distribution_items(
      distribution_key_id, lot_id, quotities, included, created_by
    ) VALUES (
      default_key_id,
      new_lot_id,
      coalesce((lot_item->>'quotities')::numeric, 0),
      true,
      auth.uid()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'copro_id', new_copro_id,
    'fiscal_year_id', new_year_id,
    'distribution_key_id', default_key_id,
    'lots_created', jsonb_array_length(coalesce(p_lots, '[]'::jsonb))
  );
END;
$$;
