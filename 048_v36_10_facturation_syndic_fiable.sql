-- WAPI One V36.10 — Facturation syndic simplifiée et fiabilisée
-- Objectif : empêcher techniquement la création de deux honoraires pour le même contrat et le même mois.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.compta_syndic_invoices
    WHERE contract_id IS NOT NULL
      AND billing_type = 'honoraires'
      AND period_year IS NOT NULL
      AND period_month IS NOT NULL
      AND status IN ('draft','issued')
    GROUP BY contract_id, period_year, period_month
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Doublons existants dans compta_syndic_invoices : corrigez-les avant d''installer V36.10.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_syndic_honoraires_contract_period
  ON public.compta_syndic_invoices(contract_id, period_year, period_month)
  WHERE contract_id IS NOT NULL
    AND billing_type = 'honoraires'
    AND period_year IS NOT NULL
    AND period_month IS NOT NULL
    AND status IN ('draft','issued');

CREATE INDEX IF NOT EXISTS idx_syndic_invoices_reporting
  ON public.compta_syndic_invoices(invoice_date, billing_type, status, copro_id);

CREATE INDEX IF NOT EXISTS idx_syndic_contract_fiscal_year
  ON public.compta_syndic_billing_contracts(copro_id, fiscal_year_id, starts_on, ends_on);

NOTIFY pgrst, 'reload schema';
