/* WAPI One V35.3 - correctif integre */
(()=>{'use strict';
  const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let issuers=[], profiles=[];
  const activeCopro=()=>String(state?.activeCoproId||$('activeCoproSelect')?.value||'');
  async function load353(){
    if(!supabaseClient)return;
    const [ir,pr]=await Promise.all([
      supabaseClient.from('compta_billing_issuers').select('*').order('company_name'),
      supabaseClient.from('compta_user_profiles').select('*').order('display_name')
    ]);
    if(!ir.error)issuers=ir.data||[]; else console.warn('Emetteurs:',ir.error.message);
    if(!pr.error)profiles=pr.data||[];
    await syncCoproBanks();
  }
  async function syncCoproBanks(){
    const source=state?.v28CoproBankAccounts||[], target=state?.bankAccounts||[];
    let changed=false;
    for(const b of source){
      if(!b.iban||target.some(x=>String(x.copro_id)===String(b.copro_id)&&String(x.iban||'').replace(/\s/g,'')===String(b.iban).replace(/\s/g,'')))continue;
      const payload={copro_id:b.copro_id,label:b.label||'Compte bancaire',iban:b.iban,bic:b.bic||null,active:b.active!==false,created_by:currentUser?.id||null};
      const r=await supabaseClient.from('compta_bank_accounts').insert(payload).select('*').single();
      if(!r.error&&r.data){state.bankAccounts.push(r.data);target.push(r.data);changed=true;}
      else if(r.error) console.error('Liaison compte bancaire financier:',r.error.message);
    }
    if(changed&&typeof loadBankAccounts==='function')await loadBankAccounts();
  }
  function issuerOptions(selected=''){return `<option value="">Choisir la société émettrice…</option>`+issuers.filter(x=>x.active!==false).map(x=>`<option value="${x.id}" ${String(x.id)===String(selected)?'selected':''}>${esc(x.company_name)} (${esc(x.invoice_prefix||x.code)})</option>`).join('');}
  function supplierOptions(selected=''){return `<option value="">Choisir le fournisseur correspondant…</option>`+(state.suppliers||[]).map(x=>`<option value="${x.id}" ${String(x.id)===String(selected)?'selected':''}>${esc((x.supplier_code?x.supplier_code+' · ':'')+(x.name||''))}</option>`).join('');}

  // Une seule navigation : les onglets de l'univers en haut restent la reference.
  function tidyBilling(){document.querySelector('#syndicBillingView>.syndic-tabs')?.remove();}

  function openIssuer353(id){
    const x=issuers.find(i=>String(i.id)===String(id));if(!x)return alert('Société émettrice introuvable. Exécutez la migration SQL V35.3 puis rechargez.');
    openAppModal('Modifier la société émettrice',`<div class="form-grid"><label>Société / fournisseur lié<select id="w353IssuerSupplier">${supplierOptions(x.supplier_id)}</select></label><label>Nom société<input id="w353IssuerName" value="${esc(x.company_name)}"></label><label>TVA<input id="w353IssuerVat" value="${esc(x.vat_number||'')}"></label><label>Préfixe<input id="w353IssuerPrefix" value="${esc(x.invoice_prefix||'')}"></label><label>Email<input id="w353IssuerEmail" value="${esc(x.email||'')}"></label><label>Téléphone<input id="w353IssuerPhone" value="${esc(x.phone||'')}"></label><label>IBAN<input id="w353IssuerIban" value="${esc(x.iban||'')}"></label><label>BIC<input id="w353IssuerBic" value="${esc(x.bic||'')}"></label><label style="grid-column:1/-1">Adresse<textarea id="w353IssuerAddress">${esc(x.address||'')}</textarea></label></div>`,`<button class="btn secondary" data-modal-close>Fermer</button><button class="btn" id="w353SaveIssuer" data-id="${x.id}">Enregistrer</button>`,{size:'wide'});
  }
  async function saveIssuer353(id){
    const p={supplier_id:$('w353IssuerSupplier').value||null,company_name:$('w353IssuerName').value.trim(),vat_number:$('w353IssuerVat').value.trim(),invoice_prefix:$('w353IssuerPrefix').value.trim(),email:$('w353IssuerEmail').value.trim(),phone:$('w353IssuerPhone').value.trim(),iban:$('w353IssuerIban').value.trim(),bic:$('w353IssuerBic').value.trim(),address:$('w353IssuerAddress').value.trim(),updated_at:new Date().toISOString()};
    const r=await supabaseClient.from('compta_billing_issuers').update(p).eq('id',id);if(r.error)return alert(r.error.message);closeAppModal();await load353();renderSyndicBillingV23();
  }

  const oldContractModal=typeof openSyndicContractModalV23==='function'?openSyndicContractModalV23:null;
  if(oldContractModal)openSyndicContractModalV23=function(id=''){
    oldContractModal(id);
    const select=$('synContractIssuer'), contract=(state.syndicContracts||[]).find(x=>String(x.id)===String(id));
    if(select){select.innerHTML=issuerOptions(contract?.issuer_id||issuers[0]?.id||'');if(!issuers.length)select.insertAdjacentHTML('afterend','<div class="notice">Aucune société disponible : exécutez le SQL V35.3 puis rechargez la page.</div>');}
  };

  // La facture interne de la copro utilise le fournisseur lié à la société émettrice.
  if(typeof v24CreateSupplierInvoiceFromSyndic==='function')v24CreateSupplierInvoiceFromSyndic=async function(inv,officialNumber){
    const existing=await supabaseClient.from('compta_invoices').select('id').eq('invoice_number',officialNumber).eq('source','syndic_billing').limit(1);
    if(!existing.error&&(existing.data||[])[0])return existing.data[0].id;
    const em=issuers.find(x=>String(x.id)===String(inv.issuer_id))||{};
    let supplier=(state.suppliers||[]).find(x=>String(x.id)===String(em.supplier_id));
    if(!supplier)throw new Error(`La société émettrice ${em.company_name||''} doit être liée à un fournisseur dans Réglages.`);
    const blob=await syndicInvoicePdfBlobV23({...inv,invoice_number:officialNumber,status:'issued'}),dataUrl=await v24BlobToDataUrl(blob);
    const payload={copro_id:inv.copro_id,supplier_id:supplier.id,account_id:inv.account_id||null,invoice_number:officialNumber,invoice_date:inv.invoice_date||new Date().toISOString().slice(0,10),amount_total:Number(inv.amount_total||0),status:'validated',payment_status:'unpaid',description:inv.description||`Facture ${em.company_name||''}`,source:'syndic_billing',file_name:`${v23Slug(officialNumber)}.pdf`,file_data_url:dataUrl,pdf_mime_type:'application/pdf',created_by:currentUser?.id||null};
    const r=await supabaseClient.from('compta_invoices').insert(payload).select('id').single();if(r.error)throw r.error;return r.data?.id||null;
  };

  function renewContract(id){
    const c=(state.syndicContracts||[]).find(x=>String(x.id)===String(id));if(!c)return;
    const old=Number(c.monthly_amount_htva||0),year=Number(c.contract_year||String(c.year_label||'').match(/20\d{2}/)?.[0]||new Date().getFullYear());
    openAppModal('Renouveler et indexer le contrat',`<div class="form-grid"><label>Nouvel exercice<input id="w353RenewYear" type="number" value="${year+1}"></label><label>Indexation (%)<input id="w353RenewRate" type="number" step="0.01" value="0"></label><label>Ancien montant HTVA<input value="${old.toFixed(2)}" disabled></label><label>Nouveau montant HTVA<input id="w353RenewAmount" type="number" step="0.01" value="${old.toFixed(2)}"></label></div><div class="notice">Le contrat actuel est conservé pour son historique. Un nouveau contrat annuel sera créé.</div>`,`<button class="btn secondary" data-modal-close>Annuler</button><button class="btn" id="w353ConfirmRenew" data-id="${id}">Créer le renouvellement</button>`,{size:'wide'});
    $('w353RenewRate').oninput=()=>{$('w353RenewAmount').value=(old*(1+Number($('w353RenewRate').value||0)/100)).toFixed(2)};
  }
  async function saveRenewal(id){
    const c=(state.syndicContracts||[]).find(x=>String(x.id)===String(id));if(!c)return;
    const y=Number($('w353RenewYear').value), rate=Number($('w353RenewRate').value||0), amount=Number($('w353RenewAmount').value||0);
    if(!y||!amount)return alert('Exercice et montant sont obligatoires.');
    const p={...c};['id','created_at','updated_at','compta_copros'].forEach(k=>delete p[k]);Object.assign(p,{contract_year:y,year_label:String(y),monthly_amount_htva:amount,indexation_rate:rate,renewed_from_contract_id:id,renewed_at:new Date().toISOString(),active:true,created_by:currentUser?.id||null});
    const r=await supabaseClient.from('compta_syndic_billing_contracts').insert(p);if(r.error)return alert(r.error.message);closeAppModal();await loadSyndicBillingV23();renderSyndicBillingV23();
  }

  function renderUsers353(){
    const v=$('usersView');if(!v)return;v.innerHTML=`<div class="card"><div class="w353-toolbar"><div><h2>Utilisateurs WAPI One</h2><p>Coordonnées, rôle et accès. Les mots de passe restent protégés par Supabase.</p></div><button class="btn secondary" id="w353MyPassword">Changer mon mot de passe</button></div><div class="w353-user-row" style="font-weight:800;background:#f7f8fb"><span>Utilisateur</span><span>E-mail</span><span>Téléphone</span><span>Rôle</span><span>Actions</span></div>${profiles.map(p=>`<div class="w353-user-row"><span><strong>${esc(p.display_name||'')}</strong><small>${p.active===false?'Inactif':'Actif'}</small></span><span>${esc(p.email||'')}</span><span>${esc(p.phone||p.mobile||'')}</span><span>${esc(p.role||'gestionnaire')}</span><span><button class="btn secondary small" data-w353-user="${p.id}">Modifier</button> <button class="btn secondary small" data-w353-reset="${esc(p.email||'')}">Réinitialiser MDP</button></span></div>`).join('')}</div>`;
  }
  function openUser353(id){const p=profiles.find(x=>String(x.id)===String(id));if(!p)return;openAppModal('Utilisateur',`<div class="form-grid"><label>Nom<input id="w353UserName" value="${esc(p.display_name||'')}"></label><label>E-mail<input value="${esc(p.email||'')}" disabled></label><label>Téléphone<input id="w353UserPhone" value="${esc(p.phone||'')}"></label><label>Fonction<input id="w353UserJob" value="${esc(p.job_title||'')}"></label><label>Rôle<select id="w353UserRole"><option>gestionnaire</option><option>admin</option><option>lecture</option></select></label><label>Actif<select id="w353UserActive"><option value="true">Oui</option><option value="false">Non</option></select></label></div>`,`<button class="btn secondary" data-modal-close>Fermer</button><button class="btn" id="w353SaveUser" data-id="${id}">Enregistrer</button>`,{size:'wide'});$('w353UserRole').value=p.role||'gestionnaire';$('w353UserActive').value=String(p.active!==false);}
  async function saveUser353(id){const p={display_name:$('w353UserName').value.trim(),phone:$('w353UserPhone').value.trim(),job_title:$('w353UserJob').value.trim(),role:$('w353UserRole').value,active:$('w353UserActive').value==='true',updated_at:new Date().toISOString()};const r=await supabaseClient.from('compta_user_profiles').update(p).eq('id',id);if(r.error)return alert(r.error.message);closeAppModal();await load353();renderUsers353();}

  function strictBankSelectors(){
    const cid=activeCopro(), accounts=(state.bankAccounts||[]).filter(b=>b.active!==false&&(!cid||String(b.copro_id)===cid));
    const opts=`<option value="">${cid?'Choisir un compte de cette copropriété':'Choisir une copropriété'}</option>`+accounts.map(b=>`<option value="${b.id}">${esc((b.label||'Compte')+' · '+(b.iban||''))}</option>`).join('');
    ['financialLedgerAccount','manualStatementAccount','bankTxAccount','codaBankAccount'].forEach(id=>{const el=$(id);if(!el)return;const old=el.value;el.innerHTML=opts;if(accounts.some(a=>String(a.id)===String(old)))el.value=old;else if(accounts.length===1)el.value=accounts[0].id;});
    const box=$('financialLedgerBankSummary');if(box&&cid&&!accounts.length)box.innerHTML='<div class="notice">Aucun compte bancaire financier lié à cette copropriété. Ouvrez ses réglages et enregistrez le compte.</div>';
  }

  function fixCallSelection(){
    document.querySelectorAll('[data-call-select]').forEach(x=>x.disabled=false);
    document.querySelectorAll('[data-owner-call-select]').forEach(x=>{if(!x.dataset.w353Init){x.checked=false;x.dataset.w353Init='1';}});
  }
  if(typeof v23SelectedCallRows==='function') v23SelectedCallRows=function(){
    const ids=new Set([...document.querySelectorAll('[data-owner-call-select]:checked')].map(x=>String(x.dataset.ownerCallSelect)));
    document.querySelectorAll('[data-call-select]:checked').forEach(g=>g.closest('.call-group-card')?.querySelectorAll('[data-owner-call-select]').forEach(x=>ids.add(String(x.dataset.ownerCallSelect))));
    return [...ids].map(id=>(state.ownerCalls||[]).find(c=>String(c.id)===id)).filter(Boolean);
  };
  if(typeof v22CurrentCallRecipients==='function') v22CurrentCallRecipients=function(){return v23SelectedCallRows().map(c=>({owner:ownerForCallV20(c),owner_id:c.owner_id,copro:v22CoproById(c.copro_id),copro_id:c.copro_id,document_type:'owner_call',document_label:c.period_label||c.label||'Appel',amount:c.amount_due,due_date:c.due_date,source_type:'owner_call',source_id:c.id,metadata:{call_id:c.call_id,lot_id:c.lot_id}}));};

  function ensureAgButtons(){
    const box=document.querySelector('#agModuleRoot .ag-pdf-actions'),m=typeof agMeeting==='function'?agMeeting():null;if(!box||!m)return;
    box.querySelectorAll('[data-v22-send-ag-convocation],[data-v22-send-ag-minutes]').forEach(x=>x.remove());
    box.insertAdjacentHTML('beforeend',`<span class="w353-send-buttons"><button class="btn" data-v22-send-ag-convocation="${m.id}">Envoyer convocations (mail/courrier)</button><button class="btn secondary" data-v22-send-ag-minutes="${m.id}">Envoyer PV (mail/courrier)</button></span>`);
  }

  const oldBilling=typeof renderSyndicBillingV23==='function'?renderSyndicBillingV23:null; if(oldBilling)renderSyndicBillingV23=function(){tidyBilling();oldBilling();setTimeout(()=>{tidyBilling();document.querySelectorAll('[data-edit-syndic-contract]').forEach(b=>{if(!b.parentElement.querySelector('[data-w353-renew]'))b.insertAdjacentHTML('afterend',`<button class="btn secondary small" data-w353-renew="${b.dataset.editSyndicContract}">Renouveler / indexer</button>`)});},0)};
  const oldCalls=typeof renderCalls==='function'?renderCalls:null;if(oldCalls)renderCalls=function(){oldCalls();fixCallSelection();};
  const oldBank=typeof renderBank==='function'?renderBank:null;if(oldBank)renderBank=function(){oldBank();strictBankSelectors();};
  const oldLedger=typeof renderFinancialLedger==='function'?renderFinancialLedger:null;if(oldLedger)renderFinancialLedger=function(){oldLedger();strictBankSelectors();};
  const oldRenderAll=typeof renderAll==='function'?renderAll:null;if(oldRenderAll)renderAll=function(){oldRenderAll();setTimeout(()=>{tidyBilling();fixCallSelection();strictBankSelectors();ensureAgButtons();},0)};
  const oldSwitch=window.switchToView;if(oldSwitch)window.switchToView=function(name){oldSwitch(name);setTimeout(()=>{if(name==='users')renderUsers353();if(name==='syndicBilling')tidyBilling();strictBankSelectors();ensureAgButtons();},0)};

  document.addEventListener('change',e=>{if(e.target.matches('[data-call-select]'))e.target.closest('.call-group-card')?.querySelectorAll('[data-owner-call-select]').forEach(x=>x.checked=e.target.checked);});
  document.addEventListener('click',async e=>{
    const ri=e.target.closest('[data-w353-renew]');if(ri)return renewContract(ri.dataset.w353Renew);
    const cr=e.target.closest('#w353ConfirmRenew');if(cr)return saveRenewal(cr.dataset.id);
    const ei=e.target.closest('[data-w352-edit-issuer]');if(ei){e.preventDefault();e.stopImmediatePropagation();return openIssuer353(ei.dataset.w352EditIssuer);}
    const si=e.target.closest('#w353SaveIssuer');if(si)return saveIssuer353(si.dataset.id);
    const eu=e.target.closest('[data-w353-user]');if(eu)return openUser353(eu.dataset.w353User);
    const su=e.target.closest('#w353SaveUser');if(su)return saveUser353(su.dataset.id);
    const rr=e.target.closest('[data-w353-reset]');if(rr){const r=await supabaseClient.auth.resetPasswordForEmail(rr.dataset.w353Reset,{redirectTo:location.origin+location.pathname});return alert(r.error?r.error.message:'E-mail de réinitialisation envoyé.');}
    if(e.target.closest('#w353MyPassword')){const p=prompt('Nouveau mot de passe (8 caractères minimum) :');if(p&&p.length>=8){const r=await supabaseClient.auth.updateUser({password:p});alert(r.error?r.error.message:'Mot de passe modifié.');}}
  },true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(async()=>{await load353();tidyBilling();strictBankSelectors();fixCallSelection();ensureAgButtons();if(!$('usersView')?.classList.contains('hidden'))renderUsers353();},1400));
})();
