-- WAPI One V34.5 - Décomptes inspirés du flux Optipro
-- Migration non destructive : index de contrôle uniquement.

CREATE INDEX IF NOT EXISTS compta_invoices_settlement_idx
  ON public.compta_invoices(copro_id, invoice_date, distribution_key_id);

CREATE INDEX IF NOT EXISTS compta_meter_batches_settlement_idx
  ON public.compta_meter_batches(copro_id, fiscal_year_id, status);

CREATE INDEX IF NOT EXISTS compta_meter_lines_settlement_idx
  ON public.compta_meter_lines(batch_id, lot_id);

-- Aucun décompte n'est comptabilisé automatiquement par cette migration.
-- La comptabilisation définitive sera ajoutée après validation fonctionnelle
-- du calcul et devra être idempotente (une seule OD par exercice/propriétaire).
