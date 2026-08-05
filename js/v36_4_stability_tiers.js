/* WAPI One V36.4 — rendu unique et stable des tiers. */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  let showInactive=false;
  let supplierLinks=[];
  let linksLoaded=false;
  let loadingLinks=null;

  function contextCopro(){return state.activeCoproId||$('ownersFilterCopro')?.value||'';}
  function coproName(id){return (state.copros||[]).find(c=>String(c.id)===String(id))?.name||'';}
  function address(row){return [[[row.street,row.street_number].filter(Boolean).join(' ')],[row.postal_code,row.city].filter(Boolean).join(' '),row.country].flat().filter(Boolean).join(', ')||row.address||'';}
  function belongs(owner,cid){return !cid||String(owner.copro_id)===String(cid)||(state.lots||[]).some(l=>String(l.owner_id)===String(owner.id)&&String(l.copro_id)===String(cid));}
  function ownerActive(owner,cid){return owner.active!==false&&(state.lots||[]).some(l=>String(l.owner_id)===String(owner.id)&&l.active!==false&&(!cid||String(l.copro_id)===String(cid)));}
  function linked(cid,sid){return supplierLinks.some(l=>l.active!==false&&String(l.copro_id)===String(cid)&&String(l.supplier_id)===String(sid));}
  function supplierLinkCount(sid){return supplierLinks.filter(l=>l.active!==false&&String(l.supplier_id)===String(sid)).length;}
  function searchValue(){return norm($('identityListSearch')?.value);}
  function matches(row){const q=searchValue();return !q||norm([row.owner_code,row.supplier_code,row.display_name,row.name,row.email,row.phone,row.vat_number,row.iban,address(row)].join(' ')).includes(q);}

  async function loadLinks(force=false){
    if(linksLoaded&&!force)return supplierLinks;
    if(loadingLinks)return loadingLinks;
    loadingLinks=(async()=>{const {data,error}=await supabaseClient.from('compta_copro_suppliers').select('*');if(error){console.warn(error.message);supplierLinks=[];}else supplierLinks=data||[];linksLoaded=true;loadingLinks=null;return supplierLinks;})();
    return loadingLinks;
  }

  function cleanShell(){
    document.title='WAPI One — V36.5.1';
    document.querySelectorAll('[data-view="suppliers"]').forEach(el=>el.remove());
    $('suppliersView')?.classList.add('hidden');
    $('v363AllSuppliers')?.remove();
    const heading=$('ownersView')?.querySelector('.toolbar h2');if(heading)heading.textContent='Tiers';
    document.querySelectorAll('[data-view="owners"] .nav-label').forEach(el=>el.textContent='Tiers');
    document.querySelectorAll('.app-version-badge,.version-badge').forEach(el=>el.textContent='V36.5.1');
  }

  function toolbar(type,count,cid){
    if(type==='owner')return `<div class="v364-tier-toolbar"><div><strong>${count} copropriétaire(s)</strong><small>${showInactive?'Actifs et non actifs':'Copropriétaires actifs'}${cid?` — ${esc(coproName(cid))}`:''}</small></div><div class="v364-tier-actions"><label class="v364-check"><input id="v364ShowInactive" type="checkbox" ${showInactive?'checked':''}> Afficher aussi les non actifs</label><button class="btn secondary" id="v344GenerateAllVcs" type="button">Générer les VCS manquantes</button></div></div>`;
    if(type==='supplier')return `<div class="v364-tier-toolbar"><div><strong>${count} fournisseur(s)</strong><small>${cid?`Fournisseurs de ${esc(coproName(cid))}`:'Mode global'}</small></div><div class="v364-tier-actions"><button class="btn secondary" data-v364-global-suppliers type="button">Répertoire de tous les fournisseurs</button><button class="btn" data-add-identity="supplier" type="button">Nouveau fournisseur</button></div></div>`;
    return `<div class="v364-tier-toolbar"><div><strong>${count} occupant(s)</strong><small>${cid?esc(coproName(cid)):'Toutes les copropriétés'}</small></div><button class="btn" data-add-identity="occupant" type="button">Nouvel occupant</button></div>`;
  }

  function renderOwners(host,cid){
    let rows=(state.owners||[]).filter(o=>belongs(o,cid)&&matches(o));
    if(!showInactive)rows=rows.filter(o=>ownerActive(o,cid));
    host.innerHTML=toolbar('owner',rows.length,cid)+`<div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>Communication VCS</th><th>E-mail</th><th>Adresse</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${rows.map(o=>`<tr class="${ownerActive(o,cid)?'':'v364-inactive'}"><td><span class="code-pill">${esc(o.owner_code||'—')}</span></td><td><strong>${esc(o.display_name||'')}</strong></td><td><code>${esc(o.vcs||'À générer')}</code></td><td>${esc(o.email||'')}</td><td>${esc(address(o))}</td><td>${ownerActive(o,cid)?'<span class="badge ok">Actif</span>':'<span class="badge">Non actif</span>'}</td><td><div class="actions-inline"><button class="btn secondary small" data-open-identity="owner|${esc(o.id)}" type="button">Ouvrir</button><button class="btn danger small" data-v364-delete-owner="${esc(o.id)}" type="button">Supprimer</button></div></td></tr>`).join('')||'<tr><td colspan="7"><div class="notice">Aucun copropriétaire dans cette vue.</div></td></tr>'}</tbody></table></div>`;
  }

  function supplierRows(cid){return (state.suppliers||[]).filter(s=>s.active!==false&&matches(s)&&(!cid||linked(cid,s.id)));}
  function renderSuppliers(host,cid){
    const rows=supplierRows(cid);
    host.innerHTML=toolbar('supplier',rows.length,cid)+`<div class="table-wrap"><table><thead><tr><th>Code</th><th>Fournisseur</th><th>TVA</th><th>E-mail</th><th>IBAN</th><th>Copros</th><th>Actions</th></tr></thead><tbody>${rows.map(s=>`<tr><td><span class="code-pill">${esc(s.supplier_code||'—')}</span></td><td><strong>${esc(s.name||'')}</strong></td><td>${esc(s.vat_number||'')}</td><td>${esc(s.email||'')}</td><td>${esc(s.iban||'')}</td><td>${supplierLinkCount(s.id)}</td><td><div class="actions-inline"><button class="btn secondary small" data-open-identity="supplier|${esc(s.id)}" type="button">Ouvrir</button><button class="btn secondary small" data-v364-manage-supplier="${esc(s.id)}" type="button">Gérer les copros</button></div></td></tr>`).join('')||'<tr><td colspan="7"><div class="notice">Aucun fournisseur attribué à cette copropriété. Ouvre le répertoire global pour en ajouter un sans créer de doublon.</div></td></tr>'}</tbody></table></div>`;
  }

  function renderOccupants(host,cid){
    const lotIds=new Set((state.lots||[]).filter(l=>!cid||String(l.copro_id)===String(cid)).map(l=>String(l.id)));
    const rows=(state.occupants||[]).filter(o=>matches(o)&&(!cid||String(o.copro_id)===String(cid)||lotIds.has(String(o.lot_id))));
    host.innerHTML=toolbar('occupant',rows.length,cid)+`<div class="table-wrap"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Adresse</th><th>Action</th></tr></thead><tbody>${rows.map(o=>`<tr><td><strong>${esc(o.display_name||'')}</strong></td><td>${esc(o.email||'')}</td><td>${esc(o.phone||'')}</td><td>${esc(address(o))}</td><td><button class="btn secondary small" data-open-identity="occupant|${esc(o.id)}" type="button">Ouvrir</button></td></tr>`).join('')||'<tr><td colspan="5"><div class="notice">Aucun occupant.</div></td></tr>'}</tbody></table></div>`;
  }

  function render(){
    cleanShell();
    const host=$('ownersTable');if(!host)return;
    const type=state.selectedIdentityType||'owner',cid=contextCopro();
    document.querySelectorAll('[data-identity-type]').forEach(b=>{b.classList.toggle('active',b.dataset.identityType===type);b.setAttribute('aria-selected',b.dataset.identityType===type?'true':'false');});
    if(type==='owner')renderOwners(host,cid);else if(type==='supplier')renderSuppliers(host,cid);else renderOccupants(host,cid);
  }

  function globalSupplierList(q=''){
    const cid=contextCopro(),needle=norm(q),rows=(state.suppliers||[]).filter(s=>s.active!==false&&(!needle||norm([s.supplier_code,s.name,s.vat_number,s.email].join(' ')).includes(needle)));
    return `<div class="v364-global-list">${rows.map(s=>`<article class="v364-supplier-card"><div><strong>${esc(s.name||'')}</strong><small>${esc([s.supplier_code,s.vat_number].filter(Boolean).join(' — '))}</small></div><div class="v364-supplier-card-actions">${cid?`<label class="v364-check"><input type="checkbox" data-v364-link-supplier="${esc(s.id)}" ${linked(cid,s.id)?'checked':''}> Dans cette copro</label>`:''}<button class="btn secondary small" data-open-identity="supplier|${esc(s.id)}" type="button">Modifier</button><button class="btn secondary small" data-v364-manage-supplier="${esc(s.id)}" type="button">Copros</button></div></article>`).join('')||'<div class="notice">Aucun fournisseur trouvé.</div>'}</div>`;
  }

  function openGlobalSuppliers(){
    openAppModal('Répertoire global des fournisseurs',`<div class="v364-global-head"><div><strong>Toutes les fiches fournisseurs</strong><p>Une fiche reste unique et peut être attribuée à plusieurs copropriétés.</p></div><button class="btn" data-add-identity="supplier" type="button">Nouveau fournisseur</button></div><label>Rechercher un fournisseur<input id="v364SupplierSearch" placeholder="Nom, code, TVA, e-mail…"></label><div id="v364GlobalSupplierResults">${globalSupplierList()}</div>`,'<button class="btn secondary" data-modal-close type="button">Fermer</button>',{size:'wide'});
  }

  function openSupplierCopros(sid){
    const supplier=(state.suppliers||[]).find(s=>String(s.id)===String(sid));if(!supplier)return;
    openAppModal('Copropriétés du fournisseur',`<div class="notice">La fiche « ${esc(supplier.name)} » reste unique. Coche uniquement les copropriétés dans lesquelles ce fournisseur intervient.</div><div class="v364-copro-grid">${(state.copros||[]).filter(c=>c.active!==false).map(c=>`<label class="v364-copro-choice ${linked(c.id,sid)?'is-linked':''}"><span><strong>${esc(c.name)}</strong><small>${esc(c.code||'')}</small></span><input type="checkbox" data-v364-supplier-copro="${esc(c.id)}" data-supplier="${esc(sid)}" ${linked(c.id,sid)?'checked':''}></label>`).join('')}</div>`,'<button class="btn" data-modal-close type="button">Terminer</button>',{size:'wide'});
  }

  async function setSupplierLink(cid,sid,active){
    const existing=supplierLinks.find(l=>String(l.copro_id)===String(cid)&&String(l.supplier_id)===String(sid));
    let result;
    if(existing)result=await supabaseClient.from('compta_copro_suppliers').update({active,updated_at:new Date().toISOString()}).eq('id',existing.id).select('*').single();
    else result=await supabaseClient.from('compta_copro_suppliers').insert({copro_id:cid,supplier_id:sid,active,source:'manual',created_by:currentUser?.id||null}).select('*').single();
    if(result.error){alert(result.error.message);return false;}
    if(existing)Object.assign(existing,result.data);else supplierLinks.push(result.data);
    return true;
  }

  async function deleteOwner(id){
    const owner=(state.owners||[]).find(o=>String(o.id)===String(id));if(!owner)return;
    const lots=(state.lots||[]).filter(l=>String(l.owner_id)===String(id)).length;
    const calls=(state.ownerCalls||[]).filter(c=>String(c.owner_id)===String(id)).length;
    const bank=(state.bankTransactions||[]).filter(t=>String(t.tier_id)===String(id)&&t.tier_type==='owner').length;
    const entries=(state.entries||[]).filter(e=>String(e.owner_id||e.tier_id)===String(id)).length;
    const opening=(state.thirdOpeningBalances||[]).filter(e=>String(e.owner_id||e.tier_id)===String(id)).length;
    if(lots||calls||bank||entries||opening)return alert(`Suppression impossible : ${lots} lot(s) et ${calls+bank+entries+opening} opération(s) comptable(s) sont liés à ce copropriétaire.`);
    if(!confirm(`Supprimer définitivement ${owner.display_name||'ce copropriétaire'} ?`))return;
    const {error}=await supabaseClient.from('compta_owners').delete().eq('id',id);if(error)return alert(error.message);
    state.owners=state.owners.filter(o=>String(o.id)!==String(id));render();
  }

  document.addEventListener('input',event=>{
    if(event.target.id==='identityListSearch')render();
    if(event.target.id==='v364SupplierSearch')$('v364GlobalSupplierResults').innerHTML=globalSupplierList(event.target.value);
  },true);
  document.addEventListener('change',event=>{
    if(event.target.id==='v364ShowInactive'){showInactive=event.target.checked;render();return;}
    if(event.target.id==='ownersFilterCopro'){setTimeout(render,0);return;}
    const quick=event.target.closest?.('[data-v364-link-supplier]');if(quick){quick.disabled=true;setSupplierLink(contextCopro(),quick.dataset.v364LinkSupplier,quick.checked).then(ok=>{quick.disabled=false;if(ok)render();});return;}
    const link=event.target.closest?.('[data-v364-supplier-copro]');if(link){link.disabled=true;setSupplierLink(link.dataset.v364SupplierCopro,link.dataset.supplier,link.checked).then(ok=>{link.disabled=false;if(ok)link.closest('.v364-copro-choice')?.classList.toggle('is-linked',link.checked);});}
  },true);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-v364-global-suppliers]')){event.preventDefault();event.stopImmediatePropagation();openGlobalSuppliers();return;}
    const manage=event.target.closest?.('[data-v364-manage-supplier]');if(manage){event.preventDefault();event.stopImmediatePropagation();openSupplierCopros(manage.dataset.v364ManageSupplier);return;}
    const del=event.target.closest?.('[data-v364-delete-owner]');if(del){event.preventDefault();event.stopImmediatePropagation();deleteOwner(del.dataset.v364DeleteOwner);return;}
  },true);

  window.WapiTiersV364={render,loadLinks,openGlobalSuppliers};
  window.WapiStableReady=async()=>{cleanShell();if($('appScreen')?.classList.contains('hidden')){document.documentElement.classList.remove('wapi-booting');return;}try{await loadLinks();render();}catch(error){console.warn('Finalisation tiers :',error);}finally{document.documentElement.classList.remove('wapi-booting');}};
  window.renderOwners=render;
  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function')window.renderAll=function(){const out=oldRenderAll.apply(this,arguments);setTimeout(render,0);return out;};
  async function install(){cleanShell();await loadLinks();render();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900),{once:true});else setTimeout(install,900);
})();
