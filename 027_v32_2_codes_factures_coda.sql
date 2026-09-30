-- ============================================================
-- WAPI One V32.2
-- Codes tiers, code copro/exercice, numérotation interne factures
-- Exemple : ALB-EX26-001
-- ============================================================

-- Codes copro / exercices
ALTER TABLE IF EXISTS public.compta_copros
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE IF EXISTS public.compta_fiscal_years
  ADD COLUMN IF NOT EXISTS code text;

-- Codes tiers. On garde également les anciens noms éventuels pour compatibilité.
ALTER TABLE IF EXISTS public.compta_owners
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS owner_code text;

ALTER TABLE IF EXISTS public.compta_suppliers
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS supplier_code text;

-- Numérotation interne des factures fournisseurs de copropriété.
ALTER TABLE IF EXISTS public.compta_invoices
  ADD COLUMN IF NOT EXISTS internal_invoice_number text,
  ADD COLUMN IF NOT EXISTS internal_invoice_prefix text,
  ADD COLUMN IF NOT EXISTS internal_invoice_sequence integer;

-- Backfill : si d'anciennes colonnes existaient déjà.
UPDATE public.compta_owners
SET code = COALESCE(NULLIF(trim(code), ''), NULLIF(trim(owner_code), ''))
WHERE COALESCE(NULLIF(trim(code), ''), '') = ''
  AND COALESCE(NULLIF(trim(owner_code), ''), '') <> '';

UPDATE public.compta_suppliers
SET code = COALESCE(NULLIF(trim(code), ''), NULLIF(trim(supplier_code), ''))
WHERE COALESCE(NULLIF(trim(code), ''), '') = ''
  AND COALESCE(NULLIF(trim(supplier_code), ''), '') <> '';

-- Backfill codes propriétaires.
WITH numbered AS (
  SELECT id, 'C-' || lpad(row_number() OVER (ORDER BY COALESCE(created_at, now()), display_name, id)::text, 4, '0') AS new_code
  FROM public.compta_owners
  WHERE COALESCE(NULLIF(trim(code), ''), '') = ''
)
UPDATE public.compta_owners o
SET code = n.new_code, owner_code = n.new_code
FROM numbered n
WHERE o.id = n.id;

UPDATE public.compta_owners
SET owner_code = code
WHERE COALESCE(NULLIF(trim(owner_code), ''), '') = ''
  AND COALESCE(NULLIF(trim(code), ''), '') <> '';

-- Backfill codes fournisseurs.
WITH numbered AS (
  SELECT id, 'F-' || lpad(row_number() OVER (ORDER BY COALESCE(created_at, now()), name, id)::text, 4, '0') AS new_code
  FROM public.compta_suppliers
  WHERE COALESCE(NULLIF(trim(code), ''), '') = ''
)
UPDATE public.compta_suppliers s
SET code = n.new_code, supplier_code = n.new_code
FROM numbered n
WHERE s.id = n.id;

UPDATE public.compta_suppliers
SET supplier_code = code
WHERE COALESCE(NULLIF(trim(supplier_code), ''), '') = ''
  AND COALESCE(NULLIF(trim(code), ''), '') <> '';

