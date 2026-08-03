/* WAPI One V35.2 - VCS, facturation mensuelle, configuration et compte comptable */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro=v=>Number(v||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR'});
  const monthNames=['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  let issuers=[], preferences=null;
  let billingYear=new Date().getFullYear(), billingMonth=new Date().getMonth()+1;
  let autoPreparing=false;

  function issuer(id){ return issuers.find(x=>String(x.id)===String(id))||issuers.find(x=>x.code==='WAPI')||{}; }
  function invoiceIssuer(inv){ return issuer(inv?.issuer_id || (state.syndicContracts||[]).find(c=>String(c.id)===String(inv?.contract_id))?.issuer_id); }
  function options(rows,value,label){ return rows.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(value)?'selected':''}>${esc(label(x))}</option>`).join(''); }

  async function loadV352(){
    const [i,p]=await Promise.all([
      supabaseClient.from('compta_billing_issuers').select('*').order('company_name'),
      supabaseClient.from('compta_app_preferences').select('*').eq('id',true).maybeSingle()
    ]);
    if(!i.error) issuers=i.data||[];
    if(!p.error) preferences=p.data||null;
  }
  const oldLoad=typeof loadSyndicBillingV23==='function'?loadSyndicBillingV23:null;
  if(oldLoad) loadSyndicBillingV23=async function(){ await oldLoad(); await loadV352(); };

  function periodRows(){
    return (state.syndicInvoices||[]).filter(x=>Number(x.period_year)===billingYear&&Number(x.period_month)===billingMonth);
  }
  function activeContracts(){
    return (state.syndicContracts||[]).filter(c=>c.active!==false&&Number(c.start_month||1)<=billingMonth&&Number(c.end_month||12)>=billingMonth);
  }
  function billingSummary(){
    const rows=periodRows(), contracts=activeContracts();
    const drafts=rows.filter(x=>x.status==='draft'), issued=rows.filter(x=>x.status==='issued');
    const expectedMissing=contracts.filter(c=>!rows.some(i=>String(i.contract_id)===String(c.id)));
    return {rows,contracts,drafts,issued,missing:expectedMissing,exportable:issued.filter(x=>!(x.clearfact_exported_at||x.clearfact_export_status==='exported'))};
  }
  function stepCard(n,title,text,status,button){ return `<div class="w352-step ${status}"><span class="w352-step-no">${n}</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>${button||''}</div>`; }

  function renderMonthly(){
    const root=$('syndicBillingContent'); if(!root) return;
    const s=billingSummary();
    const anomalies=s.drafts.filter(i=>!i.copro_id||!i.account_id||!Number(i.amount_total||0));
    root.innerHTML=`<div class="w352-billing-head"><div><h2>Facturation de ${monthNames[billingMonth]} ${billingYear}</h2><p>Un parcours unique : préparer, contrôler, valider, exporter vers Clearfact.</p></div><div class="w352-period"><select id="w352BillingMonth">${monthNames.slice(1).map((m,i)=>`<option value="${i+1}" ${i+1===billingMonth?'selected':''}>${m}</option>`).join('')}</select><input id="w352BillingYear" type="number" value="${billingYear}" min="2020" max="2100"></div></div>
    <div class="w352-kpis"><div><span>Contrats attendus</span><strong>${s.contracts.length}</strong></div><div><span>Brouillons</span><strong>${s.drafts.length}</strong></div><div><span>Factures validées</span><strong>${s.issued.length}</strong></div><div><span>À exporter</span><strong>${s.exportable.length}</strong></div></div>
    <div class="w352-steps">
      ${stepCard(1,'Préparer les factures',s.missing.length?`${s.missing.length} contrat(s) restent à générer.`:'Toutes les factures attendues sont préparées.',s.missing.length?'todo':'done',`<button class="btn" id="w352PrepareMonth">${s.missing.length?'Générer les factures manquantes':'Vérifier à nouveau'}</button>`)}
      ${stepCard(2,'Contrôler puis valider',anomalies.length?`${anomalies.length} brouillon(s) incomplet(s).`:`${s.drafts.length} brouillon(s) prêt(s) à valider.`,anomalies.length?'warn':s.drafts.length?'todo':'done',`<button class="btn" id="w352PostMonth" ${!s.drafts.length||anomalies.length?'disabled':''}>Valider ${s.drafts.length} facture(s)</button>`)}
      ${stepCard(3,'Exporter pour Clearfact',`${s.exportable.length} facture(s) non exportée(s). Un PDF distinct sera créé pour chacune.`,s.exportable.length?'todo':'done',`<button class="btn" id="w352ExportMonth" ${!s.exportable.length?'disabled':''}>Télécharger le ZIP Clearfact</button>`)}
    </div>
    <div class="w352-section-head"><div><h3>Détail du mois</h3><p>Les factures sont regroupées par société émettrice.</p></div></div>
    ${issuers.filter(x=>x.active!==false).map(em=>{const rows=s.rows.filter(i=>String(invoiceIssuer(i).id)===String(em.id));return `<section class="w352-issuer"><header><div><strong>${esc(em.company_name)}</strong><small>${esc(em.code)}</small></div><span>${rows.length} facture(s) · ${euro(rows.reduce((a,b)=>a+Number(b.amount_total||0),0))}</span></header>${invoiceTable(rows)}</section>`}).join('')}`;
    if(s.missing.length&&!autoPreparing)setTimeout(()=>prepareMonth(true),50);
  }
  function invoiceTable(rows){
    return `<div class="table-wrap"><table><thead><tr><th>État</th><th>Copropriété</th><th>Libellé</th><th>N°</th><th>TVAC</th><th></th></tr></thead><tbody>${rows.map(i=>`<tr><td><span class="badge ${i.status==='issued'?'ok':'warn'}">${i.status==='issued'?'Validée':'Brouillon'}</span></td><td>${esc(i.compta_copros?.name||i.customer_name||'')}</td><td>${esc(i.description||'')}</td><td>${esc(i.invoice_number||'Brouillon')}</td><td><strong>${euro(i.amount_total)}</strong></td><td><button class="btn secondary small" data-preview-syndic-invoice="${i.id}">PDF</button></td></tr>`).join('')||'<tr><td colspan="6" class="w352-empty">Aucune facture pour cette société ce mois-ci.</td></tr>'}</tbody></table></div>`;
  }

  function renderContracts(){
    const root=$('syndicBillingContent'); if(!root) return;
    root.innerHTML=`<div class="w352-section-head"><div><h2>Contrats récurrents</h2><p>Un contrat actif produit une facture chaque mois, sans doublon.</p></div><button class="btn" id="newSyndicContractBtn2">Nouveau contrat</button></div><div class="table-wrap"><table><thead><tr><th>Société</th><th>Copropriété</th><th>Service</th><th>Montant mensuel</th><th>Période</th><th>État</th><th></th></tr></thead><tbody>${(state.syndicContracts||[]).map(c=>`<tr><td><strong>${esc(issuer(c.issuer_id).company_name||'WAPI SYNDIK')}</strong></td><td>${esc(c.compta_copros?.name||'')}</td><td>${esc(c.label||'')}</td><td>${euro(c.monthly_amount_htva)} HTVA</td><td>${Number(c.start_month||1)} → ${Number(c.end_month||12)}</td><td><span class="badge ${c.active!==false?'ok':''}">${c.active!==false?'Actif':'Inactif'}</span></td><td><button class="btn secondary small" data-edit-syndic-contract="${c.id}">Modifier</button></td></tr>`).join('')||'<tr><td colspan="7">Aucun contrat.</td></tr>'}</tbody></table></div>`;
  }
  function renderInvoices(){ const root=$('syndicBillingContent'); if(root) root.innerHTML=`<div class="w352-section-head"><div><h2>Toutes les factures</h2><p>Historique complet, toutes sociétés confondues.</p></div></div>${invoiceTable(state.syndicInvoices||[])}`; }
  function renderIssuers(){
    const root=$('syndicBillingContent'); if(!root) return;
    root.innerHTML=`<div class="w352-section-head"><div><h2>Sociétés émettrices</h2><p>Identité et numérotation utilisées sur les factures PDF.</p></div></div><div class="w352-issuer-grid">${issuers.map(x=>`<button type="button" class="w352-issuer-card" data-w352-edit-issuer="${x.id}"><strong>${esc(x.company_name)}</strong><span>${esc(x.invoice_prefix)}-${x.numbering_year}-${String(x.next_number).padStart(5,'0')}</span><small>${esc(x.vat_number||'TVA à compléter')}</small></button>`).join('')}</div>`;
  }
  renderSyndicBillingV23=function(){
    document.querySelectorAll('[data-syndic-tab]').forEach(b=>b.classList.toggle('active',b.dataset.syndicTab===state.syndicBillingTab));
    const tab=state.syndicBillingTab||'campaigns';
    if(tab==='contracts') return renderContracts();
    if(tab==='invoices'||tab==='exports'||tab==='services') return renderInvoices();
    if(tab==='settings') return renderIssuers();
    renderMonthly();
  };

  openSyndicContractModalV23=function(id=''){
    const c=(state.syndicContracts||[]).find(x=>String(x.id)===String(id))||{issuer_id:issuer(null).id,copro_id:state.activeCoproId||'',label:'Honoraires mensuels',monthly_amount_htva:0,vat_rate:21,start_month:1,end_month:12,due_day:10,active:true};
    const html=`<div class="popup-form"><div class="w352-contract-intro">Choisissez la société qui facture, la copropriété cliente et le montant mensuel. WAPI One préparera ensuite une facture chaque mois.</div><div class="form-grid"><label>Société émettrice<select id="synContractIssuer">${options(issuers,c.issuer_id,x=>x.company_name)}</select></label><label>Copropriété<select id="synContractCopro">${v23CoproOptions(c.copro_id)}</select></label><label>Type de service<select id="synContractFamily"><option value="syndic_fee">Honoraires syndic</option><option value="cleaning">Nettoyage / entretien</option><option value="other">Autre service récurrent</option></select></label><label>Libellé<input id="synContractLabel" value="${esc(c.label||'')}"></label><label>Montant mensuel HTVA<input id="synContractAmount" type="number" step="0.01" value="${Number(c.monthly_amount_htva||0)}"></label><label>TVA %<input id="synContractVat" type="number" step="0.01" value="${Number(c.vat_rate??21)}"></label><label>Compte comptable<select id="synContractAccount">${v23AccountOptions(c.account_id||'',true)}</select></label><label>Jour d'échéance<input id="synContractDue" type="number" min="1" max="28" value="${Number(c.due_day||10)}"></label><label>Premier mois<input id="synContractStart" type="number" min="1" max="12" value="${Number(c.start_month||1)}"></label><label>Dernier mois<input id="synContractEnd" type="number" min="1" max="12" value="${Number(c.end_month||12)}"></label><label>Contrat actif<select id="synContractActive"><option value="true">Oui</option><option value="false">Non</option></select></label></div></div>`;
    openAppModal(id?'Modifier le contrat':'Nouveau contrat récurrent',html,`<button class="btn secondary" data-modal-close>Fermer</button><button class="btn" id="saveSyndicContractBtn" data-contract-id="${id}">Enregistrer</button>`,{size:'wide'});
    $('synContractFamily').value=c.service_family||'syndic_fee'; $('synContractActive').value=String(c.active!==false);
  };
  saveSyndicContractV23=async function(id=''){
    const acc=$('synContractAccount'); const payload={issuer_id:$('synContractIssuer').value||null,service_family:$('synContractFamily').value,copro_id:$('synContractCopro').value,label:$('synContractLabel').value.trim(),monthly_amount_htva:Number($('synContractAmount').value||0),vat_rate:Number($('synContractVat').value||0),account_id:acc.value||null,account_code:acc.selectedOptions?.[0]?.dataset?.code||null,due_day:Number($('synContractDue').value||10),start_month:Number($('synContractStart').value||1),end_month:Number($('synContractEnd').value||12),active:$('synContractActive').value==='true',posting_mode:'semi_auto',updated_at:new Date().toISOString()};
    if(!payload.issuer_id||!payload.copro_id||!payload.label||!payload.monthly_amount_htva||!payload.account_id) return alert('Société, copropriété, libellé, montant et compte comptable sont obligatoires.');
    const q=id?supabaseClient.from('compta_syndic_billing_contracts').update(payload).eq('id',id):supabaseClient.from('compta_syndic_billing_contracts').insert({...payload,created_by:currentUser?.id||null});
    const {error}=await q;if(error)return alert(error.message);closeAppModal();await loadSyndicBillingV23();state.syndicBillingTab='contracts';renderSyndicBillingV23();
  };

  async function ensureCampaign(){
    let c=(state.syndicCampaigns||[]).find(x=>Number(x.year)===billingYear&&Number(x.month)===billingMonth); if(c)return c;
    const invoice_date=`${billingYear}-${String(billingMonth).padStart(2,'0')}-01`, due_date=`${billingYear}-${String(billingMonth).padStart(2,'0')}-15`;
    const {data,error}=await supabaseClient.from('compta_syndic_billing_campaigns').insert({year:billingYear,month:billingMonth,label:`${monthNames[billingMonth]} ${billingYear}`,invoice_date,due_date,status:'draft',created_by:currentUser?.id||null}).select('*').single(); if(error)throw error; return data;
  }
  async function prepareMonth(silent=false){
    if(autoPreparing)return;autoPreparing=true;
    try{const camp=await ensureCampaign();const s=billingSummary(),payloads=[];for(const c of s.missing){const t=v23InvoiceTotals(c.monthly_amount_htva,c.vat_rate), day=String(Math.min(Number(c.due_day||15),28)).padStart(2,'0');payloads.push({invoice_number:`DRAFT-${c.id}-${billingYear}${String(billingMonth).padStart(2,'0')}`,billing_type:c.service_family==='cleaning'?'service':'honoraires',contract_id:c.id,campaign_id:camp.id,issuer_id:c.issuer_id,copro_id:c.copro_id,customer_name:(state.copros||[]).find(x=>String(x.id)===String(c.copro_id))?.name||'',invoice_date:`${billingYear}-${String(billingMonth).padStart(2,'0')}-01`,due_date:`${billingYear}-${String(billingMonth).padStart(2,'0')}-${day}`,period_year:billingYear,period_month:billingMonth,description:`${c.label} - ${monthNames[billingMonth]} ${billingYear}`,account_id:c.account_id,account_code:c.account_code,amount_subtotal:t.subtotal,vat_rate:Number(c.vat_rate||0),vat_amount:t.vat,amount_total:t.total,status:'draft',created_by:currentUser?.id||null});}if(payloads.length){const {error}=await supabaseClient.from('compta_syndic_invoices').insert(payloads);if(error)throw error;}await loadSyndicBillingV23();renderSyndicBillingV23();if(!silent)alert(`${payloads.length} facture(s) préparée(s).`);}catch(e){if(!silent)alert('Préparation impossible : '+e.message);else console.error('Préparation mensuelle',e);}finally{autoPreparing=false;}
  }
  postSyndicInvoiceV24=async function(id,skipConfirm=false){
    const inv=(state.syndicInvoices||[]).find(x=>String(x.id)===String(id));if(!inv||inv.status!=='draft')return;
    if(!skipConfirm&&!confirm('Valider et comptabiliser cette facture ?'))return;
    const em=invoiceIssuer(inv);if(!em.id)return alert('Choisissez une société émettrice.');
    try{const num=await supabaseClient.rpc('wapi_next_issuer_invoice_number',{p_issuer_id:em.id});if(num.error)throw num.error;const supplierId=await v24CreateSupplierInvoiceFromSyndic({...inv,issuer_id:em.id},num.data);const {error}=await supabaseClient.from('compta_syndic_invoices').update({invoice_number:num.data,issuer_id:em.id,status:'issued',posted_at:new Date().toISOString(),supplier_invoice_id:supplierId,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;}catch(e){alert('Validation impossible : '+e.message);}
  };
  async function postMonth(){for(const x of billingSummary().drafts)await postSyndicInvoiceV24(x.id,true);await loadAll();renderSyndicBillingV23();}
  async function exportMonth(){
    const rows=billingSummary().exportable;if(!rows.length)return alert('Aucune facture à exporter.');if(!window.JSZip)return alert('Le module ZIP n’est pas chargé.');
    const zip=new JSZip();for(const inv of rows){const em=invoiceIssuer(inv),blob=await syndicInvoicePdfBlobV23(inv),folder=(em.code||'FACTURES').replace(/[^A-Z0-9_-]/gi,'_');zip.file(`${folder}/${String(inv.invoice_number||inv.id).replace(/[^A-Z0-9_-]/gi,'_')}.pdf`,blob);}
    const blob=await zip.generateAsync({type:'blob'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Clearfact_${billingYear}_${String(billingMonth).padStart(2,'0')}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    const {error}=await supabaseClient.from('compta_syndic_invoices').update({clearfact_export_status:'exported',clearfact_exported_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',rows.map(x=>x.id));if(error)return alert('Les PDF ont été téléchargés, mais le statut exporté n’a pas pu être enregistré : '+error.message);await loadSyndicBillingV23();renderSyndicBillingV23();
  }

  const oldPdf=typeof syndicInvoicePdfBlobV23==='function'?syndicInvoicePdfBlobV23:null;
  syndicInvoicePdfBlobV23=async function(inv){
    const em=invoiceIssuer(inv); if(!window.jspdf?.jsPDF||!em.id) return oldPdf(inv);
    const d=new window.jspdf.jsPDF({unit:'mm',format:'a4'}), color='#0B6B3B';
    window.WapiPdfTheme?.jspdfHeader?.(d,'FACTURE',em.company_name||'');
    d.setTextColor(17,19,24);d.setFont('helvetica','bold');d.setFontSize(11);d.text(inv.invoice_number||'',195,49,{align:'right'});d.setFont('helvetica','normal');d.setFontSize(9);d.text(`Date : ${inv.invoice_date||''}`,195,55,{align:'right'});
    d.setFillColor(241,248,243);d.roundedRect(15,48,108,31,2,2,'F');d.setTextColor(94,104,116);d.setFontSize(8);d.text('CLIENT',20,56);d.setTextColor(17,19,24);d.setFont('helvetica','bold');d.setFontSize(11);d.text(inv.compta_copros?.name||inv.customer_name||'',20,65,{maxWidth:96});
    d.setFillColor(11,107,59);d.rect(15,91,180,9,'F');d.setTextColor(255);d.setFont('helvetica','bold');d.setFontSize(9);d.text('Description',18,97);d.text('HTVA',140,97,{align:'right'});d.text('TVA',165,97,{align:'right'});d.text('TVAC',192,97,{align:'right'});
    d.setTextColor(17,19,24);d.setFont('helvetica','normal');d.text(inv.description||'',18,110,{maxWidth:108});d.text(euro(inv.amount_subtotal),140,110,{align:'right'});d.text(euro(inv.vat_amount),165,110,{align:'right'});d.text(euro(inv.amount_total),192,110,{align:'right'});d.setDrawColor(215,228,218);d.line(15,116,195,116);
    d.setFillColor(color);d.roundedRect(122,126,73,18,2,2,'F');d.setTextColor(255);d.setFont('helvetica','bold');d.setFontSize(12);d.text(`TOTAL  ${euro(inv.amount_total)}`,190,137,{align:'right'});
    d.setTextColor(70,75,90);d.setFont('helvetica','normal');d.setFontSize(8.5);d.text([em.address,em.email,em.phone,em.iban?`IBAN ${em.iban}`:'',em.bic?`BIC ${em.bic}`:''].filter(Boolean),15,262);
    window.WapiPdfTheme?.jspdfFooter?.(d,'Facture '+(inv.invoice_number||''));
    return d.output('blob');
  };

  function openIssuer(id){const x=issuer(id);const html=`<div class="form-grid"><label>Nom société<input id="w352EmName" value="${esc(x.company_name||'')}"></label><label>Code<input value="${esc(x.code||'')}" disabled></label><label>N° TVA<input id="w352EmVat" value="${esc(x.vat_number||'')}"></label><label>Préfixe factures<input id="w352EmPrefix" value="${esc(x.invoice_prefix||'')}"></label><label>Année numérotation<input id="w352EmYear" type="number" value="${Number(x.numbering_year||billingYear)}"></label><label>Prochain numéro<input id="w352EmNext" type="number" value="${Number(x.next_number||1)}"></label><label>Email<input id="w352EmEmail" value="${esc(x.email||'')}"></label><label>Téléphone<input id="w352EmPhone" value="${esc(x.phone||'')}"></label><label>IBAN<input id="w352EmIban" value="${esc(x.iban||'')}"></label><label>BIC<input id="w352EmBic" value="${esc(x.bic||'')}"></label><label>Couleur PDF<input id="w352EmColor" type="color" value="${esc(x.pdf_color||'#5b4bdb')}"></label><label style="grid-column:1/-1">Adresse<textarea id="w352EmAddress">${esc(x.address||'')}</textarea></label></div>`;openAppModal('Société émettrice',html,`<button class="btn secondary" data-modal-close>Fermer</button><button class="btn" id="w352SaveIssuer" data-id="${x.id}">Enregistrer</button>`,{size:'wide'});}
  async function saveIssuer(id){const p={company_name:$('w352EmName').value,vat_number:$('w352EmVat').value,invoice_prefix:$('w352EmPrefix').value,numbering_year:Number($('w352EmYear').value),next_number:Number($('w352EmNext').value),email:$('w352EmEmail').value,phone:$('w352EmPhone').value,iban:$('w352EmIban').value,bic:$('w352EmBic').value,pdf_color:$('w352EmColor').value,address:$('w352EmAddress').value,updated_at:new Date().toISOString()};const {error}=await supabaseClient.from('compta_billing_issuers').update(p).eq('id',id);if(error)return alert(error.message);closeAppModal();await loadV352();renderIssuers();}

  function renderConfiguration(){
    const view=$('agencyView');if(!view)return;view.innerHTML=`<div class="card w352-config"><div class="w352-section-head"><div><h2>Configuration générale</h2><p>Les réglages transversaux de WAPI One, regroupés au même endroit.</p></div><button class="btn" id="w352SavePreferences">Enregistrer</button></div><div class="w352-config-grid"><section><h3>Valeurs par défaut</h3><label>Pays<input id="w352PrefCountry" value="${esc(preferences?.default_country||'Belgique')}"></label><label>Devise<input id="w352PrefCurrency" value="${esc(preferences?.currency||'EUR')}"></label><label>TVA par défaut (%)<input id="w352PrefVat" type="number" step="0.01" value="${Number(preferences?.default_vat_rate??21)}"></label></section><section><h3>Délais</h3><label>Échéance factures fournisseurs (jours)<input id="w352PrefSupplierDays" type="number" value="${Number(preferences?.supplier_due_days||30)}"></label><label>Échéance appels (jours)<input id="w352PrefCallDays" type="number" value="${Number(preferences?.call_due_days||15)}"></label></section><section><h3>Sécurité d'encodage</h3><label class="w352-check"><input id="w352PrefContext" type="checkbox" ${preferences?.require_copro_context!==false?'checked':''}> Exiger une copropriété active avant encodage</label><label class="w352-check"><input id="w352PrefConfirm" type="checkbox" ${preferences?.confirm_accounting_actions!==false?'checked':''}> Confirmer les opérations comptables sensibles</label></section><section><h3>Documents</h3><label>Couleur principale PDF<input id="w352PrefColor" type="color" value="${esc(preferences?.pdf_primary_color||'#5b4bdb')}"></label><label>Pied de page<textarea id="w352PrefFooter">${esc(preferences?.document_footer||'')}</textarea></label></section></div><div class="w352-config-note">Les sociétés qui émettent les factures se règlent dans <strong>Facturation syndic → Réglages</strong>. Les utilisateurs et leurs boîtes mail restent dans <strong>Configuration → Utilisateurs</strong>.</div></div>`;
  }
  async function savePreferences(){const p={id:true,default_country:$('w352PrefCountry').value,currency:$('w352PrefCurrency').value,default_vat_rate:Number($('w352PrefVat').value),supplier_due_days:Number($('w352PrefSupplierDays').value),call_due_days:Number($('w352PrefCallDays').value),require_copro_context:$('w352PrefContext').checked,confirm_accounting_actions:$('w352PrefConfirm').checked,pdf_primary_color:$('w352PrefColor').value,document_footer:$('w352PrefFooter').value,updated_by:currentUser?.id||null,updated_at:new Date().toISOString()};const {error}=await supabaseClient.from('compta_app_preferences').upsert(p);if(error)return alert(error.message);preferences=p;alert('Configuration enregistrée.');}

  function consolidatedAccountingRows(){
    const out=[], accById=id=>(state.accounts||[]).find(a=>String(a.id)===String(id))||{};
    const push=(code,debit,credit,text,date,ref,copro_id,source_type)=>out.push({code:String(code||'499'),debit:Number(debit||0),credit:Number(credit||0),text:text||'',date:date||'',reference:ref||'',copro_id,source_type});
    (state.invoices||[]).filter(i=>i.status!=='rejected').forEach(i=>{const a=accById(i.account_id),n=Number(i.amount_total||0),code=i.account_code||a.code||'610';push(code,n,0,i.description||`Facture ${i.invoice_number||''}`,i.invoice_date,i.invoice_number,i.copro_id,'ACH');push('440',0,n,`Dette fournisseur ${i.invoice_number||''}`,i.invoice_date,i.invoice_number,i.copro_id,'ACH');});
    (state.ownerCalls||[]).forEach(c=>{const n=Number(c.amount_due||0),code=c.accounting_account_code||(c.call_type==='reserve'?'160':c.call_type==='working_capital'?'100':'700');push('410',n,0,c.label||'Appel',c.due_date,c.period_label,c.copro_id,'VEN');push(code,0,n,c.label||'Appel',c.due_date,c.period_label,c.copro_id,'VEN');});
    (state.bankTransactions||[]).forEach(t=>{const n=Number(t.amount||0),ba=(state.bankAccounts||[]).find(b=>String(b.id)===String(t.bank_account_id))||{},bank=ba.account_code||accById(ba.account_id).code||'550',tier=t.tier_type==='owner'?'410':t.tier_type==='supplier'?'440':'499',lab=t.communication||t.description||t.counterparty_name||'Mouvement bancaire';if(n>=0){push(bank,n,0,lab,t.transaction_date,t.statement_number,t.copro_id,'FIN');push(tier,0,n,lab,t.transaction_date,t.statement_number,t.copro_id,'FIN');}else{push(tier,Math.abs(n),0,lab,t.transaction_date,t.statement_number,t.copro_id,'FIN');push(bank,0,Math.abs(n),lab,t.transaction_date,t.statement_number,t.copro_id,'FIN');}});
    (state.entries||[]).filter(e=>e.account_id).forEach(e=>{const a=accById(e.account_id);push(a.code||e.account_code||'499',e.debit,e.credit,e.description||e.label||'Opération diverse',e.entry_date,e.reference,e.copro_id,e.journal_code||'OD');});
    return out;
  }
  function accountRows(code){const copro=state.activeCoproId||'',from=$('w352AccountFrom')?.value||'0000-01-01',to=$('w352AccountTo')?.value||'9999-12-31';return consolidatedAccountingRows().filter(r=>String(r.code)===String(code)&&(!copro||String(r.copro_id)===String(copro))&&(!r.date||(r.date>=from&&r.date<=to))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  function renderAccountSearch(){
    const view=$('accountLookupView');if(!view)return;const oldCode=($('v28AccountLookupCode')?.value||'').split(/\s+-\s+/)[0];
    view.innerHTML=`<div class="card w352-account"><div class="w352-section-head"><div><h2>Compte comptable</h2><p>Recherchez un compte par numéro ou par libellé.</p></div><button class="btn secondary" id="w352AccountPdf" disabled>Exporter en PDF</button></div><div class="w352-account-search"><div class="w352-combobox"><label for="w352AccountQuery">Compte</label><input id="w352AccountQuery" autocomplete="off" placeholder="Ex. 61050 ou Électricité parties communes"><div id="w352AccountResults" class="w352-account-results hidden"></div></div><label>Du<input id="w352AccountFrom" type="date"></label><label>Au<input id="w352AccountTo" type="date"></label><button class="btn" id="w352AccountRun">Afficher</button></div><div id="w352AccountOutput" class="w352-account-output"><div class="w352-empty-state"><strong>Sélectionnez un compte</strong><span>Commencez à taper son numéro ou son libellé.</span></div></div></div>`;
    const y=(state.fiscalYears||[]).find(x=>String(x.id)===String(typeof currentYear==='function'?currentYear():''));$('w352AccountFrom').value=y?.starts_on||'';$('w352AccountTo').value=y?.ends_on||'';
    $('w352AccountQuery').addEventListener('input',showAccountMatches);if(oldCode){const a=(state.accounts||[]).find(x=>String(x.code)===oldCode);if(a){$('w352AccountQuery').value=`${a.code} — ${a.label}`;$('w352AccountQuery').dataset.code=a.code;runAccount();}}
  }
  function showAccountMatches(){const q=this.value.trim().toLowerCase(),box=$('w352AccountResults');this.dataset.code='';if(!q){box.classList.add('hidden');return;}const rows=(state.accounts||[]).filter(a=>`${a.code} ${a.label}`.toLowerCase().includes(q)).slice(0,30);box.innerHTML=rows.map(a=>`<button type="button" data-w352-account="${esc(a.code)}"><strong>${esc(a.code)}</strong><span>${esc(a.label)}</span></button>`).join('')||'<div class="w352-no-match">Aucun compte trouvé.</div>';box.classList.remove('hidden');}
  function runAccount(){const code=$('w352AccountQuery')?.dataset.code;if(!code)return alert('Choisissez un compte dans la liste de résultats.');const a=(state.accounts||[]).find(x=>String(x.code)===String(code))||{},rows=accountRows(code),debit=rows.reduce((s,r)=>s+Number(r.debit||0),0),credit=rows.reduce((s,r)=>s+Number(r.credit||0),0);$('w352AccountPdf').disabled=false;$('w352AccountOutput').innerHTML=`<div class="w352-account-title"><div><span>Compte ${esc(code)}</span><h3>${esc(a.label||'')}</h3></div><div><span>Débit<strong>${euro(debit)}</strong></span><span>Crédit<strong>${euro(credit)}</strong></span><span>Solde<strong>${euro(debit-credit)}</strong></span></div></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Journal</th><th>Référence</th><th>Libellé</th><th>Débit</th><th>Crédit</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date||'')}</td><td>${esc((r.source_type||r.journal_code||'').toUpperCase())}</td><td>${esc(r.reference||'')}</td><td>${esc(r.text||r.description||'')}</td><td>${r.debit?euro(r.debit):''}</td><td>${r.credit?euro(r.credit):''}</td></tr>`).join('')||'<tr><td colspan="6">Aucune écriture sur cette période.</td></tr>'}</tbody></table></div>`;}
  function exportAccount(){const code=$('w352AccountQuery')?.dataset.code,a=(state.accounts||[]).find(x=>String(x.code)===String(code))||{};if(!code)return;const rows=accountRows(code),d=rows.reduce((s,r)=>s+Number(r.debit||0),0),c=rows.reduce((s,r)=>s+Number(r.credit||0),0);const w=window.open('','_blank');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Compte ${esc(code)}</title><style>body{font:12px Arial;margin:18mm;color:#1d2435}h1{margin:0}h2{color:#666;margin-top:4px}.sum{display:flex;gap:20px;margin:18px 0;padding:12px;background:#f4f5f8}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left}th{background:#222b3f;color:#fff}</style></head><body><h1>Compte ${esc(code)}</h1><h2>${esc(a.label||'')}</h2><div class="sum"><b>Débit ${euro(d)}</b><b>Crédit ${euro(c)}</b><b>Solde ${euro(d-c)}</b></div>${$('w352AccountOutput').querySelector('.table-wrap')?.innerHTML||''}<script>onload=()=>setTimeout(()=>print(),200)<\/script></body></html>`);w.document.close();}

  document.addEventListener('click',async e=>{
    const a=e.target.closest('[data-w352-account]');if(a){$('w352AccountQuery').value=`${a.dataset.w352Account} — ${(state.accounts||[]).find(x=>String(x.code)===a.dataset.w352Account)?.label||''}`;$('w352AccountQuery').dataset.code=a.dataset.w352Account;$('w352AccountResults').classList.add('hidden');runAccount();return;}
    if(e.target.closest('#w352PrepareMonth'))return prepareMonth();if(e.target.closest('#w352PostMonth'))return postMonth();if(e.target.closest('#w352ExportMonth'))return exportMonth();if(e.target.closest('#w352AccountRun'))return runAccount();if(e.target.closest('#w352AccountPdf'))return exportAccount();if(e.target.closest('#w352SavePreferences'))return savePreferences();
    const ei=e.target.closest('[data-w352-edit-issuer]');if(ei)return openIssuer(ei.dataset.w352EditIssuer);const si=e.target.closest('#w352SaveIssuer');if(si)return saveIssuer(si.dataset.id);
  });
  document.addEventListener('change',e=>{if(e.target.id==='w352BillingMonth'){billingMonth=Number(e.target.value);renderMonthly();}if(e.target.id==='w352BillingYear'){billingYear=Number(e.target.value);renderMonthly();}});
  const oldSwitch=typeof switchToView==='function'?switchToView:null;if(oldSwitch)switchToView=function(name){oldSwitch(name);setTimeout(()=>{if(name==='agency')renderConfiguration();if(name==='accountLookup')renderAccountSearch();if(name==='syndicBilling')renderSyndicBillingV23();},0);};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(async()=>{await loadV352();if(!$('agencyView')?.classList.contains('hidden'))renderConfiguration();if(!$('accountLookupView')?.classList.contains('hidden'))renderAccountSearch();},1200));
})();
