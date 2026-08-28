/* WAPI One V36.10 — Facturation syndic simplifiée et pilotage du CA */
(()=>{'use strict';
  window.WAPI_ONE_VERSION='V36.10';
  window.WAPI_ONE_BUILD_DATE='2026-08-28';

  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro=v=>Number(v||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'});
  const today=()=>new Date().toISOString().slice(0,10);
  const ymToday=()=>today().slice(0,7);
  const monthNames=['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const oldRenderer=typeof renderSyndicBillingV23==='function'?renderSyndicBillingV23:null;
  let issuers=[], busy=false, initialSyncDone=false;
  const ui={mode:'dashboard',year:Number(today().slice(0,4)),month:Number(today().slice(5,7)),manager:'',copro:'',issuer:'',type:'all',search:'',contractManager:'',contractCopro:''};

  const idEq=(a,b)=>String(a||'')===String(b||'');
  const monthStart=s=>String(s||'').slice(0,7)+'-01';
  function addMonths(s,n){const [y,m]=String(s).slice(0,7).split('-').map(Number),d=new Date(Date.UTC(y,m-1+n,1));return d.toISOString().slice(0,10);}
  function endOfMonth(s){const [y,m]=String(s).slice(0,7).split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
  function slug(v){return String(v||'document').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90)||'document';}
  function managerId(c){return String(c?.manager_user_id||c?.manager_id||c?.gestionnaire_id||'');}
  function profileName(p){return p?.display_name||p?.full_name||p?.name||p?.email||'Utilisateur';}
  function copro(id){return (state.copros||[]).find(c=>idEq(c.id,id))||{};}
  function issuer(id){return issuers.find(x=>idEq(x.id,id))||issuers.find(x=>x.code==='WAPI')||issuers[0]||{};}
  function fiscalYear(id){return (state.fiscalYears||[]).find(y=>idEq(y.id,id))||null;}
  function contractStart(c){return c.starts_on||`${c.contract_year||String(c.year_label||'').match(/20\d{2}/)?.[0]||new Date().getFullYear()}-${String(c.start_month||1).padStart(2,'0')}-01`;}
  function contractEnd(c){return c.ends_on||endOfMonth(`${c.contract_year||String(c.year_label||'').match(/20\d{2}/)?.[0]||new Date().getFullYear()}-${String(c.end_month||12).padStart(2,'0')}-01`);}
  function invoiceIssuerId(inv){return inv?.issuer_id||(state.syndicContracts||[]).find(c=>idEq(c.id,inv?.contract_id))?.issuer_id||(state.syndicInvoices||[]).find(x=>idEq(x.id,inv?.related_invoice_id))?.issuer_id||'';}
  function invoiceType(inv){if(inv.billing_type!=='credit_note')return inv.billing_type;return (state.syndicInvoices||[]).find(x=>idEq(x.id,inv.related_invoice_id))?.billing_type||'credit_note';}
  function typeLabel(t){return t==='honoraires'?'Honoraires':t==='service'?'Prestation':t==='mutation'?'Mutation / notaire':t==='credit_note'?'Note de crédit':'Autre';}
  function typeClass(t){return t==='honoraires'?'honoraires':t==='service'?'service':t==='mutation'?'mutation':'credit';}
  function officialRows(){return (state.syndicInvoices||[]).filter(i=>i.status==='issued');}
  function periodMatches(inv){const d=String(inv.invoice_date||'');if(ui.year&&Number(d.slice(0,4))!==Number(ui.year))return false;if(ui.month&&Number(d.slice(5,7))!==Number(ui.month))return false;return true;}
  function scopeCopros(manager=ui.manager){return (state.copros||[]).filter(c=>c.active!==false&&c.archived!==true&&(!manager||managerId(c)===String(manager)));}
  function filterInvoice(inv,includeListFilters=true){
    if(!periodMatches(inv))return false;
    if(ui.manager&&managerId(copro(inv.copro_id))!==String(ui.manager))return false;
    if(ui.copro&&!idEq(inv.copro_id,ui.copro))return false;
    if(ui.issuer&&!idEq(invoiceIssuerId(inv),ui.issuer))return false;
    if(includeListFilters){const t=invoiceType(inv);if(ui.type!=='all'&&t!==ui.type)return false;
    if(ui.search&&!`${inv.invoice_number||''} ${inv.description||''} ${copro(inv.copro_id).name||inv.customer_name||''}`.toLowerCase().includes(ui.search.toLowerCase()))return false;}
    return true;
  }
  function filteredOfficialRows(includeListFilters=true){return officialRows().filter(i=>filterInvoice(i,includeListFilters)).sort((a,b)=>String(b.invoice_date||'').localeCompare(String(a.invoice_date||''))||String(b.invoice_number||'').localeCompare(String(a.invoice_number||'')));}
  function amountByType(rows,type,field='amount_subtotal'){return rows.filter(i=>invoiceType(i)===type).reduce((s,i)=>s+Number(i[field]||0),0);}
  function periodLabel(){if(!ui.year)return 'Toutes les factures';return ui.month?`${monthNames[ui.month]} ${ui.year}`:`Année ${ui.year}`;}
  function exported(i){return Boolean(i.clearfact_exported_at||i.clearfact_export_status==='exported');}
  function contractInvoice(c,y,m){return (state.syndicInvoices||[]).find(i=>idEq(i.contract_id,c.id)&&Number(i.period_year)===Number(y)&&Number(i.period_month)===Number(m));}
  function contractCovers(c,y,m){const d=`${y}-${String(m).padStart(2,'0')}-01`;return c.active!==false&&c.contract_status!=='stopped'&&c.service_family!=='cleaning'&&monthStart(contractStart(c))<=d&&monthStart(contractEnd(c))>=d;}
  function expectedContracts(){if(!ui.month)return[];return (state.syndicContracts||[]).filter(c=>contractCovers(c,ui.year,ui.month)&&(!ui.manager||managerId(copro(c.copro_id))===String(ui.manager))&&(!ui.copro||idEq(c.copro_id,ui.copro))&&(!ui.issuer||idEq(c.issuer_id,ui.issuer)));}

  async function loadIssuers(){if(!supabaseClient)return;const r=await supabaseClient.from('compta_billing_issuers').select('*').order('company_name');if(!r.error)issuers=r.data||[];}

  function simplifyNavigation(){
    document.querySelectorAll('.menu-group').forEach(g=>{
      const title=g.querySelector('.menu-group__text')?.textContent?.trim();if(title!=='Facturation syndic')return;
      const body=g.querySelector('.menu-group__body');if(!body||body.dataset.w3610==='1')return;
      body.dataset.w3610='1';body.innerHTML='<button data-title="Facturation syndic" data-w3610-nav="1" data-view="syndicBilling" title="Facturation syndic"><span class="nav__item"><span class="nav-icon">🧾</span><span class="nav-label">Pilotage facturation</span></span></button>';
    });
  }
  function shell(mode=ui.mode){
    const view=$('syndicBillingView'),card=view?.querySelector('.syndic-billing-root');if(!card)return;
    card.classList.add('w3610-active');
    const toolbar=card.querySelector(':scope > .toolbar');if(toolbar){
      toolbar.innerHTML=`<div><h2>${mode==='contracts'?'Honoraires syndic':'Facturation syndic'}</h2><p class="muted-note">${mode==='contracts'?'Un paramétrage par copropriété et par exercice comptable.':'Honoraires automatiques, prestations, mutations et chiffre d’affaires au même endroit.'}</p></div><div class="top-actions">${mode==='contracts'?'<button class="btn secondary" id="w3610Home">← Pilotage</button><button class="btn" id="w3610NewContract">+ Paramétrer des honoraires</button>':'<button class="btn" id="w3610NewService">+ Prestation</button><button class="btn secondary" id="w3610NewMutation">+ Mutation</button><button class="btn secondary" id="w3610Contracts">Honoraires</button><button class="btn secondary w3610-icon-btn" id="w3610Settings" title="Réglages">⚙</button>'}</div>`;
    }
    const banner=card.querySelector(':scope > .context-banner');if(banner)banner.style.display='none';
    const tabs=card.querySelector(':scope > .syndic-tabs');if(tabs)tabs.style.display='none';
    const summary=$('syndicBillingSummary');if(summary)summary.style.display='none';
  }

  function managerOptions(value=''){return '<option value="">Tous les gestionnaires</option>'+((state.userProfiles||[]).filter(p=>p.active!==false).map(p=>`<option value="${esc(p.id)}" ${idEq(p.id,value)?'selected':''}>${esc(profileName(p))}</option>`).join(''));}
  function coproOptions(value='',manager=ui.manager){return '<option value="">Toutes les copropriétés</option>'+scopeCopros(manager).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr')).map(c=>`<option value="${esc(c.id)}" ${idEq(c.id,value)?'selected':''}>${esc(c.name||'')}</option>`).join('');}
  function issuerOptions(value=''){return '<option value="">Toutes les sociétés</option>'+issuers.filter(x=>x.active!==false).map(x=>`<option value="${esc(x.id)}" ${idEq(x.id,value)?'selected':''}>${esc(x.company_name||x.code||'')}</option>`).join('');}
  function yearOptions(){const ys=new Set([new Date().getFullYear()-1,new Date().getFullYear(),new Date().getFullYear()+1]);(state.syndicInvoices||[]).forEach(i=>{const y=Number(String(i.invoice_date||'').slice(0,4));if(y)ys.add(y)});return `<option value="0" ${!ui.year?'selected':''}>Toutes les années</option>`+[...ys].sort((a,b)=>b-a).map(y=>`<option value="${y}" ${Number(y)===Number(ui.year)?'selected':''}>${y}</option>`).join('');}
  function monthOptions(){return '<option value="0">Toute l’année</option>'+monthNames.slice(1).map((m,i)=>`<option value="${i+1}" ${Number(ui.month)===i+1?'selected':''}>${m}</option>`).join('');}

  function renderDashboard(){
    ui.mode='dashboard';state.syndicBillingTab='campaigns';shell('dashboard');simplifyNavigation();
    const root=$('syndicBillingContent');if(!root)return;
    const scopeRows=filteredOfficialRows(false),rows=filteredOfficialRows(true),hon=amountByType(scopeRows,'honoraires'),pre=amountByType(scopeRows,'service'),mut=amountByType(scopeRows,'mutation'),total=scopeRows.reduce((s,i)=>s+Number(i.amount_subtotal||0),0),ttc=scopeRows.reduce((s,i)=>s+Number(i.amount_total||0),0);
    const expected=expectedContracts(),missing=expected.filter(c=>!contractInvoice(c,ui.year,ui.month)),done=expected.length-missing.length;
    const newPdfs=scopeRows.filter(i=>!exported(i));
    root.innerHTML=`
      <div class="w3610-filters">
        <label>Année<select id="w3610Year">${yearOptions()}</select></label>
        <label>Mois<select id="w3610Month" ${!ui.year?'disabled':''}>${monthOptions()}</select></label>
        <label>Gestionnaire<select id="w3610Manager">${managerOptions(ui.manager)}</select></label>
        <label>Copropriété<select id="w3610Copro">${coproOptions(ui.copro)}</select></label>
        ${issuers.length>1?`<label>Société<select id="w3610Issuer">${issuerOptions(ui.issuer)}</select></label>`:''}
      </div>
      <div class="w3610-period-head"><div><span>Chiffre d’affaires</span><h3>${esc(periodLabel())}</h3></div><div class="w3610-period-actions"><button class="btn secondary" id="w3610Sync" ${busy?'disabled':''}>${busy?'Synchronisation…':'Vérifier les honoraires'}</button><button class="btn" id="w3610ExportNew" ${newPdfs.length?'':'disabled'}>Exporter ${newPdfs.length} nouveau${newPdfs.length>1?'x':''} PDF</button><button class="btn secondary" id="w3610ExportAll" ${scopeRows.length?'':'disabled'}>Réexporter la période</button></div></div>
      <div class="w3610-kpis">
        ${kpi('Honoraires',hon,'honoraires')}${kpi('Prestations',pre,'service')}${kpi('Mutations / notaires',mut,'mutation')}
        <div class="w3610-kpi total"><span>Total facturé HTVA</span><strong>${euro(total)}</strong><small>${euro(ttc)} TVAC · ${scopeRows.length} document${scopeRows.length>1?'s':''}</small></div>
      </div>
      ${ui.month?`<div class="w3610-health ${missing.length?'warn':'ok'}"><div><strong>${missing.length?`${missing.length} honoraire${missing.length>1?'s':''} manquant${missing.length>1?'s':''}`:'Honoraires du mois à jour'}</strong><span>${done}/${expected.length} copropriété${expected.length>1?'s':''} attendue${expected.length>1?'s':''} pour ${esc(periodLabel())}.</span></div>${missing.length?'<button class="btn" id="w3610SyncMissing">Créer et comptabiliser les manquantes</button>':'<span class="badge ok">✓ Automatisation OK</span>'}</div>`:''}
      <div class="w3610-list-card">
        <div class="w3610-list-head"><div><h3>Factures de la période</h3><p>Les notes de crédit sont déduites automatiquement des totaux.</p></div><div class="w3610-list-filters"><select id="w3610Type"><option value="all">Tous les types</option><option value="honoraires">Honoraires</option><option value="service">Prestations</option><option value="mutation">Mutations</option></select><input id="w3610Search" value="${esc(ui.search)}" placeholder="Rechercher une copropriété, un n°…"></div></div>
        ${invoiceRows(rows)}
      </div>`;
    if($('w3610Type'))$('w3610Type').value=ui.type;
  }
  function kpi(label,value,cls){return `<div class="w3610-kpi ${cls}"><span>${esc(label)}</span><strong>${euro(value)}</strong><small>HTVA net</small></div>`;}
  function invoiceRows(rows){
    if(!rows.length)return '<div class="w3610-empty"><strong>Aucune facture sur cette période.</strong><span>Les honoraires apparaîtront automatiquement à leur échéance ; les prestations et mutations peuvent être ajoutées avec les boutons ci-dessus.</span></div>';
    return `<div class="w3610-invoice-table"><div class="w3610-invoice-row head"><span>Date</span><span>Facture</span><span>Copropriété</span><span>Type</span><span>HTVA</span><span>TVAC</span><span>Export</span><span></span></div>${rows.map(i=>`<div class="w3610-invoice-row"><span>${esc(i.invoice_date||'')}</span><span><strong>${esc(i.invoice_number||'')}</strong><small>${esc(i.description||'')}</small></span><span>${esc(copro(i.copro_id).name||i.customer_name||'')}</span><span><b class="w3610-type ${typeClass(invoiceType(i))}">${esc(typeLabel(invoiceType(i)))}</b>${i.billing_type==='credit_note'?'<small>Note de crédit</small>':''}</span><strong>${euro(i.amount_subtotal)}</strong><span>${euro(i.amount_total)}</span><span>${exported(i)?'<span class="badge ok">Exporté</span>':'<span class="badge warn">À exporter</span>'}</span><span class="w3610-row-actions"><button class="btn secondary small" data-preview-syndic-invoice="${i.id}">PDF</button>${i.billing_type!=='credit_note'?`<button class="btn danger small" data-credit-syndic-invoice="${i.id}">NC</button>`:''}</span></div>`).join('')}</div>`;
  }

  function renderContracts(){
    ui.mode='contracts';state.syndicBillingTab='contracts';shell('contracts');simplifyNavigation();
    const root=$('syndicBillingContent');if(!root)return;
    const allowed=scopeCopros(ui.contractManager),contracts=(state.syndicContracts||[]).filter(c=>c.service_family!=='cleaning'&&allowed.some(x=>idEq(x.id,c.copro_id))&&(!ui.contractCopro||idEq(c.copro_id,ui.contractCopro))).sort((a,b)=>String(copro(a.copro_id).name||'').localeCompare(String(copro(b.copro_id).name||''),'fr')||String(contractStart(b)).localeCompare(String(contractStart(a))));
    const nowMonth=monthStart(today()),active=contracts.filter(c=>c.active!==false&&c.contract_status!=='stopped'&&monthStart(contractStart(c))<=nowMonth&&monthStart(contractEnd(c))>=nowMonth);
    root.innerHTML=`<div class="w3610-contract-summary"><div><span>Contrats en cours</span><strong>${active.length}</strong></div><div><span>Honoraires mensuels actuels HTVA</span><strong>${euro(active.reduce((s,c)=>s+Number(c.monthly_amount_htva||0),0))}</strong></div><div><span>Montant annuel théorique actuel</span><strong>${euro(active.reduce((s,c)=>s+Number(c.monthly_amount_htva||0)*12,0))}</strong></div></div>
      <div class="w3610-filters compact"><label>Gestionnaire<select id="w3610ContractManager">${managerOptions(ui.contractManager)}</select></label><label>Copropriété<select id="w3610ContractCopro">${coproOptions(ui.contractCopro,ui.contractManager)}</select></label></div>
      <div class="w3610-list-card"><div class="w3610-list-head"><div><h3>Paramétrage des honoraires</h3><p>Les dates suivent l’exercice comptable réel de chaque copropriété, même lorsqu’il ne commence pas le 1er janvier.</p></div></div>
      ${contractRows(contracts)}</div>`;
  }
  function contractRows(rows){
    if(!rows.length)return '<div class="w3610-empty"><strong>Aucun contrat dans ce filtre.</strong><span>Crée un paramétrage d’honoraires pour commencer.</span></div>';
    return `<div class="w3610-contract-table"><div class="w3610-contract-row head"><span>Copropriété</span><span>Exercice / période</span><span>Montant</span><span>Automatisation</span><span></span></div>${rows.map(c=>{const stopped=c.active===false||c.contract_status==='stopped',fy=fiscalYear(c.fiscal_year_id),count=(state.syndicInvoices||[]).filter(i=>idEq(i.contract_id,c.id)&&i.billing_type==='honoraires').length;return `<div class="w3610-contract-row"><span><strong>${esc(copro(c.copro_id).name||c.compta_copros?.name||'')}</strong><small>${esc(issuer(c.issuer_id).company_name||'')}</small></span><span><strong>${esc(fy?.label||c.year_label||'Exercice')}</strong><small>${esc(contractStart(c))} → ${esc(contractEnd(c))}</small></span><span><strong>${euro(c.monthly_amount_htva)} HTVA/mois</strong><small>${count} facture${count>1?'s':''} créée${count>1?'s':''}</small></span><span>${stopped?'<span class="badge">Arrêté</span>':c.auto_account!==false?'<span class="badge ok">Automatique</span>':'<span class="badge warn">Manuel</span>'}<small>${c.indexation_rate?`Dernière indexation : ${Number(c.indexation_rate).toLocaleString('fr-BE')} %`:''}</small></span><span class="w3610-row-actions"><button class="btn secondary small" data-w3610-edit-contract="${c.id}">Modifier</button>${stopped?'':`<button class="btn secondary small" data-w3610-index-contract="${c.id}">Indexer</button><button class="btn danger small" data-w3610-stop-contract="${c.id}">Arrêter</button>`}</span></div>`}).join('')}</div>`;
  }

  function fiscalYearsForCopro(coproId){return (state.fiscalYears||[]).filter(y=>idEq(y.copro_id,coproId)).sort((a,b)=>String(b.starts_on||'').localeCompare(String(a.starts_on||'')));}
  function currentFiscalFor(coproId){const d=today(),ys=fiscalYearsForCopro(coproId);return ys.find(y=>y.starts_on<=d&&y.ends_on>=d)||ys.find(y=>y.status!=='closed')||ys[0]||null;}
  function yearSelectHtml(coproId,selected=''){const ys=fiscalYearsForCopro(coproId);return '<option value="">Choisir l’exercice…</option>'+ys.map(y=>`<option value="${esc(y.id)}" ${idEq(y.id,selected)?'selected':''}>${esc(y.label||y.year_code||`${y.starts_on} → ${y.ends_on}`)} · ${esc(y.starts_on||'')} → ${esc(y.ends_on||'')}</option>`).join('');}
  function accountOptions(selected=''){return typeof v23AccountOptions==='function'?v23AccountOptions(selected,true):(state.accounts||[]).filter(a=>String(a.code||'').startsWith('6')).map(a=>`<option value="${esc(a.id)}" ${idEq(a.id,selected)?'selected':''}>${esc(a.code+' - '+a.label)}</option>`).join('');}
  function contractCoproOptions(selected=''){return (state.copros||[]).filter(c=>c.active!==false&&c.archived!==true).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr')).map(c=>`<option value="${esc(c.id)}" ${idEq(c.id,selected)?'selected':''}>${esc(c.name||'')}</option>`).join('');}
  function issuerFormOptions(selected=''){return issuers.filter(x=>x.active!==false).map(x=>`<option value="${esc(x.id)}" ${idEq(x.id,selected)?'selected':''}>${esc(x.company_name||x.code||'')}</option>`).join('');}

  function openContract(id=''){
    const existing=(state.syndicContracts||[]).find(c=>idEq(c.id,id));
    const cid=existing?.copro_id||ui.contractCopro||ui.copro||state.activeCoproId||(state.copros||[])[0]?.id||'';
    const yearsForCopro=fiscalYearsForCopro(cid),existingStart=existing?contractStart(existing):'';
    const matchedFy=existing?.fiscal_year_id?fiscalYear(existing.fiscal_year_id):(existing?yearsForCopro.find(y=>y.starts_on===contractStart(existing)&&y.ends_on===contractEnd(existing))||yearsForCopro.find(y=>y.starts_on<=existingStart&&y.ends_on>=existingStart):null);
    const fy=matchedFy||currentFiscalFor(cid);
    const defaultBillingFrom=existing?.billing_from||(fy?.starts_on&&fy.starts_on<monthStart(today())?monthStart(today()):fy?.starts_on||today());
    const c=existing||{issuer_id:issuer('').id,copro_id:cid,label:'Honoraires syndic',monthly_amount_htva:0,vat_rate:21,due_day:15,account_id:state.syndicInvoiceSettings?.default_account_id||'',auto_account:true};
    const html=`<div class="popup-form w3610-form"><div class="w3610-form-note">Le contrat est rattaché à un <strong>exercice comptable</strong>. Les dates de facturation suivent automatiquement cet exercice.</div><div class="form-grid">
      <label>Copropriété<select id="w3610ContractFormCopro">${contractCoproOptions(cid)}</select></label>
      <label>Exercice comptable<select id="w3610ContractFormYear">${yearSelectHtml(cid,fy?.id||'')}</select></label>
      <label>Société émettrice<select id="w3610ContractFormIssuer">${issuerFormOptions(c.issuer_id)}</select></label>
      <label>Libellé<input id="w3610ContractFormLabel" value="${esc(c.label||'Honoraires syndic')}"></label>
      <label>Montant mensuel HTVA<input id="w3610ContractFormAmount" type="number" min="0" step="0.01" value="${Number(c.monthly_amount_htva||0)}"></label>
      <label>TVA (%)<input id="w3610ContractFormVat" type="number" min="0" step="0.01" value="${Number(c.vat_rate??21)}"></label>
      <label>Compte comptable<select id="w3610ContractFormAccount">${accountOptions(c.account_id||'')}</select></label>
      <label>Jour d’échéance<input id="w3610ContractFormDue" type="number" min="1" max="28" value="${Number(c.due_day||15)}"></label>
      <label>Automatisation<select id="w3610ContractFormAuto"><option value="true">Automatique — créer et comptabiliser</option><option value="false">Manuel</option></select></label>
      <label>Facturer à partir de<input id="w3610ContractFormBillingFrom" type="date" value="${esc(defaultBillingFrom)}"></label>
    </div><div id="w3610FiscalHint" class="w3610-fiscal-hint"></div></div>`;
    openAppModal(existing?'Modifier les honoraires':'Paramétrer les honoraires',html,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="w3610SaveContract" data-id="${esc(id)}">Enregistrer</button>`,{size:'wide'});
    $('w3610ContractFormAuto').value=String(c.auto_account!==false);
    const refreshYears=()=>{const x=$('w3610ContractFormCopro').value,cur=currentFiscalFor(x);$('w3610ContractFormYear').innerHTML=yearSelectHtml(x,cur?.id||'');if(cur)$('w3610ContractFormBillingFrom').value=cur.starts_on<monthStart(today())?monthStart(today()):cur.starts_on;refreshFiscalHint();};
    const refreshFiscalHint=()=>{const y=fiscalYear($('w3610ContractFormYear').value),hint=$('w3610FiscalHint');if(!hint)return;hint.innerHTML=y?`<strong>Période :</strong> ${esc(y.starts_on)} → ${esc(y.ends_on)}. Une facture sera créée pour chaque mois compris dans cette période.`:'Sélectionne un exercice comptable.';if(y&&!existing){const b=$('w3610ContractFormBillingFrom');if(!b.value||b.value<y.starts_on||b.value>y.ends_on)b.value=y.starts_on<monthStart(today())?monthStart(today()):y.starts_on;}};
    $('w3610ContractFormCopro').onchange=refreshYears;$('w3610ContractFormYear').onchange=refreshFiscalHint;refreshFiscalHint();
  }
  async function saveContract(id=''){
    const cid=$('w3610ContractFormCopro').value,y=fiscalYear($('w3610ContractFormYear').value),amount=Number($('w3610ContractFormAmount').value||0),acc=$('w3610ContractFormAccount'),billingFrom=$('w3610ContractFormBillingFrom').value;
    if(!cid||!y||!amount||!acc.value)return alert('Copropriété, exercice, montant et compte comptable sont obligatoires.');
    if(billingFrom<y.starts_on||billingFrom>y.ends_on)return alert('La date « Facturer à partir de » doit être comprise dans l’exercice sélectionné.');
    const duplicate=(state.syndicContracts||[]).find(c=>!idEq(c.id,id)&&idEq(c.copro_id,cid)&&idEq(c.fiscal_year_id,y.id)&&c.service_family!=='cleaning'&&c.active!==false&&c.contract_status!=='stopped');
    if(duplicate)return alert('Un contrat d’honoraires actif existe déjà pour cette copropriété et cet exercice. Modifie le contrat existant ou arrête-le avant d’en créer un autre.');
    const payload={issuer_id:$('w3610ContractFormIssuer').value||null,copro_id:cid,fiscal_year_id:y.id,service_family:'syndic_fee',label:$('w3610ContractFormLabel').value.trim()||'Honoraires syndic',monthly_amount_htva:amount,vat_rate:Number($('w3610ContractFormVat').value||0),account_id:acc.value,account_code:acc.selectedOptions?.[0]?.dataset?.code||null,due_day:Number($('w3610ContractFormDue').value||15),starts_on:y.starts_on,ends_on:y.ends_on,billing_from:billingFrom,start_month:Number(y.starts_on.slice(5,7)),end_month:Number(y.ends_on.slice(5,7)),contract_year:Number(y.starts_on.slice(0,4)),year_label:y.label||y.year_code||`${y.starts_on} → ${y.ends_on}`,auto_account:$('w3610ContractFormAuto').value==='true',posting_mode:'auto',active:true,contract_status:'active',updated_at:new Date().toISOString()};
    const r=id?await supabaseClient.from('compta_syndic_billing_contracts').update(payload).eq('id',id).select('*, compta_copros(name,optipro_ref,address)').single():await supabaseClient.from('compta_syndic_billing_contracts').insert({...payload,created_by:currentUser?.id||null}).select('*, compta_copros(name,optipro_ref,address)').single();
    if(r.error)return alert(r.error.message);closeAppModal();await loadSyndicBillingV23();if(payload.auto_account)await syncContract(r.data,false);await loadSyndicBillingV23();renderContracts();
  }

  function nextFiscal(c){return fiscalYearsForCopro(c.copro_id).filter(y=>String(y.starts_on)>String(contractEnd(c))).sort((a,b)=>String(a.starts_on).localeCompare(String(b.starts_on)))[0]||null;}
  function openIndexation(id){
    const c=(state.syndicContracts||[]).find(x=>idEq(x.id,id));if(!c)return;const next=nextFiscal(c);if(!next)return alert('Aucun exercice suivant n’est encore créé pour cette copropriété. Crée d’abord le prochain exercice comptable, puis reviens sur « Indexer ».');
    const existing=(state.syndicContracts||[]).find(x=>idEq(x.copro_id,c.copro_id)&&idEq(x.fiscal_year_id,next.id)&&x.service_family!=='cleaning'&&x.active!==false&&x.contract_status!=='stopped');if(existing)return alert('Le contrat de l’exercice suivant existe déjà. Ouvre-le avec « Modifier ».');
    const old=Number(c.monthly_amount_htva||0);
    openAppModal('Indexer les honoraires',`<div class="popup-form w3610-form"><div class="w3610-form-note"><strong>${esc(copro(c.copro_id).name||'')}</strong><br>Exercice suivant : ${esc(next.label||'')} · ${esc(next.starts_on)} → ${esc(next.ends_on)}</div><div class="form-grid"><label>Montant actuel HTVA<input value="${old.toFixed(2)}" disabled></label><label>Indexation (%)<input id="w3610IndexRate" type="number" step="0.01" value="0"></label><label>Nouveau montant HTVA<input id="w3610IndexAmount" type="number" step="0.01" value="${old.toFixed(2)}"></label></div><div class="w3610-fiscal-hint">L’ancien contrat reste intact. Un nouveau contrat sera créé pour l’exercice suivant.</div></div>`,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="w3610SaveIndex" data-id="${esc(id)}" data-year="${esc(next.id)}">Créer le contrat indexé</button>`,{size:'wide'});
    $('w3610IndexRate').oninput=()=>{$('w3610IndexAmount').value=(old*(1+Number($('w3610IndexRate').value||0)/100)).toFixed(2);};
  }
  async function saveIndexation(id,yearId){
    const c=(state.syndicContracts||[]).find(x=>idEq(x.id,id)),y=fiscalYear(yearId);if(!c||!y)return;const amount=Number($('w3610IndexAmount').value||0),rate=Number($('w3610IndexRate').value||0);if(!amount)return alert('Indique le nouveau montant.');
    const payload={issuer_id:c.issuer_id,copro_id:c.copro_id,fiscal_year_id:y.id,service_family:c.service_family||'syndic_fee',label:c.label||'Honoraires syndic',monthly_amount_htva:amount,vat_rate:Number(c.vat_rate||0),account_id:c.account_id,account_code:c.account_code,due_day:Number(c.due_day||15),starts_on:y.starts_on,ends_on:y.ends_on,billing_from:y.starts_on,start_month:Number(y.starts_on.slice(5,7)),end_month:Number(y.ends_on.slice(5,7)),contract_year:Number(y.starts_on.slice(0,4)),year_label:y.label||y.year_code||`${y.starts_on} → ${y.ends_on}`,auto_account:c.auto_account!==false,posting_mode:'auto',active:true,contract_status:'active',indexation_rate:rate,renewed_from_contract_id:c.id,renewed_at:new Date().toISOString(),created_by:currentUser?.id||null,updated_at:new Date().toISOString()};
    const r=await supabaseClient.from('compta_syndic_billing_contracts').insert(payload);if(r.error)return alert(r.error.message);closeAppModal();await loadSyndicBillingV23();renderContracts();
  }
  async function stopContract(id){if(!confirm('Arrêter ce contrat ? Les factures déjà comptabilisées restent intactes. Aucune nouvelle mensualité ne sera générée pour ce contrat.'))return;const r=await supabaseClient.from('compta_syndic_billing_contracts').update({active:false,contract_status:'stopped',stopped_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(r.error)return alert(r.error.message);await loadSyndicBillingV23();renderContracts();}

  function openOneOff(type='service'){
    const label=type==='mutation'?'Renseignements notaire / mutation':'Prestation complémentaire',cid=ui.copro||state.activeCoproId||(state.copros||[])[0]?.id||'',em=issuer(ui.issuer);
    const html=`<div class="popup-form w3610-form"><div class="form-grid"><label>Copropriété<select id="w3610OneCopro">${contractCoproOptions(cid)}</select></label><label>Société émettrice<select id="w3610OneIssuer">${issuerFormOptions(em.id)}</select></label><label>Date facture<input id="w3610OneDate" type="date" value="${today()}"></label><label>Échéance<input id="w3610OneDue" type="date"></label><label>Libellé<input id="w3610OneLabel" value="${esc(label)}"></label><label>Montant HTVA<input id="w3610OneAmount" type="number" min="0" step="0.01" value="0"></label><label>TVA (%)<input id="w3610OneVat" type="number" min="0" step="0.01" value="21"></label><label>Compte comptable<select id="w3610OneAccount">${accountOptions(state.syndicInvoiceSettings?.default_account_id||'')}</select></label><label style="grid-column:1/-1">Note interne<textarea id="w3610OneNotes" placeholder="Référence dossier, notaire, détail de la prestation…"></textarea></label></div><div class="w3610-form-note">Le bouton principal crée d’abord un brouillon puis le comptabilise. Ainsi, si la numérotation ou l’intégration comptable échoue, le brouillon reste récupérable.</div></div>`;
    openAppModal(type==='mutation'?'Nouvelle mutation / notaire':'Nouvelle prestation',html,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn secondary" id="w3610SaveOneDraft" data-type="${type}">Enregistrer en brouillon</button><button class="btn" id="w3610SaveOnePost" data-type="${type}">Créer et comptabiliser</button>`,{size:'wide'});
  }
  async function saveOneOff(type,post){
    const cid=$('w3610OneCopro').value,emid=$('w3610OneIssuer').value,date=$('w3610OneDate').value||today(),amount=Number($('w3610OneAmount').value||0),acc=$('w3610OneAccount'),desc=$('w3610OneLabel').value.trim();
    if(!cid||!emid||!date||!amount||!acc.value||!desc)return alert('Copropriété, société émettrice, date, libellé, montant et compte comptable sont obligatoires.');
    const t=typeof v23InvoiceTotals==='function'?v23InvoiceTotals(amount,$('w3610OneVat').value):{subtotal:amount,vat:amount*Number($('w3610OneVat').value||0)/100,total:amount*(1+Number($('w3610OneVat').value||0)/100)};
    const payload={invoice_number:`DRAFT-${type==='mutation'?'MUT':'PREST'}-${Date.now()}`,billing_type:type,issuer_id:emid,copro_id:cid,customer_name:copro(cid).name||'',invoice_date:date,due_date:$('w3610OneDue').value||null,period_year:Number(date.slice(0,4)),period_month:Number(date.slice(5,7)),description:desc,notes:$('w3610OneNotes').value||null,account_id:acc.value,account_code:acc.selectedOptions?.[0]?.dataset?.code||null,amount_subtotal:Number(t.subtotal.toFixed?t.subtotal.toFixed(2):t.subtotal),vat_rate:Number($('w3610OneVat').value||0),vat_amount:Number(Number(t.vat).toFixed(2)),amount_total:Number(Number(t.total).toFixed(2)),status:'draft',clearfact_export_status:'not_exported',created_by:currentUser?.id||null,updated_at:new Date().toISOString()};
    const r=await supabaseClient.from('compta_syndic_invoices').insert(payload).select('id').single();if(r.error)return alert(r.error.message);closeAppModal();await loadSyndicBillingV23();
    if(post){await postSyndicInvoiceV24(r.data.id,true);if(typeof loadAll==='function')await loadAll();else await loadSyndicBillingV23();}
    ui.year=Number(date.slice(0,4));ui.month=Number(date.slice(5,7));ui.type='all';renderDashboard();
  }

  function recurringPayload(c,date){const y=Number(date.slice(0,4)),m=Number(date.slice(5,7)),t=typeof v23InvoiceTotals==='function'?v23InvoiceTotals(c.monthly_amount_htva,c.vat_rate):{subtotal:Number(c.monthly_amount_htva),vat:Number(c.monthly_amount_htva)*Number(c.vat_rate||0)/100,total:Number(c.monthly_amount_htva)*(1+Number(c.vat_rate||0)/100)},day=String(Math.min(Number(c.due_day||15),28)).padStart(2,'0');return {invoice_number:`DRAFT-${c.id}-${y}${String(m).padStart(2,'0')}`,billing_type:'honoraires',contract_id:c.id,issuer_id:c.issuer_id,copro_id:c.copro_id,customer_name:copro(c.copro_id).name||'',invoice_date:date,due_date:`${y}-${String(m).padStart(2,'0')}-${day}`,period_year:y,period_month:m,description:`${c.label||'Honoraires syndic'} - ${monthNames[m]} ${y}`,account_id:c.account_id,account_code:c.account_code,amount_subtotal:Number(t.subtotal),vat_rate:Number(c.vat_rate||0),vat_amount:Number(t.vat),amount_total:Number(t.total),status:'draft',clearfact_export_status:'not_exported',created_by:currentUser?.id||null};}
  async function ensureMonthly(c,date){
    const y=Number(date.slice(0,4)),m=Number(date.slice(5,7));let existing=contractInvoice(c,y,m);
    if(!existing){const check=await supabaseClient.from('compta_syndic_invoices').select('*, compta_copros(name,optipro_ref,address)').eq('contract_id',c.id).eq('period_year',y).eq('period_month',m).limit(1);if(!check.error&&check.data?.[0])existing=check.data[0];}
    if(!existing){const ins=await supabaseClient.from('compta_syndic_invoices').insert(recurringPayload(c,date)).select('*, compta_copros(name,optipro_ref,address)').single();if(ins.error){if(String(ins.error.code)==='23505'){const again=await supabaseClient.from('compta_syndic_invoices').select('*, compta_copros(name,optipro_ref,address)').eq('contract_id',c.id).eq('period_year',y).eq('period_month',m).limit(1);existing=again.data?.[0];}else throw ins.error;}else existing=ins.data;}
    if(existing?.status==='draft'&&c.auto_account!==false){if(!(state.syndicInvoices||[]).some(x=>idEq(x.id,existing.id)))state.syndicInvoices.push(existing);await postSyndicInvoiceV24(existing.id,true);return 1;}return 0;
  }
  async function syncContract(c,show=false){if(c.auto_account===false||c.active===false||c.contract_status==='stopped')return 0;let cursor=monthStart(c.billing_from||contractStart(c)),end=monthStart(contractEnd(c)),limit=monthStart(today()),count=0;if(end>limit)end=limit;while(cursor<=end){count+=await ensureMonthly(c,cursor);cursor=addMonths(cursor,1);}await supabaseClient.from('compta_syndic_billing_contracts').update({last_automation_at:new Date().toISOString()}).eq('id',c.id);if(show)alert(count?`${count} facture(s) d’honoraires comptabilisée(s).`:'Tous les honoraires sont déjà à jour.');return count;}
  async function syncDue(show=true,onlyMissingPeriod=false){if(busy)return;busy=true;renderDashboard();let count=0;try{let contracts=(state.syndicContracts||[]).filter(c=>c.service_family!=='cleaning'&&c.auto_account!==false&&c.active!==false&&c.contract_status!=='stopped');if(onlyMissingPeriod&&ui.month)contracts=expectedContracts().filter(c=>!contractInvoice(c,ui.year,ui.month));for(const c of contracts)count+=await syncContract(c,false);if(typeof loadAll==='function')await loadAll();else await loadSyndicBillingV23();if(show)alert(count?`${count} facture(s) d’honoraires créée(s) et comptabilisée(s).`:'Tout est déjà à jour.');}catch(e){alert('Synchronisation interrompue : '+(e.message||e));}finally{busy=false;renderDashboard();}}

  async function exportRows(rows,markExported){
    if(!rows.length)return alert('Aucune facture à exporter dans ce filtre.');if(!window.JSZip)return alert('Le module ZIP n’est pas disponible.');
    const zip=new JSZip(),csv=[['Numero','Date','Societe','Copropriete','Type','HTVA','TVA','TVAC'].join(';')];
    for(const inv of rows){const em=issuer(invoiceIssuerId(inv)),folder=`${slug(em.code||em.company_name||'Societe')}/${slug(typeLabel(invoiceType(inv)))}`,blob=await syndicInvoicePdfBlobV23(inv),file=`${slug(inv.invoice_number||inv.id)}_${slug(copro(inv.copro_id).name||inv.customer_name||'copro')}.pdf`;zip.file(`${folder}/${file}`,blob);csv.push([inv.invoice_number||'',inv.invoice_date||'',em.company_name||'',copro(inv.copro_id).name||inv.customer_name||'',typeLabel(invoiceType(inv)),Number(inv.amount_subtotal||0).toFixed(2),Number(inv.vat_amount||0).toFixed(2),Number(inv.amount_total||0).toFixed(2)].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';'));}
    const totals=['','','','TOTAL','',rows.reduce((s,i)=>s+Number(i.amount_subtotal||0),0).toFixed(2),rows.reduce((s,i)=>s+Number(i.vat_amount||0),0).toFixed(2),rows.reduce((s,i)=>s+Number(i.amount_total||0),0).toFixed(2)];csv.push(totals.map(v=>`"${v}"`).join(';'));zip.file('resume_facturation.csv','\ufeff'+csv.join('\n'));
    const blob=await zip.generateAsync({type:'blob'}),a=document.createElement('a'),url=URL.createObjectURL(blob),period=ui.month?`${ui.year}-${String(ui.month).padStart(2,'0')}`:`${ui.year}`;a.href=url;a.download=`Facturation_syndic_${period}.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(markExported){const r=await supabaseClient.from('compta_syndic_invoices').update({clearfact_export_status:'exported',clearfact_exported_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',rows.map(i=>i.id));if(r.error)return alert('Le ZIP a été téléchargé, mais le statut d’export n’a pas pu être enregistré : '+r.error.message);await loadSyndicBillingV23();renderDashboard();}
  }

  function render(){simplifyNavigation();if(ui.mode==='contracts')return renderContracts();return renderDashboard();}
  renderSyndicBillingV23=render;window.wapiRenderSyndicBilling=render;

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b)return;
    if(b.dataset.w3610Nav){e.preventDefault();e.stopImmediatePropagation();ui.mode='dashboard';if(typeof switchToView==='function')switchToView('syndicBilling');setTimeout(renderDashboard,0);return;}
    if(b.id==='w3610Contracts'){ui.mode='contracts';return renderContracts();}
    if(b.id==='w3610Home'){ui.mode='dashboard';return renderDashboard();}
    if(b.id==='w3610NewContract')return openContract();
    if(b.dataset.w3610EditContract)return openContract(b.dataset.w3610EditContract);
    if(b.id==='w3610SaveContract')return saveContract(b.dataset.id||'');
    if(b.dataset.w3610IndexContract)return openIndexation(b.dataset.w3610IndexContract);
    if(b.id==='w3610SaveIndex')return saveIndexation(b.dataset.id,b.dataset.year);
    if(b.dataset.w3610StopContract)return stopContract(b.dataset.w3610StopContract);
    if(b.id==='w3610NewService')return openOneOff('service');
    if(b.id==='w3610NewMutation')return openOneOff('mutation');
    if(b.id==='w3610SaveOneDraft')return saveOneOff(b.dataset.type,false);
    if(b.id==='w3610SaveOnePost')return saveOneOff(b.dataset.type,true);
    if(b.id==='w3610Sync')return syncDue(true,false);
    if(b.id==='w3610SyncMissing')return syncDue(true,true);
    if(b.id==='w3610ExportNew')return exportRows(filteredOfficialRows(false).filter(i=>!exported(i)),true);
    if(b.id==='w3610ExportAll')return exportRows(filteredOfficialRows(false),false);
    if(b.id==='w3610Settings'){state.syndicBillingTab='settings';ui.mode='legacy';shell('dashboard');if(oldRenderer)oldRenderer();return;}
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t)return;
    if(t.id==='w3610Year'){ui.year=Number(t.value);if(!ui.year)ui.month=0;renderDashboard();}
    if(t.id==='w3610Month'){ui.month=Number(t.value);renderDashboard();}
    if(t.id==='w3610Manager'){ui.manager=t.value;ui.copro='';renderDashboard();}
    if(t.id==='w3610Copro'){ui.copro=t.value;renderDashboard();}
    if(t.id==='w3610Issuer'){ui.issuer=t.value;renderDashboard();}
    if(t.id==='w3610Type'){ui.type=t.value;renderDashboard();}
    if(t.id==='w3610ContractManager'){ui.contractManager=t.value;ui.contractCopro='';renderContracts();}
    if(t.id==='w3610ContractCopro'){ui.contractCopro=t.value;renderContracts();}
  },true);
  document.addEventListener('input',e=>{if(e.target?.id==='w3610Search'){ui.search=e.target.value;const pos=e.target.selectionStart;renderDashboard();const n=$('w3610Search');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(_){}}}},true);

  const install=async()=>{simplifyNavigation();await loadIssuers();setTimeout(simplifyNavigation,300);setTimeout(simplifyNavigation,1500);if(!$('syndicBillingView')?.classList.contains('hidden'))render();if(!initialSyncDone){initialSyncDone=true;setTimeout(()=>syncDue(false,false),2600);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,2100));else setTimeout(install,2100);
})();
