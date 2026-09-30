/* WAPI One V37.0 — Coeur comptable serveur (mode parallèle)
 * Le moteur V36 reste disponible. V37 n'affiche les états serveur qu'après
 * activation explicite du mode "V37 serveur" dans l'interface.
 */
(function(root, factory){
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WapiAccountingV37 = api;
})(typeof window !== 'undefined' ? window : null, function(root){
  'use strict';

  const VERSION = '37.0.0';
  const MODE_KEY = 'wapi_v37_report_mode';

  const pure = {
    cents(value){ return Math.round((Number(value)||0)*100); },
    isBalancedLines(lines){
      const rows = Array.isArray(lines) ? lines : [];
      const debit = rows.reduce((s,l)=>s+this.cents(l?.debit),0);
      const credit = rows.reduce((s,l)=>s+this.cents(l?.credit),0);
      return rows.length >= 2 && debit > 0 && debit === credit;
    },
    balanceTotals(rows){
      const list = Array.isArray(rows) ? rows : [];
      const debit = list.reduce((s,r)=>s+Number(r?.debit||0),0);
      const credit = list.reduce((s,r)=>s+Number(r?.credit||0),0);
      return {debit, credit, difference: debit-credit};
    },
    normalizeMode(value){ return value === 'server' ? 'server' : 'legacy'; },
    pickFiscalYear(years, coproId, selectedId){
      const list=(Array.isArray(years)?years:[]).filter(y=>!coproId || String(y?.copro_id)===String(coproId));
      if(selectedId){ const selected=list.find(y=>String(y?.id)===String(selectedId)); if(selected) return selected; }
      return list.find(y=>String(y?.status||'').toLowerCase()==='open') || list[0] || null;
    }
  };

  if (!root) return {VERSION, pure};

  const runtime = {
    available:false,
    checked:false,
    capability:null,
    balance:[],
    journals:[],
    recent:[],
    reconciliation:null,
    ledger:[],
    error:'',
    loading:false,
    requestToken:0,
    mode:pure.normalizeMode(localStorage.getItem(MODE_KEY)||'legacy'),
    context:{coproId:'',yearId:''}
  };

  const byId = (id)=>document.getElementById(id);
  const esc = (value)=>String(value??'').replace(/[&<>'"]/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const money = (value)=>new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(Number(value||0));
  const fmtDate = (value)=>{ if(!value) return ''; try{return new Date(value+'T00:00:00').toLocaleDateString('fr-BE');}catch(_){return String(value);} };
  const client = ()=>typeof supabaseClient!=='undefined' ? supabaseClient : null;
  const appState = ()=>typeof state!=='undefined' ? state : null;

  function selectedContext(){
    const s=appState(); if(!s) return {coproId:'',year:null,yearId:''};
    const coproId=String(s.activeCoproId||'');
    const selectedId=String(s.activeFiscalYearId||byId('activeFiscalYearSelect')?.value||'');
    const year=pure.pickFiscalYear(s.fiscalYears||[],coproId,selectedId);
    return {coproId,year,yearId:String(year?.id||'')};
  }

  async function rpc(name,args={}){
    const c=client(); if(!c) throw new Error('Connexion Supabase indisponible.');
    const {data,error}=await c.rpc(name,args);
    if(error) throw error;
    return data;
  }

  async function checkAvailability(force=false){
    if(runtime.checked && !force) return runtime.available;
    runtime.checked=true;
    try{
      const ctx=selectedContext();
      const cap=await rpc('wapi_v37_capabilities',{p_copro_id:ctx.coproId||null,p_fiscal_year_id:ctx.yearId||null});
      runtime.capability=cap||{}; runtime.available=!!cap?.server_accounting; runtime.error='';
    }catch(error){
      runtime.available=false; runtime.capability=null;
      const msg=String(error?.message||error||'');
      if(!/function .*wapi_v37_capabilities|Could not find the function|schema cache|does not exist/i.test(msg)) console.warn('WAPI V37 disponibilité :',error);
    }
    updateModeBars();
    return runtime.available;
  }

  function setMode(mode){
    runtime.mode=pure.normalizeMode(mode);
    localStorage.setItem(MODE_KEY,runtime.mode);
    updateModeBars();
    if(runtime.mode==='server') refresh({force:true,render:true});
    else if(typeof renderAll==='function') renderAll();
  }

  function modeBarHtml(){
    const cap=runtime.capability||{};
    const recon=runtime.reconciliation||{};
    const status=runtime.available
      ? `<span class="badge ok">V37 disponible</span><span class="badge">${Number(cap.entries||0)} écriture(s)</span>${Number(recon.missing_total||0)?`<span class="badge warn">${Number(recon.missing_total)} source(s) à synchroniser</span>`:''}${Number(cap.open_sync_errors||recon.open_sync_errors||0)?`<span class="badge warn">${Number(cap.open_sync_errors||recon.open_sync_errors||0)} erreur(s) synchro</span>`:''}${recon.ready_for_compare?'<span class="badge ok">Rapprochement OK</span>':''}`
      : '<span class="badge warn">Migration SQL V37 non appliquée</span>';
    return `<div class="v37-mode-bar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 14px;padding:10px 12px;border:1px solid rgba(31,122,140,.18);border-radius:12px;background:rgba(31,122,140,.05)">
      <strong>Moteur comptable</strong>
      <button class="btn secondary small" type="button" data-v37-mode="legacy" ${runtime.mode==='legacy'?'disabled':''}>V36 historique</button>
      <button class="btn small" type="button" data-v37-mode="server" ${!runtime.available||runtime.mode==='server'?'disabled':''}>V37 serveur</button>
      ${status}
      <span class="muted-note">Mode parallèle : WAPI TWO n'est pas modifié.</span>
    </div>`;
  }

  function ensureModeBar(targetId){
    const target=byId(targetId); if(!target) return;
    const id=`v37ModeBar_${targetId}`;
    let bar=byId(id);
    if(!bar){ bar=document.createElement('div'); bar.id=id; target.insertAdjacentElement('beforebegin',bar); }
    bar.innerHTML=modeBarHtml();
  }

  function updateModeBars(){
    ['balanceTable','journalsTable'].forEach(ensureModeBar);
  }

  function contextNotice(){
    const ctx=selectedContext();
    if(!ctx.coproId) return 'Choisis une copropriété : V37 ne charge volontairement pas une comptabilité globale de toutes les ACP.';
    if(!ctx.yearId) return 'Choisis un exercice comptable.';
    return '';
  }

  async function loadServerReports(){
    const ctx=selectedContext(); runtime.context={coproId:ctx.coproId,yearId:ctx.yearId};
    const notice=contextNotice();
    if(notice){ runtime.balance=[]; runtime.journals=[]; runtime.recent=[]; return; }
    const token=++runtime.requestToken; runtime.loading=true;
    try{
      const [balance,journals,recent,cap,reconciliation]=await Promise.all([
        rpc('wapi_v37_balance',{p_copro_id:ctx.coproId,p_fiscal_year_id:ctx.yearId,p_from:null,p_to:null}),
        rpc('wapi_v37_journal_summary',{p_copro_id:ctx.coproId,p_fiscal_year_id:ctx.yearId}),
        rpc('wapi_v37_recent_entries',{p_copro_id:ctx.coproId,p_fiscal_year_id:ctx.yearId,p_limit:20}),
        rpc('wapi_v37_capabilities',{p_copro_id:ctx.coproId,p_fiscal_year_id:ctx.yearId}),
        rpc('wapi_v37_reconciliation',{p_copro_id:ctx.coproId,p_fiscal_year_id:ctx.yearId})
      ]);
      if(token!==runtime.requestToken) return;
      runtime.balance=balance||[]; runtime.journals=journals||[]; runtime.recent=recent||[]; runtime.capability=cap||runtime.capability; runtime.reconciliation=reconciliation||null; runtime.error=''; updateModeBars();
    }catch(error){ if(token===runtime.requestToken){runtime.error=String(error?.message||error); console.warn('WAPI V37 états serveur :',error);} }
    finally{ if(token===runtime.requestToken) runtime.loading=false; }
  }

  function renderServerBalance(){
    const el=byId('balanceTable'); if(!el || runtime.mode!=='server' || !runtime.available) return;
    const notice=contextNotice();
    if(notice){ el.innerHTML=`<div class="notice">${esc(notice)}</div>`; return; }
    if(runtime.error){ el.innerHTML=`<div class="notice danger">${esc(runtime.error)}</div>`; return; }
    const totals=pure.balanceTotals(runtime.balance);
    const year=selectedContext().year;
    el.innerHTML=`<div class="v30-account-toolbar"><label>Exercice <input value="${esc(year?.label||'')}" disabled></label><span class="badge ok">Source PostgreSQL V37</span></div>
      <div class="v30-kpi-grid"><div class="v30-kpi-card"><span>Total débit</span><strong>${money(totals.debit)}</strong></div><div class="v30-kpi-card"><span>Total crédit</span><strong>${money(totals.credit)}</strong></div><div class="v30-kpi-card"><span>Écart</span><strong>${money(totals.difference)}</strong></div></div>
      <div class="table-wrap"><table class="v30-table"><thead><tr><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde</th><th>Lignes</th></tr></thead><tbody>${runtime.balance.map(r=>`<tr data-v37-ledger-account="${esc(r.account_code)}"><td><strong>${esc(r.account_code)}</strong></td><td>${esc(r.account_label||'')}</td><td>${money(r.debit)}</td><td>${money(r.credit)}</td><td>${money(r.balance)}</td><td>${Number(r.line_count||0)}</td></tr>`).join('')||'<tr><td colspan="6">Aucune écriture V37 pour cet exercice. Lance d’abord le backfill contrôlé.</td></tr>'}</tbody></table></div>`;
  }

  function renderServerJournals(){
    if(runtime.mode!=='server'||!runtime.available) return;
    const summary=byId('journalsTable'), recent=byId('recentJournalEntriesTable'); if(!summary) return;
    const notice=contextNotice(); if(notice){summary.innerHTML=`<div class="notice">${esc(notice)}</div>`; if(recent) recent.innerHTML=''; return;}
    summary.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Journal</th><th>Écritures</th><th>Lignes</th><th>Débit</th><th>Crédit</th><th>Dernière date</th></tr></thead><tbody>${runtime.journals.map(j=>`<tr><td><strong>${esc(j.journal_code)}</strong></td><td>${Number(j.entry_count||0)}</td><td>${Number(j.line_count||0)}</td><td>${money(j.total_debit)}</td><td>${money(j.total_credit)}</td><td>${fmtDate(j.last_entry_date)}</td></tr>`).join('')||'<tr><td colspan="6">Aucun journal V37.</td></tr>'}</tbody></table></div>`;
    if(recent) recent.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Date</th><th>N° écriture</th><th>Journal</th><th>Référence</th><th>Libellé</th><th>Montant</th><th>Source</th></tr></thead><tbody>${runtime.recent.map(e=>`<tr><td>${fmtDate(e.entry_date)}</td><td><strong>${esc(e.entry_number)}</strong></td><td>${esc(e.journal_code)}</td><td>${esc(e.reference||'')}</td><td>${esc(e.label||'')}</td><td>${money(e.total)}</td><td>${esc(e.source_type||'')}</td></tr>`).join('')||'<tr><td colspan="7">Aucune écriture V37.</td></tr>'}</tbody></table></div>`;
  }

  function ledgerShell(){
    const view=byId('ledgerView'); const card=view?.querySelector('.card'); if(!card) return;
    if(card.dataset.v37Ready==='1') return;
    card.dataset.v37Ready='1';
    card.innerHTML=`<div class="toolbar"><div><h2>Grand livre</h2><p class="muted-note">Lecture serveur V37 — journal comptable central.</p></div><div><span class="badge ok">V37</span> <span class="badge warn">Mode parallèle</span></div></div>
      <div class="context-banner"><span>Contexte : <span data-active-copro-label>Mode global</span></span><span id="v37LedgerStatus" class="muted-note"></span></div>
      <div class="list-filters" id="v37LedgerFilters">
        <label>Compte <select id="v37LedgerAccount"><option value="">Tous les comptes</option></select></label>
        <label>Du <input id="v37LedgerFrom" type="date"></label>
        <label>Au <input id="v37LedgerTo" type="date"></label>
        <label>Recherche <input id="v37LedgerSearch" placeholder="Référence, libellé, n° écriture..."></label>
        <button class="btn secondary" id="v37LedgerRefresh" type="button">Rafraîchir</button>
      </div>
      <div id="v37LedgerSummary" class="summary-line"></div><div id="v37LedgerTable"><div class="notice">Chargement du grand livre V37…</div></div>`;
    populateLedgerFilters();
  }

  function populateLedgerFilters(){
    const s=appState(); const select=byId('v37LedgerAccount'); if(!s||!select) return;
    const keep=select.value||'';
    select.innerHTML='<option value="">Tous les comptes</option>'+(s.accounts||[]).map(a=>`<option value="${esc(a.code||'')}">${esc((a.code||'')+' - '+(a.label||''))}</option>`).join('');
    if([...select.options].some(o=>o.value===keep)) select.value=keep;
    const y=selectedContext().year;
    if(y){ if(!byId('v37LedgerFrom')?.value) byId('v37LedgerFrom').value=y.starts_on||''; if(!byId('v37LedgerTo')?.value) byId('v37LedgerTo').value=y.ends_on||''; }
  }

  async function loadLedger(){
    ledgerShell(); populateLedgerFilters();
    const ctx=selectedContext(); const table=byId('v37LedgerTable'); const status=byId('v37LedgerStatus');
    if(!runtime.available){ if(table)table.innerHTML='<div class="notice">Exécute d’abord la migration SQL 057_v37_compta_serveur.sql dans Supabase.</div>'; return; }
    const notice=contextNotice(); if(notice){if(table)table.innerHTML=`<div class="notice">${esc(notice)}</div>`;return;}
    const account=byId('v37LedgerAccount')?.value||null, from=byId('v37LedgerFrom')?.value||null, to=byId('v37LedgerTo')?.value||null;
    if(status){ const r=runtime.reconciliation||{}; status.textContent=r.ready_for_compare?'Rapprochement V36/V37 OK':'Chargement serveur…'; }
    try{
      runtime.ledger=await rpc('wapi_v37_ledger',{p_copro_id:ctx.coproId,p_fiscal_year_id:ctx.yearId,p_account_code:account,p_from:from,p_to:to,p_limit:2000})||[];
      renderLedger(); if(status) status.textContent=`${runtime.ledger.length} ligne(s) chargée(s)`;
    }catch(error){ if(table)table.innerHTML=`<div class="notice danger">${esc(error?.message||error)}</div>`; if(status)status.textContent='Erreur'; }
  }

  function renderLedger(){
    const table=byId('v37LedgerTable'), summary=byId('v37LedgerSummary'); if(!table) return;
    const q=(byId('v37LedgerSearch')?.value||'').toLowerCase().trim();
    const rows=(runtime.ledger||[]).filter(r=>!q||[r.entry_number,r.reference,r.entry_label,r.description,r.account_code,r.account_label,r.source_type].join(' ').toLowerCase().includes(q));
    const totals=pure.balanceTotals(rows);
    if(summary) summary.innerHTML=`<span class="badge">${rows.length} ligne(s)</span><span class="badge">Débit ${money(totals.debit)}</span><span class="badge">Crédit ${money(totals.credit)}</span><span class="badge ${Math.abs(totals.difference)<0.005?'ok':'warn'}">Écart ${money(totals.difference)}</span>`;
    table.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Compte</th><th>Date</th><th>N° écriture</th><th>Journal</th><th>Référence</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde progressif</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.account_code)}</strong><div class="muted-note">${esc(r.account_label||'')}</div></td><td>${fmtDate(r.entry_date)}</td><td>${esc(r.entry_number)}</td><td>${esc(r.journal_code)}</td><td>${esc(r.reference||'')}</td><td>${esc(r.description||r.entry_label||'')}</td><td>${Number(r.debit||0)?money(r.debit):''}</td><td>${Number(r.credit||0)?money(r.credit):''}</td><td>${money(r.running_balance)}</td></tr>`).join('')||'<tr><td colspan="9">Aucune ligne V37 pour ces filtres.</td></tr>'}</tbody></table></div>`;
  }

  async function refresh(options={}){
    const force=!!options.force;
    if(!(await checkAvailability(force))){ ledgerShell(); if(options.render!==false){updateModeBars();} return false; }
    updateModeBars(); ledgerShell(); populateLedgerFilters();
    if(runtime.mode==='server'){
      await loadServerReports(); renderServerBalance(); renderServerJournals();
    }
    const activeView=document.querySelector('.view:not(.hidden)')?.id||'';
    if(activeView==='ledgerView') await loadLedger();
    return true;
  }

  async function syncLegacyOd(groupId){
    if(!groupId) return null;
    if(!(runtime.available || await checkAvailability())) return null;
    try{ return await rpc('wapi_v37_sync_legacy_od',{p_group_id:String(groupId)}); }
    catch(error){ console.warn('Synchronisation OD vers V37 :',error); return null; }
  }

  async function postEntry(payload){
    if(!(await checkAvailability())) throw new Error('Moteur V37 indisponible.');
    if(!pure.isBalancedLines(payload?.lines)) throw new Error('Écriture non équilibrée.');
    return rpc('wapi_v37_post_entry',{
      p_copro_id:payload.coproId,p_fiscal_year_id:payload.fiscalYearId,p_journal_code:payload.journalCode,
      p_entry_date:payload.entryDate,p_reference:payload.reference||null,p_label:payload.label||'Écriture comptable',p_lines:payload.lines,
      p_source_type:payload.sourceType||null,p_source_id:payload.sourceId||null,p_metadata:payload.metadata||{}
    });
  }

  async function reverseEntry(entryId,reason='Correction'){
    if(!(await checkAvailability())) throw new Error('Moteur V37 indisponible.');
    return rpc('wapi_v37_reverse_entry',{p_entry_id:entryId,p_reason:reason});
  }

  async function dryRunBackfill(coproId,yearId){
    if(!(await checkAvailability())) throw new Error('Moteur V37 indisponible.');
    return rpc('wapi_v37_backfill_sources',{p_copro_id:coproId,p_fiscal_year_id:yearId,p_dry_run:true});
  }

  function installHooks(){
    if(root.__wapiV37HooksInstalled) return; root.__wapiV37HooksInstalled=true;
    document.addEventListener('click',(event)=>{
      const mode=event.target.closest?.('[data-v37-mode]')?.dataset?.v37Mode;
      if(mode){event.preventDefault();setMode(mode);return;}
      const account=event.target.closest?.('[data-v37-ledger-account]')?.dataset?.v37LedgerAccount;
      if(account){
        if(typeof switchToView==='function') switchToView('ledger');
        setTimeout(()=>{ledgerShell(); const s=byId('v37LedgerAccount'); if(s)s.value=account; loadLedger();},0);
        return;
      }
      const viewBtn=event.target.closest?.('[data-view]');
      if(viewBtn && ['ledger','balance','journals'].includes(viewBtn.dataset.view)) setTimeout(()=>refresh({render:true}),0);
    });
    document.addEventListener('change',(event)=>{
      if(['activeFiscalYearSelect','activeCoproSelect'].includes(event.target?.id)) setTimeout(()=>refresh({force:true,render:true}),0);
      if(['v37LedgerAccount','v37LedgerFrom','v37LedgerTo'].includes(event.target?.id)) loadLedger();
    });
    document.addEventListener('input',(event)=>{ if(event.target?.id==='v37LedgerSearch') renderLedger(); });
    document.addEventListener('click',(event)=>{ if(event.target?.id==='v37LedgerRefresh') loadLedger(); });

    if(typeof renderAll==='function' && !root.__wapiV37RenderWrapped){
      root.__wapiV37RenderWrapped=true;
      const original=renderAll;
      renderAll=function(){ const out=original.apply(this,arguments); setTimeout(()=>{updateModeBars(); if(runtime.mode==='server') refresh({render:true});},0); return out; };
    }
  }

  function init(){
    installHooks(); ledgerShell(); updateModeBars();
    setTimeout(()=>checkAvailability().then(()=>refresh({render:true})),150);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();

  return {
    VERSION,pure,runtime,checkAvailability,refresh,setMode,loadLedger,syncLegacyOd,postEntry,reverseEntry,dryRunBackfill
  };
});
