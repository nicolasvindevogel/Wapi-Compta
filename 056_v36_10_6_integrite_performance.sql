-- WAPI One V36.10.6
-- Correctifs sûrs d'intégrité/concurrence + index de consultation.
-- Cette migration ne modifie pas les données existantes.

-- 1) Evite les collisions de codes tiers lors de créations simultanées.
CREATE OR REPLACE FUNCTION public.wapi_next_owner_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('wapi:owner-code'));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '')::integer), 0) + 1
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
  PERFORM pg_advisory_xact_lock(hashtext('wapi:supplier-code'));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '')::integer), 0) + 1
    INTO n
  FROM public.compta_suppliers
  WHERE code ~ '^F-[0-9]+';
  RETURN 'F-' || lpad(n::text, 4, '0');
END;
$$;

-- 2) Evite les collisions de numéros internes de factures pour un même préfixe.
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

  IF copro_code IS NULL OR trim(copro_code) = '' THEN copro_code := 'COP'; END IF;

  SELECT COALESCE(NULLIF(trim(fy.code), ''), 'EX' || to_char(inv_date, 'YY'))
    INTO year_code
  FROM public.compta_fiscal_years fy
  WHERE fy.copro_id = NEW.copro_id
    AND inv_date BETWEEN fy.starts_on AND fy.ends_on
  ORDER BY fy.starts_on DESC
  LIMIT 1;

  IF year_code IS NULL OR trim(year_code) = '' THEN year_code := 'EX' || to_char(inv_date, 'YY'); END IF;

  prefix_value := copro_code || '-' || upper(year_code);
  PERFORM pg_advisory_xact_lock(hashtext('wapi:invoice:' || prefix_value));

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

-- 3) Un import OCR ne doit normalement produire qu'une facture.
-- On n'active la contrainte que si la base actuelle est propre, pour ne pas bloquer la migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.compta_invoices
    WHERE ocr_source_item_id IS NOT NULL
    GROUP BY ocr_source_item_id
    HAVING COUNT(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS compta_invoices_ocr_source_unique_idx ON public.compta_invoices(ocr_source_item_id) WHERE ocr_source_item_id IS NOT NULL';
  ELSE
    RAISE WARNING 'Doublons ocr_source_item_id détectés : index unique non créé. Nettoyer les doublons puis rejouer la migration.';
  END IF;
END $$;

-- 4) Index des écrans les plus consultés.
CREATE INDEX IF NOT EXISTS compta_invoices_copro_date_idx
  ON public.compta_invoices(copro_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS compta_bank_transactions_copro_date_idx
  ON public.compta_bank_transactions(copro_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS compta_entries_copro_date_idx
  ON public.compta_entries(copro_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS compta_owner_calls_copro_due_idx
  ON public.compta_owner_calls(copro_id, due_date DESC);
CREATE INDEX IF NOT EXISTS compta_validation_queue_status_copro_idx
  ON public.compta_validation_queue(status, copro_id, created_at DESC);
CREATE INDEX IF NOT EXISTS compta_import_items_created_idx
  ON public.compta_import_items(created_at DESC);
