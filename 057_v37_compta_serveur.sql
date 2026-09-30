-- ============================================================
-- WAPI One V37.0 — Coeur comptable serveur (mode parallèle)
-- ============================================================
-- Objectifs :
--   * journal central côté PostgreSQL, non reconstruit dans le navigateur ;
--   * écritures équilibrées et numérotation atomique ;
--   * écritures validées immuables ; correction par extourne ;
--   * synchronisation parallèle des factures, appels et mouvements bancaires ;
--   * balance / grand livre / journaux calculés côté serveur ;
--   * aucun impact bloquant sur les flux V36 : une erreur de synchro V37 est loguée.
--
-- IMPORTANT : V37 reste volontairement en parallèle de la comptabilité historique.
-- Ne pas supprimer les anciennes tables / fonctions tant que les contrôles de
-- rapprochement V36 <-> V37 ne sont pas terminés.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 1. Référentiel des journaux ----------
CREATE TABLE IF NOT EXISTS public.compta_accounting_journals (
  code text PRIMARY KEY,
  label text NOT NULL,
  journal_type text NOT NULL DEFAULT 'general',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compta_accounting_journals_code_chk CHECK (code = upper(code) AND length(code) BETWEEN 2 AND 10)
);

INSERT INTO public.compta_accounting_journals(code,label,journal_type) VALUES
  ('ACH','Achats','purchase'),
  ('VEN','Appels / ventes','sales'),
  ('FIN','Financier','bank'),
  ('OD','Opérations diverses','general'),
  ('AN','À-nouveaux','opening')
ON CONFLICT (code) DO UPDATE SET label=excluded.label, journal_type=excluded.journal_type, active=true;

-- ---------- 2. Compteurs atomiques ----------
CREATE TABLE IF NOT EXISTS public.compta_accounting_counters (
  copro_id uuid NOT NULL REFERENCES public.compta_copros(id) ON DELETE CASCADE,
  fiscal_year_id uuid NOT NULL REFERENCES public.compta_fiscal_years(id) ON DELETE CASCADE,
  journal_code text NOT NULL REFERENCES public.compta_accounting_journals(code),
  last_sequence bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(copro_id,fiscal_year_id,journal_code)
);

-- ---------- 3. En-têtes / lignes ----------
CREATE TABLE IF NOT EXISTS public.compta_accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_id uuid NOT NULL REFERENCES public.compta_copros(id) ON DELETE RESTRICT,
  fiscal_year_id uuid NOT NULL REFERENCES public.compta_fiscal_years(id) ON DELETE RESTRICT,
  journal_code text NOT NULL REFERENCES public.compta_accounting_journals(code),
  entry_date date NOT NULL,
  sequence_no bigint NOT NULL,
  entry_number text NOT NULL,
  reference text,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  source_type text,
  source_id text,
  source_fingerprint text,
  reversal_of uuid REFERENCES public.compta_accounting_entries(id) ON DELETE RESTRICT,
  reversal_entry_id uuid REFERENCES public.compta_accounting_entries(id) ON DELETE RESTRICT,
  reversed_at timestamptz,
  reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at timestamptz,
  CONSTRAINT compta_accounting_entries_status_chk CHECK (status IN ('draft','posted','reversed')),
  CONSTRAINT compta_accounting_entries_seq_uniq UNIQUE(copro_id,fiscal_year_id,journal_code,sequence_no),
  CONSTRAINT compta_accounting_entries_number_uniq UNIQUE(copro_id,entry_number)
);

CREATE TABLE IF NOT EXISTS public.compta_accounting_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.compta_accounting_entries(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  account_id uuid NOT NULL REFERENCES public.compta_accounts(id) ON DELETE RESTRICT,
  tier_type text,
  tier_id uuid,
  lot_id uuid REFERENCES public.compta_lots(id) ON DELETE SET NULL,
  distribution_key_id uuid REFERENCES public.compta_distribution_keys(id) ON DELETE SET NULL,
  description text,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compta_accounting_lines_no_uniq UNIQUE(entry_id,line_no),
  CONSTRAINT compta_accounting_lines_amount_chk CHECK (
    debit >= 0 AND credit >= 0 AND
    ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
  ),
  CONSTRAINT compta_accounting_lines_tier_chk CHECK (tier_type IS NULL OR tier_type IN ('owner','supplier','occupant','other'))
);

