/* WAPI One V36 — centre de traitement factures, multi-copro et rapide. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V36.0.2 — Centre factures';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const store={tab:localStorage.getItem('wapi_v36_invoice_tab')||'to_process',manager:localStorage.getItem('wapi_v36_invoice_manager')||'',copro:localStorage.getItem('wapi_v36_invoice_copro')||'',search:'',links:[],busy:false};
  const tabs=[['to_process','À traiter'],['to_validate','À valider'],['posted','Comptabilisées'],['errors','Erreurs'],['duplicates','Doublons'],['rejected','Rejetées']];

  const previewUrls=new Map();
  function item(q){
    const full=(state.importItems||[]).find(x=>String(x.id)===String(q.item_id));
    if(full)return full;
    const joined=q?.compta_import_items||{};
    return {...joined,id:q?.item_id||joined.id||null,raw_data:joined.raw_data||{}};
  }
  function values(q){const i=item(q);return {...(q.extracted_data||i.raw_data?.extracted||{}),...(q.corrected_data||{})};}
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
    const [links,profiles]=await Promise.all([
      supabaseClient.from('compta_copro_suppliers').select('*'),
      (state.userProfiles||[]).length?Promise.resolve({data:state.userProfiles}):supabaseClient.from('compta_user_profiles').select('id,email,display_name,role,active').order('display_name')
    ]);
    if(!links.error)store.links=links.data||[];else console.warn('Migration 045 manquante',links.error.message);
    if(!profiles.error)state.userProfiles=profiles.data||[];
    if(!store.manager&&currentUser?.id&&(state.userProfiles||[]).some(u=>String(u.id)===String(currentUser.id))){store.manager=currentUser.id;localStorage.setItem('wapi_v36_invoice_manager',store.manager);}
  }

  /* Détection volontairement stricte : mieux vaut laisser un champ vide que
     comptabiliser un VCS, un IBAN, une date ou un numéro client comme montant. */
  function parseInvoiceMoney(raw){
    if(!raw)return null;let s=String(raw).replace(/[€\s']/g,'');
    if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
    else if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    const n=Number(s.replace(/[^0-9.-]/g,''));return Number.isFinite(n)&&n>0&&n<10000000?n:null;
  }
  function strictTotal(text){
    const lines=String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean),candidates=[];
    const labels=[[/\bnet\s+(?:a|à)\s+payer\b/i,120],[/\btotal\s+(?:a|à)\s+payer\b/i,118],[/\bmontant\s+(?:a|à)\s+payer\b/i,116],[/\bsolde\s+(?:a|à)\s+payer\b/i,114],[/\btotal\s+(?:tvac|ttc)\b/i,112],[/\bmontant\s+(?:tvac|ttc)\b/i,110],[/\bgrand\s+total\b/i,105],[/\btotal\s+facture\b/i,102],[/\bbalance\s+due\b/i,102]];
    const amounts=line=>[...String(line||'').matchAll(/(?:^|[^0-9])(-?[0-9]{1,3}(?:[ .'][0-9]{3})*(?:[,.][0-9]{2})|-?[0-9]{1,8}[,.][0-9]{2})(?=\s*(?:€|EUR|$|[^0-9]))/gi)].map(m=>parseInvoiceMoney(m[1])).filter(v=>v!==null);
    lines.forEach((line,index)=>{
      if(/iban|bic|communication\s+structuree|communication\s+structurée|vcs|numero\s+client|numéro\s+client|n°\s*client|tva\s*(?:be)?\s*\d{8,}/i.test(line))return;
      for(const [rx,score] of labels){if(!rx.test(line))continue;const own=amounts(line),next=amounts(lines[index+1]||'');const vals=own.length?own:next;if(vals.length)candidates.push({value:vals[vals.length-1],score,index});break;}
    });
    candidates.sort((a,b)=>b.score-a.score||b.index-a.index);return candidates[0]?.value??null;
  }
  function strictReference(text,fileName=''){
    const flat=String(text||'').replace(/\u00a0/g,' ').replace(/\s+/g,' '),patterns=[
      /(?:n(?:um[eé]ro)?\s*(?:de\s+)?facture|facture\s*n[°o.]?|invoice\s*(?:number|no\.?|#))\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,30})/i,
      /(?:n(?:um[eé]ro)?\s*(?:de\s+)?document|document\s*n[°o.]?|document\s*(?:number|no\.?))\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,30})/i,
      /(?:r[eé]f[eé]rence\s+facture|invoice\s+reference)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,30})/i
    ];
    for(const rx of patterns){const m=flat.match(rx);if(!m)continue;const v=m[1].replace(/[.,;:]+$/,'');if(/^BE\d{8,}$/i.test(v)||/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(v)||/^\d+[,.]\d{2}$/.test(v)||v.length<3)continue;return v;}
    const base=String(fileName||'').replace(/\.[^.]+$/,'').trim(),m=base.match(/(?:facture|invoice)[ _-]+([A-Z0-9][A-Z0-9._-]{2,30})$/i);return m?m[1]:'';
  }
  const previousStrictExtractor=window.extractInvoiceFieldsV19||window.extractInvoiceFieldsV13;
  function strictInvoiceExtract(text,fileName=''){
    const base=typeof previousStrictExtractor==='function'?previousStrictExtractor(text,fileName)||{}:{};
    const total=strictTotal(text),reference=strictReference(text,fileName);
    return {...base,amount:total??'',reference:reference||''};
  }
  window.extractInvoiceFieldsV19=strictInvoiceExtract;
  window.extractInvoiceFieldsV13=strictInvoiceExtract;
  if(window.WapiOcrV349?.analyze){
    const previousSupplyAnalyze=window.WapiOcrV349.analyze;
    window.WapiOcrV349.analyze=function(text,options={}){const result=previousSupplyAnalyze.apply(this,arguments)||{fields:{}};const total=strictTotal(text),reference=strictReference(text,options.fileName||'');result.fields={...(result.fields||{}),amount:total??'',reference:reference||'',amount_excl_vat:'',vat_amount:'',amount_check:total!==null?'verified':'missing'};return result;};
  }

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
    return {missing,amountMismatch:false,unlinked:!!(cid&&sid&&!linked(cid,sid)),ready:!missing.length};
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
      ${store.manager&&!allowedCopros().length?`<div class="notice">Aucune copropriété n’est attribuée à ${esc(profileName(store.manager))}. Attribue-lui une copropriété dans les réglages copro.</div>`:`<div class="v36-workbench">${renderList(rows)}${selected?renderPreview(selected)+renderFields(selected):'<div class="v36-pane v36-empty">Aucune facture dans ce filtre.</div>'}</div>`}`;
  }
  function renderList(rows){return `<div class="v36-pane"><div class="v36-pane-head"><strong>${rows.length} facture(s)</strong><small>${esc(tabs.find(x=>x[0]===store.tab)?.[1]||'')}</small></div><div class="v36-list">${rows.map(q=>{const d=values(q),i=item(q),s=supplier(qSupplier(q)),c=copro(qCopro(q)),[label,cls]=statusInfo(q),qa=quality(q);return `<button class="v36-row ${String(q.id)===String(state.ocrSelectedQueueId)?'active':''}" data-v36-open="${q.id}"><strong>${esc(s?.name||d.supplier_name_guess||'Fournisseur non reconnu')}</strong><small>${esc(c?.name||'Copropriété non reconnue')} · ${esc(d.reference||i.file_name||'N° manquant')}</small><div class="v36-row-meta"><span>${d.amount?money(d.amount):'Montant ?'}</span><span class="v36-status ${qa.missing.length?'danger':cls}">${qa.missing.length?`${qa.missing.length} manque(nt)`:label}</span></div></button>`;}).join('')||'<div class="v36-empty">Aucune facture.</div>'}</div></div>`;}
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
  function renderFields(q){
    const d=values(q),cid=qCopro(q),sid=qSupplier(q),qa=quality(q),isPosted=bucket(q)==='posted',cOptions='<option value="">Choisir…</option>'+allowedCopros().map(c=>`<option value="${c.id}" ${String(c.id)===String(cid)?'selected':''}>${esc(c.name)}</option>`).join('');
    const summary=qa.missing.length?`${qa.missing.length} champ(s) obligatoire(s) à corriger`:qa.amountMismatch?'Montants incohérents':qa.unlinked?'Fournisseur à associer à la copropriété':'Contrôles essentiels réussis';
    return `<div class="v36-pane v36-fields-pane"><div class="v36-pane-head"><strong>Données de la facture</strong><span class="v36-status ${qa.missing.length||qa.amountMismatch?'danger':qa.unlinked?'warn':'ok'}">${isPosted?'Comptabilisée':qa.ready?'Prête':'À vérifier'}</span></div><div class="v36-pane-body v36-fields"><div class="v36-quality ${qa.missing.length||qa.amountMismatch?'danger':qa.unlinked?'warn':''}"><strong>${esc(summary)}</strong><small>${qa.missing.length?'Manque : '+qa.missing.join(', '):qa.amountMismatch?'HTVA + TVA doit correspondre au TVAC.':qa.unlinked?'La fiche fournisseur existe déjà : associe-la sans la recréer.':'Tu peux enregistrer ou valider.'}</small></div>
      <div class="v36-field-grid">
        ${field('Copropriété',`<select id="v36FieldCopro">${cOptions}</select>`,!cid,'Sélection obligatoire')}
        ${field('Fournisseur',`<select id="v36FieldSupplier">${supplierOptions(cid,sid)}</select>`,!sid,'Choisis ou crée un fournisseur',qa.unlinked)}
        ${field('Compte comptable',`<select id="v36FieldAccount">${accountOptions(d.account_id||'')}</select>`,!d.account_id,'Compte obligatoire')}
        ${field('Numéro de facture',`<input id="v36FieldReference" value="${esc(d.reference||'')}">`,!d.reference,'Numéro manquant')}
        ${field('Date facture',`<input id="v36FieldDate" type="date" value="${esc(d.date||'')}">`,!d.date,'Date manquante')}
        ${field('Échéance',`<input id="v36FieldDue" type="date" value="${esc(d.due_date||'')}">`,false,'')}
        ${field('Montant TVAC',`<input id="v36FieldTotal" type="number" step="0.01" value="${esc(d.amount||'')}">`,!(Number(d.amount)>0),'TVAC obligatoire',qa.amountMismatch)}
        ${field('Taux TVA',`<input id="v36FieldRate" type="number" step="0.01" value="${esc(d.vat_rate||'')}">`,false,'')}
      </div>
      <div class="v36-tax-calculation" id="v36TaxCalculation">${taxCalculationHtml(d.amount,d.vat_rate)}</div>
      <div class="v36-supplier-actions">${supplierActions(cid,sid)}</div>
      <label class="v36-block-label">Libellé interne<textarea id="v36FieldDescription">${esc(d.description||'')}</textarea></label>
      <label class="v36-block-label">Note de traitement<textarea id="v36FieldNotes">${esc(d.notes||q.notes||'')}</textarea></label>
      ${q.processing_error?`<div class="notice danger"><strong>Erreur :</strong> ${esc(q.processing_error)}</div>`:''}
      <div class="v36-actions"><button class="btn secondary" id="v36Save" ${isPosted?'disabled':''}>Enregistrer</button><button class="btn" id="v36Validate" ${isPosted?'disabled':''}>Valider et comptabiliser</button><button class="btn danger" id="v36Reject" ${isPosted?'disabled':''}>Rejeter</button></div></div></div>`;
  }
  function field(label,control,missing,hint,warning=false){return `<label class="${missing?'v36-field-error':warning?'v36-field-warning':''}">${label}${control}${missing||warning?`<span class="v36-field-hint">${esc(hint||'À vérifier')}</span>`:''}</label>`;}
  function supplierActions(cid,sid){
    if(!cid)return '<strong>Fournisseur</strong><small>Choisis d’abord la copropriété.</small>';
    if(sid&&!linked(cid,sid))return `<strong>${esc(supplier(sid)?.name||'Fournisseur existant')}</strong><small>Ce fournisseur global n’est pas encore associé à cette copropriété.</small><div class="actions-inline"><button class="btn small" id="v36LinkSupplier">Ajouter à la copro</button><button class="btn secondary small" id="v36ChooseSupplier">Choisir dans le répertoire global</button><button class="btn secondary small" id="v36CreateSupplier">Nouveau fournisseur</button></div>`;
    return `<strong>${sid?esc(supplier(sid)?.name||'Fournisseur'):'Aucun fournisseur sélectionné'}</strong><small>${sid?'Fournisseur déjà associé à cette copropriété.':'Choisis une fiche globale existante ou crée-en une.'}</small><div class="actions-inline"><button class="btn secondary small" id="v36ChooseSupplier">Répertoire global</button><button class="btn secondary small" id="v36CreateSupplier">Nouveau fournisseur</button></div>`;
  }

  function calculatedTaxes(total,rate){const t=Number(total||0),r=Math.max(0,Number(rate||0));if(!(t>0))return {ht:null,vat:null};const ht=Number((t/(1+r/100)).toFixed(2)),vat=Number((t-ht).toFixed(2));return {ht,vat};}
  function taxCalculationHtml(total,rate){const x=calculatedTaxes(total,rate);return `<div><span>Montant HTVA calculé</span><strong>${x.ht===null?'—':money(x.ht)}</strong></div><div><span>TVA calculée</span><strong>${x.vat===null?'—':money(x.vat)}</strong></div><div><span>Montant TVAC</span><strong>${Number(total)>0?money(total):'—'}</strong></div>`;}
  function readForm(){const amount=$('v36FieldTotal')?.value?Number($('v36FieldTotal').value):null,vat_rate=$('v36FieldRate')?.value?Number($('v36FieldRate').value):0,tax=calculatedTaxes(amount,vat_rate);return {copro_id:$('v36FieldCopro')?.value||null,supplier_id:$('v36FieldSupplier')?.value||null,account_id:$('v36FieldAccount')?.value||null,reference:$('v36FieldReference')?.value.trim()||null,date:$('v36FieldDate')?.value||null,due_date:$('v36FieldDue')?.value||null,amount_excl_vat:tax.ht,vat_amount:tax.vat,amount,vat_rate,description:$('v36FieldDescription')?.value.trim()||null,notes:$('v36FieldNotes')?.value.trim()||null};}
  function selectedQ(){return allInvoiceQueues().find(q=>String(q.id)===String(state.ocrSelectedQueueId));}
  function patchQueue(id,patch){const idx=state.validationQueue.findIndex(q=>String(q.id)===String(id));if(idx>=0)state.validationQueue[idx]={...state.validationQueue[idx],...patch};}
  async function save(validate=false){
    const q=selectedQ();if(!q)return;const d={...values(q),...readForm()},qa={missing:[]};
    if(validate){if(!d.copro_id)qa.missing.push('copropriété');if(!d.supplier_id)qa.missing.push('fournisseur');if(!d.account_id)qa.missing.push('compte');if(!d.reference)qa.missing.push('numéro');if(!d.date)qa.missing.push('date');if(!(d.amount>0))qa.missing.push('montant');if(qa.missing.length)return alert('Complète : '+qa.missing.join(', '));}
    const status=validate?'to_validate':(d.copro_id&&d.supplier_id&&d.account_id&&d.reference&&d.date&&d.amount>0?'to_validate':'to_verify');
    const {error}=await supabaseClient.from('compta_validation_queue').update({copro_id:d.copro_id,corrected_data:d,notes:d.notes,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null}).eq('id',q.id);if(error)return alert(error.message);
    patchQueue(q.id,{copro_id:d.copro_id,corrected_data:d,notes:d.notes,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null});
    if(!validate){render();return;}
    await ensureLink(d.copro_id,d.supplier_id,'ocr');
    const i=item(q),raw=i.raw_data||{};
    const payload={copro_id:d.copro_id,supplier_id:d.supplier_id,account_id:d.account_id,distribution_key_id:d.distribution_key_id||null,charge_target:d.charge_target||'common_owner',supply_profile_id:d.supply_profile_id||null,invoice_number:d.reference,invoice_date:d.date,due_date:d.due_date,amount_total:Number(d.amount),vat_rate:d.vat_rate,vat_amount:d.vat_amount,status:'validated',payment_status:'unpaid',description:d.description||`Importé depuis ${i.file_name||'OCR'}`,source:'processing_center',file_name:i.file_name||null,file_data_url:raw.file_data_url||null,pdf_mime_type:i.mime_type||raw.mime_type||null,ocr_confidence:i.confidence||null,ocr_text:i.raw_text||null,ocr_source_item_id:i.id||null,ocr_raw_json:{extracted:q.extracted_data||{},corrected:d,raw_data:raw},created_by:currentUser.id};
    const created=await supabaseClient.from('compta_invoices').insert(payload).select('*').single();if(created.error){await supabaseClient.from('compta_validation_queue').update({processing_error:created.error.message,workflow_bucket:'errors'}).eq('id',q.id);patchQueue(q.id,{processing_error:created.error.message,workflow_bucket:'errors'});store.tab='errors';render();return alert(created.error.message);}
    await supabaseClient.from('compta_validation_queue').update({status:'validated',workflow_bucket:'posted',validated_by:currentUser.id,validated_at:new Date().toISOString()}).eq('id',q.id);
    await supabaseClient.from('compta_import_items').update({status:'validated'}).eq('id',q.item_id);
    state.invoices.push(created.data);patchQueue(q.id,{status:'validated',workflow_bucket:'posted',validated_at:new Date().toISOString()});store.tab='to_process';state.ocrSelectedQueueId='';render();
  }
  async function ensureLink(cid,sid,source='manual'){if(!cid||!sid||linked(cid,sid))return true;const existing=store.links.find(x=>String(x.copro_id)===String(cid)&&String(x.supplier_id)===String(sid));const req=existing?supabaseClient.from('compta_copro_suppliers').update({active:true,source,updated_at:new Date().toISOString()}).eq('id',existing.id):supabaseClient.from('compta_copro_suppliers').insert({copro_id:cid,supplier_id:sid,active:true,source,created_by:currentUser.id}).select('*').single();const r=await req;if(r.error){alert(r.error.message);return false;}if(existing)existing.active=true;else if(r.data)store.links.push(r.data);return true;}
  async function analyze(){
    const q=selectedQ(),i=item(q);if(!q||store.busy)return;const btn=$('v36Analyze');store.busy=true;if(btn){btn.disabled=true;btn.innerHTML='<span class="v36-spinner"></span> Analyse…';}
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
    try{const text=i.raw_text||'';if(!text)return alert('Aucun texte OCR conservé. Réimporte ce PDF pour une nouvelle lecture complète.');const extractor=window.extractInvoiceFieldsV19||window.extractInvoiceFieldsV13;const extracted=typeof extractor==='function'?extractor(text,i.file_name||''):q.extracted_data||{};const sd=typeof detectSupplierFromText==='function'?detectSupplierFromText(text):{},cd=typeof detectCoproFromText==='function'?detectCoproFromText(text):{};const current=values(q),next={...current,...extracted};if(!next.supplier_id&&sd.supplier)next.supplier_id=sd.supplier.id;if(!next.copro_id&&cd.copro)next.copro_id=cd.copro.id;const status=next.copro_id&&next.supplier_id&&next.account_id&&next.reference&&next.date&&next.amount?'to_validate':'to_verify';const r=await supabaseClient.from('compta_validation_queue').update({extracted_data:extracted,corrected_data:next,copro_id:next.copro_id||null,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null,last_analysis_at:new Date().toISOString(),analysis_attempts:Number(q.analysis_attempts||0)+1}).eq('id',q.id);if(r.error)throw r.error;patchQueue(q.id,{extracted_data:extracted,corrected_data:next,copro_id:next.copro_id||null,status,workflow_bucket:status==='to_validate'?'to_validate':'to_process',processing_error:null,analysis_attempts:Number(q.analysis_attempts||0)+1});render();}catch(error){await supabaseClient.from('compta_validation_queue').update({processing_error:error.message||String(error),workflow_bucket:'errors'}).eq('id',q.id);patchQueue(q.id,{processing_error:error.message||String(error),workflow_bucket:'errors'});store.tab='errors';render();}finally{store.busy=false;}
  }

  function chooseSupplier(){const q=selectedQ(),d=readForm(),cid=d.copro_id||qCopro(q);if(!cid)return alert('Choisis d’abord la copropriété.');const body=`<div class="popup-form"><div class="notice">Tous les fournisseurs globaux sont disponibles, même s’ils ne sont pas encore associés à cette copropriété.</div><label>Rechercher<input id="v36SupplierSearch" placeholder="Nom, code, TVA…"></label><div id="v36SupplierResults" class="v359-manage-grid"></div></div>`;openAppModal('Répertoire global des fournisseurs',body,'<button class="btn secondary" data-modal-close>Annuler</button>',{size:'wide'});const draw=()=>{const needle=norm($('v36SupplierSearch')?.value);$('v36SupplierResults').innerHTML=(state.suppliers||[]).filter(s=>s.active!==false&&(!needle||norm([s.name,s.supplier_code,s.vat_number].join(' ')).includes(needle))).slice(0,80).map(s=>`<button class="v359-copro-link ${linked(cid,s.id)?'is-linked':''}" data-v36-use-supplier="${s.id}"><span><strong>${esc(s.name)}</strong><small>${esc(s.supplier_code||s.vat_number||'')}</small></span><span>${linked(cid,s.id)?'Déjà associé':'Ajouter'}</span></button>`).join('')||'<div class="notice">Aucun résultat.</div>';};draw();$('v36SupplierSearch').oninput=draw;document.querySelectorAll('[data-v36-use-supplier]').forEach(()=>{});$('v36SupplierResults').onclick=async e=>{const b=e.target.closest('[data-v36-use-supplier]');if(!b)return;await ensureLink(cid,b.dataset.v36UseSupplier,'ocr');const old=values(q),next={...old,copro_id:cid,supplier_id:b.dataset.v36UseSupplier};await supabaseClient.from('compta_validation_queue').update({copro_id:cid,corrected_data:next}).eq('id',q.id);patchQueue(q.id,{copro_id:cid,corrected_data:next});closeAppModal();render();};}
  function createSupplier(){const q=selectedQ(),d=readForm(),cid=d.copro_id||qCopro(q);if(!cid)return alert('Choisis d’abord la copropriété.');openAppModal('Nouveau fournisseur',`<div class="popup-form"><div class="notice">Une seule fiche globale sera créée puis associée à ${esc(copro(cid)?.name||'la copropriété')}.</div><div class="form-grid"><label>Nom<input id="v36NewSupplierName"></label><label>N° TVA<input id="v36NewSupplierVat"></label><label>E-mail<input id="v36NewSupplierEmail" type="email"></label><label>IBAN<input id="v36NewSupplierIban"></label></div></div>`,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="v36SaveSupplier">Créer et utiliser</button>`,{size:'wide'});$('v36SaveSupplier').onclick=async()=>{const name=$('v36NewSupplierName').value.trim();if(!name)return alert('Indique le nom.');const existing=(state.suppliers||[]).find(s=>norm(s.name)===norm(name)||($('v36NewSupplierVat').value&&norm(s.vat_number)===norm($('v36NewSupplierVat').value)));if(existing){if(!confirm(`« ${existing.name} » existe déjà. Réutiliser cette fiche ?`))return;await useNewSupplier(existing);}else{const r=await supabaseClient.from('compta_suppliers').insert({name,vat_number:$('v36NewSupplierVat').value.trim()||null,email:$('v36NewSupplierEmail').value.trim()||null,iban:$('v36NewSupplierIban').value.trim()||null,active:true,created_by:currentUser.id}).select('*').single();if(r.error)return alert(r.error.message);state.suppliers.push(r.data);await useNewSupplier(r.data);}};async function useNewSupplier(s){await ensureLink(cid,s.id,'ocr');const next={...values(q),copro_id:cid,supplier_id:s.id};await supabaseClient.from('compta_validation_queue').update({copro_id:cid,corrected_data:next}).eq('id',q.id);patchQueue(q.id,{copro_id:cid,corrected_data:next});closeAppModal();render();}}
  async function reject(){const q=selectedQ();if(!q||!confirm('Rejeter cette facture ?'))return;const r=await supabaseClient.from('compta_validation_queue').update({status:'rejected',workflow_bucket:'rejected',processing_error:null,duplicate_of:null}).eq('id',q.id);if(r.error)return alert(r.error.message);patchQueue(q.id,{status:'rejected',workflow_bucket:'rejected',processing_error:null,duplicate_of:null});store.tab='rejected';localStorage.setItem('wapi_v36_invoice_tab','rejected');state.ocrSelectedQueueId=q.id;render();}

  function tierCoproId(){return state.activeCoproId||$('ownersFilterCopro')?.value||'';}
  function renderSupplierDirectory(){
    if((state.selectedIdentityType||'owner')!=='supplier')return;const host=$('ownersTable');if(!host)return;
    const cid=tierCoproId(),ids=new Set(store.links.filter(l=>l.active!==false&&(!cid||String(l.copro_id)===String(cid))).map(l=>String(l.supplier_id)));
    const rows=(state.suppliers||[]).filter(s=>s.active!==false&&(!cid||ids.has(String(s.id))));
    host.innerHTML=`<div class="v359-supplier-toolbar"><div><strong>${rows.length} fournisseur(s)</strong><div class="v359-supplier-context">${cid?`Fournisseurs attribués à ${esc(copro(cid)?.name||'la copropriété')}`:'Répertoire global des fournisseurs'}</div></div><div class="actions-inline">${cid?`<button class="btn secondary" data-v36-tier-add-existing="${cid}">Ajouter un fournisseur existant</button>`:''}<button class="btn" data-add-identity="supplier">Nouveau fournisseur</button></div></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Fournisseur</th><th>TVA</th><th>E-mail</th><th>IBAN</th><th>Copropriétés</th><th>Actions</th></tr></thead><tbody>${rows.map(s=>`<tr><td><span class="code-pill">${esc(s.supplier_code||'—')}</span></td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.vat_number||'')}</td><td>${esc(s.email||'')}</td><td>${esc(s.iban||'')}</td><td><span class="v359-link-count">${store.links.filter(l=>l.active!==false&&String(l.supplier_id)===String(s.id)).length} copro(s)</span></td><td><div class="actions-inline"><button class="btn secondary small" data-open-identity="supplier|${s.id}">Ouvrir</button><button class="btn secondary small" data-v36-manage-supplier="${s.id}">Gérer les copros</button></div></td></tr>`).join('')||`<tr><td colspan="7"><div class="notice">Aucun fournisseur attribué. Ajoute une fiche existante ou crée un nouveau fournisseur.</div></td></tr>`}</tbody></table></div>`;
  }
  function manageSupplierCopros(sid){const s=supplier(sid);if(!s)return;openAppModal('Copropriétés du fournisseur',`<div class="popup-form"><div class="notice">La fiche « ${esc(s.name)} » reste unique. Active-la uniquement dans les copropriétés où elle intervient.</div><div class="v359-manage-grid">${(state.copros||[]).filter(c=>c.active!==false).map(c=>`<label class="v359-copro-link ${linked(c.id,sid)?'is-linked':''}"><span><strong>${esc(c.name)}</strong><small>${esc(c.code||'')}</small></span><input type="checkbox" data-v36-supplier-copro="${c.id}" data-supplier="${sid}" ${linked(c.id,sid)?'checked':''}></label>`).join('')}</div></div>`,`<button class="btn" data-modal-close>Terminer</button>`,{size:'wide',subtitle:s.name});}
  function addExistingToCopro(cid){openAppModal('Ajouter un fournisseur existant',`<div class="popup-form"><div class="notice">Aucune nouvelle fiche ne sera créée.</div><label>Fournisseur<select id="v36TierExisting"><option value="">Choisir…</option>${(state.suppliers||[]).filter(s=>s.active!==false&&!linked(cid,s.id)).map(s=>`<option value="${s.id}">${esc([s.supplier_code,s.name].filter(Boolean).join(' — '))}</option>`).join('')}</select></label></div>`,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="v36TierAddConfirm">Ajouter</button>`,{size:'small',subtitle:copro(cid)?.name||''});$('v36TierAddConfirm').onclick=async()=>{const sid=$('v36TierExisting').value;if(!sid)return alert('Choisis un fournisseur.');if(await ensureLink(cid,sid,'manual')){closeAppModal();renderSupplierDirectory();}};}

  function enhanceSettings(coproId){const body=$('globalModalBody');if(!body||!$('v33CoproName')||$('v36SettingsSuppliers'))return;const cid=coproId||state.activeCoproId;if(!cid)return;const ids=new Set(store.links.filter(l=>l.active!==false&&String(l.copro_id)===String(cid)).map(l=>String(l.supplier_id))),rows=(state.suppliers||[]).filter(s=>ids.has(String(s.id)));body.insertAdjacentHTML('beforeend',`<section class="v36-settings-suppliers" id="v36SettingsSuppliers"><h3>Fournisseurs de la copropriété</h3><p class="muted-note">Les fiches restent globales. Cette liste définit uniquement les fournisseurs disponibles dans cette copropriété.</p><div class="v36-settings-list" id="v36SettingsSupplierList">${rows.map(s=>`<span class="v36-settings-chip">${esc(s.name)}<button data-v36-unlink-settings="${s.id}" title="Retirer">×</button></span>`).join('')||'<span class="muted-note">Aucun fournisseur associé.</span>'}</div><div class="actions-inline"><select id="v36SettingsSupplierSelect"><option value="">Ajouter un fournisseur existant…</option>${(state.suppliers||[]).filter(s=>s.active!==false&&!ids.has(String(s.id))).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn secondary small" id="v36SettingsAddSupplier">Ajouter</button></div></section>`);$('v36SettingsAddSupplier').onclick=async()=>{const sid=$('v36SettingsSupplierSelect').value;if(!sid)return;await ensureLink(cid,sid,'manual');$('v36SettingsSuppliers').remove();enhanceSettings(cid);};$('v36SettingsSupplierList').onclick=async e=>{const b=e.target.closest('[data-v36-unlink-settings]');if(!b)return;if(!confirm('Retirer ce fournisseur de cette copropriété ? Son historique et sa fiche globale sont conservés.'))return;const link=store.links.find(l=>String(l.copro_id)===String(cid)&&String(l.supplier_id)===String(b.dataset.v36UnlinkSettings));if(link){const r=await supabaseClient.from('compta_copro_suppliers').update({active:false,updated_at:new Date().toISOString()}).eq('id',link.id);if(r.error)return alert(r.error.message);link.active=false;}$('v36SettingsSuppliers').remove();enhanceSettings(cid);};}

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
  document.addEventListener('click',e=>{const t=e.target.closest?.('[data-v36-tab],[data-v36-open],#v36Profiles,#v36Import,#v36Refresh,#v36Save,#v36Validate,#v36Reject,#v36Analyze,#v36ChooseSupplier,#v36CreateSupplier,#v36LinkSupplier');if(!t)return;e.preventDefault();e.stopImmediatePropagation();if(t.dataset.v36Tab){store.tab=t.dataset.v36Tab;localStorage.setItem('wapi_v36_invoice_tab',store.tab);state.ocrSelectedQueueId='';render();}else if(t.dataset.v36Open){state.ocrSelectedQueueId=t.dataset.v36Open;render();}else if(t.id==='v36Profiles')$('v349ProfilesBtn')?.click();else if(t.id==='v36Import')switchToView('processing');else if(t.id==='v36Refresh')refresh();else if(t.id==='v36Save')save(false);else if(t.id==='v36Validate')save(true);else if(t.id==='v36Reject')reject();else if(t.id==='v36Analyze')analyze();else if(t.id==='v36ChooseSupplier')chooseSupplier();else if(t.id==='v36CreateSupplier')createSupplier();else if(t.id==='v36LinkSupplier'){const d=readForm();ensureLink(d.copro_id,d.supplier_id,'ocr').then(render);}},true);
  document.addEventListener('change',e=>{if(e.target.id==='v36Manager'){store.manager=e.target.value;store.copro='';localStorage.setItem('wapi_v36_invoice_manager',store.manager);localStorage.removeItem('wapi_v36_invoice_copro');state.ocrSelectedQueueId='';render();}if(e.target.id==='v36Copro'){store.copro=e.target.value;localStorage.setItem('wapi_v36_invoice_copro',store.copro);state.ocrSelectedQueueId='';render();}if(e.target.id==='v36FieldCopro'){const q=selectedQ(),next={...values(q),...readForm(),copro_id:e.target.value,supplier_id:null};patchQueue(q.id,{copro_id:e.target.value,corrected_data:next});render();}if(e.target.id==='v36FieldSupplier'){const q=selectedQ(),next={...values(q),...readForm(),supplier_id:e.target.value||null};patchQueue(q.id,{corrected_data:next});render();}const toggle=e.target.closest?.('[data-v36-supplier-copro]');if(toggle){toggle.disabled=true;(async()=>{if(toggle.checked)await ensureLink(toggle.dataset.v36SupplierCopro,toggle.dataset.supplier,'manual');else{const l=store.links.find(x=>String(x.copro_id)===String(toggle.dataset.v36SupplierCopro)&&String(x.supplier_id)===String(toggle.dataset.supplier));if(l){const r=await supabaseClient.from('compta_copro_suppliers').update({active:false,updated_at:new Date().toISOString()}).eq('id',l.id);if(r.error)alert(r.error.message);else l.active=false;}}toggle.disabled=false;toggle.closest('.v359-copro-link')?.classList.toggle('is-linked',toggle.checked);})();}});
  document.addEventListener('input',e=>{if(e.target.id==='v36Search'){store.search=e.target.value;clearTimeout(store.searchTimer);store.searchTimer=setTimeout(render,180);}if(e.target.id==='v36FieldTotal'||e.target.id==='v36FieldRate'){const host=$('v36TaxCalculation');if(host)host.innerHTML=taxCalculationHtml($('v36FieldTotal')?.value,$('v36FieldRate')?.value);}});
  async function refresh(){const btn=$('v36Refresh');if(btn){btn.disabled=true;btn.innerHTML='<span class="v36-spinner"></span> Actualisation…';}await Promise.all([loadImportBatches?.(),loadImportItems?.(),loadValidationQueue?.(),loadInvoices?.(),loadSupport()]);render();}
  async function install(){await loadSupport();const old=$('ocrStatusFilter');if(old)old.closest('.list-filters').style.display='none';render();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700));else setTimeout(install,700);
})();
