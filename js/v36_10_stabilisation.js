/* WAPI One V36.10.3 - stabilisation budget, OCR, mutations et facturation syndic. */
(()=>{'use strict';
  window.WAPI_ONE_VERSION='V36.10.3';
  window.WAPI_ONE_BUILD_DATE='2026-09-08';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur=v=>typeof money==='function'?money(Number(v||0)):Number(v||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'});
  const today=()=>new Date().toISOString().slice(0,10);
  const ymToday=()=>today().slice(0,7);
  const monthNames=['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const slug=v=>String(v||'document').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,90)||'document';
  function stampVersion(){document.title='WAPI One — V36.10.3';document.querySelector('meta[name="wapi-one-version"]')?.setAttribute('content','36.10.3');}
  let emitters=[];

  function monthStart(value){return String(value||ymToday()).slice(0,7)+'-01'}
  function endOfMonth(value){const [y,m]=String(value||ymToday()).slice(0,7).split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)}
  function addMonths(value,n){const [y,m]=String(value||ymToday()).slice(0,7).split('-').map(Number);return new Date(Date.UTC(y,m-1+Number(n||0),1)).toISOString().slice(0,10)}
  function contractStart(c){return c.starts_on||`${c.contract_year||String(c.year_label||'').match(/20\d{2}/)?.[0]||new Date().getFullYear()}-${String(c.start_month||1).padStart(2,'0')}-01`}
  function contractEnd(c){return c.ends_on||endOfMonth(`${c.contract_year||String(c.year_label||'').match(/20\d{2}/)?.[0]||new Date().getFullYear()}-${String(c.end_month||12).padStart(2,'0')}`)}
  function dateInContract(c,ym){const d=monthStart(ym);return c.active!==false&&c.contract_status!=='stopped'&&monthStart(contractStart(c))<=d&&monthStart(contractEnd(c))>=d}
  function invoiceYM(i){return `${Number(i.period_year||String(i.invoice_date||'').slice(0,4)||0)}-${String(Number(i.period_month||String(i.invoice_date||'').slice(5,7)||1)).padStart(2,'0')}`}
  function invoiceFor(c,ym){return (state.syndicInvoices||[]).find(i=>String(i.contract_id)===String(c.id)&&invoiceYM(i)===String(ym).slice(0,7))}
  function copro(id){return (state.copros||[]).find(x=>String(x.id)===String(id))||{}}
  function owner(id){return (state.owners||[]).find(x=>String(x.id)===String(id))||{}}
  function issuer(id){return emitters.find(x=>String(x.id)===String(id))||{}}
  function billingTypeLabel(type){return {honoraires:'Honoraires',service:'Prestation',mutation:'Mutation / notaire',credit_note:'Note de crédit'}[type]||type||'Autre'}
  function fiscalFor(coproId,date){return (state.fiscalYears||[]).find(y=>String(y.copro_id)===String(coproId)&&(!y.starts_on||date>=y.starts_on)&&(!y.ends_on||date<=y.ends_on))||(state.fiscalYears||[]).find(y=>String(y.copro_id)===String(coproId))||null}
  function totalsFor(ht,vat){if(typeof v23InvoiceTotals==='function')return v23InvoiceTotals(ht,vat);const sub=Number(ht||0),rate=Number(vat||0),tax=Number((sub*rate/100).toFixed(2));return{subtotal:sub,vat:tax,total:Number((sub+tax).toFixed(2))}}
  async function loadEmitters(){if(!supabaseClient)return;const r=await supabaseClient.from('compta_billing_issuers').select('*').order('company_name');if(!r.error)emitters=r.data||[]}

  function billingScope(){
    state.v3610BillingScope=state.v3610BillingScope||{mode:'month',month:ymToday(),year:Number(today().slice(0,4)),type:'all',status:'issued',search:''};
    return state.v3610BillingScope;
  }
  function scopedInvoices(){
    const f=billingScope(),q=String(f.search||'').toLowerCase();
    return (state.syndicInvoices||[]).filter(i=>{
      const ym=invoiceYM(i);
      if(f.mode==='month'&&ym!==f.month)return false;
      if(f.mode==='year'&&Number(ym.slice(0,4))!==Number(f.year))return false;
      if(f.type!=='all'&&i.billing_type!==f.type)return false;
      if(f.status!=='all'){
        if(f.status==='exported'&&!(i.clearfact_exported_at||i.clearfact_export_status==='exported'))return false;
        else if(f.status==='to_export'&&!(i.status==='issued'&&!(i.clearfact_exported_at||i.clearfact_export_status==='exported')))return false;
        else if(!['exported','to_export'].includes(f.status)&&i.status!==f.status)return false;
      }
      return !q||[i.invoice_number,i.description,i.customer_name,i.compta_copros?.name,copro(i.copro_id).name,billingTypeLabel(i.billing_type)].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>String(b.invoice_date||b.created_at||'').localeCompare(String(a.invoice_date||a.created_at||'')));
  }
  function revenueTotals(rows){
    const issued=rows.filter(i=>i.status==='issued'&&['honoraires','service','mutation'].includes(i.billing_type));
    const by={honoraires:0,service:0,mutation:0};
    issued.forEach(i=>{by[i.billing_type]+=Number(i.amount_total||0)});
    return {...by,total:by.honoraires+by.service+by.mutation,count:issued.length};
  }
  function renderSyndicTabs(){
    const tabs=$('syndicBillingView')?.querySelector('.syndic-tabs');if(!tabs)return;
    const current=state.syndicBillingTab||'campaigns';
    const items=[['campaigns','Vue d’ensemble'],['contracts','Honoraires'],['services','Prestations & mutations'],['invoices','Factures & exports']];
    tabs.className='v3610-tabs';
    tabs.innerHTML=items.map(([id,label])=>`<button class="v3610-tab ${current===id||(['exports'].includes(current)&&id==='invoices')?'active':''}" data-syndic-tab="${id}" type="button">${label}</button>`).join('');
  }
  function renderSyndicSummary(){
    const host=$('syndicBillingSummary');if(!host)return;
    const f=billingScope(),t=revenueTotals(scopedInvoices());
    const label=f.mode==='month'?monthNames[Number(f.month.slice(5,7))]+' '+f.month.slice(0,4):f.mode==='year'?String(f.year):'Depuis le début';
    host.innerHTML=`<div class="v3610-kpi"><span>Période</span><strong>${esc(label)}</strong></div><div class="v3610-kpi"><span>Honoraires</span><strong>${eur(t.honoraires)}</strong></div><div class="v3610-kpi"><span>Prestations</span><strong>${eur(t.service)}</strong></div><div class="v3610-kpi"><span>Total global</span><strong>${eur(t.total)}</strong></div>`;
  }
  function renderSyndic(){
    const root=$('syndicBillingContent');if(!root)return;
    renderSyndicTabs();renderSyndicSummary();
    const tab=state.syndicBillingTab||'campaigns';
    if(tab==='contracts')return renderContracts(root);
    if(tab==='services')return renderServices(root);
    if(tab==='invoices'||tab==='exports')return renderInvoices(root);
    return renderOverview(root);
  }
  function scopeControls(extra=''){
    const f=billingScope();
    return `<div class="v3610-filterbar"><label>Période<select id="v3610ScopeMode"><option value="month" ${f.mode==='month'?'selected':''}>Mois</option><option value="year" ${f.mode==='year'?'selected':''}>Année</option><option value="all" ${f.mode==='all'?'selected':''}>Toutes périodes</option></select></label><label>Mois<input id="v3610ScopeMonth" type="month" value="${esc(f.month)}"></label><label>Année<input id="v3610ScopeYear" type="number" value="${Number(f.year||today().slice(0,4))}"></label>${extra}</div>`;
  }
  function renderOverview(root){
    const f=billingScope(),ym=f.month||ymToday(),rows=(state.syndicContracts||[]).filter(c=>dateInContract(c,ym)),t=revenueTotals(scopedInvoices());
    root.innerHTML=`<div class="v3610-head"><div><h2>Facturation syndic</h2><p>Honoraires mensuels, factures ponctuelles et export PDF société dans une seule vue.</p></div><div class="v3610-actions"><button class="btn" id="v3610GenerateMonth" type="button">Générer le mois</button><button class="btn secondary" id="v3610ExportMonth" type="button">Exporter PDF du mois</button><button class="btn secondary" data-open-oneoff-invoice="service" type="button">Prestation</button><button class="btn secondary" data-open-oneoff-invoice="mutation" type="button">Mutation</button></div></div>${scopeControls('<label>Recherche<input id="v3610ScopeSearch" value="'+esc(f.search||'')+'" placeholder="Copropriété, facture..."></label>')}<div class="v3610-kpis"><div class="v3610-kpi"><span>Honoraires facturés</span><strong>${eur(t.honoraires)}</strong></div><div class="v3610-kpi"><span>Prestations facturées</span><strong>${eur(t.service)}</strong></div><div class="v3610-kpi"><span>Mutations facturées</span><strong>${eur(t.mutation)}</strong></div><div class="v3610-kpi"><span>Total facturé</span><strong>${eur(t.total)}</strong></div></div><div class="v3610-panel"><div class="v3610-head"><div><h3>Honoraires à générer pour ${esc(monthNames[Number(ym.slice(5,7))]+' '+ym.slice(0,4))}</h3><p>Le statut est contrôlé copro par copro, même si les exercices ne démarrent pas au 1er janvier.</p></div></div><table class="v3610-table"><thead><tr><th>Copropriété</th><th>Exercice</th><th>Contrat</th><th class="v3610-money">Mensuel</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(c=>{const inv=invoiceFor(c,ym),fy=fiscalFor(c.copro_id,monthStart(ym)),st=!inv?['À générer','warn']:inv.status==='draft'?['Brouillon','warn']:['Comptabilisée','ok'];return `<tr><td><strong>${esc(c.compta_copros?.name||copro(c.copro_id).name||'Copropriété')}</strong></td><td>${esc(fy?.label||fy?.year_code||'Exercice non défini')}<small>${esc([fy?.starts_on,fy?.ends_on].filter(Boolean).join(' → '))}</small></td><td>${esc(c.label||'Honoraires syndic')}<small>${esc(contractStart(c))} → ${esc(contractEnd(c))}</small></td><td class="v3610-money">${eur(c.monthly_amount_htva)} HTVA</td><td><span class="v3610-pill ${st[1]}">${st[0]}</span></td><td>${!inv?`<button class="btn secondary small" data-v3610-create-month="${c.id}" type="button">Générer</button>`:inv.status==='draft'?`<button class="btn small" data-v3610-post="${inv.id}" type="button">Comptabiliser</button>`:`<button class="btn secondary small" data-preview-syndic-invoice="${inv.id}" type="button">PDF</button>`}</td></tr>`}).join('')||'<tr><td colspan="6"><div class="v3610-empty">Aucun contrat actif pour ce mois.</div></td></tr>'}</tbody></table></div>`;
  }
  function renderContracts(root){
    const rows=state.syndicContracts||[];
    root.innerHTML=`<div class="v3610-head"><div><h3>Honoraires par copropriété</h3><p>Un montant mensuel par copro, des dates alignées sur l’exercice, et une indexation annuelle via renouvellement.</p></div><button class="btn" id="w354NewContract" type="button">Nouveau contrat</button></div><table class="v3610-table"><thead><tr><th>Copropriété</th><th>Période</th><th class="v3610-money">Mensuel</th><th class="v3610-money">Annuel estimé</th><th>Mode</th><th></th></tr></thead><tbody>${rows.map(c=>{const stopped=c.active===false||c.contract_status==='stopped',months=Math.max(1,Math.round((new Date(contractEnd(c))-new Date(contractStart(c)))/(1000*60*60*24*30.44))+1);return `<tr><td><strong>${esc(c.compta_copros?.name||copro(c.copro_id).name||'')}</strong><small>${esc(c.label||'Honoraires syndic')}</small></td><td>${esc(contractStart(c))} → ${esc(contractEnd(c))}</td><td class="v3610-money">${eur(c.monthly_amount_htva)} HTVA</td><td class="v3610-money">${eur(Number(c.monthly_amount_htva||0)*months)} HTVA</td><td><span class="v3610-pill ${stopped?'danger':c.auto_account?'ok':'warn'}">${stopped?'Arrêté':c.auto_account?'Automatique':'Manuel'}</span></td><td><div class="v3610-actions"><button class="btn secondary small" data-w354-edit="${c.id}" type="button">Modifier</button><button class="btn secondary small" data-w353-renew="${c.id}" type="button">Indexer</button>${stopped?'':`<button class="btn danger small" data-w354-stop="${c.id}" type="button">Arrêter</button>`}</div></td></tr>`}).join('')||'<tr><td colspan="6"><div class="v3610-empty">Aucun contrat.</div></td></tr>'}</tbody></table>`;
  }
  function renderServices(root){
    const rows=(state.syndicInvoices||[]).filter(i=>['service','mutation'].includes(i.billing_type)).sort((a,b)=>String(b.invoice_date||'').localeCompare(String(a.invoice_date||'')));
    root.innerHTML=`<div class="v3610-head"><div><h3>Prestations complémentaires & mutations</h3><p>Factures ponctuelles : brouillon, puis comptabilisation quand le dossier est prêt.</p></div><div class="v3610-actions"><button class="btn" data-open-oneoff-invoice="service" type="button">Nouvelle prestation</button><button class="btn secondary" data-open-oneoff-invoice="mutation" type="button">Nouvelle mutation</button></div></div><table class="v3610-table"><thead><tr><th>Type</th><th>Copropriété</th><th>Libellé</th><th>Date</th><th class="v3610-money">Montant</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(i=>`<tr><td>${billingTypeLabel(i.billing_type)}</td><td>${esc(i.compta_copros?.name||i.customer_name||copro(i.copro_id).name||'')}</td><td>${esc(i.description||'')}</td><td>${esc(i.invoice_date||'')}</td><td class="v3610-money">${eur(i.amount_total)}</td><td><span class="v3610-pill ${i.status==='issued'?'ok':'warn'}">${i.status==='issued'?'Comptabilisée':'Brouillon'}</span></td><td><div class="v3610-actions"><button class="btn secondary small" data-preview-syndic-invoice="${i.id}" type="button">PDF</button>${i.status==='draft'?`<button class="btn small" data-v3610-post="${i.id}" type="button">Comptabiliser</button><button class="btn secondary small" data-edit-syndic-draft="${i.id}" type="button">Modifier</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7"><div class="v3610-empty">Aucune prestation ou mutation.</div></td></tr>'}</tbody></table>`;
  }
  function renderInvoices(root){
    const f=billingScope(),rows=scopedInvoices();
    root.innerHTML=`<div class="v3610-head"><div><h3>Factures & exports PDF</h3><p>La même liste sert au contrôle et à l’export vers la comptabilité société.</p></div><div class="v3610-actions"><button class="btn" id="v3610ExportSelected" type="button">Exporter sélection</button><button class="btn secondary" id="v3610ExportVisible" type="button">Exporter visibles</button></div></div>${scopeControls(`<label>Type<select id="v3610ScopeType"><option value="all" ${f.type==='all'?'selected':''}>Tous</option><option value="honoraires" ${f.type==='honoraires'?'selected':''}>Honoraires</option><option value="service" ${f.type==='service'?'selected':''}>Prestations</option><option value="mutation" ${f.type==='mutation'?'selected':''}>Mutations</option><option value="credit_note" ${f.type==='credit_note'?'selected':''}>Notes de crédit</option></select></label>`)}<div class="v3610-filterbar"><label>Statut<select id="v3610ScopeStatus"><option value="all" ${f.status==='all'?'selected':''}>Tous</option><option value="draft" ${f.status==='draft'?'selected':''}>Brouillons</option><option value="issued" ${f.status==='issued'?'selected':''}>Comptabilisées</option><option value="to_export" ${f.status==='to_export'?'selected':''}>PDF à exporter</option><option value="exported" ${f.status==='exported'?'selected':''}>Exportées</option></select></label><label>Recherche<input id="v3610ScopeSearch" value="${esc(f.search||'')}" placeholder="N°, copropriété, libellé..."></label></div><table class="v3610-table"><thead><tr><th><input id="v3610CheckAllInvoices" type="checkbox"></th><th>Facture</th><th>Copropriété</th><th>Type</th><th>Date</th><th class="v3610-money">Montant</th><th>Export</th><th></th></tr></thead><tbody>${rows.map(i=>{const exported=i.clearfact_exported_at||i.clearfact_export_status==='exported';return `<tr><td><input type="checkbox" data-v3610-invoice-select="${i.id}" ${i.status==='issued'||i.billing_type==='credit_note'?'':'disabled'}></td><td><strong>${esc((typeof v24DisplayInvoiceNumber==='function'?v24DisplayInvoiceNumber(i):i.invoice_number)||'Brouillon')}</strong><small>${esc(i.description||'')}</small></td><td>${esc(i.compta_copros?.name||i.customer_name||copro(i.copro_id).name||'')}</td><td>${billingTypeLabel(i.billing_type)}</td><td>${esc(i.invoice_date||'')}</td><td class="v3610-money">${eur(i.amount_total)}</td><td><span class="v3610-pill ${exported?'ok':'warn'}">${exported?'Exporté':'À exporter'}</span></td><td><div class="v3610-actions"><button class="btn secondary small" data-preview-syndic-invoice="${i.id}" type="button">PDF</button>${i.status==='draft'?`<button class="btn small" data-v3610-post="${i.id}" type="button">Comptabiliser</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="8"><div class="v3610-empty">Aucune facture dans ce filtre.</div></td></tr>'}</tbody></table>`;
  }
  async function createDraftForContract(c,ym){
    const existing=invoiceFor(c,ym);if(existing)return existing;
    const t=totalsFor(c.monthly_amount_htva,c.vat_rate),d=monthStart(ym),day=String(Math.min(Number(c.due_day||15),28)).padStart(2,'0');
    const payload={invoice_number:`DRAFT-HONO-${c.id}-${ym.replace('-','')}`,billing_type:'honoraires',contract_id:c.id,issuer_id:c.issuer_id||emitters[0]?.id||null,copro_id:c.copro_id,customer_name:copro(c.copro_id).name||c.compta_copros?.name||'',invoice_date:d,due_date:`${ym}-${day}`,period_year:Number(ym.slice(0,4)),period_month:Number(ym.slice(5,7)),description:`${c.label||'Honoraires syndic'} - ${monthNames[Number(ym.slice(5,7))]} ${ym.slice(0,4)}`,account_id:c.account_id||null,account_code:c.account_code||null,amount_subtotal:t.subtotal,vat_rate:Number(c.vat_rate||0),vat_amount:t.vat,amount_total:t.total,status:'draft',created_by:currentUser?.id||null};
    const r=await supabaseClient.from('compta_syndic_invoices').insert(payload).select('*, compta_copros(name,optipro_ref,address)').single();if(r.error)throw r.error;
    state.syndicInvoices=state.syndicInvoices||[];state.syndicInvoices.unshift(r.data);return r.data;
  }
  async function createAndPostContract(id,refresh=true){
    const f=billingScope(),ym=f.month||ymToday(),c=(state.syndicContracts||[]).find(x=>String(x.id)===String(id));if(!c)return;
    if(!c.account_id)return alert('Ajoute un compte comptable dans le contrat avant de générer cette facture.');
    const draft=await createDraftForContract(c,ym);if(draft.status==='draft'&&typeof postSyndicInvoiceV24==='function')await postSyndicInvoiceV24(draft.id,true);
    if(refresh){await loadSyndicBillingV23?.();renderSyndic();}
  }
  async function generateMonth(){
    const f=billingScope(),ym=f.month||ymToday(),rows=(state.syndicContracts||[]).filter(c=>dateInContract(c,ym)&&!invoiceFor(c,ym));
    if(!rows.length)return alert('Tout est déjà généré pour ce mois.');
    const missing=rows.filter(c=>!c.account_id);if(missing.length)return alert(`${missing.length} contrat(s) n’ont pas encore de compte comptable.`);
    if(!confirm(`Créer et comptabiliser ${rows.length} facture(s) d’honoraires pour ${monthNames[Number(ym.slice(5,7))]} ${ym.slice(0,4)} ?`))return;
    for(const c of rows)await createAndPostContract(c.id,false);
    await loadSyndicBillingV23?.();renderSyndic();
    alert(`${rows.length} facture(s) générée(s).`);
  }
  async function postInvoice(id){if(typeof postSyndicInvoiceV24!=='function')return alert('Comptabilisation indisponible.');await postSyndicInvoiceV24(id,true);await loadSyndicBillingV23?.();renderSyndic();}
  async function exportInvoices(ids,label=''){
    const rows=(state.syndicInvoices||[]).filter(i=>ids.includes(String(i.id))&&(i.status==='issued'||i.billing_type==='credit_note'));
    if(!rows.length)return alert('Sélectionne au moins une facture comptabilisée.');
    if(!window.JSZip)return alert('Le module ZIP est indisponible.');
    const zip=new JSZip(),csv=[['Numero','Date','Copropriete','Type','HTVA','TVA','TVAC','PDF'].join(';')];
    for(const inv of rows){const blob=await syndicInvoicePdfBlobV23(inv),em=issuer(inv.issuer_id),top=slug(em.company_name||em.code||'WAPI-SYNDIK'),folder=`${top}/${invoiceYM(inv)}/${slug(billingTypeLabel(inv.billing_type))}`,file=`${folder}/${slug(inv.invoice_number||inv.id)}_${slug(inv.compta_copros?.name||inv.customer_name||copro(inv.copro_id).name||'copro')}.pdf`;zip.file(file,blob);csv.push([inv.invoice_number||'',inv.invoice_date||'',inv.compta_copros?.name||inv.customer_name||'',billingTypeLabel(inv.billing_type),Number(inv.amount_subtotal||0).toFixed(2),Number(inv.vat_amount||0).toFixed(2),Number(inv.amount_total||0).toFixed(2),file].map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';'))}
    zip.file('resume_export.csv',csv.join('\n'));const blob=await zip.generateAsync({type:'blob'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Factures_societe_${slug(label||billingScope().month||today())}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    await supabaseClient.from('compta_syndic_invoices').update({clearfact_export_status:'exported',clearfact_exported_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',rows.map(i=>i.id));
    await loadSyndicBillingV23?.();renderSyndic();
  }

  function enhanceBudget(){
    const table=$('budgetsTable');if(!table||!state.selectedBudgetHeaderId)return;
    const header=(state.budgetHeaders||[]).find(b=>String(b.id)===String(state.selectedBudgetHeaderId));if(!header)return;
    const locked=String(header.status||'draft')==='validated';
    table.classList.toggle('v3610-budget-locked',locked);
    if(locked){
      table.querySelectorAll('[data-budget-amount-v11],[data-budget-label-v11],[data-delete-budget],[data-show-budget-add],[data-add-budget-line]').forEach(el=>{el.disabled=true;});
      return;
    }
    if(!table.querySelector('#v3610SaveBudgetDraft')){
      table.insertAdjacentHTML('afterbegin',`<div class="v3610-budget-save"><span><strong>Brouillon non validé</strong> Ajuste les montants, puis enregistre le brouillon avant validation.</span><button class="btn" id="v3610SaveBudgetDraft" type="button">Enregistrer brouillon</button></div>`);
    }
  }
  function markBudgetDirty(el){el?.classList.add('v3610-budget-dirty');if(typeof recalcBudgetTotalsV11==='function')recalcBudgetTotalsV11();}
  let budgetSaveTask=null;
  async function saveBudgetDraft(silent=false){
    if(budgetSaveTask)return budgetSaveTask;
    const headerId=state.selectedBudgetHeaderId;if(!headerId)return false;
    const header=(state.budgetHeaders||[]).find(b=>String(b.id)===String(headerId));
    if(!header||header.status==='validated')return false;
    const table=$('budgetsTable'),snapshots=[];
    for(const line of (state.budgetLines||[]).filter(l=>String(l.budget_id)===String(headerId))){
      const amountEl=table.querySelector('[data-budget-amount-v11="'+line.id+'"]'),labelEl=table.querySelector('[data-budget-label-v11="'+line.id+'"]');
      if(!amountEl&&!labelEl)continue;
      if(amountEl&&(!amountEl.value.trim()||!amountEl.checkValidity()||!Number.isFinite(Number(amountEl.value)))){alert('Indique un montant valide pour chaque ligne.');return false;}
      snapshots.push({line,amount:amountEl?Number(amountEl.value):line.amount,label:labelEl?(labelEl.value.trim()||null):line.label});
    }
    const controls=[...table.querySelectorAll('button,input,select')].filter(el=>!el.disabled);
    controls.forEach(el=>el.disabled=true);
    budgetSaveTask=(async()=>{
      try{
        const results=await Promise.allSettled(snapshots.map(async snapshot=>{
          const {line,amount,label}=snapshot;
          const result=await supabaseClient.from('compta_budget_lines').update({amount,label}).eq('id',line.id);
          if(result.error)throw result.error;
          line.amount=amount;line.label=label;
        }));
        const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
        const result=await supabaseClient.from('compta_budgets').update({status:'draft',updated_at:new Date().toISOString()}).eq('id',headerId);
        if(result.error)throw result.error;
        header.status='draft';
        table.querySelectorAll('.v3610-budget-dirty').forEach(el=>el.classList.remove('v3610-budget-dirty'));
        if(!silent){renderBudgets();alert('Brouillon enregistré.');}
        return true;
      }catch(e){alert('Enregistrement impossible : '+(e.message||e));return false;}
      finally{controls.forEach(el=>el.disabled=false);budgetSaveTask=null;}
    })();
    return budgetSaveTask;
  }

  function enhanceLots(){
    const host=$('lotsTable');if(!host)return;
    host.querySelectorAll('[data-open-lot]').forEach(btn=>{if(btn.parentElement?.querySelector('[data-v3610-mutate-lot]'))return;const id=btn.dataset.openLot;btn.insertAdjacentHTML('afterend',` <button class="btn small" type="button" data-v3610-mutate-lot="${esc(id)}">Mutation</button>`);});
    const panel=$('lotDetailPanel');if(panel&&!panel.querySelector('[data-v3610-mutate-current]')&&state.selectedLotId)panel.querySelector('.top-actions')?.insertAdjacentHTML('beforeend',`<button class="btn small" type="button" data-v3610-mutate-lot="${esc(state.selectedLotId)}" data-v3610-mutate-current>Mutation</button>`);
  }
  function openMutation(lotId){
    const lot=(state.lots||[]).find(l=>String(l.id)===String(lotId));if(!lot)return;
    const owners=(state.owners||[]).filter(o=>String(o.copro_id)===String(lot.copro_id));
    const html=`<div class="popup-form"><table class="v3610-mutation-table"><thead><tr><th>Lot</th><th>Nouveau propriétaire</th><th>Date mutation</th></tr></thead><tbody><tr><td><strong>${esc(lot.lot_number||lot.reference||'Lot')}</strong><small>${esc(copro(lot.copro_id).name||'')}</small></td><td><select id="v3610MutationOwner"><option value="">Choisir...</option>${owners.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(lot.owner_id)?'selected':''}>${esc(o.display_name||o.name||'')}</option>`).join('')}</select></td><td><input id="v3610MutationDate" type="date" value="${esc(lot.mutation_date||today())}"></td></tr></tbody></table></div>`;
    openAppModal('Mutation de propriétaire',html,`<button class="btn secondary" data-modal-close type="button">Annuler</button><button class="btn" id="v3610SaveMutation" data-lot-id="${esc(lot.id)}" type="button">Enregistrer mutation</button>`,{size:'wide'});
  }
  async function saveMutation(lotId){
    const ownerId=$('v3610MutationOwner')?.value||null,date=$('v3610MutationDate')?.value||null,lot=(state.lots||[]).find(l=>String(l.id)===String(lotId));
    if(!lot||!ownerId||!date)return alert('Choisis le propriétaire et la date de mutation.');
    const r=await supabaseClient.from('compta_lots').update({owner_id:ownerId,mutation_date:date,updated_at:new Date().toISOString()}).eq('id',lotId);if(r.error)return alert(r.error.message);
    lot.owner_id=ownerId;lot.mutation_date=date;lot.compta_owners={display_name:owner(ownerId).display_name||owner(ownerId).name||''};closeAppModal();renderLots?.();
  }

  const originalRenderSyndic=typeof renderSyndicBillingV23==='function'?renderSyndicBillingV23:null;
  renderSyndicBillingV23=function(){return renderSyndic()};
  if(typeof renderSyndicBillingV25==='function')renderSyndicBillingV25=renderSyndic;
  window.wapiRenderSyndicBilling=renderSyndic;
  if(typeof renderBudgets==='function'){const old=renderBudgets;renderBudgets=function(){const out=old.apply(this,arguments);setTimeout(enhanceBudget,0);return out;};}
  if(typeof renderLots==='function'){const oldLots=renderLots;renderLots=function(){const out=oldLots.apply(this,arguments);setTimeout(enhanceLots,0);return out;};}

  const originalGenerateCalls=typeof v31GenerateCalls==='function'?v31GenerateCalls:null;
  if(originalGenerateCalls) v31GenerateCalls=async function(){
    if($('v31CallType')?.value!=='provisions')return originalGenerateCalls();
    const coproId=$('v31CallCopro')?.value,yearId=$('v31CallYear')?.value||null,periodicity=$('v31CallPeriodicity')?.value||'once',firstDate=$('v31CallStart')?.value,baseLabel=($('v31CallLabel')?.value||'Appel de provisions').trim(),budgetId=$('v31CallBudget')?.value||'';
    if(!coproId||!firstDate)return alert('Choisis la copropriété et la date.');
    const header=budgetId?(state.budgetHeaders||[]).find(b=>String(b.id)===String(budgetId)):(state.budgetHeaders||[]).find(b=>String(b.copro_id)===String(coproId)&&(!yearId||String(b.fiscal_year_id)===String(yearId))&&b.status==='validated');
    if(!header)return alert('Aucun budget validé trouvé.');
    const lines=(state.budgetLines||[]).filter(l=>String(l.budget_id)===String(header.id));
    const groups=new Map();lines.forEach(l=>{const key=l.distribution_key_id||v31DefaultKey?.(coproId)?.id||'';groups.set(key,(groups.get(key)||0)+Number(l.amount||0));});
    const count=typeof v31PeriodCount==='function'?v31PeriodCount(periodicity):periodicity==='monthly'?12:periodicity==='quarterly'?4:periodicity==='semiannual'?2:1,step=typeof v31PeriodStep==='function'?v31PeriodStep(periodicity):periodicity==='monthly'?1:periodicity==='quarterly'?3:periodicity==='semiannual'?6:0,account=typeof v31AccountByCode==='function'?v31AccountByCode('701'):null;
    for(let i=0;i<count;i++){
      const due=step&&typeof v31AddMonths==='function'?v31AddMonths(firstDate,i*step):firstDate,periodLabel=periodicity==='once'?'Appel unique':(typeof v31MonthLabel==='function'?v31MonthLabel(due):due);
      for(const [keyId,total] of groups.entries()){
        if(!total)continue;
        const key=(state.distributionKeys||[]).find(k=>String(k.id)===String(keyId)),lots=typeof v31LotsForKey==='function'?v31LotsForKey(coproId,keyId):(state.lots||[]).filter(l=>String(l.copro_id)===String(coproId)&&l.active!==false&&l.owner_id).map(l=>({lot:l,q:Number(l.quotities||0)}));
        if(!lots.length)continue;
        const perAmount=Number(total||0)/count,totalQ=lots.reduce((s,x)=>s+Number(x.q||0),0)||1,label=`${baseLabel} - ${periodLabel}${key?.name?' - '+key.name:''}`;
        const call=await supabaseClient.from('compta_calls').insert({copro_id:coproId,fiscal_year_id:yearId,distribution_key_id:keyId||null,periodicity,is_unique_call:periodicity==='once',call_type:'provisions',accounting_account_code:'701',accounting_account_id:account?.id||null,label,call_date:due,due_date:due,amount_total:Number(perAmount.toFixed(2)),status:'sent',accounting_status:'sent',created_by:currentUser?.id||null}).select('id').single();
        if(call.error)return alert(call.error.message);
        const rows=lots.map(x=>({call_id:call.data.id,copro_id:coproId,fiscal_year_id:yearId,distribution_key_id:keyId||null,owner_id:x.lot.owner_id,lot_id:x.lot.id,label,due_date:due,amount_due:Number((perAmount*(Number(x.q||0)/totalQ)).toFixed(2)),amount_paid:0,status:'unpaid',call_type:'provisions',period_label:periodLabel,accounting_status:'pending',accounting_account_code:'701',accounting_account_id:account?.id||null,journal_code:'VEN',created_by:currentUser?.id||null}));
        const r=await supabaseClient.from('compta_owner_calls').insert(rows);if(r.error)return alert(r.error.message);
      }
    }
    closeAppModal();await loadAll?.();alert('Appels générés par clé de répartition.');
  };

  document.addEventListener('input',e=>{if(e.target.matches?.('[data-budget-amount-v11],[data-budget-label-v11]'))markBudgetDirty(e.target);if(e.target.id==='v3610ScopeSearch'){billingScope().search=e.target.value;clearTimeout(state.v3610SearchTimer);state.v3610SearchTimer=setTimeout(renderSyndic,160);}},true);
  document.addEventListener('change',e=>{
    if(e.target.matches?.('[data-budget-amount-v11],[data-budget-label-v11]')){e.stopImmediatePropagation();markBudgetDirty(e.target);return;}
    const f=billingScope();
    if(e.target.id==='v3610ScopeMode'){f.mode=e.target.value;renderSyndic();}
    if(e.target.id==='v3610ScopeMonth'){f.month=e.target.value||ymToday();f.year=Number(f.month.slice(0,4));renderSyndic();}
    if(e.target.id==='v3610ScopeYear'){f.year=Number(e.target.value||today().slice(0,4));renderSyndic();}
    if(e.target.id==='v3610ScopeType'){f.type=e.target.value;renderSyndic();}
    if(e.target.id==='v3610ScopeStatus'){f.status=e.target.value;renderSyndic();}
    if(e.target.id==='v3610CheckAllInvoices')document.querySelectorAll('[data-v3610-invoice-select]:not(:disabled)').forEach(cb=>cb.checked=e.target.checked);
  },true);
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b)return;
    if(b.matches('[data-back-budget-list]')){
      e.preventDefault();e.stopImmediatePropagation();
      const leave=()=>{state.selectedBudgetHeaderId='';if($('budgetHeaderFilter'))$('budgetHeaderFilter').value='';$('budgetsTable')?.classList.remove('v3610-budget-locked');renderBudgets();};
      if(document.querySelector('.v3610-budget-dirty')){b.disabled=true;saveBudgetDraft(true).then(ok=>{if(ok)leave();else b.disabled=false;});}else leave();
      return;
    }
    if(b.id==='v3610SaveBudgetDraft'){e.preventDefault();e.stopImmediatePropagation();return saveBudgetDraft();}
    if(b.dataset.validateBudgetHeader&&document.querySelector('.v3610-budget-dirty')){e.preventDefault();e.stopImmediatePropagation();saveBudgetDraft(true).then(ok=>{if(ok&&typeof validateBudgetHeaderV113==='function')validateBudgetHeaderV113(b.dataset.validateBudgetHeader);});return;}
    if((b.matches('[data-delete-budget],[data-show-budget-add],[data-add-budget-line]'))&&$('budgetsTable')?.classList.contains('v3610-budget-locked')){e.preventDefault();e.stopImmediatePropagation();return alert('Ce budget est validé. Crée ou modifie un brouillon pour préparer une nouvelle version.');}
    if(b.dataset.v3610MutateLot){e.preventDefault();e.stopImmediatePropagation();return openMutation(b.dataset.v3610MutateLot);}
    if(b.id==='v3610SaveMutation'){e.preventDefault();e.stopImmediatePropagation();return saveMutation(b.dataset.lotId);}
    if(b.dataset.syndicTab){state.syndicBillingTab=b.dataset.syndicTab;e.preventDefault();e.stopImmediatePropagation();return renderSyndic();}
    if(b.id==='v3610GenerateMonth'){e.preventDefault();e.stopImmediatePropagation();return generateMonth();}
    if(b.dataset.v3610CreateMonth){e.preventDefault();e.stopImmediatePropagation();return createAndPostContract(b.dataset.v3610CreateMonth);}
    if(b.dataset.v3610Post){e.preventDefault();e.stopImmediatePropagation();return postInvoice(b.dataset.v3610Post);}
    if(b.id==='v3610ExportMonth'){e.preventDefault();e.stopImmediatePropagation();const ym=billingScope().month||ymToday();return exportInvoices((state.syndicInvoices||[]).filter(i=>invoiceYM(i)===ym&&(i.status==='issued'||i.billing_type==='credit_note')).map(i=>String(i.id)),ym);}
    if(b.id==='v3610ExportSelected'){e.preventDefault();e.stopImmediatePropagation();return exportInvoices([...document.querySelectorAll('[data-v3610-invoice-select]:checked')].map(x=>x.dataset.v3610InvoiceSelect),'selection');}
    if(b.id==='v3610ExportVisible'){e.preventDefault();e.stopImmediatePropagation();return exportInvoices(scopedInvoices().map(i=>String(i.id)),'visibles');}
  },true);
  async function install(){stampVersion();let vTicks=0;const vTimer=setInterval(()=>{stampVersion();if(++vTicks>=12)clearInterval(vTimer);},1500);await loadEmitters();setTimeout(()=>{if(!$('syndicBillingView')?.classList.contains('hidden'))renderSyndic();enhanceBudget();enhanceLots();stampVersion();},0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,2100));else setTimeout(install,300);
})();