CREATE UNIQUE INDEX IF NOT EXISTS compta_accounting_entries_active_source_uniq
  ON public.compta_accounting_entries(copro_id,source_type,source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND status='posted';

CREATE INDEX IF NOT EXISTS compta_accounting_entries_context_idx
  ON public.compta_accounting_entries(copro_id,fiscal_year_id,entry_date,journal_code,status);
CREATE INDEX IF NOT EXISTS compta_accounting_entries_source_idx
  ON public.compta_accounting_entries(source_type,source_id,status);
CREATE INDEX IF NOT EXISTS compta_accounting_lines_entry_idx
  ON public.compta_accounting_lines(entry_id,line_no);
CREATE INDEX IF NOT EXISTS compta_accounting_lines_account_idx
  ON public.compta_accounting_lines(account_id,entry_id);
CREATE INDEX IF NOT EXISTS compta_accounting_lines_tier_idx
  ON public.compta_accounting_lines(tier_type,tier_id,entry_id)
  WHERE tier_id IS NOT NULL;

-- ---------- 4. Journal des erreurs de synchronisation parallèle ----------
CREATE TABLE IF NOT EXISTS public.compta_accounting_sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_id uuid REFERENCES public.compta_copros(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text,
  error_message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS compta_accounting_sync_errors_open_idx
  ON public.compta_accounting_sync_errors(created_at DESC)
  WHERE resolved_at IS NULL;

-- ---------- 5. Accès applicatif au contexte copro ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_can_access_copro(p_copro_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.compta_user_profiles p
    JOIN public.compta_copros c ON c.id=p_copro_id
    WHERE p.id=p_user_id
      AND p.active=true
      AND (
        lower(coalesce(p.role,'')) IN ('admin','administrator','administrateur','direction','comptable')
        OR c.manager_user_id=p_user_id
        OR c.manager_user_id IS NULL
      )
  );
$$;
REVOKE ALL ON FUNCTION public.wapi_v37_can_access_copro(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.wapi_v37_can_access_copro(uuid,uuid) TO authenticated;

-- ---------- 6. Helpers internes ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_resolve_account_id(p_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_id uuid; v_code text := trim(coalesce(p_code,''));
BEGIN
  IF v_code='' THEN RETURN NULL; END IF;
  SELECT a.id INTO v_id FROM public.compta_accounts a WHERE trim(a.code)=v_code ORDER BY a.id LIMIT 1;
  IF v_id IS NULL THEN
    SELECT a.id INTO v_id
    FROM public.compta_accounts a
    WHERE trim(a.code) LIKE v_code || '%'
    ORDER BY length(trim(a.code)), trim(a.code), a.id
    LIMIT 1;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_fiscal_year_for(p_copro_id uuid,p_date date)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT fy.id
  FROM public.compta_fiscal_years fy
  WHERE fy.copro_id=p_copro_id
    AND p_date BETWEEN fy.starts_on AND fy.ends_on
  ORDER BY fy.starts_on DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_next_sequence(p_copro_id uuid,p_fiscal_year_id uuid,p_journal_code text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_seq bigint;
BEGIN
  INSERT INTO public.compta_accounting_counters(copro_id,fiscal_year_id,journal_code,last_sequence)
  VALUES(p_copro_id,p_fiscal_year_id,upper(p_journal_code),1)
  ON CONFLICT(copro_id,fiscal_year_id,journal_code)
  DO UPDATE SET last_sequence=public.compta_accounting_counters.last_sequence+1, updated_at=now()
  RETURNING last_sequence INTO v_seq;
  RETURN v_seq;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_make_entry_number(
  p_copro_id uuid,p_fiscal_year_id uuid,p_journal_code text,p_sequence bigint
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_copro text; v_year text;
BEGIN
  SELECT upper(coalesce(nullif(trim(c.code),''), regexp_replace(c.name,'[^A-Za-z0-9]','','g'), 'COP')) INTO v_copro
  FROM public.compta_copros c WHERE c.id=p_copro_id;
  SELECT upper(coalesce(nullif(trim(fy.code),''),nullif(trim(fy.year_code),''),to_char(fy.starts_on,'YYYY'))) INTO v_year
  FROM public.compta_fiscal_years fy WHERE fy.id=p_fiscal_year_id;
  RETURN coalesce(v_copro,'COP') || '-' || coalesce(v_year,'EX') || '-' || upper(p_journal_code) || '-' || lpad(p_sequence::text,6,'0');
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_assert_period(p_copro_id uuid,p_fiscal_year_id uuid,p_date date)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_year public.compta_fiscal_years%ROWTYPE;
BEGIN
  SELECT * INTO v_year FROM public.compta_fiscal_years WHERE id=p_fiscal_year_id;
  IF NOT FOUND OR v_year.copro_id<>p_copro_id THEN
    RAISE EXCEPTION 'Exercice comptable invalide pour cette copropriété.';
  END IF;
  IF p_date<v_year.starts_on OR p_date>v_year.ends_on THEN
    RAISE EXCEPTION 'Date % hors exercice % - %.',p_date,v_year.starts_on,v_year.ends_on;
  END IF;
  IF lower(coalesce(v_year.status,''))='closed' THEN
    RAISE EXCEPTION 'Exercice clôturé : aucune nouvelle écriture n''est autorisée.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_entry_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD.status IN ('posted','reversed')
     AND coalesce(current_setting('wapi.v37_mutation',true),'')<>'on' THEN
    RAISE EXCEPTION 'Une écriture validée ne peut pas être supprimée. Utilisez une extourne.';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('posted','reversed')
     AND coalesce(current_setting('wapi.v37_mutation',true),'')<>'on' THEN
    RAISE EXCEPTION 'Une écriture validée est immuable. Utilisez une extourne.';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS trg_wapi_v37_entry_guard ON public.compta_accounting_entries;
CREATE TRIGGER trg_wapi_v37_entry_guard
BEFORE UPDATE OR DELETE ON public.compta_accounting_entries
FOR EACH ROW EXECUTE FUNCTION public.wapi_v37_entry_guard();

CREATE OR REPLACE FUNCTION public.wapi_v37_line_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_status text; v_entry uuid;
BEGIN
  v_entry:=CASE WHEN TG_OP='DELETE' THEN OLD.entry_id ELSE NEW.entry_id END;
  SELECT status INTO v_status FROM public.compta_accounting_entries WHERE id=v_entry;
  IF v_status IN ('posted','reversed') AND coalesce(current_setting('wapi.v37_mutation',true),'')<>'on' THEN
    RAISE EXCEPTION 'Les lignes d''une écriture validée sont immuables.';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS trg_wapi_v37_line_guard ON public.compta_accounting_lines;
CREATE TRIGGER trg_wapi_v37_line_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.compta_accounting_lines
FOR EACH ROW EXECUTE FUNCTION public.wapi_v37_line_guard();

CREATE OR REPLACE FUNCTION public.wapi_v37_log_sync_error(
  p_copro_id uuid,p_source_type text,p_source_id text,p_error text,p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  INSERT INTO public.compta_accounting_sync_errors(copro_id,source_type,source_id,error_message,payload)
  VALUES(p_copro_id,coalesce(p_source_type,'unknown'),p_source_id,left(coalesce(p_error,'Erreur inconnue'),4000),coalesce(p_payload,'{}'::jsonb));
END;
$$;

-- ---------- 7. Création / extourne interne ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_post_internal(
  p_copro_id uuid,
  p_fiscal_year_id uuid,
  p_journal_code text,
  p_entry_date date,
  p_reference text,
  p_label text,
  p_source_type text,
  p_source_id text,
  p_source_fingerprint text,
  p_lines jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_entry_id uuid; v_seq bigint; v_no text; v_line jsonb; v_line_no int:=0;
  v_account_id uuid; v_debit numeric(14,2); v_credit numeric(14,2);
  v_total_debit numeric(14,2):=0; v_total_credit numeric(14,2):=0; v_hash text;
BEGIN
  PERFORM public.wapi_v37_assert_period(p_copro_id,p_fiscal_year_id,p_entry_date);
  IF upper(coalesce(p_journal_code,'')) NOT IN (SELECT code FROM public.compta_accounting_journals WHERE active) THEN
    RAISE EXCEPTION 'Journal comptable invalide : %',p_journal_code;
  END IF;
  IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)<2 THEN
    RAISE EXCEPTION 'Une écriture doit contenir au moins deux lignes.';
  END IF;

  IF p_source_type IS NOT NULL AND p_source_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('wapi:v37:'||p_copro_id::text||':'||p_source_type||':'||p_source_id));
    SELECT id INTO v_entry_id
    FROM public.compta_accounting_entries
    WHERE copro_id=p_copro_id AND source_type=p_source_type AND source_id=p_source_id AND status='posted'
    ORDER BY posted_at DESC NULLS LAST,created_at DESC LIMIT 1;
    IF v_entry_id IS NOT NULL THEN RETURN v_entry_id; END IF;
  END IF;

  v_seq:=public.wapi_v37_next_sequence(p_copro_id,p_fiscal_year_id,upper(p_journal_code));
  v_no:=public.wapi_v37_make_entry_number(p_copro_id,p_fiscal_year_id,upper(p_journal_code),v_seq);
  INSERT INTO public.compta_accounting_entries(
    copro_id,fiscal_year_id,journal_code,entry_date,sequence_no,entry_number,reference,label,status,
    source_type,source_id,source_fingerprint,metadata,created_by
  ) VALUES(
    p_copro_id,p_fiscal_year_id,upper(p_journal_code),p_entry_date,v_seq,v_no,nullif(trim(coalesce(p_reference,'')),''),
    coalesce(nullif(trim(coalesce(p_label,'')),''),'Écriture comptable'),'draft',p_source_type,p_source_id,p_source_fingerprint,
    coalesce(p_metadata,'{}'::jsonb),coalesce(p_actor,auth.uid())
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_no:=v_line_no+1;
    v_account_id:=NULL;
    BEGIN v_account_id:=nullif(v_line->>'account_id','')::uuid; EXCEPTION WHEN others THEN v_account_id:=NULL; END;
    IF v_account_id IS NULL THEN v_account_id:=public.wapi_v37_resolve_account_id(v_line->>'account_code'); END IF;
    IF v_account_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.compta_accounts WHERE id=v_account_id) THEN
      RAISE EXCEPTION 'Compte comptable introuvable à la ligne % (%).',v_line_no,coalesce(v_line->>'account_code',v_line->>'account_id');
    END IF;
    v_debit:=round(coalesce(nullif(v_line->>'debit','')::numeric,0),2);
    v_credit:=round(coalesce(nullif(v_line->>'credit','')::numeric,0),2);
    IF (v_debit<=0 AND v_credit<=0) OR (v_debit>0 AND v_credit>0) THEN
      RAISE EXCEPTION 'Montant débit/crédit invalide à la ligne %.',v_line_no;
    END IF;
    v_total_debit:=v_total_debit+v_debit; v_total_credit:=v_total_credit+v_credit;
    INSERT INTO public.compta_accounting_lines(
      entry_id,line_no,account_id,tier_type,tier_id,lot_id,distribution_key_id,description,debit,credit,metadata
    ) VALUES(
      v_entry_id,v_line_no,v_account_id,nullif(v_line->>'tier_type',''),nullif(v_line->>'tier_id','')::uuid,
      nullif(v_line->>'lot_id','')::uuid,nullif(v_line->>'distribution_key_id','')::uuid,
      nullif(v_line->>'description',''),v_debit,v_credit,coalesce(v_line->'metadata','{}'::jsonb)
    );
  END LOOP;

  IF round(v_total_debit,2)<>round(v_total_credit,2) OR round(v_total_debit,2)=0 THEN
    RAISE EXCEPTION 'Écriture non équilibrée : débit %, crédit %.',v_total_debit,v_total_credit;
  END IF;

  SELECT md5(
    concat_ws('|',p_copro_id::text,p_fiscal_year_id::text,upper(p_journal_code),p_entry_date::text,v_no,coalesce(p_reference,''),coalesce(p_label,''),
      coalesce((SELECT jsonb_agg(jsonb_build_object('account_id',l.account_id,'debit',l.debit,'credit',l.credit,'tier_type',l.tier_type,'tier_id',l.tier_id,'description',l.description) ORDER BY l.line_no)::text FROM public.compta_accounting_lines l WHERE l.entry_id=v_entry_id),'[]'))
  ) INTO v_hash;

  PERFORM set_config('wapi.v37_mutation','on',true);
  UPDATE public.compta_accounting_entries
  SET status='posted',posted_at=now(),posted_by=coalesce(p_actor,auth.uid()),content_hash=v_hash
  WHERE id=v_entry_id;
  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_reverse_internal(
  p_entry_id uuid,p_reason text DEFAULT 'Extourne',p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v public.compta_accounting_entries%ROWTYPE; v_reverse uuid; v_lines jsonb;
BEGIN
  SELECT * INTO v FROM public.compta_accounting_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Écriture introuvable.'; END IF;
  IF v.status='reversed' THEN RETURN v.reversal_entry_id; END IF;
  IF v.status<>'posted' THEN RAISE EXCEPTION 'Seule une écriture validée peut être extournée.'; END IF;

  SELECT id INTO v_reverse FROM public.compta_accounting_entries WHERE reversal_of=p_entry_id AND status='posted' LIMIT 1;
  IF v_reverse IS NOT NULL THEN RETURN v_reverse; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'account_id',l.account_id,'debit',l.credit,'credit',l.debit,'tier_type',l.tier_type,'tier_id',l.tier_id,
    'lot_id',l.lot_id,'distribution_key_id',l.distribution_key_id,'description',coalesce(l.description,v.label)
  ) ORDER BY l.line_no) INTO v_lines
  FROM public.compta_accounting_lines l WHERE l.entry_id=p_entry_id;

  v_reverse:=public.wapi_v37_post_internal(
    v.copro_id,v.fiscal_year_id,v.journal_code,v.entry_date,
    coalesce(v.reference,v.entry_number)||' / EXT',
    'Extourne — '||coalesce(p_reason,v.label),
    'reversal',p_entry_id::text,md5(p_entry_id::text||coalesce(p_reason,'')),v_lines,
    jsonb_build_object('reversal_of',p_entry_id,'reason',p_reason),coalesce(p_actor,auth.uid())
  );

  PERFORM set_config('wapi.v37_mutation','on',true);
  UPDATE public.compta_accounting_entries
  SET status='reversed',reversal_entry_id=v_reverse,reversed_at=now(),reversed_by=coalesce(p_actor,auth.uid())
  WHERE id=p_entry_id;
  UPDATE public.compta_accounting_entries SET reversal_of=p_entry_id WHERE id=v_reverse;
  RETURN v_reverse;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_replace_source_internal(
  p_copro_id uuid,p_fiscal_year_id uuid,p_journal_code text,p_entry_date date,p_reference text,p_label text,
  p_source_type text,p_source_id text,p_source_fingerprint text,p_lines jsonb,p_metadata jsonb DEFAULT '{}'::jsonb,p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_existing public.compta_accounting_entries%ROWTYPE; v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('wapi:v37:'||p_copro_id::text||':'||p_source_type||':'||p_source_id));
  SELECT * INTO v_existing FROM public.compta_accounting_entries
   WHERE copro_id=p_copro_id AND source_type=p_source_type AND source_id=p_source_id AND status='posted'
   ORDER BY posted_at DESC NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND coalesce(v_existing.source_fingerprint,'')=coalesce(p_source_fingerprint,'') THEN RETURN v_existing.id; END IF;
  IF FOUND THEN PERFORM public.wapi_v37_reverse_internal(v_existing.id,'Source modifiée',p_actor); END IF;
  v_id:=public.wapi_v37_post_internal(p_copro_id,p_fiscal_year_id,p_journal_code,p_entry_date,p_reference,p_label,p_source_type,p_source_id,p_source_fingerprint,p_lines,p_metadata,p_actor);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_deactivate_source_internal(
  p_copro_id uuid,p_source_type text,p_source_id text,p_reason text DEFAULT 'Source supprimée ou rejetée',p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.compta_accounting_entries
  WHERE copro_id=p_copro_id AND source_type=p_source_type AND source_id=p_source_id AND status='posted'
  ORDER BY posted_at DESC NULLS LAST,created_at DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.wapi_v37_reverse_internal(v_id,p_reason,p_actor);
END;
$$;

-- ---------- 8. Synchronisation des sources existantes ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_sync_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE j jsonb; v_copro uuid; v_fy uuid; v_date date; v_amount numeric(14,2); v_account uuid; v_supplier uuid; v_lines jsonb; v_fp text; v_status text;
BEGIN
  SELECT to_jsonb(i) INTO j FROM public.compta_invoices i WHERE i.id=p_invoice_id;
  IF j IS NULL THEN RETURN NULL; END IF;
  v_copro:=(j->>'copro_id')::uuid; v_status:=lower(coalesce(j->>'status',''));
  IF v_status='rejected' THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'invoice',p_invoice_id::text,'Facture rejetée',nullif(j->>'created_by','')::uuid); END IF;
  v_date:=coalesce(nullif(j->>'invoice_date','')::date,(j->>'created_at')::timestamptz::date,current_date);
  v_fy:=CASE WHEN coalesce(j->>'fiscal_year_id','')<>'' THEN (j->>'fiscal_year_id')::uuid ELSE public.wapi_v37_fiscal_year_for(v_copro,v_date) END;
  IF v_fy IS NULL THEN RAISE EXCEPTION 'Aucun exercice pour la facture % à la date %.',p_invoice_id,v_date; END IF;
  v_amount:=round(coalesce(nullif(j->>'amount_total','')::numeric,0),2);
  v_account:=nullif(j->>'account_id','')::uuid; v_supplier:=nullif(j->>'supplier_id','')::uuid;
  IF v_amount=0 THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'invoice',p_invoice_id::text,'Montant facture nul',nullif(j->>'created_by','')::uuid); END IF;
  IF v_account IS NULL THEN RAISE EXCEPTION 'Compte de charge manquant pour la facture %.',p_invoice_id; END IF;
  IF v_amount>0 THEN
    v_lines:=jsonb_build_array(
      jsonb_build_object('account_id',v_account,'debit',v_amount,'credit',0,'description',coalesce(j->>'description','Facture fournisseur')),
      jsonb_build_object('account_code','440','debit',0,'credit',v_amount,'tier_type','supplier','tier_id',v_supplier,'description','Dette fournisseur')
    );
  ELSE
    v_lines:=jsonb_build_array(
      jsonb_build_object('account_id',v_account,'debit',0,'credit',abs(v_amount),'description',coalesce(j->>'description','Note de crédit fournisseur')),
      jsonb_build_object('account_code','440','debit',abs(v_amount),'credit',0,'tier_type','supplier','tier_id',v_supplier,'description','Créance fournisseur')
    );
  END IF;
  v_fp:=md5(jsonb_build_object('date',v_date,'amount',v_amount,'account',v_account,'supplier',v_supplier,'number',j->>'invoice_number','status',v_status)::text);
  RETURN public.wapi_v37_replace_source_internal(v_copro,v_fy,'ACH',v_date,j->>'invoice_number',coalesce(j->>'description','Facture fournisseur'),'invoice',p_invoice_id::text,v_fp,v_lines,jsonb_build_object('legacy_table','compta_invoices'),nullif(j->>'created_by','')::uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_sync_owner_call(p_owner_call_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE j jsonb; v_copro uuid; v_fy uuid; v_date date; v_amount numeric(14,2); v_owner uuid; v_code text; v_lines jsonb; v_fp text; v_status text;
BEGIN
  SELECT to_jsonb(c) INTO j FROM public.compta_owner_calls c WHERE c.id=p_owner_call_id;
  IF j IS NULL THEN RETURN NULL; END IF;
  v_copro:=(j->>'copro_id')::uuid; v_status:=lower(coalesce(nullif(j->>'accounting_status',''),nullif(j->>'accounting_state',''),CASE WHEN lower(coalesce(j->>'is_accounted','')) IN ('true','1','yes') THEN 'accounted' ELSE 'pending' END));
  IF v_status<>'accounted' THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'owner_call',p_owner_call_id::text,'Appel non comptabilisé',nullif(j->>'created_by','')::uuid); END IF;
  v_date:=coalesce(nullif(j->>'due_date','')::date,current_date); v_fy:=nullif(j->>'fiscal_year_id','')::uuid;
  IF v_fy IS NULL THEN v_fy:=public.wapi_v37_fiscal_year_for(v_copro,v_date); END IF;
  IF v_fy IS NULL THEN RAISE EXCEPTION 'Aucun exercice pour l''appel %.',p_owner_call_id; END IF;
  v_amount:=round(coalesce(nullif(j->>'amount_due','')::numeric,0),2); v_owner:=nullif(j->>'owner_id','')::uuid;
  IF v_amount=0 THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'owner_call',p_owner_call_id::text,'Montant appel nul',nullif(j->>'created_by','')::uuid); END IF;
  v_code:=coalesce(nullif(j->>'accounting_account_code',''),CASE coalesce(j->>'call_type','provisions') WHEN 'working_fund' THEN '100' WHEN 'reserve' THEN '160' WHEN 'extraordinary' THEN '702' ELSE '701' END);
  v_lines:=jsonb_build_array(
    jsonb_build_object('account_code','410','debit',v_amount,'credit',0,'tier_type','owner','tier_id',v_owner,'lot_id',nullif(j->>'lot_id',''),'description',coalesce(j->>'label','Appel de fonds')),
    jsonb_build_object('account_code',v_code,'debit',0,'credit',v_amount,'description',coalesce(j->>'label','Appel de fonds'))
  );
  v_fp:=md5(jsonb_build_object('date',v_date,'amount',v_amount,'owner',v_owner,'lot',j->>'lot_id','code',v_code,'status',v_status)::text);
  RETURN public.wapi_v37_replace_source_internal(v_copro,v_fy,'VEN',v_date,j->>'period_label',coalesce(j->>'label','Appel de fonds'),'owner_call',p_owner_call_id::text,v_fp,v_lines,jsonb_build_object('legacy_table','compta_owner_calls','call_id',j->>'call_id'),nullif(j->>'created_by','')::uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_sync_bank_transaction(p_tx_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE j jsonb; b jsonb; v_copro uuid; v_fy uuid; v_date date; v_amount numeric(14,2); v_bank_account_id uuid; v_bank_code text; v_tier_code text; v_tier_type text; v_tier_id uuid; v_lines jsonb; v_fp text;
BEGIN
  SELECT to_jsonb(t) INTO j FROM public.compta_bank_transactions t WHERE t.id=p_tx_id;
  IF j IS NULL THEN RETURN NULL; END IF;
  v_copro:=(j->>'copro_id')::uuid; v_date:=coalesce(nullif(j->>'transaction_date','')::date,current_date); v_fy:=public.wapi_v37_fiscal_year_for(v_copro,v_date);
  IF v_fy IS NULL THEN RAISE EXCEPTION 'Aucun exercice pour le mouvement bancaire %.',p_tx_id; END IF;
  v_amount:=round(coalesce(nullif(j->>'amount','')::numeric,0),2); v_bank_account_id:=nullif(j->>'bank_account_id','')::uuid;
  SELECT to_jsonb(a) INTO b FROM public.compta_bank_accounts a WHERE a.id=v_bank_account_id;
  v_bank_code:=coalesce(nullif(b->>'account_code',''),(SELECT code FROM public.compta_accounts WHERE id=nullif(b->>'account_id','')::uuid),'550');
  v_tier_type:=nullif(j->>'tier_type',''); v_tier_id:=nullif(j->>'tier_id','')::uuid;
  v_tier_code:=CASE v_tier_type WHEN 'owner' THEN '410' WHEN 'supplier' THEN '440' WHEN 'occupant' THEN '418' ELSE '499' END;
  IF v_amount=0 THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'bank_tx',p_tx_id::text,'Mouvement bancaire nul',nullif(j->>'created_by','')::uuid); END IF;
  IF v_amount>0 THEN
    v_lines:=jsonb_build_array(
      jsonb_build_object('account_code',v_bank_code,'debit',v_amount,'credit',0,'description',coalesce(j->>'communication',j->>'description','Mouvement bancaire')),
      jsonb_build_object('account_code',v_tier_code,'debit',0,'credit',v_amount,'tier_type',coalesce(v_tier_type,'other'),'tier_id',v_tier_id,'description',coalesce(j->>'communication',j->>'description','Mouvement bancaire'))
    );
  ELSE
    v_lines:=jsonb_build_array(
      jsonb_build_object('account_code',v_tier_code,'debit',abs(v_amount),'credit',0,'tier_type',coalesce(v_tier_type,'other'),'tier_id',v_tier_id,'description',coalesce(j->>'communication',j->>'description','Mouvement bancaire')),
      jsonb_build_object('account_code',v_bank_code,'debit',0,'credit',abs(v_amount),'description',coalesce(j->>'communication',j->>'description','Mouvement bancaire'))
    );
  END IF;
  v_fp:=md5(jsonb_build_object('date',v_date,'amount',v_amount,'bank',v_bank_account_id,'tier_type',v_tier_type,'tier_id',v_tier_id,'label',coalesce(j->>'communication',j->>'description'))::text);
  RETURN public.wapi_v37_replace_source_internal(v_copro,v_fy,'FIN',v_date,j->>'statement_number',coalesce(j->>'communication',j->>'description',j->>'counterparty_name','Mouvement bancaire'),'bank_tx',p_tx_id::text,v_fp,v_lines,jsonb_build_object('legacy_table','compta_bank_transactions','statement_id',j->>'statement_id'),nullif(j->>'created_by','')::uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.wapi_v37_sync_legacy_od(p_group_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r record; v_copro uuid; v_fy uuid; v_date date; v_journal text; v_ref text; v_label text; v_lines jsonb; v_fp text; v_status text; v_source text:=coalesce(nullif(p_group_id,''),'');
BEGIN
  IF v_source='' THEN RAISE EXCEPTION 'Groupe OD manquant.'; END IF;
  SELECT e.copro_id,e.entry_date,upper(coalesce(e.journal_code,'OD')),e.reference,coalesce(e.label,e.description,'Opération diverse'),coalesce(e.status,'posted')
    INTO v_copro,v_date,v_journal,v_ref,v_label,v_status
  FROM public.compta_entries e
  WHERE coalesce(e.od_group_id::text,e.source_id::text,e.id::text)=v_source
  ORDER BY e.entry_date,e.id LIMIT 1;
  IF v_copro IS NULL THEN
    SELECT copro_id INTO v_copro FROM public.compta_accounting_entries WHERE source_type='legacy_od' AND source_id=v_source ORDER BY created_at DESC LIMIT 1;
    IF v_copro IS NOT NULL THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'legacy_od',v_source,'OD supprimée',auth.uid()); END IF;
    RETURN NULL;
  END IF;
  IF lower(v_status)='draft' THEN RETURN public.wapi_v37_deactivate_source_internal(v_copro,'legacy_od',v_source,'OD repassée en brouillon',auth.uid()); END IF;
  v_fy:=public.wapi_v37_fiscal_year_for(v_copro,v_date); IF v_fy IS NULL THEN RAISE EXCEPTION 'Aucun exercice pour OD %.',v_source; END IF;
  SELECT jsonb_agg(jsonb_build_object('account_id',e.account_id,'debit',e.debit,'credit',e.credit,'description',coalesce(e.description,e.label,v_label)) ORDER BY e.id),
         md5(jsonb_agg(jsonb_build_object('account_id',e.account_id,'debit',e.debit,'credit',e.credit,'description',coalesce(e.description,e.label,v_label)) ORDER BY e.id)::text)
  INTO v_lines,v_fp
  FROM public.compta_entries e
  WHERE coalesce(e.od_group_id::text,e.source_id::text,e.id::text)=v_source AND coalesce(e.status,'posted')<>'draft';
  IF v_lines IS NULL OR jsonb_array_length(v_lines)<2 THEN RAISE EXCEPTION 'OD % incomplète.',v_source; END IF;
  RETURN public.wapi_v37_replace_source_internal(v_copro,v_fy,CASE WHEN v_journal='AN' THEN 'AN' ELSE 'OD' END,v_date,v_ref,v_label,'legacy_od',v_source,v_fp,v_lines,jsonb_build_object('legacy_table','compta_entries'),auth.uid());
END;
$$;

-- ---------- 9. Triggers de synchronisation non bloquants ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_invoice_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row jsonb; v_id uuid; v_copro uuid;
BEGIN
  v_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; v_id:=(v_row->>'id')::uuid; v_copro:=nullif(v_row->>'copro_id','')::uuid;
  BEGIN
    IF TG_OP='DELETE' THEN PERFORM public.wapi_v37_deactivate_source_internal(v_copro,'invoice',v_id::text,'Facture supprimée',auth.uid());
    ELSE PERFORM public.wapi_v37_sync_invoice(v_id); END IF;
  EXCEPTION WHEN others THEN PERFORM public.wapi_v37_log_sync_error(v_copro,'invoice',v_id::text,SQLERRM,v_row); END;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
DROP TRIGGER IF EXISTS trg_wapi_v37_invoice_sync ON public.compta_invoices;
CREATE TRIGGER trg_wapi_v37_invoice_sync AFTER INSERT OR UPDATE OR DELETE ON public.compta_invoices FOR EACH ROW EXECUTE FUNCTION public.wapi_v37_invoice_trigger();

CREATE OR REPLACE FUNCTION public.wapi_v37_owner_call_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row jsonb; v_id uuid; v_copro uuid;
BEGIN
  v_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; v_id:=(v_row->>'id')::uuid; v_copro:=nullif(v_row->>'copro_id','')::uuid;
  BEGIN
    IF TG_OP='DELETE' THEN PERFORM public.wapi_v37_deactivate_source_internal(v_copro,'owner_call',v_id::text,'Appel supprimé',auth.uid());
    ELSE PERFORM public.wapi_v37_sync_owner_call(v_id); END IF;
  EXCEPTION WHEN others THEN PERFORM public.wapi_v37_log_sync_error(v_copro,'owner_call',v_id::text,SQLERRM,v_row); END;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
DROP TRIGGER IF EXISTS trg_wapi_v37_owner_call_sync ON public.compta_owner_calls;
CREATE TRIGGER trg_wapi_v37_owner_call_sync AFTER INSERT OR UPDATE OR DELETE ON public.compta_owner_calls FOR EACH ROW EXECUTE FUNCTION public.wapi_v37_owner_call_trigger();

CREATE OR REPLACE FUNCTION public.wapi_v37_bank_tx_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row jsonb; v_id uuid; v_copro uuid;
BEGIN
  v_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; v_id:=(v_row->>'id')::uuid; v_copro:=nullif(v_row->>'copro_id','')::uuid;
  BEGIN
    IF TG_OP='DELETE' THEN PERFORM public.wapi_v37_deactivate_source_internal(v_copro,'bank_tx',v_id::text,'Mouvement bancaire supprimé',auth.uid());
    ELSE PERFORM public.wapi_v37_sync_bank_transaction(v_id); END IF;
  EXCEPTION WHEN others THEN PERFORM public.wapi_v37_log_sync_error(v_copro,'bank_tx',v_id::text,SQLERRM,v_row); END;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
DROP TRIGGER IF EXISTS trg_wapi_v37_bank_tx_sync ON public.compta_bank_transactions;
CREATE TRIGGER trg_wapi_v37_bank_tx_sync AFTER INSERT OR UPDATE OR DELETE ON public.compta_bank_transactions FOR EACH ROW EXECUTE FUNCTION public.wapi_v37_bank_tx_trigger();

-- ---------- 10. API publique contrôlée ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_post_entry(
  p_copro_id uuid,p_fiscal_year_id uuid,p_journal_code text,p_entry_date date,p_reference text,p_label text,p_lines jsonb,
  p_source_type text DEFAULT NULL,p_source_id text DEFAULT NULL,p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_fp text;
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé à cette copropriété.'; END IF;
  v_fp:=md5(jsonb_build_object('date',p_entry_date,'journal',p_journal_code,'reference',p_reference,'label',p_label,'lines',p_lines)::text);
  RETURN public.wapi_v37_post_internal(p_copro_id,p_fiscal_year_id,p_journal_code,p_entry_date,p_reference,p_label,p_source_type,p_source_id,v_fp,p_lines,p_metadata,auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_reverse_entry(p_entry_id uuid,p_reason text DEFAULT 'Correction')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_copro uuid;
BEGIN
  SELECT copro_id INTO v_copro FROM public.compta_accounting_entries WHERE id=p_entry_id;
  IF v_copro IS NULL OR NOT public.wapi_v37_can_access_copro(v_copro) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  RETURN public.wapi_v37_reverse_internal(p_entry_id,p_reason,auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_balance(
  p_copro_id uuid,p_fiscal_year_id uuid,p_from date DEFAULT NULL,p_to date DEFAULT NULL
)
RETURNS TABLE(account_id uuid,account_code text,account_label text,debit numeric,credit numeric,balance numeric,line_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  RETURN QUERY
  SELECT a.id,a.code,a.label,round(sum(l.debit),2),round(sum(l.credit),2),round(sum(l.debit-l.credit),2),count(*)
  FROM public.compta_accounting_entries e
  JOIN public.compta_accounting_lines l ON l.entry_id=e.id
  JOIN public.compta_accounts a ON a.id=l.account_id
  WHERE e.copro_id=p_copro_id AND e.fiscal_year_id=p_fiscal_year_id
    AND e.status IN ('posted','reversed')
    AND (p_from IS NULL OR e.entry_date>=p_from) AND (p_to IS NULL OR e.entry_date<=p_to)
  GROUP BY a.id,a.code,a.label
  HAVING abs(sum(l.debit-l.credit))>=0.005 OR sum(l.debit)>0 OR sum(l.credit)>0
  ORDER BY a.code;
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_ledger(
  p_copro_id uuid,p_fiscal_year_id uuid,p_account_code text DEFAULT NULL,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_limit integer DEFAULT 1000
)
RETURNS TABLE(entry_id uuid,entry_number text,entry_date date,journal_code text,reference text,entry_label text,line_no integer,account_id uuid,account_code text,account_label text,tier_type text,tier_id uuid,description text,debit numeric,credit numeric,running_balance numeric,source_type text,source_id text,status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT e.id entry_id,e.entry_number,e.entry_date,e.journal_code,e.reference,e.label entry_label,l.line_no,l.account_id,a.code account_code,a.label account_label,l.tier_type,l.tier_id,l.description,l.debit,l.credit,e.source_type,e.source_id,e.status
    FROM public.compta_accounting_entries e
    JOIN public.compta_accounting_lines l ON l.entry_id=e.id
    JOIN public.compta_accounts a ON a.id=l.account_id
    WHERE e.copro_id=p_copro_id AND e.fiscal_year_id=p_fiscal_year_id AND e.status IN ('posted','reversed')
      AND (p_account_code IS NULL OR trim(p_account_code)='' OR a.code LIKE trim(p_account_code)||'%')
      AND (p_from IS NULL OR e.entry_date>=p_from) AND (p_to IS NULL OR e.entry_date<=p_to)
  )
  SELECT b.entry_id,b.entry_number,b.entry_date,b.journal_code,b.reference,b.entry_label,b.line_no,b.account_id,b.account_code,b.account_label,b.tier_type,b.tier_id,b.description,b.debit,b.credit,
    round(sum(b.debit-b.credit) OVER(PARTITION BY b.account_id ORDER BY b.entry_date,b.entry_number,b.line_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),2),
    b.source_type,b.source_id,b.status
  FROM base b
  ORDER BY b.account_code,b.entry_date,b.entry_number,b.line_no
  LIMIT greatest(1,least(coalesce(p_limit,1000),5000));
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_journal_summary(p_copro_id uuid,p_fiscal_year_id uuid)
RETURNS TABLE(journal_code text,entry_count bigint,line_count bigint,total_debit numeric,total_credit numeric,last_entry_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  RETURN QUERY
  SELECT e.journal_code,count(DISTINCT e.id),count(l.id),round(sum(l.debit),2),round(sum(l.credit),2),max(e.entry_date)
  FROM public.compta_accounting_entries e JOIN public.compta_accounting_lines l ON l.entry_id=e.id
  WHERE e.copro_id=p_copro_id AND e.fiscal_year_id=p_fiscal_year_id AND e.status IN ('posted','reversed')
  GROUP BY e.journal_code ORDER BY e.journal_code;
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_recent_entries(p_copro_id uuid,p_fiscal_year_id uuid,p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid,entry_number text,entry_date date,journal_code text,reference text,label text,status text,source_type text,source_id text,total numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  RETURN QUERY
  SELECT e.id,e.entry_number,e.entry_date,e.journal_code,e.reference,e.label,e.status,e.source_type,e.source_id,round(sum(l.debit),2)
  FROM public.compta_accounting_entries e JOIN public.compta_accounting_lines l ON l.entry_id=e.id
  WHERE e.copro_id=p_copro_id AND e.fiscal_year_id=p_fiscal_year_id AND e.status IN ('posted','reversed')
  GROUP BY e.id ORDER BY e.entry_date DESC,e.entry_number DESC LIMIT greatest(1,least(coalesce(p_limit,20),100));
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_capabilities(p_copro_id uuid DEFAULT NULL,p_fiscal_year_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_entries bigint:=0; v_lines bigint:=0; v_errors bigint:=0;
BEGIN
  -- Sans copropriété explicite, on expose uniquement la disponibilité du moteur,
  -- jamais des totaux multi-ACP à un utilisateur standard.
  IF p_copro_id IS NULL THEN
    RETURN jsonb_build_object('version','37.0.0','server_accounting',true,'entries',0,'lines',0,'open_sync_errors',0,'parallel_mode',true);
  END IF;
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  SELECT count(*) INTO v_entries FROM public.compta_accounting_entries e WHERE e.copro_id=p_copro_id AND (p_fiscal_year_id IS NULL OR e.fiscal_year_id=p_fiscal_year_id) AND e.status IN ('posted','reversed');
  SELECT count(*) INTO v_lines FROM public.compta_accounting_lines l JOIN public.compta_accounting_entries e ON e.id=l.entry_id WHERE e.copro_id=p_copro_id AND (p_fiscal_year_id IS NULL OR e.fiscal_year_id=p_fiscal_year_id) AND e.status IN ('posted','reversed');
  SELECT count(*) INTO v_errors FROM public.compta_accounting_sync_errors s WHERE s.resolved_at IS NULL AND s.copro_id=p_copro_id;
  RETURN jsonb_build_object('version','37.0.0','server_accounting',true,'entries',v_entries,'lines',v_lines,'open_sync_errors',v_errors,'parallel_mode',true);
END; $$;

CREATE OR REPLACE FUNCTION public.wapi_v37_reconciliation(p_copro_id uuid,p_fiscal_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_year public.compta_fiscal_years%ROWTYPE;
  v_inv_source bigint:=0; v_inv_missing bigint:=0;
  v_call_source bigint:=0; v_call_missing bigint:=0;
  v_bank_source bigint:=0; v_bank_missing bigint:=0;
  v_od_source bigint:=0; v_od_missing bigint:=0;
  v_errors bigint:=0; v_entries bigint:=0; v_debit numeric:=0; v_credit numeric:=0;
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  SELECT * INTO v_year FROM public.compta_fiscal_years WHERE id=p_fiscal_year_id AND copro_id=p_copro_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice invalide.'; END IF;

  SELECT count(*),count(*) FILTER (WHERE NOT EXISTS(
    SELECT 1 FROM public.compta_accounting_entries e
    WHERE e.copro_id=p_copro_id AND e.source_type='invoice' AND e.source_id=i.id::text AND e.status='posted'
  )) INTO v_inv_source,v_inv_missing
  FROM public.compta_invoices i
  WHERE i.copro_id=p_copro_id AND i.invoice_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(i.status,''))<>'rejected';

  SELECT count(*),count(*) FILTER (WHERE NOT EXISTS(
    SELECT 1 FROM public.compta_accounting_entries e
    WHERE e.copro_id=p_copro_id AND e.source_type='owner_call' AND e.source_id=c.id::text AND e.status='posted'
  )) INTO v_call_source,v_call_missing
  FROM public.compta_owner_calls c
  WHERE c.copro_id=p_copro_id AND c.due_date BETWEEN v_year.starts_on AND v_year.ends_on
    AND lower(coalesce(nullif(to_jsonb(c)->>'accounting_status',''),nullif(to_jsonb(c)->>'accounting_state',''),CASE WHEN lower(coalesce(to_jsonb(c)->>'is_accounted','')) IN ('true','1','yes') THEN 'accounted' ELSE 'pending' END))='accounted';

  SELECT count(*),count(*) FILTER (WHERE NOT EXISTS(
    SELECT 1 FROM public.compta_accounting_entries e
    WHERE e.copro_id=p_copro_id AND e.source_type='bank_tx' AND e.source_id=t.id::text AND e.status='posted'
  )) INTO v_bank_source,v_bank_missing
  FROM public.compta_bank_transactions t
  WHERE t.copro_id=p_copro_id AND t.transaction_date BETWEEN v_year.starts_on AND v_year.ends_on;

  WITH groups AS (
    SELECT DISTINCT coalesce(e.od_group_id::text,e.source_id::text,e.id::text) gid
    FROM public.compta_entries e
    WHERE e.copro_id=p_copro_id AND e.entry_date BETWEEN v_year.starts_on AND v_year.ends_on
      AND coalesce(e.status,'posted')<>'draft'
      AND (lower(coalesce(e.source_type,''))='od' OR upper(coalesce(e.journal_code,'')) IN ('OD','AN'))
  )
  SELECT count(*),count(*) FILTER (WHERE NOT EXISTS(
    SELECT 1 FROM public.compta_accounting_entries ae
    WHERE ae.copro_id=p_copro_id AND ae.source_type='legacy_od' AND ae.source_id=groups.gid AND ae.status='posted'
  )) INTO v_od_source,v_od_missing FROM groups;

  SELECT count(*) INTO v_errors FROM public.compta_accounting_sync_errors s WHERE s.copro_id=p_copro_id AND s.resolved_at IS NULL;
  SELECT count(DISTINCT e.id),coalesce(round(sum(l.debit),2),0),coalesce(round(sum(l.credit),2),0)
    INTO v_entries,v_debit,v_credit
  FROM public.compta_accounting_entries e JOIN public.compta_accounting_lines l ON l.entry_id=e.id
  WHERE e.copro_id=p_copro_id AND e.fiscal_year_id=p_fiscal_year_id AND e.status IN ('posted','reversed');

  RETURN jsonb_build_object(
    'version','37.0.0','copro_id',p_copro_id,'fiscal_year_id',p_fiscal_year_id,
    'source_counts',jsonb_build_object('invoices',v_inv_source,'owner_calls',v_call_source,'bank_transactions',v_bank_source,'od_groups',v_od_source),
    'missing',jsonb_build_object('invoices',v_inv_missing,'owner_calls',v_call_missing,'bank_transactions',v_bank_missing,'od_groups',v_od_missing),
    'missing_total',v_inv_missing+v_call_missing+v_bank_missing+v_od_missing,
    'open_sync_errors',v_errors,'entry_count',v_entries,'total_debit',v_debit,'total_credit',v_credit,
    'balanced',abs(v_debit-v_credit)<0.005,
    'ready_for_compare',(v_inv_missing+v_call_missing+v_bank_missing+v_od_missing)=0 AND v_errors=0 AND abs(v_debit-v_credit)<0.005
  );
END; $$;

-- ---------- 11. Backfill contrôlé ----------
CREATE OR REPLACE FUNCTION public.wapi_v37_backfill_sources(p_copro_id uuid,p_fiscal_year_id uuid,p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_year public.compta_fiscal_years%ROWTYPE; r record; v_inv int:=0; v_calls int:=0; v_bank int:=0; v_od int:=0; v_err int:=0;
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  SELECT * INTO v_year FROM public.compta_fiscal_years WHERE id=p_fiscal_year_id AND copro_id=p_copro_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice invalide.'; END IF;

  SELECT count(*) INTO v_inv FROM public.compta_invoices i WHERE i.copro_id=p_copro_id AND i.invoice_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(i.status,''))<>'rejected';
  SELECT count(*) INTO v_calls FROM public.compta_owner_calls c WHERE c.copro_id=p_copro_id AND c.due_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(nullif(to_jsonb(c)->>'accounting_status',''),nullif(to_jsonb(c)->>'accounting_state',''),CASE WHEN lower(coalesce(to_jsonb(c)->>'is_accounted','')) IN ('true','1','yes') THEN 'accounted' ELSE 'pending' END))='accounted';
  SELECT count(*) INTO v_bank FROM public.compta_bank_transactions t WHERE t.copro_id=p_copro_id AND t.transaction_date BETWEEN v_year.starts_on AND v_year.ends_on;
  SELECT count(DISTINCT coalesce(e.od_group_id::text,e.source_id::text,e.id::text)) INTO v_od FROM public.compta_entries e WHERE e.copro_id=p_copro_id AND e.entry_date BETWEEN v_year.starts_on AND v_year.ends_on AND coalesce(e.status,'posted')<>'draft' AND (lower(coalesce(e.source_type,''))='od' OR upper(coalesce(e.journal_code,'')) IN ('OD','AN'));

  IF p_dry_run THEN RETURN jsonb_build_object('dry_run',true,'invoices',v_inv,'owner_calls',v_calls,'bank_transactions',v_bank,'od_groups',v_od); END IF;

  FOR r IN SELECT i.id FROM public.compta_invoices i WHERE i.copro_id=p_copro_id AND i.invoice_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(i.status,''))<>'rejected' LOOP
    BEGIN PERFORM public.wapi_v37_sync_invoice(r.id); EXCEPTION WHEN others THEN v_err:=v_err+1; PERFORM public.wapi_v37_log_sync_error(p_copro_id,'invoice',r.id::text,SQLERRM,'{}'::jsonb); END;
  END LOOP;
  FOR r IN SELECT c.id FROM public.compta_owner_calls c WHERE c.copro_id=p_copro_id AND c.due_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(nullif(to_jsonb(c)->>'accounting_status',''),nullif(to_jsonb(c)->>'accounting_state',''),CASE WHEN lower(coalesce(to_jsonb(c)->>'is_accounted','')) IN ('true','1','yes') THEN 'accounted' ELSE 'pending' END))='accounted' LOOP
    BEGIN PERFORM public.wapi_v37_sync_owner_call(r.id); EXCEPTION WHEN others THEN v_err:=v_err+1; PERFORM public.wapi_v37_log_sync_error(p_copro_id,'owner_call',r.id::text,SQLERRM,'{}'::jsonb); END;
  END LOOP;
  FOR r IN SELECT t.id FROM public.compta_bank_transactions t WHERE t.copro_id=p_copro_id AND t.transaction_date BETWEEN v_year.starts_on AND v_year.ends_on LOOP
    BEGIN PERFORM public.wapi_v37_sync_bank_transaction(r.id); EXCEPTION WHEN others THEN v_err:=v_err+1; PERFORM public.wapi_v37_log_sync_error(p_copro_id,'bank_tx',r.id::text,SQLERRM,'{}'::jsonb); END;
  END LOOP;
  FOR r IN SELECT DISTINCT coalesce(e.od_group_id::text,e.source_id::text,e.id::text) gid FROM public.compta_entries e WHERE e.copro_id=p_copro_id AND e.entry_date BETWEEN v_year.starts_on AND v_year.ends_on AND coalesce(e.status,'posted')<>'draft' AND (lower(coalesce(e.source_type,''))='od' OR upper(coalesce(e.journal_code,'')) IN ('OD','AN')) LOOP
    BEGIN PERFORM public.wapi_v37_sync_legacy_od(r.gid); EXCEPTION WHEN others THEN v_err:=v_err+1; PERFORM public.wapi_v37_log_sync_error(p_copro_id,'legacy_od',r.gid,SQLERRM,'{}'::jsonb); END;
  END LOOP;
  RETURN jsonb_build_object('dry_run',false,'invoices',v_inv,'owner_calls',v_calls,'bank_transactions',v_bank,'od_groups',v_od,'errors',v_err);
END; $$;

-- ---------- 12. RLS / droits ----------
ALTER TABLE public.compta_accounting_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compta_accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compta_accounting_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compta_accounting_sync_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compta_accounting_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wapi_v37_journals_read ON public.compta_accounting_journals;
CREATE POLICY wapi_v37_journals_read ON public.compta_accounting_journals FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS wapi_v37_entries_read ON public.compta_accounting_entries;
CREATE POLICY wapi_v37_entries_read ON public.compta_accounting_entries FOR SELECT TO authenticated USING(public.wapi_v37_can_access_copro(copro_id));
DROP POLICY IF EXISTS wapi_v37_lines_read ON public.compta_accounting_lines;
CREATE POLICY wapi_v37_lines_read ON public.compta_accounting_lines FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.compta_accounting_entries e WHERE e.id=entry_id AND public.wapi_v37_can_access_copro(e.copro_id)));
DROP POLICY IF EXISTS wapi_v37_sync_errors_read ON public.compta_accounting_sync_errors;
CREATE POLICY wapi_v37_sync_errors_read ON public.compta_accounting_sync_errors FOR SELECT TO authenticated USING(copro_id IS NULL OR public.wapi_v37_can_access_copro(copro_id));

REVOKE ALL ON public.compta_accounting_entries,public.compta_accounting_lines,public.compta_accounting_counters,public.compta_accounting_sync_errors FROM anon,authenticated;
GRANT SELECT ON public.compta_accounting_entries,public.compta_accounting_lines,public.compta_accounting_sync_errors,public.compta_accounting_journals TO authenticated;

REVOKE ALL ON FUNCTION public.wapi_v37_post_entry(uuid,uuid,text,date,text,text,jsonb,text,text,jsonb) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_reverse_entry(uuid,text) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_balance(uuid,uuid,date,date) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_ledger(uuid,uuid,text,date,date,integer) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_journal_summary(uuid,uuid) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_recent_entries(uuid,uuid,integer) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_capabilities(uuid,uuid) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_reconciliation(uuid,uuid) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_backfill_sources(uuid,uuid,boolean) FROM public;
REVOKE ALL ON FUNCTION public.wapi_v37_sync_legacy_od(text) FROM public;
GRANT EXECUTE ON FUNCTION public.wapi_v37_post_entry(uuid,uuid,text,date,text,text,jsonb,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_reverse_entry(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_balance(uuid,uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_ledger(uuid,uuid,text,date,date,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_journal_summary(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_recent_entries(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_capabilities(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_reconciliation(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_backfill_sources(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wapi_v37_sync_legacy_od(text) TO authenticated;

-- Les helpers internes ne sont jamais appelables directement depuis le navigateur.
REVOKE ALL ON FUNCTION public.wapi_v37_resolve_account_id(text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_fiscal_year_for(uuid,date) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_next_sequence(uuid,uuid,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_make_entry_number(uuid,uuid,text,bigint) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_assert_period(uuid,uuid,date) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_log_sync_error(uuid,text,text,text,jsonb) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_post_internal(uuid,uuid,text,date,text,text,text,text,text,jsonb,jsonb,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_reverse_internal(uuid,text,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_replace_source_internal(uuid,uuid,text,date,text,text,text,text,text,jsonb,jsonb,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_deactivate_source_internal(uuid,text,text,text,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_sync_invoice(uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_sync_owner_call(uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.wapi_v37_sync_bank_transaction(uuid) FROM public,anon,authenticated;

COMMENT ON TABLE public.compta_accounting_entries IS 'WAPI One V37 : journal comptable serveur. Mode parallèle tant que la bascule OptiPro/WAPI n’est pas validée.';
COMMENT ON FUNCTION public.wapi_v37_backfill_sources(uuid,uuid,boolean) IS 'Synchronise les sources historiques d’une copro/exercice. Toujours lancer d’abord avec p_dry_run=true.';
