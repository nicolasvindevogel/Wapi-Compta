-- WAPI One V36.10.5 — exercice, communication structurée et factures récurrentes

ALTER TABLE IF EXISTS public.compta_invoices
  ADD COLUMN IF NOT EXISTS fiscal_year_id uuid
    REFERENCES public.compta_fiscal_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structured_communication text;

CREATE INDEX IF NOT EXISTS idx_compta_invoices_fiscal_year
  ON public.compta_invoices (copro_id, fiscal_year_id, invoice_date);

CREATE TABLE IF NOT EXISTS public.compta_invoice_encoding_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_id uuid NOT NULL REFERENCES public.compta_copros(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.compta_suppliers(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.compta_accounts(id) ON DELETE SET NULL,
  description_mode text NOT NULL DEFAULT 'manual'
    CHECK (description_mode IN ('manual', 'invoice_month')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (copro_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_encoding_preferences_lookup
  ON public.compta_invoice_encoding_preferences (copro_id, supplier_id)
  WHERE active = true;

ALTER TABLE public.compta_invoice_encoding_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compta_invoice_encoding_preferences_authenticated
  ON public.compta_invoice_encoding_preferences;
CREATE POLICY compta_invoice_encoding_preferences_authenticated
  ON public.compta_invoice_encoding_preferences
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compta_invoice_encoding_preferences TO authenticated;
