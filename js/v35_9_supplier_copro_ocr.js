/* WAPI One V35.9 — fournisseurs globaux liés aux copropriétés + contrôle OCR. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V35.9 — Fournisseurs par copropriété et OCR contrôlé';
  const $=id=>document.getElementById(id);
  const esc=value=>typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  state.coproSupplierLinks=state.coproSupplierLinks||[];

  function activeCopro(){return state.activeCoproId||$('ownersFilterCopro')?.value||'';}
  function supplier(id){return (state.suppliers||[]).find(row=>String(row.id)===String(id));}
  function copro(id){return (state.copros||[]).find(row=>String(row.id)===String(id));}
  function linksForSupplier(id){return (state.coproSupplierLinks||[]).filter(link=>link.active!==false&&String(link.supplier_id)===String(id));}
  function isLinked(coproId,supplierId){return (state.coproSupplierLinks||[]).some(link=>link.active!==false&&String(link.copro_id)===String(coproId)&&String(link.supplier_id)===String(supplierId));}
  function supplierIdsForCopro(coproId){return new Set((state.coproSupplierLinks||[]).filter(link=>link.active!==false&&String(link.copro_id)===String(coproId)).map(link=>String(link.supplier_id)));}

  async function loadLinks(){
    if(!supabaseClient)return;
    const {data,error}=await supabaseClient.from('compta_copro_suppliers').select('*').order('created_at');
    if(error){console.warn('V35.9 : migration fournisseurs/copro non disponible',error.message);return;}
    state.coproSupplierLinks=data||[];
  }
  const oldLoadAll=window.loadAll;
  if(typeof oldLoadAll==='function')window.loadAll=async function(){const result=await oldLoadAll.apply(this,arguments);await loadLinks();return result;};

  async function setLink(coproId,supplierId,active=true,source='manual'){
    if(!coproId||!supplierId)return false;
    const existing=(state.coproSupplierLinks||[]).find(link=>String(link.copro_id)===String(coproId)&&String(link.supplier_id)===String(supplierId));
    const request=existing
      ?supabaseClient.from('compta_copro_suppliers').update({active,source,updated_at:new Date().toISOString()}).eq('id',existing.id)
      :supabaseClient.from('compta_copro_suppliers').insert({copro_id:coproId,supplier_id:supplierId,active,source,created_by:currentUser?.id||null});
    const {error}=await request;if(error){alert(error.message+'\n\nExécute d’abord la migration SQL V35.9.');return false;}
    await loadLinks();return true;
  }

  function renderSupplierDirectory(){
    if(window.WapiTiersV364?.render)return window.WapiTiersV364.render();
    if((state.selectedIdentityType||'owner')!=='supplier')return;
    const host=$('ownersTable');if(!host)return;
    const coproId=activeCopro(),allowed=supplierIdsForCopro(coproId);
    const rows=(state.suppliers||[]).filter(row=>row.active!==false&&(!coproId||allowed.has(String(row.id))));
    const context=coproId?`Fournisseurs actifs pour ${copro(coproId)?.name||'la copropriété'}`:'Répertoire global — un fournisseur n’est créé qu’une seule fois';
    host.innerHTML=`<div class="v359-supplier-toolbar"><div><strong>${rows.length} fournisseur(s)</strong><div class="v359-supplier-context">${esc(context)}</div></div><button class="btn" data-add-identity="supplier" type="button">Nouveau fournisseur global</button></div>
      <div class="table-wrap"><table><thead><tr><th>Code</th><th>Fournisseur</th><th>TVA</th><th>Email</th><th>IBAN</th><th>${coproId?'Association':'Copropriétés'}</th><th>Actions</th></tr></thead><tbody>${rows.map(row=>`<tr><td><span class="code-pill">${esc(row.supplier_code||'—')}</span></td><td><strong>${esc(row.name||'')}</strong></td><td>${esc(row.vat_number||'')}</td><td>${esc(row.email||'')}</td><td>${esc(row.iban||'')}</td><td><span class="v359-link-count">${coproId?'Associé':`${linksForSupplier(row.id).length} copro(s)`}</span></td><td><div class="actions-inline"><button class="btn secondary small" data-open-identity="supplier|${row.id}" type="button">Ouvrir</button><button class="btn secondary small" data-v359-manage-supplier="${row.id}" type="button">Gérer les copros</button></div></td></tr>`).join('')||`<tr><td colspan="7"><div class="notice">${coproId?'Aucun fournisseur n’est encore attribué à cette copropriété. Utilise « Ajouter un fournisseur existant » pour éviter tout doublon.':'Aucun fournisseur.'}</div></td></tr>`}</tbody></table></div>
      ${coproId?`<div class="top-actions" style="justify-content:flex-end;margin-top:12px"><button class="btn secondary" data-v359-pick-existing="${coproId}" type="button">Ajouter un fournisseur existant</button></div>`:''}`;
  }

  function openSupplierLinks(supplierId){
    const row=supplier(supplierId);if(!row)return;
    const body=`<div class="popup-form"><div class="notice"><strong>${esc(row.name)}</strong> reste une fiche fournisseur unique. Coche uniquement les copropriétés dans lesquelles ce fournisseur intervient.</div><div class="v359-manage-grid">${(state.copros||[]).filter(c=>c.active!==false).map(c=>{const linked=isLinked(c.id,row.id);return `<label class="v359-copro-link ${linked?'is-linked':''}"><span><strong>${esc(c.name)}</strong><small>${esc(c.code||'')}</small></span><input type="checkbox" data-v359-link-copro="${c.id}" data-supplier="${row.id}" ${linked?'checked':''}></label>`;}).join('')}</div></div>`;
    openAppModal('Copropriétés du fournisseur',body,'<button class="btn" data-modal-close type="button">Terminer</button>',{subtitle:row.name,size:'wide'});
  }

  function openExistingPicker(coproId){
    const allowed=supplierIdsForCopro(coproId),available=(state.suppliers||[]).filter(s=>s.active!==false&&!allowed.has(String(s.id)));
    const body=`<div class="popup-form"><div class="notice">Sélectionne un fournisseur global existant. Sa fiche, son code, son IBAN et son historique restent uniques.</div><label>Fournisseur<select id="v359ExistingSupplier"><option value="">Choisir…</option>${available.map(s=>`<option value="${s.id}">${esc([s.supplier_code,s.name].filter(Boolean).join(' — '))}</option>`).join('')}</select></label></div>`;
    openAppModal('Ajouter un fournisseur existant',body,'<button class="btn secondary" data-modal-close type="button">Annuler</button><button class="btn" id="v359ConfirmExisting" type="button">Ajouter à la copropriété</button>',{subtitle:copro(coproId)?.name||'',size:'small'});
    $('v359ConfirmExisting').onclick=async()=>{const id=$('v359ExistingSupplier').value;if(!id)return alert('Choisis un fournisseur.');if(await setLink(coproId,id,true,'manual')){closeAppModal();renderSupplierDirectory();}};
  }

  function selectedQueueData(){const q=(state.validationQueue||[]).find(x=>x.id===state.ocrSelectedQueueId);return {q,data:{...(q?.extracted_data||{}),...(q?.corrected_data||{})}};}
  function fieldQuality(id,level,message){const input=$(id),label=input?.closest('label');if(!label)return;label.classList.remove('v359-field-missing','v359-field-warning');label.querySelector('.v359-field-note')?.remove();if(!level)return;label.classList.add(level==='missing'?'v359-field-missing':'v359-field-warning');label.insertAdjacentHTML('beforeend',`<span class="v359-field-note">${esc(message)}</span>`);}

  function refreshOcrSupplierOptions(coproId,supplierId){
    const select=$('ocrFieldSupplier');if(!select)return;
    const allowed=supplierIdsForCopro(coproId),selected=String(select.value||supplierId||'');
    const rows=(state.suppliers||[]).filter(s=>!coproId||allowed.has(String(s.id))||String(s.id)===selected);
    select.innerHTML='<option value="">Choisir…</option>'+rows.map(s=>`<option value="${s.id}" ${String(s.id)===selected?'selected':''} class="${coproId&&!allowed.has(String(s.id))?'v359-unlinked-option':''}">${esc(s.name)}${coproId&&!allowed.has(String(s.id))?' — non associé à cette copro':''}</option>`).join('');
  }

  function enhanceOcr(){
    const {q,data}=selectedQueueData();if(!q||!$('.ocr-fields'))return;
    const coproId=$('ocrFieldCopro')?.value||data.copro_id||q.copro_id||'',supplierId=$('ocrFieldSupplier')?.value||data.supplier_id||'';
    refreshOcrSupplierOptions(coproId,supplierId);
    const linked=coproId&&supplierId&&isLinked(coproId,supplierId);
    $('.v359-ocr-alert')?.remove();
    if(coproId&&supplierId&&!linked){
      $('.ocr-fields').insertAdjacentHTML('afterbegin',`<div class="v359-ocr-alert"><strong>Fournisseur reconnu, mais pas encore utilisé dans cette copropriété</strong><span>${esc(supplier(supplierId)?.name||'Le fournisseur')} existe déjà dans WAPI One. Ne le recrée pas.</span><div class="actions-inline" style="margin-top:8px"><button class="btn small" id="v359LinkDetectedSupplier" type="button">Ajouter à ${esc(copro(coproId)?.name||'cette copropriété')}</button></div></div>`);
      $('v359LinkDetectedSupplier').onclick=async()=>{if(await setLink(coproId,supplierId,true,'ocr')){enhanceOcr();}};
    }else if(coproId&&supplierId){
      $('.ocr-fields').insertAdjacentHTML('afterbegin','<div class="v359-ocr-alert is-ok"><strong>Fournisseur autorisé pour cette copropriété</strong><span>La fiche globale existante sera réutilisée, sans doublon.</span></div>');
    }

    const amount=Number($('ocrFieldAmount')?.value||0),ht=Number($('ocrFieldAmountExclVat')?.value||0),vat=Number($('ocrFieldVatAmount')?.value||0);
    const missing=[];
    [['ocrFieldCopro','Copropriété','Aucune copropriété reconnue'],['ocrFieldSupplier','Fournisseur','Fournisseur absent ou non reconnu'],['ocrFieldAccount','Compte comptable','Compte comptable à confirmer'],['ocrFieldReference','Numéro de facture','Numéro de facture manquant'],['ocrFieldDate','Date','Date de facture manquante'],['ocrFieldAmount','Montant TVAC','Montant TVAC manquant ou invalide']].forEach(([id,label,msg])=>{const value=$(id)?.value;if(!value||(id==='ocrFieldAmount'&&Number(value)<=0)){missing.push(label);fieldQuality(id,'missing',msg);}else fieldQuality(id,null,'');});
    const inconsistent=amount>0&&ht>0&&Math.abs((ht+vat)-amount)>.05;
    if(inconsistent)fieldQuality('ocrFieldAmount','warning','HTVA + TVA ne correspond pas au TVAC');
    if(coproId&&supplierId&&!linked)fieldQuality('ocrFieldSupplier','warning','Fournisseur global non encore associé à cette copropriété');
    $('.v359-quality-summary')?.remove();
    const cls=missing.length?'has-errors':(inconsistent||!linked?'has-warnings':'');
    $('.ocr-fields h3')?.insertAdjacentHTML('afterend',`<div class="v359-quality-summary ${cls}"><div><strong>${missing.length?`${missing.length} donnée(s) obligatoire(s) à corriger`:inconsistent||!linked?'Vérification nécessaire':'Contrôles essentiels réussis'}</strong><div class="muted-note">${missing.length?esc(missing.join(' · ')):inconsistent?'Les montants ne sont pas cohérents.':!linked?'Confirme l’association fournisseur/copropriété.':'La facture peut être validée.'}</div></div><span class="badge ${missing.length?'danger':cls?'warn':'ok'}">${missing.length?'À corriger':cls?'À vérifier':'Prête'}</span></div>`);

    const create=$('ocrCreateDetectedSupplier');
    if(create&&!create.dataset.v359Safe){const clone=create.cloneNode(true);clone.dataset.v359Safe='true';clone.textContent='Rechercher ou créer sans doublon';create.replaceWith(clone);clone.onclick=createOrReuseDetectedSupplier;}
  }

  async function createOrReuseDetectedSupplier(){
    const {q,data}=selectedQueueData(),name=String(data.supplier_name_guess||'').trim(),coproId=$('ocrFieldCopro')?.value||data.copro_id||q?.copro_id||'';if(!q||!name)return;
    const exact=(state.suppliers||[]).find(s=>norm(s.name)===norm(name));
    let supplierId=exact?.id;
    if(exact){if(!confirm(`Le fournisseur global « ${exact.name} » existe déjà. Le réutiliser ?`))return;}
    else{
      const close=(state.suppliers||[]).filter(s=>norm(s.name).includes(norm(name))||norm(name).includes(norm(s.name))).slice(0,5);
      if(close.length)return openDetectedCandidates(q,name,coproId,close);
      if(!confirm(`Créer une seule fiche fournisseur globale « ${name} » ?`))return;
      const {data:created,error}=await supabaseClient.from('compta_suppliers').insert({name,active:true,created_by:currentUser?.id||null}).select('*').single();if(error)return alert(error.message);supplierId=created.id;
    }
    await applyDetectedSupplier(q,supplierId,coproId);
  }
  function openDetectedCandidates(q,name,coproId,candidates){
    const body=`<div class="popup-form"><div class="notice">Des fournisseurs ressemblants existent déjà. Réutilise la bonne fiche pour éviter un doublon.</div><div class="v359-manage-grid">${candidates.map(s=>`<button class="v359-copro-link" data-v359-reuse="${s.id}" type="button"><span><strong>${esc(s.name)}</strong><small>${esc(s.supplier_code||s.vat_number||'')}</small></span><span>Réutiliser</span></button>`).join('')}</div><button class="btn secondary" id="v359CreateAnyway" type="button">Aucun ne correspond — créer « ${esc(name)} »</button></div>`;
    openAppModal('Éviter un doublon fournisseur',body,'<button class="btn secondary" data-modal-close type="button">Annuler</button>',{size:'wide'});
    document.querySelectorAll('[data-v359-reuse]').forEach(btn=>btn.onclick=()=>applyDetectedSupplier(q,btn.dataset.v359Reuse,coproId));
    $('v359CreateAnyway').onclick=async()=>{const {data:created,error}=await supabaseClient.from('compta_suppliers').insert({name,active:true,created_by:currentUser?.id||null}).select('*').single();if(error)return alert(error.message);applyDetectedSupplier(q,created.id,coproId);};
  }
  async function applyDetectedSupplier(q,supplierId,coproId){
    const data={...(q.extracted_data||{}),...(q.corrected_data||{}),supplier_id:supplierId};
    const {error}=await supabaseClient.from('compta_validation_queue').update({corrected_data:data}).eq('id',q.id);if(error)return alert(error.message);
    if(coproId)await setLink(coproId,supplierId,true,'ocr');
    closeAppModal?.();await loadAll();state.ocrSelectedQueueId=q.id;renderInvoiceOcrV13();
  }

  const oldOcrRender=window.renderInvoiceOcrV13;
  if(typeof oldOcrRender==='function')window.renderInvoiceOcrV13=function(){const out=oldOcrRender.apply(this,arguments);setTimeout(enhanceOcr,0);return out;};
  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function')window.renderAll=function(){const out=oldRenderAll.apply(this,arguments);setTimeout(()=>{if((state.selectedIdentityType||'owner')==='supplier')renderSupplierDirectory();enhanceOcr();},0);return out;};

  window.addEventListener('click',event=>{
    const tab=event.target.closest?.('[data-identity-type="supplier"]');if(tab)setTimeout(renderSupplierDirectory,0);
    const manage=event.target.closest?.('[data-v359-manage-supplier]');if(manage){event.preventDefault();event.stopPropagation();openSupplierLinks(manage.dataset.v359ManageSupplier);}
    const pick=event.target.closest?.('[data-v359-pick-existing]');if(pick){event.preventDefault();openExistingPicker(pick.dataset.v359PickExisting);}
    if(event.target.closest?.('#modalSaveIdentityBtn')&&(state.selectedIdentityType||'owner')==='supplier'&&activeCopro()){
      const coproId=activeCopro(),editedId=state.selectedIdentityId||'',name=$('modalIdentityName')?.value.trim()||'';
      /* Le formulaire historique sauvegarde la fiche globale. Après sa réponse,
         on ajoute uniquement la liaison avec la copro active. Aucun fournisseur
         supplémentaire n'est créé. */
      setTimeout(async()=>{
        await loadLinks();
        const row=editedId?supplier(editedId):(state.suppliers||[]).find(s=>norm(s.name)===norm(name));
        if(row&&!isLinked(coproId,row.id)){await setLink(coproId,row.id,true,'manual');renderSupplierDirectory();}
      },1200);
    }
  },true);
  document.addEventListener('change',async event=>{
    const toggle=event.target.closest?.('[data-v359-link-copro]');if(toggle){toggle.disabled=true;const ok=await setLink(toggle.dataset.v359LinkCopro,toggle.dataset.supplier,toggle.checked,'manual');toggle.disabled=false;if(ok)toggle.closest('.v359-copro-link')?.classList.toggle('is-linked',toggle.checked);}
    if(event.target.id==='ocrFieldCopro'||event.target.id==='ocrFieldSupplier')enhanceOcr();
  });

  async function install(){await loadLinks();if((state.selectedIdentityType||'owner')==='supplier')renderSupplierDirectory();enhanceOcr();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700));else setTimeout(install,700);
})();
