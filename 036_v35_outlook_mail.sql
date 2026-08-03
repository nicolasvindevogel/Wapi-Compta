-- WAPI One V34.6 - Décomptes validés, report à la clôture, tiers actifs

CREATE TABLE IF NOT EXISTS public.compta_settlement_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_id uuid NOT NULL REFERENCES public.compta_copros(id) ON DELETE CASCADE,
  fiscal_year_id uuid NOT NULL REFERENCES public.compta_fiscal_years(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.compta_owners(id) ON DELETE RESTRICT,
  charges_total numeric(14,2) NOT NULL DEFAULT 0,
  balance_before numeric(14,2) NOT NULL DEFAULT 0,
  final_balance numeric(14,2) NOT NULL DEFAULT 0,
  calculation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','cancelled')),
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiscal_year_id, owner_id)
);

ALTER TABLE public.compta_settlement_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated settlement snapshots" ON public.compta_settlement_snapshots;
CREATE POLICY "authenticated settlement snapshots"
ON public.compta_settlement_snapshots
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Un propriétaire est actif lorsqu'au moins un lot actif lui est actuellement attribué.
CREATE OR REPLACE FUNCTION public.wapi_refresh_owner_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_owner uuid := NULL;
  new_owner uuid := NULL;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN old_owner := OLD.owner_id; END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN new_owner := NEW.owner_id; END IF;

  IF old_owner IS NOT NULL THEN
    UPDATE public.compta_owners o
    SET active = EXISTS (
      SELECT 1 FROM public.compta_lots l
      WHERE l.owner_id = old_owner AND coalesce(l.active,true)
    )
    WHERE o.id = old_owner;
  END IF;
  IF new_owner IS NOT NULL AND new_owner IS DISTINCT FROM old_owner THEN
    UPDATE public.compta_owners o
    SET active = EXISTS (
      SELECT 1 FROM public.compta_lots l
      WHERE l.owner_id = new_owner AND coalesce(l.active,true)
    )
    WHERE o.id = new_owner;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_wapi_refresh_owner_activity ON public.compta_lots;
CREATE TRIGGER trg_wapi_refresh_owner_activity
AFTER INSERT OR UPDATE OF owner_id,active OR DELETE
ON public.compta_lots
FOR EACH ROW EXECUTE FUNCTION public.wapi_refresh_owner_activity();

UPDATE public.compta_owners o
SET active = EXISTS (
  SELECT 1 FROM public.compta_lots l
  WHERE l.owner_id=o.id AND coalesce(l.active,true)
);

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
  linked_private integer := 0;
  linked_settlements integer := 0;
BEGIN
  SELECT count(*) INTO linked_lots FROM public.compta_lots WHERE owner_id=p_owner_id;
  SELECT count(*) INTO linked_calls FROM public.compta_owner_calls WHERE owner_id=p_owner_id;
  SELECT count(*) INTO linked_bank FROM public.compta_bank_transactions WHERE tier_type='owner' AND tier_id=p_owner_id;
  SELECT count(*) INTO linked_opening FROM public.compta_third_opening_balances WHERE tier_type='owner' AND tier_id=p_owner_id;
  SELECT count(*) INTO linked_private FROM public.compta_invoices WHERE private_owner_id=p_owner_id;
  SELECT count(*) INTO linked_settlements FROM public.compta_settlement_snapshots WHERE owner_id=p_owner_id;

  IF linked_lots+linked_calls+linked_bank+linked_opening+linked_private+linked_settlements>0 THEN
    RETURN jsonb_build_object('deleted',false,'lots',linked_lots,
      'accounting',linked_calls+linked_bank+linked_opening+linked_private+linked_settlements);
  END IF;
  DELETE FROM public.compta_owners WHERE id=p_owner_id;
  RETURN jsonb_build_object('deleted',true,'lots',0,'accounting',0);
END;
$$;
