/* WAPI One V36 — centre de traitement factures, multi-copro et rapide. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V36.0.2 — Centre factures';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const store={tab:localStorage.getItem('wapi_v36_invoice_tab')||'to_process',manager:localStorage.getItem('wapi_v36_invoice_manager')||'',copro:localStorage.getItem('wapi_v36_invoice_copro')||'',search:'',links:[],preferences:[],busy:false,selected:new Set()};
  const tabs=[['to_process','À traiter'],['to_validate','À valider'],['posted','Comptabilisées'],['errors','Erreurs'],['duplicates','Doublons'],['rejected','Rejetées']];

  const previewUrls=new Map();
  function item(q){
    const full=(state.importItems||[]).find(x=>String(x.id)===String(q.item_id));
    if(full)return full;
    const joined=q?.compta_import_items||{};
    return {...joined,id:q?.item_id||joined.id||null,raw_data:joined.raw_data||{}};
  }
  function monthLabel(date){if(!date)return '';const label=new Intl.DateTimeFormat('fr-BE',{month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00`));return label.charAt(0).toUpperCase()+label.slice(1);}
  function fiscalYearFor(coproId,date){if(!coproId||!date)return null;return (state.fiscalYears||[]).filter(y=>String(y.copro_id)===String(coproId)&&(!y.starts_on||y.starts_on<=date)&&(!y.ends_on||y.ends_on>=date)).sort((a,b)=>String(b.starts_on||'').localeCompare(String(a.starts_on||'')))[0]||null;}
  function fiscalYearOptions(coproId,selected){return '<option value="">Choisir…</option>'+(state.fiscalYears||[]).filter(y=>String(y.copro_id)===String(coproId)).sort((a,b)=>String(b.starts_on||'').localeCompare(String(a.starts_on||''))).map(y=>`<option value="${y.id}" ${String(y.id)===String(selected)?'selected':''}>${esc(y.label||y.code||`${y.starts_on||''} — ${y.ends_on||''}`)}</option>`).join('');}
  function preferenceFor(d){return (store.preferences||[]).find(p=>p.active!==false&&String(p.copro_id)===String(d.copro_id)&&String(p.supplier_id)===String(d.supplier_id))||null;}
  function applyPreference(d){const p=preferenceFor(d);if(!p)return d;const next={...d,account_id:d.account_id||p.account_id||null};if(p.description_mode==='invoice_month'&&d.date)next.description=monthLabel(d.date);return next;}
  function values(q){const i=item(q),raw={...(q.extracted_data||i.raw_data?.extracted||{}),...(q.corrected_data||{})};return applyPreference(raw);}
  function copro(id){return (state.copros||[]).find(x=>String(x.id)===String(id));}
  function supplier(id){return (state.suppliers||[]).find(x=>String(x.id)===String(id));}
  function qCopro(q){const d=values(q),i=item(q);return q.copro_id||d.copro_id||i.detected_copro_id||'';}
  function qSupplier(q){const d=values(q),i=item(q);return d.supplier_id||i.detected_supplier_id||'';}
  function managerOf(c){return c?.manager_user_id||c?.manager_id||'';}
  function profileName(id){const u=(state.userProfiles||[]).find(x=>String(x.id)===String(id));return u?.display_name||u?.email||'Gestionnaire';}
  function allowedCopros(){const rows=(state.copros||[]).filter(c=>c.active!==false);return store.manager?rows.filter(c=>String(managerOf(c))===String(store.manager)):rows;}
  function allowedCoproIds(){return new Set(allowedCopros().map(c=>String(c.id)));}
  function linked(coproId,supplierId){return store.links.some(x=>x.active!==false&&String(x.copro_id)===String(coproId)&&String(x.supplier_id)===String(supplierId));}

  async function loadSupport(){
    const [links,profiles,preferences]=await Promise.all([
      supabaseClient.from('compta_copro_suppliers').select('*'),
      (state.userProfiles||[]).length?Promise.resolve({data:state.userProfiles}):supabaseClient.from('compta_user_profiles').select('id,email,display_name,role,active').order('display_name'),
      supabaseClient.from('compta_invoice_encoding_preferences').select('*')
    ]);
    if(!links.error)store.links=links.data||[];else console.warn('Migration 045 manquante',links.error.message);
    if(!profiles.error)state.userProfiles=profiles.data||[];
    if(!preferences.error)store.preferences=preferences.data||[];else console.warn('Préférences de factures récurrentes indisponibles : exécute la migration V36.10.5.',preferences.error.message);
    if(!store.manager&&currentUser?.id&&(state.userProfiles||[]).some(u=>String(u.id)===String(currentUser.id))){store.manager=currentUser.id;localStorage.setItem('wapi_v36_invoice_manager',store.manager);}
  }

  // Les champs documentaires sont interprétés par invoice_document.js.
  const previousStrictExtractor=window.extractInvoiceFieldsV19||window.extractInvoiceFieldsV13;
  function strictInvoiceExtract(text,fileName=''){
    const base=typeof previousStrictExtractor==='function'?previousStrictExtractor(text,fileName)||{}:{};
    const fields={...base,...window.WapiInvoiceDocument.extract(text,fileName)},file=String(fileName||'').trim(),bare=file.replace(/\.[^.]+$/,'');
    fields.ocr_warnings=[...(fields.ocr_warnings||[])];
    if(fields.reference&&(/\.(?:pdf|png|jpe?g|tiff?|webp)$/i.test(fields.reference)||norm(fields.reference)===norm(file)||norm(fields.reference)===norm(bare))){fields.reference='';fields.ocr_warnings.push('Le numéro proposé venait du nom du fichier, pas du PDF.');}
    return fields;
  }
  window.extractInvoiceFieldsV19=strictInvoiceExtract;
  window.extractInvoiceFieldsV13=strictInvoiceExtract;
  if(window.WapiOcrV349?.analyze){
    const previousSupplyAnalyze=window.WapiOcrV349.analyze;
    window.WapiOcrV349.analyze=function(text,options={}){const result=previousSupplyAnalyze.apply(this,arguments)||{fields:{}};result.fields={...(result.fields||{}),...strictInvoiceExtract(text,options.fileName||'')};return result;};
  }
  const previousSimpleExtractor=window.extractSimpleFieldsFromText;
  window.extractSimpleFieldsFromText=function(text,fileName,type){return type==='invoice'?strictInvoiceExtract(text,fileName):previousSimpleExtractor.apply(this,arguments);};

  function duplicateFor(q){
    const d=values(q),ref=norm(d.reference),cid=qCopro(q),sid=qSupplier(q);if(!ref||!cid||!sid)return null;
    return (state.invoices||[]).find(inv=>String(inv.copro_id)===String(cid)&&String(inv.supplier_id)===String(sid)&&norm(inv.invoice_number)===ref)||null;
  }
  function bucket(q){
    /* Un rejet est définitif dans le workflow : il prime sur une ancienne
       détection de doublon ou une erreur mémorisée. */
    if(q.status==='rejected'||q.workflow_bucket==='rejected')return 'rejected';
    if(q.processing_error||q.workflow_bucket==='errors'||q.status==='error')return 'errors';
    if(q.duplicate_of||duplicateFor(q))return 'duplicates';
    if(q.status==='validated'||q.workflow_bucket==='posted')return 'posted';
    if(q.status==='to_validate'||q.workflow_bucket==='to_validate')return 'to_validate';
    return 'to_process';
  }
  function allInvoiceQueues(){return (state.validationQueue||[]).filter(q=>(q.target_type||item(q).import_type)==='invoice');}
  function managerRows(){const allowed=allowedCoproIds();return allInvoiceQueues().filter(q=>!store.manager||allowed.has(String(qCopro(q))));}
  function visibleRows(){return managerRows().filter(q=>bucket(q)===store.tab).filter(q=>!store.copro||String(qCopro(q))===String(store.copro)).filter(q=>{if(!store.search)return true;const d=values(q),i=item(q),s=supplier(qSupplier(q)),c=copro(qCopro(q));return norm([i.file_name,d.reference,d.amount,d.description,s?.name,c?.name].join(' ')).includes(norm(store.search));});}
  function counts(){const out={};tabs.forEach(([id])=>out[id]=0);managerRows().forEach(q=>out[bucket(q)]++);return out;}

  function quality(q){
    const d=values(q),cid=qCopro(q),sid=qSupplier(q),missing=[];
    if(!cid)missing.push('copropriété');if(!sid)missing.push('fournisseur');if(!d.account_id)missing.push('compte comptable');if(!d.reference)missing.push('numéro');if(!d.date)missing.push('date');if(!(Number(d.amount)>0))missing.push('TVAC');
    const warnings=[...(d.ocr_warnings||[])];
    if(d.reference&&/\.(?:pdf|png|jpe?g|tiff?|webp)$/i.test(String(d.reference)))warnings.push('Le numéro de facture ressemble à un nom de fichier.');
    return {missing,warnings,amountMismatch:d.amount_check==='mismatch',unlinked:!!(cid&&sid&&!linked(cid,sid)),ready:!missing.length&&!warnings.length};
  }
  function statusInfo(q){const b=bucket(q),map={to_process:['À traiter','warn'],to_validate:['Prête','ok'],posted:['Comptabilisée','ok'],errors:['Erreur','danger'],duplicates:['Doublon','danger'],rejected:['Rejetée','']};return map[b]||map.to_process;}
  function accountOptions(selected){return '<option value="">Choisir…</option>'+(state.accounts||[]).filter(a=>a.active!==false).map(a=>`<option value="${a.id}" ${String(a.id)===String(selected)?'selected':''}>${esc(`${a.code||''} — ${a.label||''}`)}</option>`).join('');}
  function supplierOptions(cid,selected){
    const ids=new Set(store.links.filter(l=>l.active!==false&&String(l.copro_id)===String(cid)).map(l=>String(l.supplier_id)));
    return '<option value="">Choisir…</option>'+(state.suppliers||[]).filter(s=>s.active!==false&&(ids.has(String(s.id))||String(s.id)===String(selected))).map(s=>`<option value="${s.id}" ${String(s.id)===String(selected)?'selected':''}>${esc(s.name)}${!ids.has(String(s.id))?' — à associer':''}</option>`).join('');
  }

  function render(){
    const view=$('invoiceOcrView'),host=$('invoiceOcrWorkbench');if(!view||!host)return;
    view.classList.add('v36-shell');
    const oldFilters=view.querySelector('.list-filters'),notice=view.querySelector('.notice');if(oldFilters)oldFilters.style.display='none';if(notice)notice.style.display='none';
    const oldToolbar=view.querySelector(':scope > .card > .toolbar');if(oldToolbar)oldToolbar.style.display='none';
    let shell=$('v36InvoiceShell');if(!shell){host.innerHTML='<div id="v36InvoiceShell"></div>';shell=$('v36InvoiceShell');}
    const count=counts(),rows=visibleRows();
    if(rows.length&&!rows.some(q=>String(q.id)===String(state.ocrSelectedQueueId)))state.ocrSelectedQueueId=rows[0].id;
    if(!rows.length)state.ocrSelectedQueueId='';
    const selected=rows.find(q=>String(q.id)===String(state.ocrSelectedQueueId))||null;
    shell.innerHTML=`<div class="v36-head"><div><h2>Centre de traitement des factures</h2><p>Contrôle, validation et archive comptable dans une seule vue.</p></div><div class="actions-inline"><button class="btn secondary" id="v36Profiles">EAN et compteurs</button><button class="btn secondary" id="v36Import">Importer</button><button class="btn secondary" id="v36Refresh">Actualiser</button></div></div>
      <div class="v36-tabs">${tabs.map(([id,label])=>`<button class="v36-tab ${store.tab===id?'active':''}" data-v36-tab="${id}">${label}<b>${count[id]||0}</b></button>`).join('')}</div>
      <div class="v36-filters"><label>Gestionnaire<select id="v36Manager"><option value="">Tous les gestionnaires</option>${(state.userProfiles||[]).filter(u=>u.active!==false).map(u=>`<option value="${u.id}" ${String(store.manager)===String(u.id)?'selected':''}>${esc(u.display_name||u.email)}</option>`).join('')}</select></label><label>Copropriété<select id="v36Copro"><option value="">Toutes les copropriétés du gestionnaire</option>${allowedCopros().map(c=>`<option value="${c.id}" ${String(store.copro)===String(c.id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Recherche<input id="v36Search" value="${esc(store.search)}" placeholder="Fournisseur, facture, montant, copropriété…"></label></div>
      ${store.manager&&!allowedCopros().length?`<div class="notice">Aucune copropriété n’est attribuée à ${esc(profileName(store.manager))}. Attribue-lui une copropriété dans les réglages copro.</div>`:`<div class="v36-workbench">${renderList(rows)}${selected?renderPreview(selected)+renderFields(selected,rows):'<div class="v36-pane v36-empty">Aucune facture dans ce filtre.</div>'}</div>`}`;
  }
  function bulkEligible(q){return ['to_process','to_validate'].includes(bucket(q))&&quality(q).ready&&!duplicateFor(q);}
  function selectedRows(){return visibleRows().filter(q=>store.selected.has(String(q.id))&&bulkEligible(q));}
  function renderList(rows){
    const eligible=rows.filter(bulkEligible),selected=eligible.filter(q=>store.selected.has(String(q.id))),all=eligible.length&&selected.length===eligible.length;
    return `<div class="v36-pane"><div class="v36-pane-head v36-list-head"><div><strong>${rows.length} facture(s)</strong><small>${esc(tabs.find(x=>x[0]===store.tab)?.[1]||'')}</small></div>${eligible.length?`<label class="v36-check-all"><input id="v36SelectVisible" type="checkbox" ${all?'checked':''}> Tout cocher</label>`:''}</div>${selected.length?`<div class="v36-bulkbar"><span>${selected.length} prête(s)</span><button class="btn small" id="v36BulkValidate">Valider la sélection</button><button class="btn secondary small" id="v36ClearSelection">Effacer</button></div>`:''}<div class="v36-list">${rows.map(q=>{const d=values(q),i=item(q),s=supplier(qSupplier(q)),c=copro(qCopro(q)),[label,cls]=statusInfo(q),qa=quality(q),canBulk=bulkEligible(q);return `<div class="v36-row ${String(q.id)===String(state.ocrSelectedQueueId)?'active':''}">${canBulk?`<label class="v36-row-check" title="Sélectionner pour validation multiple"><input type="checkbox" data-v36-select="${q.id}" ${store.selected.has(String(q.id))?'checked':''}></label>`:'<span class="v36-row-check"></span>'}<button class="v36-row-open" data-v36-open="${q.id}"><strong>${esc(s?.name||d.supplier_name_guess||'Fournisseur non reconnu')}</strong><small>${esc(c?.name||'Copropriété non reconnue')} · ${esc(d.reference||i.file_name||'N° manquant')}</small><div class="v36-row-meta"><span>${d.amount?money(d.amount):'Montant ?'}</span><span class="v36-status ${qa.missing.length||qa.warnings.length?'danger':cls}">${qa.missing.length?`${qa.missing.length} manque(nt)`:qa.warnings.length?'À vérifier':label}</span></div></button></div>`;}).join('')||'<div class="v36-empty">Aucune facture.</div>'}</div></div>`;
  }
  function previewUrl(q,i,raw){
    const source=raw.file_data_url||i.file_data_url||q?.compta_import_items?.raw_data?.file_data_url||'';
    if(!source)return '';
    if(!source.startsWith('data:'))return source;
    const key=String(i.id||q.item_id||q.id);
    if(previewUrls.has(key))return previewUrls.get(key);
    try{
      const comma=source.indexOf(','),meta=source.slice(5,comma),body=source.slice(comma+1),mime=(meta.split(';')[0]||'application/pdf'),binary=meta.includes(';base64')?atob(body):decodeURIComponent(body),bytes=new Uint8Array(binary.length);
      for(let n=0;n<binary.length;n++)bytes[n]=binary.charCodeAt(n);
      const url=URL.createObjectURL(new Blob([bytes],{type:mime}));previewUrls.set(key,url);return url;
    }catch(error){console.warn('Aperçu PDF impossible',error);return source;}
  }
  function renderPreview(q){const i=item(q),raw=i.raw_data||q.compta_import_items?.raw_data||{},url=previewUrl(q,i,raw),mime=i.mime_type||raw.mime_type||String(raw.file_data_url||'').slice(5,50),name=String(i.file_name||'');const image=/^image\//i.test(mime)||/\.(png|jpe?g|webp|gif)$/i.test(name);const content=url?(image?`<img src="${url}" alt="Facture">`:`<iframe src="${url}#toolbar=1&navpanes=0" title="Facture"></iframe>`):'<div class="v36-empty"><strong>PDF non disponible dans cet import</strong><br>Le fichier n’a pas été enregistré dans la ligne d’import. Réimporte-le pour rattacher le document.</div>';return `<div class="v36-pane"><div class="v36-pane-head"><strong>${esc(i.file_name||'Facture')}</strong><button class="btn secondary small" id="v36Analyze">Ré-analyser</button></div><div class="v36-preview">${content}</div></div>`;}
  function renderFields(q,rows=visibleRows()){
    const d=values(q),cid=qCopro(q),sid=qSupplier(q),qa=quality(q),isPosted=bucket(q)==='posted',suggestedYear=fiscalYearFor(cid,d.date),fiscalYearId=d.fiscal_year_id||suggestedYear?.id||'',preference=preferenceFor({...d,copro_id:cid,supplier_id:sid}),monthlyLabel=d.recurring_label_mode==='invoice_month'||preference?.description_mode==='invoice_month',cOptions='<option value="">Choisir…</option>'+allowedCopros().map(c=>`<option value="${c.id}" ${String(c.id)===String(cid)?'selected':''}>${esc(c.name)}</option>`).join('');
    const summary=qa.missing.length?`${qa.missing.length} champ(s) obligatoire(s) à corriger`:qa.amountMismatch?'Montants incohérents':qa.unlinked?'Fournisseur à associer à la copropriété':'Contrôles essentiels réussis';
    return `<div class="v36-pane v36-fields-pane"><div class="v36-pane-head"><strong>Données de la facture</strong><span class="v36-status ${qa.missing.length||qa.amountMismatch?'danger':qa.unlinked?'warn':'ok'}">${isPosted?'Comptabilisée':qa.ready?'Prête':'À vérifier'}</span></div><div class="v36-pane-body v36-fields"><div class="v36-quality ${qa.missing.length||qa.amountMismatch?'danger':qa.unlinked?'warn':''}"><strong>${esc(summary)}</strong><small>${qa.missing.length?'Manque : '+qa.missing.join(', '):qa.amountMismatch?'HTVA + TVA doit correspondre au TVAC.':qa.unlinked?'La fiche fournisseur existe déjà : associe-la sans la recréer.':'Tu peux enregistrer ou valider.'}</small></div>
      <div class="v36-field-grid">
        ${field('Copropriété',`<select id="v36FieldCopro">${cOptions}</select>`,!cid,'Sélection obligatoire')}
        ${field('Fournisseur',`<select id="v36FieldSupplier">${supplierOptions(cid,sid)}</select>`,!sid,'Choisis ou crée un fournisseur',qa.unlinked)}
        ${field('Compte comptable',`<select id="v36FieldAccount">${accountOptions(d.account_id||'')}</select>`,!d.account_id,'Compte obligatoire')}
        ${field('Numéro de facture',`<input id="v36FieldReference" value="${esc(d.reference||'')}">`,!d.reference,'Numéro manquant')}
        ${field('Communication structurée',`<input id="v36FieldCommunication" value="${esc(d.structured_communication||'')}" placeholder="+++123/1234/12345+++">`,false,'')}
        ${field('Date facture',`<input id="v36FieldDate" type="date" value="${esc(d.date||'')}">`,!d.date,'Date manquante')}
        ${field('Exercice comptable',`<select id="v36FieldFiscalYear">${fiscalYearOptions(cid,fiscalYearId)}</select>`,false,'')}
        ${field('Échéance',`<input id="v36FieldDue" type="date" value="${esc(d.due_date||'')}">`,false,'')}
        ${field('Montant TVAC',`<input id="v36FieldTotal" type="number" step="0.01" value="${esc(d.amount||'')}">`,!(Number(d.amount)>0),'TVAC obligatoire',qa.amountMismatch)}
        ${field('Taux TVA',`<input id="v36FieldRate" type="number" step="0.01" value="${esc(d.vat_rate??'')}">`,false,'')}
      </div>
      ${qa.warnings.length?`<div class="notice"><strong>Reconnaissance à vérifier</strong><ul>${qa.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}
      ${d.ocr_evidence?`<details><summary>Texte utilisé pour reconnaître les champs</summary>${[['amount','Montant'],['date','Date facture'],['due_date','Échéance']].filter(([key])=>d.ocr_evidence[key]).map(([key,label])=>`<p><strong>${label} :</strong> ${esc(d.ocr_evidence[key])}</p>`).join('')}</details>`:''}
      <div class="v36-tax-calculation" id="v36TaxCalculation">${taxCalculationHtml(d.amount,d.vat_rate)}</div>
      <div class="v36-supplier-actions">${supplierActions(cid,sid)}</div>
      <label class="v36-block-label"><input id="v36MonthlyLabel" type="checkbox" ${monthlyLabel?'checked':''}> Libellé mensuel automatique${d.date?` <small>(${esc(monthLabel(d.date))})</small>`:''}</label>
      <label class="v36-block-label">Libellé interne<textarea id="v36FieldDescription">${esc(d.description||'')}</textarea></label>
      <label class="v36-block-label"><input id="v36KeepPreferences" type="checkbox" ${preference||d.keep_recurring_preferences?'checked':''}> Garder les préférences pour les prochaines factures <small>(même copropriété et même fournisseur)</small></label>
      <label class="v36-block-label">Note de traitement<textarea id="v36FieldNotes">${esc(d.notes||q.notes||'')}</textarea></label>
      ${q.processing_error?`<div class="notice danger"><strong>Erreur :</strong> ${esc(q.processing_error)}</div>`:''}
      <div class="v36-actions"><button class="btn secondary" id="v36Previous" ${rows.length<2?'disabled':''}>← Précédente</button><button class="btn secondary" id="v36Next" ${rows.length<2?'disabled':''}>Suivante →</button><button class="btn secondary" id="v36Save" ${isPosted?'disabled':''}>Enregistrer</button><button class="btn" id="v36Validate" ${isPosted?'disabled':''}>Valider et comptabiliser</button><button class="btn" id="v36ValidateNext" ${isPosted?'disabled':''}>Valider + suivante</button><button class="btn danger" id="v36Reject" ${isPosted?'disabled':''}>Rejeter</button></div></div></div>`;
  }
  function field(label,control,missing,hint,warning=false){return `<label class="${missing?'v36-field-error':warning?'v36-field-warning':''}">${label}${control}${missing||warning?`<span class="v36-field-hint">${esc(hint||'À vérifier')}</span>`:''}</label>`;}
  function supplierActions(cid,sid){
    if(!cid)return '<strong>Fournisseur</strong><small>Choisis d’abord la copropriété.</small>';
    if(sid&&!linked(cid,sid))return `<strong>${esc(supplier(sid)?.name||'Fournisseur existant')}</strong><small>Ce fournisseur global n’est pas encore associé à cette copropriété.</small><div class="actions-inline"><button class="btn small" id="v36LinkSupplier">Ajouter à la copro</button><button class="btn secondary small" id="v36ChooseSupplier">Choisir dans le répertoire global</button><button class="btn secondary small" id="v36CreateSupplier">Nouveau fournisseur</button></div>`;
    return `<strong>${sid?esc(supplier(sid)?.name||'Fournisseur'):'Aucun fournisseur sélectionné'}</strong><small>${sid?'Fournisseur déjà associé à cette copropriété.':'Choisis une fiche globale existante ou crée-en une.'}</small><div class="actions-inline"><button class="btn secondary small" id="v36ChooseSupplier">Répertoire global</button><button class="btn secondary small" id="v36CreateSupplier">Nouveau fournisseur</button></div>`;
  }

  function calculatedTaxes(total,rate){if(rate===null||rate===undefined||rate==='')return {ht:null,vat:null};const t=Number(total||0),r=Math.max(0,Number(rate));if(!(t>0))return {ht:null,vat:null};const ht=Number((t/(1+r/100)).toFixed(2)),vat=Number((t-ht).toFixed(2));return {ht,vat};}
  function taxCalculationHtml(total,rate){const x=calculatedTaxes(total,rate);return `<div><span>Montant HTVA calculé</span><strong>${x.ht===null?'—':money(x.ht)}</strong></div><div><span>TVA calculée</span><strong>${x.vat===null?'—':money(x.vat)}</strong></div><div><span>Montant TVAC</span><strong>${Number(total)>0?money(total):'—'}</strong></div>`;}
  function readForm(){
    const q=selectedQ(),old=q?values(q):{},rawAmount=$('v36FieldTotal')?.value,rawRate=$('v36FieldRate')?.value;
    const amount=rawAmount?Number(rawAmount):null,vat_rate=rawRate!==''&&rawRate!=null?Number(rawRate):null;
    const changed=String(amount??'')!==String(old.amount??'')||String(vat_rate??'')!==String(old.vat_rate??'');
    const numeric=v=>v===null||v===undefined||v===''?null:Number(v);
    const tax=changed?calculatedTaxes(amount,vat_rate):{ht:numeric(old.amount_excl_vat),vat:numeric(old.vat_amount)};
    const date=$('v36FieldDate')?.value||null,monthly=$('v36MonthlyLabel')?.checked;
    return {copro_id:$('v36FieldCopro')?.value||null,supplier_id:$('v36FieldSupplier')?.value||null,account_id:$('v36FieldAccount')?.value||null,fiscal_year_id:$('v36FieldFiscalYear')?.value||null,fiscal_year_manual:old.fiscal_year_manual===true,reference:$('v36FieldReference')?.value.trim()||null,structured_communication:$('v36FieldCommunication')?.value.trim()||null,date,due_date:$('v36FieldDue')?.value||null,amount_excl_vat:tax.ht,vat_amount:tax.vat,amount,vat_rate,recurring_label_mode:monthly?'invoice_month':'manual',keep_recurring_preferences:!!$('v36KeepPreferences')?.checked,description:monthly?monthLabel(date):$('v36FieldDescription')?.value.trim()||null,notes:$('v36FieldNotes')?.value.trim()||null};
  }
  function selectedQ(){return allInvoiceQueues().find(q=>String(q.id)===String(state.ocrSelectedQueueId));}
  function patchQueue(id,patch){const idx=state.validationQueue.findIndex(q=>String(q.id)===String(id));if(idx>=0)state.validationQueue[idx]={...state.validationQueue[idx],...patch};}
  function invoicePayload(q,d){const i=item(q),raw=i.raw_data||{},fiscalYearId=d.fiscal_year_id||fiscalYearFor(d.copro_id,d.date)?.id||null;return {copro_id:d.copro_id,supplier_id:d.supplier_id,account_id:d.account_id,fiscal_year_id:fiscalYearId,structured_communication:d.structured_communication||null,distribution_key_id:d.distribution_key_id||null,charge_target:d.charge_target||'common_owner',supply_profile_id:d.supply_profile_id||null,invoice_number:d.reference,invoice_date:d.date,due_date:d.due_date,amount_total:Number(d.amount),vat_rate:d.vat_rate,vat_amount:d.vat_amount,status:'validated',payment_status:'unpaid',description:d.description||`Importé depuis ${i.file_name||'OCR'}`,source:'processing_center',file_name:i.file_name||null,file_data_url:raw.file_data_url||null,pdf_mime_type:i.mime_type||raw.mime_type||null,ocr_confidence:i.confidence||null,ocr_text:i.raw_text||null,ocr_source_item_id:i.id||null,ocr_raw_json:{extracted:q.extracted_data||{},corrected:d,raw_data:raw},created_by:currentUser.id};}
  async function saveRecurringPreference(d){
    if(!d.keep_recurring_preferences)return;
    if(!d.copro_id||!d.supplier_id||!d.account_id)throw new Error('Choisis la copropriété, le fournisseur et le compte avant de mémoriser les préférences.');
    const previous=preferenceFor(d),payload={copro_id:d.copro_id,supplier_id:d.supplier_id,account_id:d.account_id,description_mode:d.recurring_label_mode==='invoice_month'?'invoice_month':'manual',active:true,updated_at:new Date().toISOString(),created_by:previous?.created_by||currentUser.id};
    const result=previous?await supabaseClient.from('compta_invoice_encoding_preferences').update(payload).eq('id',previous.id).select('*').single():await supabaseClient.from('compta_invoice_encoding_preferences').insert(payload).select('*').single();
    if(result.error)throw result.error;
    if(previous)Object.assign(previous,result.data||payload);else if(result.data)store.preferences.push(result.data);
  }
  function moveRelative(step){const rows=visibleRows(),index=rows.findIndex(q=>String(q.id)===String(state.ocrSelectedQueueId));if(index<0||rows.length<2)return;state.ocrSelectedQueueId=rows[(index+step+rows.length)%rows.length].id;render();}
  async function bulkValidate(){
    if(store.busy)return;const rows=selectedRows();if(!rows.length)return alert('Sélectionne au moins une facture prête.');
    const seen=new Set(),failures=[],done=[];store.busy=true;
    for(const q of rows){
      const d=values(q),key=[d.copro_id,d.supplier_id,norm(d.reference)].join('|');
      if(seen.has(key)||duplicateFor(q)){failures.push(`${item(q).file_name||d.reference} : doublon potentiel`);continue;}seen.add(key);
      try{
        if(!await ensureLink(d.copro_id,d.supplier_id,'ocr'))throw new Error('association fournisseur impossible');
        const created=await supabaseClient.from('compta_invoices').insert(invoicePayload(q,d)).select('*').single();if(created.error)throw created.error;
        const posted={status:'validated',workflow_bucket:'posted',validated_by:currentUser.id,validated_at:new Date().toISOString()};
        const updated=await supabaseClient.from('compta_validation_queue').update(posted).eq('id',q.id);if(updated.error)throw updated.error;
        const itemUpdated=await supabaseClient.from('compta_import_items').update({status:'validated'}).eq('id',q.item_id);if(itemUpdated.error)throw itemUpdated.error;
        state.invoices.push(created.data);patchQueue(q.id,posted);const local=item(q);local.status='validated';store.selected.delete(String(q.id));done.push(q);
      }catch(error){failures.push(`${item(q).file_name||d.reference} : ${error.message||error}`);}
    }
    store.busy=false;render();alert(`${done.length} facture(s) comptabilisée(s).${failures.length?`\n\nÀ corriger :\n${failures.join('\n')}`:''}`);
  }
  async function save(validate=false,advance=false){
    const q=selectedQ();if(!q)return;const tabBefore=store.tab,d={...values(q),...readForm()},qa={missing:[]};
    const rowsBefore=visibleRows(),position=rowsBefore.findIndex(x=>String(x.id)===String(q.id)),nextId=rowsBefore[position+1]?.id||rowsBefore[position-1]?.id||'';
    if(validate){if(!d.copro_id)qa.missing.push('copropriété');if(!d.supplier_id)qa.missing.push('fournisseur');if(!d.account_id)qa.missing.push('compte');if(!d.reference)qa.missing.push('numéro');if(!d.date)qa.missing.push('date');if(!(d.amount>0))qa.missing.push('montant');if(qa.missing.length)return alert('Complète : '+qa.missing.join(', '));}
    if(validate&&d.ocr_warnings?.length&&!confirm('Des points restent à vérifier sur le PDF :\n\n'+d.ocr_warnings.join('\n')+'\n\nConfirmez-vous avoir vérifié et corrigé les données affichées ?'))return;
    const status=validate?'to_validate':(d.copro_id&&d.supplier_id&&d.account_id&&d.reference&&d.date&&d.amount>0?'to_validate':'to_verify');
    const {error}=await supabaseClient.from('compta_validation_queue').update({copro_id:d.copro_id,corrected_data:d,notes:d.notes,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null}).eq('id',q.id);if(error)return alert(error.message);
    patchQueue(q.id,{copro_id:d.copro_id,corrected_data:d,notes:d.notes,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null});
    try{await saveRecurringPreference(d);}catch(error){return alert('Facture enregistrée, mais les préférences n’ont pas pu être mémorisées : '+(error.message||error));}
    if(!validate){render();return;}
    if(!await ensureLink(d.copro_id,d.supplier_id,'ocr'))return;
    const i=item(q),raw=i.raw_data||{};
    const created=await supabaseClient.from('compta_invoices').insert(invoicePayload(q,d)).select('*').single();if(created.error){await supabaseClient.from('compta_validation_queue').update({processing_error:created.error.message,workflow_bucket:'errors'}).eq('id',q.id);patchQueue(q.id,{processing_error:created.error.message,workflow_bucket:'errors'});store.tab='errors';render();return alert(created.error.message);}
    await supabaseClient.from('compta_validation_queue').update({status:'validated',workflow_bucket:'posted',validated_by:currentUser.id,validated_at:new Date().toISOString()}).eq('id',q.id);
    await supabaseClient.from('compta_import_items').update({status:'validated'}).eq('id',q.item_id);
    state.invoices.push(created.data);patchQueue(q.id,{status:'validated',workflow_bucket:'posted',validated_at:new Date().toISOString()});i.status='validated';store.selected.delete(String(q.id));store.tab=advance?tabBefore:'to_process';state.ocrSelectedQueueId=advance?nextId:'';render();
  }
  async function ensureLink(cid,sid,source='manual'){if(!cid||!sid||linked(cid,sid))return true;let existing=store.links.find(x=>String(x.copro_id)===String(cid)&&String(x.supplier_id)===String(sid));if(!existing){const lookup=await supabaseClient.from('compta_copro_suppliers').select('*').eq('copro_id',cid).eq('supplier_id',sid).maybeSingle();if(!lookup.error&&lookup.data){existing=lookup.data;store.links.push(existing);}}const req=existing?supabaseClient.from('compta_copro_suppliers').update({active:true,source,updated_at:new Date().toISOString()}).eq('id',existing.id).select('*').single():supabaseClient.from('compta_copro_suppliers').insert({copro_id:cid,supplier_id:sid,active:true,source,created_by:currentUser.id}).select('*').single();const r=await req;if(r.error){alert(r.error.message);return false;}if(existing){existing.active=true;existing.source=source;}else if(r.data)store.links.push(r.data);return true;}
  async function analyze(){
    const q=selectedQ();if(!q||store.busy||bucket(q)==='posted')return;
    const current={...values(q),...readForm()};
    store.busy=true;
    const progress=message=>{const button=$('v36Analyze');if(button){button.disabled=true;button.textContent=message;}};
    progress('Lecture du document…');
    try{
      let i=item(q);
      if(!i.raw_data?.file_data_url&&q.item_id){
        const loaded=await supabaseClient.from('compta_import_items').select('*').eq('id',q.item_id).single();
        if(loaded.error)throw loaded.error;
        i=loaded.data;
      }
      const raw=i.raw_data||{},dataUrl=raw.file_data_url||i.file_data_url||'';
      let text=i.raw_text||'';
      let documentWarnings=[];const diagnostics=d=>{documentWarnings=d.warnings||[];};
      if(dataUrl){
        const response=await fetch(dataUrl);if(!response.ok)throw new Error('Le fichier PDF est inaccessible.');
        const blob=await response.blob(),mime=i.mime_type||raw.mime_type||blob.type||'';
        if(/pdf/i.test(mime)||/\.pdf$/i.test(i.file_name||''))text=await window.WapiInvoiceDocument.readPdf(blob,{forceOcr:true,onProgress:progress,onDiagnostics:diagnostics});
        else if(/^image\//.test(mime)||/\.(png|jpe?g|webp|tiff?)$/i.test(i.file_name||''))text=await window.WapiInvoiceDocument.readImage(blob,{onProgress:n=>progress('Reconnaissance : '+n+' %'),onDiagnostics:diagnostics});
      }
      if(!text.trim())throw new Error('Aucun texte lisible. Vérifiez la qualité du document ou importez un PDF plus net.');
      const extracted=strictInvoiceExtract(text,i.file_name||'');
      extracted.ocr_warnings.push(...documentWarnings);
      if(!dataUrl)extracted.ocr_warnings.push('Document source absent : seule une nouvelle interprétation du texte conservé a été possible.');
      const next=window.WapiInvoiceDocument.mergeAnalysis(q.extracted_data||{},current,extracted);
      const sd=typeof detectSupplierFromText==='function'?detectSupplierFromText(text):{};
      const cd=typeof detectCoproFromText==='function'?detectCoproFromText(text):{};
      if(!next.supplier_id&&sd.supplier)next.supplier_id=sd.supplier.id;
      if(!next.copro_id&&cd.copro)next.copro_id=cd.copro.id;
      if(!next.fiscal_year_manual)next.fiscal_year_id=fiscalYearFor(next.copro_id,next.date)?.id||null;
      Object.assign(next,applyPreference(next));
      const status=next.copro_id&&next.supplier_id&&next.account_id&&next.reference&&next.date&&Number(next.amount)>0&&!next.ocr_warnings?.length?'to_validate':'to_verify';
      const rawData={...raw,extracted,ocr_mode:'document-36.10.3',ocr_text_length:text.length};
      const savedItem=await supabaseClient.from('compta_import_items').update({raw_text:text,raw_data:rawData}).eq('id',q.item_id);
      if(savedItem.error)throw savedItem.error;
      const patch={extracted_data:extracted,corrected_data:next,copro_id:next.copro_id||null,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null,last_analysis_at:new Date().toISOString(),analysis_attempts:Number(q.analysis_attempts||0)+1};
      const result=await supabaseClient.from('compta_validation_queue').update(patch).eq('id',q.id);
      if(result.error)throw result.error;
      Object.assign(i,{raw_text:text,raw_data:rawData});
      const local=(state.importItems||[]).find(x=>String(x.id)===String(i.id));if(local)Object.assign(local,i);else(state.importItems||=[]).push(i);
      patchQueue(q.id,patch);
    }catch(error){alert('Analyse impossible : '+(error.message||error));}
    finally{store.busy=false;render();}
  }

  function chooseSupplier(){const q=selectedQ(),d=readForm(),cid=d.copro_id||qCopro(q);if(!cid)return alert('Choisis d’abord la copropriété.');const body=`<div class="popup-form"><div class="notice">Tous les fournisseurs globaux sont disponibles, même s’ils ne sont pas encore associés à cette copropriété.</div><label>Rechercher<input id="v36SupplierSearch" placeholder="Nom, code, TVA…"></label><div id="v36SupplierResults" class="v359-manage-grid"></div></div>`;openAppModal('Répertoire global des fournisseurs',body,'<button class="btn secondary" data-modal-close>Annuler</button>',{size:'wide'});const draw=()=>{const needle=norm($('v36SupplierSearch')?.value);$('v36SupplierResults').innerHTML=(state.suppliers||[]).filter(s=>s.active!==false&&(!needle||norm([s.name,s.supplier_code,s.vat_number].join(' ')).includes(needle))).slice(0,80).map(s=>`<button class="v359-copro-link ${linked(cid,s.id)?'is-linked':''}" data-v36-use-supplier="${s.id}"><span><strong>${esc(s.name)}</strong><small>${esc(s.supplier_code||s.vat_number||'')}</small></span><span>${linked(cid,s.id)?'Déjà associé':'Ajouter'}</span></button>`).join('')||'<div class="notice">Aucun résultat.</div>';};draw();$('v36SupplierSearch').oninput=draw;document.querySelectorAll('[data-v36-use-supplier]').forEach(()=>{});$('v36SupplierResults').onclick=async e=>{const b=e.target.closest('[data-v36-use-supplier]');if(!b)return;await ensureLink(cid,b.dataset.v36UseSupplier,'ocr');const old=values(q),next={...old,copro_id:cid,supplier_id:b.dataset.v36UseSupplier};await supabaseClient.from('compta_validation_queue').update({copro_id:cid,corrected_data:next}).eq('id',q.id);patchQueue(q.id,{copro_id:cid,corrected_data:next});closeAppModal();render();};}
  function createSupplier(){const q=selectedQ(),d=readForm(),cid=d.copro_id||qCopro(q);if(!cid)return alert('Choisis d’abord la copropriété.');openAppModal('Nouveau fournisseur',`<div class="popup-form"><div class="notice">Une seule fiche globale sera créée puis associée à ${esc(copro(cid)?.name||'la copropriété')}.</div><div class="form-grid"><label>Nom<input id="v36NewSupplierName"></label><label>N° TVA<input id="v36NewSupplierVat"></label><label>E-mail<input id="v36NewSupplierEmail" type="email"></label><label>IBAN<input id="v36NewSupplierIban"></label></div></div>`,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="v36SaveSupplier">Créer et utiliser</button>`,{size:'wide'});$('v36SaveSupplier').onclick=async()=>{const name=$('v36NewSupplierName').value.trim();if(!name)return alert('Indique le nom.');const existing=(state.suppliers||[]).find(s=>norm(s.name)===norm(name)||($('v36NewSupplierVat').value&&norm(s.vat_number)===norm($('v36NewSupplierVat').value)));if(existing){if(!confirm(`« ${existing.name} » existe déjà. Réutiliser cette fiche ?`))return;await useNewSupplier(existing);}else{const r=await supabaseClient.from('compta_suppliers').insert({name,vat_number:$('v36NewSupplierVat').value.trim()||null,email:$('v36NewSupplierEmail').value.trim()||null,iban:$('v36NewSupplierIban').value.trim()||null,active:true,created_by:currentUser.id}).select('*').single();if(r.error)return alert(r.error.message);state.suppliers.push(r.data);await useNewSupplier(r.data);}};async function useNewSupplier(s){await ensureLink(cid,s.id,'ocr');const next={...values(q),copro_id:cid,supplier_id:s.id};await supabaseClient.from('compta_validation_queue').update({copro_id:cid,corrected_data:next}).eq('id',q.id);patchQueue(q.id,{copro_id:cid,corrected_data:next});closeAppModal();render();}}
  async function reject(){const q=selectedQ();if(!q||!confirm('Rejeter cette facture ?'))return;const r=await supabaseClient.from('compta_validation_queue').update({status:'rejected',workflow_bucket:'rejected',processing_error:null,duplicate_of:null}).eq('id',q.id);if(r.error)return alert(r.error.message);patchQueue(q.id,{status:'rejected',workflow_bucket:'rejected',processing_error:null,duplicate_of:null});store.tab='rejected';localStorage.setItem('wapi_v36_invoice_tab','rejected');state.ocrSelectedQueueId=q.id;render();}

  function tierCoproId(){return state.activeCoproId||$('ownersFilterCopro')?.value||'';}
  function renderSupplierDirectory(){
    if(window.WapiTiersV364?.render)return window.WapiTiersV364.render();
    if((state.selectedIdentityType||'owner')!=='supplier')return;const host=$('ownersTable');if(!host)return;
    const cid=tierCoproId(),ids=new Set(store.links.filter(l=>l.active!==false&&(!cid||String(l.copro_id)===String(cid))).map(l=>String(l.supplier_id)));
    const rows=(state.suppliers||[]).filter(s=>s.active!==false&&(!cid||ids.has(String(s.id))));
    host.innerHTML=`<div class="v359-supplier-toolbar"><div><strong>${rows.length} fournisseur(s)</strong><div class="v359-supplier-context">${cid?`Fournisseurs attribués à ${esc(copro(cid)?.name||'la copropriété')}`:'Répertoire global des fournisseurs'}</div></div><div class="actions-inline">${cid?`<button class="btn secondary" data-v36-tier-add-existing="${cid}">Ajouter un fournisseur existant</button>`:''}<button class="btn" data-add-identity="supplier">Nouveau fournisseur</button></div></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Fournisseur</th><th>TVA</th><th>E-mail</th><th>IBAN</th><th>Copropriétés</th><th>Actions</th></tr></thead><tbody>${rows.map(s=>`<tr><td><span class="code-pill">${esc(s.supplier_code||'—')}</span></td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.vat_number||'')}</td><td>${esc(s.email||'')}</td><td>${esc(s.iban||'')}</td><td><span class="v359-link-count">${store.links.filter(l=>l.active!==false&&String(l.supplier_id)===String(s.id)).length} copro(s)</span></td><td><div class="actions-inline"><button class="btn secondary small" data-open-identity="supplier|${s.id}">Ouvrir</button><button class="btn secondary small" data-v36-manage-supplier="${s.id}">Gérer les copros</button></div></td></tr>`).join('')||`<tr><td colspan="7"><div class="notice">Aucun fournisseur attribué. Ajoute une fiche existante ou crée un nouveau fournisseur.</div></td></tr>`}</tbody></table></div>`;
  }
  function manageSupplierCopros(sid){const s=supplier(sid);if(!s)return;openAppModal('Copropriétés du fournisseur',`<div class="popup-form"><div class="notice">La fiche « ${esc(s.name)} » reste unique. Active-la uniquement dans les copropriétés où elle intervient.</div><div class="v359-manage-grid">${(state.copros||[]).filter(c=>c.active!==false).map(c=>`<label class="v359-copro-link ${linked(c.id,sid)?'is-linked':''}"><span><strong>${esc(c.name)}</strong><small>${esc(c.code||'')}</small></span><input type="checkbox" data-v36-supplier-copro="${c.id}" data-supplier="${sid}" ${linked(c.id,sid)?'checked':''}></label>`).join('')}</div></div>`,`<button class="btn" data-modal-close>Terminer</button>`,{size:'wide',subtitle:s.name});}
  function addExistingToCopro(cid){openAppModal('Ajouter un fournisseur existant',`<div class="popup-form"><div class="notice">Aucune nouvelle fiche ne sera créée.</div><label>Fournisseur<select id="v36TierExisting"><option value="">Choisir…</option>${(state.suppliers||[]).filter(s=>s.active!==false&&!linked(cid,s.id)).map(s=>`<option value="${s.id}">${esc([s.supplier_code,s.name].filter(Boolean).join(' — '))}</option>`).join('')}</select></label></div>`,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="v36TierAddConfirm">Ajouter</button>`,{size:'small',subtitle:copro(cid)?.name||''});$('v36TierAddConfirm').onclick=async()=>{const sid=$('v36TierExisting').value;if(!sid)return alert('Choisis un fournisseur.');if(await ensureLink(cid,sid,'manual')){closeAppModal();renderSupplierDirectory();}};}

  function enhanceSettings(coproId){const body=$('globalModalBody');if(!body||!$('v33CoproName')||$('v36SettingsSuppliers'))return;const cid=coproId||state.activeCoproId;if(!cid)return;const ids=new Set(store.links.filter(l=>l.active!==false&&String(l.copro_id)===String(cid)).map(l=>String(l.supplier_id))),rows=(state.suppliers||[]).filter(s=>ids.has(String(s.id)));body.insertAdjacentHTML('beforeend',`<section class="v36-settings-suppliers" id="v36SettingsSuppliers"><h3>Fournisseurs de la copropriété</h3><p class="muted-note">Les fiches restent globales. Cette liste définit uniquement les fournisseurs disponibles dans cette copropriété.</p><div class="v36-settings-list" id="v36SettingsSupplierList">${rows.map(s=>`<span class="v36-settings-chip">${esc(s.name)}<button data-v36-unlink-settings="${s.id}" title="Retirer">×</button></span>`).join('')||'<span class="muted-note">Aucun fournisseur associé.</span>'}</div><div class="actions-inline"><select id="v36SettingsSupplierSelect"><option value="">Ajouter un fournisseur existant…</option>${(state.suppliers||[]).filter(s=>s.active!==false&&!ids.has(String(s.id))).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn secondary small" id="v36SettingsAddSupplier">Ajouter</button></div></section>`);$('v36SettingsAddSupplier').onclick=async()=>{const sid=$('v36SettingsSupplierSelect').value;if(!sid)return;await ensureLink(cid,sid,'manual');$('v36SettingsSuppliers').remove();enhanceSettings(cid);};$('v36SettingsSupplierList').onclick=async e=>{const b=e.target.closest('[data-v36-unlink-settings]');if(!b)return;if(!confirm('Retirer ce fournisseur de cette copropriété ? Son historique et sa fiche globale sont conservés.'))return;const link=store.links.find(l=>String(l.copro_id)===String(cid)&&String(l.supplier_id)===String(b.dataset.v36UnlinkSettings));if(link){const r=await supabaseClient.from('compta_copro_suppliers').update({active:false,updated_at:new Date().toISOString()}).eq('id',link.id);if(r.error)return alert(r.error.message);link.active=false;}$('v36SettingsSuppliers').remove();enhanceSettings(cid);};}

  function invoiceForImport(itemId,q){
    const direct=(state.invoices||[]).find(i=>String(i.ocr_source_item_id)===String(itemId));if(direct)return direct;
    const i=item(q||{}),matches=(state.invoices||[]).filter(inv=>inv.source==='processing_center'&&inv.file_name&&inv.file_name===i.file_name&&(!q||String(inv.copro_id)===String(qCopro(q))));
    return matches.length===1?matches[0]:null;
  }
  function importHistoryStatus(i,q){const inv=invoiceForImport(i.id,q);if(inv)return {label:'Facture encodée',className:'ok',invoice:inv};if(q&&bucket(q)==='rejected')return {label:'Rejetée',className:'danger'};if(q)return {label:bucket(q)==='to_validate'?'Prête à valider':'À traiter',className:bucket(q)==='errors'?'danger':'warn'};return {label:i.status==='validated'?'Encodage introuvable':'Sans file de traitement',className:'warn'};}
  function renderImportHistory(){
    const host=$('importBatchesTable');if(!host)return;const rows=(state.importItems||[]).slice(0,200);
    host.innerHTML=`<div class="v36-history"><div class="v36-history-head"><div><strong>Historique des documents importés</strong><small>Ouvre une ligne pour poursuivre le traitement ou retrouver la facture encodée.</small></div><span>${rows.length} document(s)</span></div><div class="table-wrap"><table><thead><tr><th>Importé le</th><th>Fichier</th><th>Lot</th><th>Type</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(i=>{const q=allInvoiceQueues().find(x=>String(x.item_id)===String(i.id)),status=importHistoryStatus(i,q);return `<tr class="v36-history-row" data-v36-history-open="${esc(i.id)}" tabindex="0"><td>${i.created_at?new Date(i.created_at).toLocaleString('fr-BE'):''}</td><td><strong>${esc(i.file_name||'Document')}</strong></td><td>${esc(i.compta_import_batches?.label||'Lot manuel')}</td><td>${esc(i.import_type==='invoice'?'Facture':i.import_type||'Document')}</td><td><span class="v36-status ${status.className}">${status.label}</span></td><td><button class="btn secondary small" type="button" data-v36-history-open="${esc(i.id)}">Ouvrir</button></td></tr>`;}).join('')||'<tr><td colspan="6">Aucun document importé.</td></tr>'}</tbody></table></div></div>`;
  }
  function openImportHistory(itemId){
    const i=(state.importItems||[]).find(x=>String(x.id)===String(itemId)),q=allInvoiceQueues().find(x=>String(x.item_id)===String(itemId));if(!i)return;
    const inv=invoiceForImport(itemId,q);
    if(inv){switchToView('invoices');setTimeout(()=>document.querySelector(`[data-edit-invoice="${inv.id}"]`)?.click(),120);return;}
    if(q&&(q.target_type||i.import_type)==='invoice'){store.tab=bucket(q)==='to_validate'?'to_validate':'to_process';localStorage.setItem('wapi_v36_invoice_tab',store.tab);state.ocrSelectedQueueId=q.id;switchToView('invoiceOcr');setTimeout(render,80);return;}
    alert('Ce document ne correspond pas à une facture à traiter.');
  }
  if(typeof renderImportBatches==='function'){const previousRenderImportBatches=renderImportBatches;renderImportBatches=function(){const out=previousRenderImportBatches.apply(this,arguments);renderImportHistory();return out;};}

  window.renderInvoiceOcrV13=render;
  const previousRenderAll=window.renderAll;if(typeof previousRenderAll==='function')window.renderAll=function(){const out=previousRenderAll.apply(this,arguments);setTimeout(()=>{render();renderSupplierDirectory();},0);return out;};
  window.addEventListener('click',e=>{
    if(e.target.closest?.('[data-open-copro-settings],#activeCoproSettingsBtn,[data-v322-copro-settings]')){const b=e.target.closest('[data-open-copro-settings],#activeCoproSettingsBtn,[data-v322-copro-settings]'),cid=b?.dataset?.openCoproSettings==='active'?state.activeCoproId:(b?.dataset?.openCoproSettings||b?.dataset?.v322CoproSettings||state.activeCoproId);setTimeout(()=>enhanceSettings(cid),80);}
    if(e.target.closest?.('[data-identity-type="supplier"]'))setTimeout(renderSupplierDirectory,0);
    const manage=e.target.closest?.('[data-v36-manage-supplier]');if(manage){e.preventDefault();e.stopPropagation();manageSupplierCopros(manage.dataset.v36ManageSupplier);}
    const add=e.target.closest?.('[data-v36-tier-add-existing]');if(add){e.preventDefault();e.stopPropagation();addExistingToCopro(add.dataset.v36TierAddExisting);}
    if(e.target.closest?.('#modalSaveIdentityBtn')&&(state.selectedIdentityType||'owner')==='supplier'&&tierCoproId()){
      const cid=tierCoproId(),id=state.selectedIdentityId||'',name=$('modalIdentityName')?.value.trim()||'';
      setTimeout(async()=>{const s=id?supplier(id):(state.suppliers||[]).find(x=>norm(x.name)===norm(name));if(s&&!linked(cid,s.id)){await ensureLink(cid,s.id,'manual');renderSupplierDirectory();}},1200);
    }
  },true);
  document.addEventListener('click',e=>{const t=e.target.closest?.('[data-v36-tab],[data-v36-open],[data-v36-history-open],#v36Profiles,#v36Import,#v36Refresh,#v36Save,#v36Validate,#v36ValidateNext,#v36Previous,#v36Next,#v36BulkValidate,#v36ClearSelection,#v36Reject,#v36Analyze,#v36ChooseSupplier,#v36CreateSupplier,#v36LinkSupplier');if(!t)return;e.preventDefault();e.stopImmediatePropagation();if(t.dataset.v36HistoryOpen){openImportHistory(t.dataset.v36HistoryOpen);}else if(t.dataset.v36Tab){store.tab=t.dataset.v36Tab;localStorage.setItem('wapi_v36_invoice_tab',store.tab);state.ocrSelectedQueueId='';render();}else if(t.dataset.v36Open){state.ocrSelectedQueueId=t.dataset.v36Open;render();}else if(t.id==='v36Profiles')$('v349ProfilesBtn')?.click();else if(t.id==='v36Import')switchToView('processing');else if(t.id==='v36Refresh')refresh();else if(t.id==='v36Save')save(false);else if(t.id==='v36Validate')save(true);else if(t.id==='v36ValidateNext')save(true,true);else if(t.id==='v36Previous')moveRelative(-1);else if(t.id==='v36Next')moveRelative(1);else if(t.id==='v36BulkValidate')bulkValidate();else if(t.id==='v36ClearSelection'){store.selected.clear();render();}else if(t.id==='v36Reject')reject();else if(t.id==='v36Analyze')analyze();else if(t.id==='v36ChooseSupplier')chooseSupplier();else if(t.id==='v36CreateSupplier')createSupplier();else if(t.id==='v36LinkSupplier'){const d=readForm();ensureLink(d.copro_id,d.supplier_id,'ocr').then(render);}},true);
  document.addEventListener('change',e=>{if(e.target.id==='v36SelectVisible'){visibleRows().filter(bulkEligible).forEach(q=>e.target.checked?store.selected.add(String(q.id)):store.selected.delete(String(q.id)));render();return;}const selected=e.target.closest?.('[data-v36-select]');if(selected){selected.checked?store.selected.add(String(selected.dataset.v36Select)):store.selected.delete(String(selected.dataset.v36Select));render();return;}if(e.target.id==='v36Manager'){store.manager=e.target.value;store.copro='';localStorage.setItem('wapi_v36_invoice_manager',store.manager);localStorage.removeItem('wapi_v36_invoice_copro');state.ocrSelectedQueueId='';render();}if(e.target.id==='v36Copro'){store.copro=e.target.value;localStorage.setItem('wapi_v36_invoice_copro',store.copro);state.ocrSelectedQueueId='';render();}if(e.target.id==='v36FieldCopro'){const q=selectedQ(),form=readForm(),current=values(q),coproId=e.target.value||null,keptSupplier=form.supplier_id||current.supplier_id||qSupplier(q)||null,next={...current,...form,copro_id:coproId,supplier_id:keptSupplier,fiscal_year_id:fiscalYearFor(coproId,form.date)?.id||null,fiscal_year_manual:false,amount:form.amount??current.amount};patchQueue(q.id,{copro_id:coproId,corrected_data:next});render();return;}if(e.target.id==='v36FieldSupplier'){const q=selectedQ(),next=applyPreference({...values(q),...readForm(),supplier_id:e.target.value||null});patchQueue(q.id,{corrected_data:next});render();return;}if(e.target.id==='v36FieldFiscalYear'){const q=selectedQ(),next={...values(q),...readForm(),fiscal_year_id:e.target.value||null,fiscal_year_manual:true};patchQueue(q.id,{corrected_data:next});render();return;}if(e.target.id==='v36FieldDate'){const q=selectedQ(),next={...values(q),...readForm(),date:e.target.value||null};if(!next.fiscal_year_manual)next.fiscal_year_id=fiscalYearFor(next.copro_id,next.date)?.id||null;patchQueue(q.id,{corrected_data:next});render();return;}if(e.target.id==='v36MonthlyLabel'){const description=$('v36FieldDescription'),date=$('v36FieldDate')?.value;if(e.target.checked&&description)description.value=monthLabel(date);return;}const toggle=e.target.closest?.('[data-v36-supplier-copro]');if(toggle){toggle.disabled=true;(async()=>{if(toggle.checked)await ensureLink(toggle.dataset.v36SupplierCopro,toggle.dataset.supplier,'manual');else{const l=store.links.find(x=>String(x.copro_id)===String(toggle.dataset.v36SupplierCopro)&&String(x.supplier_id)===String(toggle.dataset.supplier));if(l){const r=await supabaseClient.from('compta_copro_suppliers').update({active:false,updated_at:new Date().toISOString()}).eq('id',l.id);if(r.error)alert(r.error.message);else l.active=false;}}toggle.disabled=false;toggle.closest('.v359-copro-link')?.classList.toggle('is-linked',toggle.checked);})();}});
  document.addEventListener('input',e=>{if(e.target.id==='v36Search'){store.search=e.target.value;clearTimeout(store.searchTimer);store.searchTimer=setTimeout(render,180);}if(e.target.id==='v36FieldTotal'||e.target.id==='v36FieldRate'){const host=$('v36TaxCalculation');if(host)host.innerHTML=taxCalculationHtml($('v36FieldTotal')?.value,$('v36FieldRate')?.value);}});
  async function refresh(){const btn=$('v36Refresh');if(btn){btn.disabled=true;btn.innerHTML='<span class="v36-spinner"></span> Actualisation…';}await Promise.all([loadImportBatches?.(),loadImportItems?.(),loadValidationQueue?.(),loadInvoices?.(),loadSupport()]);render();}
  async function install(){await loadSupport();const old=$('ocrStatusFilter');if(old)old.closest('.list-filters').style.display='none';render();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700));else setTimeout(install,700);
})();
