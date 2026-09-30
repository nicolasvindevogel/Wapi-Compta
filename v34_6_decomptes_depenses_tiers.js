/* WAPI One V34.6 - Décomptes fiables, liste des dépenses Optipro, tiers actifs. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V34.6 - Décomptes et dépenses';
  const id=x=>document.getElementById(x);
  const esc=x=>typeof escapeHtml==='function'?escapeHtml(String(x??'')):String(x??'');
  const num=x=>Number(x||0);
  const db=()=>supabaseClient;
  let showInactiveOwners=false;

  function openSettlement(ownerId){
    const api=window.WapiSettlementV345;if(!api)return alert('Le module de décompte V34.5 n’est pas chargé.');
    state.selectedSettlementOwnerId=ownerId;
    api.renderDetail(ownerId);
    const detail=id('settlementDetail');if(!detail)return;
    const copy=detail.cloneNode(true);copy.querySelector('[data-close-settlement-detail]')?.remove();
    const body=copy.innerHTML;
    if(typeof window.openAppModal==='function'){
      window.openAppModal('Décompte copropriétaire',`<div class="v346-settlement-modal-content">${body}</div>`,
        '<button class="btn secondary" data-modal-close type="button">Fermer</button>',{subtitle:'Charges, consommations et situation de compte',size:'wide'});
      id('globalModalBackdrop')?.classList.add('v346-settlement-modal');
    }else{
      detail.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  function installSettlementValidation(){
    const actions=id('statementsView')?.querySelector('.quick-actions');
    if(!actions||id('v346ValidateSettlements'))return;
    actions.insertAdjacentHTML('beforeend','<button class="btn" id="v346ValidateSettlements" type="button">Valider les soldes de clôture</button>');
    const notice=id('statementsView')?.querySelector('.notice');
    notice?.insertAdjacentHTML('afterend','<div class="notice v346-settlement-note"><span class="status-dot"></span><span>Les soldes restent une simulation jusqu’à cette validation. Leur report au 01/01 de l’exercice suivant ne se fait qu’au clic sur <strong>Clôturer l’exercice</strong>.</span></div>');
  }
  async function validateSettlements(){
    const api=window.WapiSettlementV345,{coproId,yearId}=api?.selectedContext?.()||{};
    if(!coproId||!yearId)return alert('Choisis une copropriété et un exercice.');
    const owners=api.ownerRows(coproId,yearId);if(!owners.length)return alert('Aucun copropriétaire à valider.');
    if(!confirm(`Valider les soldes calculés pour ${owners.length} copropriétaire(s) ?\n\nCette validation ne reporte encore rien dans l’exercice suivant.`))return;
    const rows=owners.map(o=>{const c=api.buildOwner(o.id,coproId,yearId);return {
      copro_id:coproId,fiscal_year_id:yearId,owner_id:o.id,charges_total:Number(c.totalCharges.toFixed(2)),
      balance_before:Number(num(c.balanceRow.balance).toFixed(2)),final_balance:Number(c.final.toFixed(2)),
      calculation_data:{common:c.common,occupant:c.occupant,private_charges:c.privateCharges,consumption:c.consumptionTotal,lots:c.lots.map(l=>l.id)},
      status:'validated',validated_at:new Date().toISOString(),validated_by:currentUser?.id||null
    };});
    const {error}=await db().from('compta_settlement_snapshots').upsert(rows,{onConflict:'fiscal_year_id,owner_id'});
    if(error)return alert(error.message+'\n\nExécute la migration SQL V34.6.');
    state.v346SettlementSnapshots=rows;alert('Décomptes validés. Les soldes seront reportés uniquement lors de la clôture de l’exercice.');
  }

  async function closeYearWithSettlements(yearId){
    const year=(state.fiscalYears||[]).find(y=>y.id===yearId);if(!year)return;
    const next=(state.fiscalYears||[]).filter(y=>y.copro_id===year.copro_id&&y.starts_on>year.ends_on).sort((a,b)=>String(a.starts_on).localeCompare(String(b.starts_on)))[0];
    if(!next)return alert('Crée d’abord l’exercice suivant : aucun exercice ne peut recevoir les soldes reportés.');
    const {data:snapshots,error:snapError}=await db().from('compta_settlement_snapshots').select('*').eq('fiscal_year_id',yearId).eq('status','validated');
    if(snapError)return alert(snapError.message);
    const expected=(state.owners||[]).filter(o=>o.copro_id===year.copro_id&&(state.lots||[]).some(l=>l.copro_id===year.copro_id&&l.owner_id===o.id&&l.active!==false));
    if(!snapshots?.length)return alert('Valide d’abord les décomptes de cet exercice dans le module Décomptes.');
    if(snapshots.length<expected.length&&!confirm(`${expected.length-snapshots.length} copropriétaire(s) actif(s) n’ont pas de solde validé. Continuer malgré tout ?`))return;
    if(!confirm(`Clôturer ${year.label||''} ?\n\nLes soldes finaux validés seront créés dans « Soldes reportés au 01/01 » de ${next.label||''}.`))return;
    const ownerRows=snapshots.filter(s=>Math.abs(num(s.final_balance))>=.005).map(s=>({
      copro_id:year.copro_id,fiscal_year_id:next.id,tier_type:'owner',tier_id:s.owner_id,
      amount:Number(num(s.final_balance).toFixed(2)),source_fiscal_year_id:year.id,created_by:currentUser?.id||null
    }));
    const suppliers=typeof thirdRowsFor==='function'?thirdRowsFor('suppliers',year.copro_id,year.id):[];
    const supplierRows=suppliers.filter(r=>Math.abs(num(r.balance))>=.005).map(r=>({
      copro_id:year.copro_id,fiscal_year_id:next.id,tier_type:'supplier',tier_id:r.id,
      amount:Number((-num(r.balance)).toFixed(2)),source_fiscal_year_id:year.id,created_by:currentUser?.id||null
    }));
    const reports=[...ownerRows,...supplierRows];
    for(const row of reports){
      const {data:existing,error:findError}=await db().from('compta_third_opening_balances').select('id').eq('fiscal_year_id',row.fiscal_year_id).eq('tier_type',row.tier_type).eq('tier_id',row.tier_id).limit(1);
      if(findError)return alert('Contrôle du report impossible : '+findError.message);
      const request=existing?.[0]?.id?db().from('compta_third_opening_balances').update(row).eq('id',existing[0].id):db().from('compta_third_opening_balances').insert(row);
      const {error}=await request;if(error)return alert('Report impossible : '+error.message);
    }
    const {error}=await db().from('compta_fiscal_years').update({status:'closed',closed_at:new Date().toISOString(),closed_by:currentUser?.id||null}).eq('id',year.id);
    if(error)return alert(error.message);
    await loadAll();alert(`Exercice clôturé. ${ownerRows.length} solde(s) copropriétaire(s) et ${supplierRows.length} solde(s) fournisseur(s) ont été reportés.`);
  }

  function expenseContext(){
    const coproId=state.activeCoproId||id('expensesCoproFilter')?.value||'';
    const yearId=id('v346ExpensesYear')?.value||state.activeFiscalYearId||'';
    const year=(state.fiscalYears||[]).find(y=>y.id===yearId)||null;
    return {coproId,yearId,year};
  }
  function installExpenseFilters(){
    const old=id('expensesListView')?.querySelector('.ledger-toolbar');if(!old||id('v346ExpensesYear'))return;
    old.className='v346-expense-filters';
    old.insertAdjacentHTML('beforeend',`
      <label>Exercice <select id="v346ExpensesYear"></select></label>
      <label>Clé de répartition <select id="v346ExpensesKey"></select></label>
      <label>Recherche <input id="v346ExpensesSearch" placeholder="Libellé, fournisseur, référence…"></label>`);
    old.insertAdjacentHTML('afterend',`<div class="v346-expense-options">
      <label><input id="v346ExpenseShowOwnerOccupant" type="checkbox" checked> Parts propriétaire/occupant</label>
      <label><input id="v346ExpenseIncludeMeters" type="checkbox" checked> Relevés de compteurs</label>
      <label><input id="v346ExpenseIncludePrivate" type="checkbox" checked> Frais privatifs</label>
      <label><input id="v346ExpenseShowVat" type="checkbox"> TVA</label>
      <label><input id="v346ExpenseShowRealRef" type="checkbox"> Référence fournisseur</label>
    </div>`);
  }
  function expenseRows(){
    const {coproId,year}=expenseContext(),accountId=id('expensesAccountFilter')?.value||'',keyId=id('v346ExpensesKey')?.value||'',search=(id('v346ExpensesSearch')?.value||'').toLowerCase();
    const includePrivate=id('v346ExpenseIncludePrivate')?.checked!==false;
    const includeMeters=id('v346ExpenseIncludeMeters')?.checked!==false;
    return (state.invoices||[]).filter(i=>{
      const acc=(state.accounts||[]).find(a=>a.id===i.account_id);
      if(!String(acc?.code||'').startsWith('6'))return false;
      if(coproId&&i.copro_id!==coproId)return false;if(accountId&&i.account_id!==accountId)return false;if(keyId&&i.distribution_key_id!==keyId)return false;
      if(year&&i.invoice_date&&(i.invoice_date<year.starts_on||i.invoice_date>year.ends_on))return false;
      if(!includePrivate&&String(i.charge_target||'').startsWith('private_'))return false;
      if(!includeMeters&&i.charge_target==='meter_pending')return false;
      return !search||[i.description,i.invoice_number,i.internal_invoice_code,i.compta_suppliers?.name].join(' ').toLowerCase().includes(search);
    });
  }
  function expensePart(inv,kind){
    const target=inv.charge_target||'common_owner',amount=num(inv.amount_total);
    if(kind==='owner')return target==='common_occupant'?0:amount;
    return target==='common_occupant'?amount:0;
  }
  function renderExpenses(){
    const host=id('expensesListTable');if(!host)return;installExpenseFilters();
    const keepC=state.activeCoproId||id('expensesCoproFilter')?.value||'';
    id('expensesCoproFilter').innerHTML='<option value="">Toutes les copropriétés</option>'+(state.copros||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');id('expensesCoproFilter').value=keepC;
    const keepA=id('expensesAccountFilter').value||'';id('expensesAccountFilter').innerHTML='<option value="">Tous les comptes</option>'+(state.accounts||[]).filter(a=>String(a.code||'').startsWith('6')).map(a=>`<option value="${a.id}">${esc(`${a.code} - ${a.label}`)}</option>`).join('');id('expensesAccountFilter').value=keepA;
    const years=(state.fiscalYears||[]).filter(y=>!keepC||y.copro_id===keepC),keepY=id('v346ExpensesYear').value||state.activeFiscalYearId||years[0]?.id||'';
    id('v346ExpensesYear').innerHTML='<option value="">Toutes périodes</option>'+years.map(y=>`<option value="${y.id}">${esc(y.label||y.code)}</option>`).join('');id('v346ExpensesYear').value=years.some(y=>y.id===keepY)?keepY:'';
    const keys=(state.distributionKeys||[]).filter(k=>!keepC||k.copro_id===keepC),keepK=id('v346ExpensesKey').value||'';
    id('v346ExpensesKey').innerHTML='<option value="">Toutes les clés</option>'+keys.map(k=>`<option value="${k.id}">${esc(k.name)}</option>`).join('');id('v346ExpensesKey').value=keepK;
    const rows=expenseRows(),showParts=id('v346ExpenseShowOwnerOccupant')?.checked!==false,showRef=id('v346ExpenseShowRealRef')?.checked,groups=new Map();
    rows.forEach(i=>{const acc=(state.accounts||[]).find(a=>a.id===i.account_id)||{},key=(state.distributionKeys||[]).find(k=>k.id===i.distribution_key_id)||{name:'Quotités générales'};const ak=acc.id||'none',kk=key.id||key.name;if(!groups.has(ak))groups.set(ak,{acc,keys:new Map()});const g=groups.get(ak);if(!g.keys.has(kk))g.keys.set(kk,{key,rows:[]});g.keys.get(kk).rows.push(i);});
    let html='';for(const g of groups.values()){const all=[...g.keys.values()].flatMap(x=>x.rows),total=all.reduce((s,i)=>s+num(i.amount_total),0);html+=`<section class="v346-expense-group"><h3><span>Compte : ${esc(`${g.acc.code||''} - ${g.acc.label||''}`)}</span><strong>${money(total)}</strong></h3>`;for(const kg of g.keys.values()){const kt=kg.rows.reduce((s,i)=>s+num(i.amount_total),0);html+=`<div class="v346-expense-key">Clé : ${esc(kg.key.name||'Quotités générales')} · ${money(kt)}</div><div class="table-wrap"><table class="v346-expense-table"><thead><tr><th>Date valeur</th><th>Libellé</th><th>Fournisseur</th><th>Réf. interne</th>${showRef?'<th>Réf. fournisseur</th>':''}<th class="amount">Montant</th>${showParts?'<th class="amount">Part propriétaire</th><th class="amount">Part occupant</th>':''}<th></th></tr></thead><tbody>${kg.rows.sort((a,b)=>String(a.invoice_date||'').localeCompare(String(b.invoice_date||''))).map(i=>`<tr><td>${esc(i.invoice_date||'')}</td><td>${esc(i.description||'')}</td><td>${esc(i.compta_suppliers?.name||'')}</td><td>${esc(i.internal_invoice_code||i.invoice_code||'')}</td>${showRef?`<td>${esc(i.invoice_number||'')}</td>`:''}<td class="amount">${money(i.amount_total)}</td>${showParts?`<td class="amount">${money(expensePart(i,'owner'))}</td><td class="amount">${money(expensePart(i,'occupant'))}</td>`:''}<td><button class="btn secondary small" data-v346-edit-expense="${i.id}" type="button">Modifier</button></td></tr>`).join('')}</tbody></table></div>`;}html+='</section>';}
    host.innerHTML=html||'<div class="notice">Aucune dépense pour ces critères.</div>';
    host.querySelectorAll('[data-v346-edit-expense]').forEach(btn=>{
      const inv=(state.invoices||[]).find(i=>String(i.id)===String(btn.dataset.v346EditExpense));
      if(inv?.file_data_url&&!btn.parentElement.querySelector('[data-show-pdf]'))btn.insertAdjacentHTML('beforebegin',`<button class="btn secondary small" data-show-pdf="${inv.id}" type="button">Voir PDF</button> `);
    });
    const toolbar=id('expensesListView')?.querySelector('.toolbar');if(toolbar&&!id('v346ExpensesPdf'))toolbar.insertAdjacentHTML('beforeend','<button class="btn" id="v346ExpensesPdf" type="button">Exporter le PDF</button>');
  }
  window.WapiExpensesV346={render:renderExpenses};
  function expensesPdf(){
    const {coproId,year}=expenseContext(),copro=(state.copros||[]).find(c=>c.id===coproId)||{},rows=expenseRows(),groups=new Map();
    rows.forEach(i=>{const a=(state.accounts||[]).find(x=>x.id===i.account_id)||{},k=(state.distributionKeys||[]).find(x=>x.id===i.distribution_key_id)||{name:'Quotités générales'},key=`${a.code}|${k.name}`;if(!groups.has(key))groups.set(key,{a,k,rows:[]});groups.get(key).rows.push(i);});
    const body=[...groups.values()].map(g=>`<div class="compact-section"><table><tr><th colspan="5">Compte : ${esc(`${g.a.code||''} - ${g.a.label||''}`)}</th><th class="amount">${money(g.rows.reduce((s,i)=>s+num(i.amount_total),0))}</th></tr><tr><th colspan="6">Clé : ${esc(g.k.name||'')}</th></tr>${g.rows.map(i=>`<tr><td>${esc(i.invoice_date||'')}</td><td>${esc(i.description||'')}</td><td>${esc(i.compta_suppliers?.name||'')}</td><td>${esc(i.internal_invoice_code||i.invoice_code||'')}</td><td class="amount">${money(i.amount_total)}</td><td class="amount">${money(expensePart(i,'occupant'))}</td></tr>`).join('')}</table></div>`).join('');
    const period=year?`Du ${year.starts_on} au ${year.ends_on}`:'Toutes périodes';
    openPrintWindowV16('Liste des dépenses',`<section class="page">${agPdfHeaderV15('Liste des dépenses',copro.name||'Portefeuille WAPI One')}<div class="meta-grid"><div class="meta"><span>Période</span><strong>${esc(period)}</strong></div><div class="meta"><span>Édité le</span><strong>${new Date().toLocaleDateString('fr-BE')}</strong></div></div>${body}<div class="settlement-pay"><strong>Total général : ${money(rows.reduce((s,i)=>s+num(i.amount_total),0))}</strong></div>${agPdfFooterV15('Liste des dépenses')}</section>`);
  }

  function effectiveOwnerActive(owner){
    return owner.active!==false&&(state.lots||[]).some(l=>l.owner_id===owner.id&&l.active!==false);
  }
  function renderOwnersActive(){
    if(window.WapiTiersV364?.render)return window.WapiTiersV364.render();
    const host=id('ownersTable');if(!host||state.selectedIdentityType!=='owner')return;
    const copro=state.activeCoproId||id('ownersFilterCopro')?.value||'';
    let rows=(state.owners||[]).filter(o=>!copro||o.copro_id===copro||(state.lots||[]).some(l=>l.copro_id===copro&&l.owner_id===o.id));
    rows=rows.filter(o=>showInactiveOwners?!effectiveOwnerActive(o):effectiveOwnerActive(o));
    host.innerHTML=`<div class="v346-owner-toolbar"><div class="summary-line"><span class="badge">${rows.length} copropriétaire(s) ${showInactiveOwners?'non actif(s)':'actif(s)'}</span></div><div class="actions-inline"><label><input id="v346ShowInactiveOwners" type="checkbox" ${showInactiveOwners?'checked':''}> Afficher les copropriétaires non actifs</label><button class="btn secondary" id="v344GenerateAllVcs" type="button">Générer les VCS manquantes</button></div></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>Communication VCS</th><th>Email</th><th>Adresse</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(o=>`<tr class="${effectiveOwnerActive(o)?'':'v346-owner-inactive'}"><td><span class="code-pill">${esc(o.owner_code||'—')}</span></td><td>${esc(o.display_name||'')}</td><td><code>${esc(o.vcs||'À générer')}</code></td><td>${esc(o.email||'')}</td><td>${esc([[o.street,o.street_number].filter(Boolean).join(' '),[o.postal_code,o.city].filter(Boolean).join(' '),o.country].filter(Boolean).join(', ')||o.address||'')}</td><td>${effectiveOwnerActive(o)?'<span class="badge ok">Actif</span>':'<span class="badge">Non actif</span>'}</td><td><button class="btn secondary small" data-open-identity="owner|${o.id}" type="button">Ouvrir</button></td></tr>`).join('')||`<tr><td colspan="7" class="v346-owner-empty">${showInactiveOwners?'Aucun copropriétaire non actif.':'Aucun copropriétaire actif.'}</td></tr>`}</tbody></table></div>`;
  }

  const previousRenderAll=window.renderAll;
  if(typeof previousRenderAll==='function')window.renderAll=function(){const out=previousRenderAll.apply(this,arguments);setTimeout(()=>{installSettlementValidation();renderExpenses();renderOwnersActive();},0);return out;};
  document.addEventListener('click',e=>{
    const open=e.target.closest?.('[data-v345-open-owner],.settlement-owner-row');
    if(open&&!e.target.matches?.('[data-settlement-select]')){const ownerId=open.dataset.v345OpenOwner||open.querySelector?.('[data-settlement-select]')?.dataset.settlementSelect;if(ownerId){e.preventDefault();e.stopImmediatePropagation();openSettlement(ownerId);return;}}
    if(e.target.closest?.('#v346ValidateSettlements')){e.preventDefault();e.stopImmediatePropagation();validateSettlements();return;}
    const close=e.target.closest?.('[data-v29-close-year]');if(close){e.preventDefault();e.stopImmediatePropagation();closeYearWithSettlements(close.dataset.v29CloseYear);return;}
    if(e.target.closest?.('#v346ExpensesPdf')){e.preventDefault();expensesPdf();return;}
    const invoicePdf=e.target.closest?.('[data-show-pdf]');if(invoicePdf&&invoicePdf.closest('#expensesListView')){e.preventDefault();e.stopImmediatePropagation();typeof showInvoicePdf==='function'?showInvoicePdf(invoicePdf.dataset.showPdf):alert('PDF indisponible.');return;}
    const edit=e.target.closest?.('[data-v346-edit-expense]');if(edit){e.preventDefault();typeof openInvoiceModal==='function'?openInvoiceModal(edit.dataset.v346EditExpense):alert('Édition facture indisponible.');return;}
  },true);
  document.addEventListener('change',e=>{
    if(e.target.matches?.('[data-settlement-select]')&&e.target.checked){e.stopImmediatePropagation();openSettlement(e.target.dataset.settlementSelect);return;}
    if(e.target.id==='v346ShowInactiveOwners'){showInactiveOwners=e.target.checked;renderOwnersActive();return;}
    if(['expensesCoproFilter','expensesAccountFilter','v346ExpensesYear','v346ExpensesKey','v346ExpenseShowOwnerOccupant','v346ExpenseIncludeMeters','v346ExpenseIncludePrivate','v346ExpenseShowVat','v346ExpenseShowRealRef'].includes(e.target.id))renderExpenses();
  },true);
  document.addEventListener('input',e=>{if(e.target.id==='v346ExpensesSearch')renderExpenses();});
  function install(){installSettlementValidation();installExpenseFilters();renderExpenses();renderOwnersActive();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();
