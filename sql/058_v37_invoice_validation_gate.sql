-- WAPI ONE : corriger la comptabilisation des factures non validées.
-- Migration additive après 057. Ne pas réexécuter ni modifier 057.
-- À vérifier et appliquer dans Supabase staging avant déploiement base.
-- Aucun backfill, aucune suppression et aucune réparation historique automatique.
-- Les droits des trois fonctions existantes sont conservés par CREATE OR REPLACE.
BEGIN;

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
  -- Seules les factures validées/payées alimentent le journal ACH.
  -- Revenir en brouillon extourne la source via le mécanisme existant.
  IF v_status NOT IN ('validated','paid') THEN
    RETURN public.wapi_v37_deactivate_source_internal(v_copro,'invoice',p_invoice_id::text,'Facture non validée',nullif(j->>'created_by','')::uuid);
  END IF;
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
  WHERE i.copro_id=p_copro_id AND i.invoice_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(i.status,'')) IN ('validated','paid');

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

CREATE OR REPLACE FUNCTION public.wapi_v37_backfill_sources(p_copro_id uuid,p_fiscal_year_id uuid,p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_year public.compta_fiscal_years%ROWTYPE; r record; v_inv int:=0; v_calls int:=0; v_bank int:=0; v_od int:=0; v_err int:=0;
BEGIN
  IF NOT public.wapi_v37_can_access_copro(p_copro_id) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  SELECT * INTO v_year FROM public.compta_fiscal_years WHERE id=p_fiscal_year_id AND copro_id=p_copro_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice invalide.'; END IF;

  SELECT count(*) INTO v_inv FROM public.compta_invoices i WHERE i.copro_id=p_copro_id AND i.invoice_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(i.status,'')) IN ('validated','paid');
  SELECT count(*) INTO v_calls FROM public.compta_owner_calls c WHERE c.copro_id=p_copro_id AND c.due_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(nullif(to_jsonb(c)->>'accounting_status',''),nullif(to_jsonb(c)->>'accounting_state',''),CASE WHEN lower(coalesce(to_jsonb(c)->>'is_accounted','')) IN ('true','1','yes') THEN 'accounted' ELSE 'pending' END))='accounted';
  SELECT count(*) INTO v_bank FROM public.compta_bank_transactions t WHERE t.copro_id=p_copro_id AND t.transaction_date BETWEEN v_year.starts_on AND v_year.ends_on;
  SELECT count(DISTINCT coalesce(e.od_group_id::text,e.source_id::text,e.id::text)) INTO v_od FROM public.compta_entries e WHERE e.copro_id=p_copro_id AND e.entry_date BETWEEN v_year.starts_on AND v_year.ends_on AND coalesce(e.status,'posted')<>'draft' AND (lower(coalesce(e.source_type,''))='od' OR upper(coalesce(e.journal_code,'')) IN ('OD','AN'));

  IF p_dry_run THEN RETURN jsonb_build_object('dry_run',true,'invoices',v_inv,'owner_calls',v_calls,'bank_transactions',v_bank,'od_groups',v_od); END IF;

  FOR r IN SELECT i.id FROM public.compta_invoices i WHERE i.copro_id=p_copro_id AND i.invoice_date BETWEEN v_year.starts_on AND v_year.ends_on AND lower(coalesce(i.status,'')) IN ('validated','paid') LOOP
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

COMMIT;