-- Index uniques partiels.
CREATE UNIQUE INDEX IF NOT EXISTS compta_owners_code_unique_idx
  ON public.compta_owners(code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS compta_suppliers_code_unique_idx
  ON public.compta_suppliers(code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS compta_invoices_internal_number_unique_idx
  ON public.compta_invoices(internal_invoice_number)
  WHERE internal_invoice_number IS NOT NULL;

-- Fonctions de génération de codes tiers.
CREATE OR REPLACE FUNCTION public.wapi_next_owner_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::integer), 0) + 1
  INTO n
  FROM public.compta_owners
  WHERE code ~ '^C-[0-9]+';
  RETURN 'C-' || lpad(n::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_next_supplier_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::integer), 0) + 1
  INTO n
  FROM public.compta_suppliers
  WHERE code ~ '^F-[0-9]+';
  RETURN 'F-' || lpad(n::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_set_owner_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.wapi_next_owner_code();
  END IF;
  IF NEW.owner_code IS NULL OR trim(NEW.owner_code) = '' THEN
    NEW.owner_code := NEW.code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_set_supplier_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.wapi_next_supplier_code();
  END IF;
  IF NEW.supplier_code IS NULL OR trim(NEW.supplier_code) = '' THEN
    NEW.supplier_code := NEW.code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wapi_set_owner_code ON public.compta_owners;
CREATE TRIGGER trg_wapi_set_owner_code
BEFORE INSERT ON public.compta_owners
FOR EACH ROW EXECUTE FUNCTION public.wapi_set_owner_code();

DROP TRIGGER IF EXISTS trg_wapi_set_supplier_code ON public.compta_suppliers;
CREATE TRIGGER trg_wapi_set_supplier_code
BEFORE INSERT ON public.compta_suppliers
FOR EACH ROW EXECUTE FUNCTION public.wapi_set_supplier_code();

-- Numérotation interne des factures fournisseurs copro.
CREATE OR REPLACE FUNCTION public.wapi_clean_code(src text, fallback text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE c text;
BEGIN
  c := upper(regexp_replace(coalesce(src, fallback, 'COP'), '[^A-Za-z0-9]', '', 'g'));
  IF c IS NULL OR trim(c) = '' THEN c := fallback; END IF;
  RETURN substring(c from 1 for 8);
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_set_invoice_internal_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  copro_code text;
  year_code text;
  inv_date date;
  prefix_value text;
  next_seq integer;
BEGIN
  IF NEW.internal_invoice_number IS NOT NULL AND trim(NEW.internal_invoice_number) <> '' THEN
    RETURN NEW;
  END IF;

  inv_date := COALESCE(NEW.invoice_date, CURRENT_DATE);

  SELECT public.wapi_clean_code(COALESCE(c.code, c.optipro_ref, c.name), 'COP')
  INTO copro_code
  FROM public.compta_copros c
  WHERE c.id = NEW.copro_id;

  IF copro_code IS NULL OR trim(copro_code) = '' THEN
    copro_code := 'COP';
  END IF;

  SELECT COALESCE(NULLIF(trim(fy.code), ''), 'EX' || to_char(inv_date, 'YY'))
  INTO year_code
  FROM public.compta_fiscal_years fy
  WHERE fy.copro_id = NEW.copro_id
    AND inv_date BETWEEN fy.starts_on AND fy.ends_on
  ORDER BY fy.starts_on DESC
  LIMIT 1;

  IF year_code IS NULL OR trim(year_code) = '' THEN
    year_code := 'EX' || to_char(inv_date, 'YY');
  END IF;

  prefix_value := copro_code || '-' || upper(year_code);

  SELECT COALESCE(MAX(internal_invoice_sequence), 0) + 1
  INTO next_seq
  FROM public.compta_invoices
  WHERE internal_invoice_prefix = prefix_value;

  NEW.internal_invoice_prefix := prefix_value;
  NEW.internal_invoice_sequence := next_seq;
  NEW.internal_invoice_number := prefix_value || '-' || lpad(next_seq::text, 3, '0');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wapi_set_invoice_internal_number ON public.compta_invoices;
CREATE TRIGGER trg_wapi_set_invoice_internal_number
BEFORE INSERT OR UPDATE OF copro_id, invoice_date, internal_invoice_number ON public.compta_invoices
FOR EACH ROW EXECUTE FUNCTION public.wapi_set_invoice_internal_number();

-- Backfill numéros internes manquants : le trigger UPDATE ci-dessus complète la valeur.
UPDATE public.compta_invoices
SET internal_invoice_number = NULL
WHERE internal_invoice_number IS NULL OR trim(internal_invoice_number) = '';
