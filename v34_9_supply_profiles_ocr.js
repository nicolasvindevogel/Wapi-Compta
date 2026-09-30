/* WAPI One V34.9 — EAN, compteurs et montants OCR stricts. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V34.9 — Profils fournisseurs';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const compact=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const months=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  state.v349SupplyProfiles=state.v349SupplyProfiles||[];

  function parseAmount(raw){
    if(!raw)return null;let s=String(raw).replace(/[€\s']/g,'');
    if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
    else s=s.replace(',','.');
    const n=Number(s.replace(/[^0-9.-]/g,''));return Number.isFinite(n)&&n>=0&&n<10000000?n:null;
  }
  function moneyTokens(line){
    const rx=/([0-9]{1,3}(?:[ .'][0-9]{3})*(?:[,.][0-9]{2})|[0-9]{1,8}(?:[,.][0-9]{2}))(?:\s*(?:€|EUR))?/gi;
    return [...String(line||'').matchAll(rx)].map(m=>parseAmount(m[1])).filter(v=>v!==null);
  }
  function strictAmount(lines,kind){
    const patterns={
      total:[/net\s+(?:a|à)\s+payer/i,/total\s+(?:tvac|ttc)/i,/montant\s+(?:tvac|ttc)/i,/grand\s+total/i,/balance\s+due/i,/total\s+facture/i],
      base:[/total\s+htva/i,/total\s+hors\s+tva/i,/hors\s+taxe/i,/base\s+imposable/i,/sous[- ]?total/i,/subtotal/i],
      vat:[/montant\s+tva/i,/total\s+tva/i,/vat\s+amount/i,/btw[- ]?bedrag/i,/^\s*tva\s+\d{1,2}(?:[,.]\d+)?\s*%/i]
    }[kind];
    const found=[];
    lines.forEach((line,index)=>{
      if(!patterns.some(p=>p.test(norm(line))))return;
      const own=moneyTokens(line),next=moneyTokens(lines[index+1]||'');
      const values=own.length?own:next;
      if(values.length)found.push({value:values[values.length-1],index});
    });
    return found[0]?.value??null;
  }
  function extractStrictAmounts(text){
    const ls=String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    let total=strictAmount(ls,'total'),base=strictAmount(ls,'base'),vat=strictAmount(ls,'vat');
    if(base!==null&&vat!==null){
      const calculated=Number((base+vat).toFixed(2));
      if(total===null)total=calculated;
      else if(Math.abs(total-calculated)>.05)total=null;
    }
    if(total!==null&&base!==null&&vat===null&&total>=base)vat=Number((total-base).toFixed(2));
    if(total!==null&&vat!==null&&base===null&&total>=vat)base=Number((total-vat).toFixed(2));
    const valid=total!==null&&total>0&&(!base||!vat||Math.abs((base+vat)-total)<.05);
    return {amount:valid?total:'',amount_excl_vat:base??'',vat_amount:vat??'',amount_check:valid?'verified':'missing_or_inconsistent'};
  }
  function explicitCopro(text){
    const n=norm(text),rows=[];
    for(const copro of state.copros||[]){
      const name=norm(copro.name||''),address=norm([copro.street,copro.street_number,copro.postal_code,copro.city,copro.address].filter(Boolean).join(' '));
      let score=0;
      if(name.length>=5&&n.includes(name))score=95;
      if(address.length>=10&&address.split(' ').filter(x=>x.length>2).every(x=>n.includes(x)))score=Math.max(score,92);
      if(score)rows.push({copro,score});
    }
    rows.sort((a,b)=>b.score-a.score);
    return rows.length===1||rows[0]?.score>rows[1]?.score?rows[0]:null;
  }
  function profileMatch(text,supplierId){
    const packed=compact(text),n=norm(text),profiles=(state.v349SupplyProfiles||[]).filter(p=>p.active!==false);
    const exact=profiles.filter(p=>{
      const e=compact(p.ean),m=compact(p.meter_number);
      return (e.length>=8&&packed.includes(e))||(m.length>=4&&packed.includes(m));
    });
    if(exact.length===1)return {profile:exact[0],proof:exact[0].ean?'EAN reconnu':'Compteur reconnu',confidence:99};
    const keyword=profiles.filter(p=>p.supplier_id===supplierId&&(p.keywords||[]).some(k=>norm(k).length>2&&n.includes(norm(k))));
    if(keyword.length===1)return {profile:keyword[0],proof:'Fournisseur et mots-clés reconnus',confidence:84,noCopro:true};
    return {profile:null,proof:'',confidence:0};
  }
  function formatLabel(profile,date){
    const d=date?new Date(`${date}T12:00:00`):new Date(),service={electricity:'Électricité',gas:'Gaz',water:'Eau',other:profile.label||'Charge'}[profile.service_type]||profile.label;
    return String(profile.label_template||'{service} — {mois} {année}').replaceAll('{service}',service).replaceAll('{mois}',months[d.getMonth()]).replaceAll('{année}',String(d.getFullYear())).replaceAll('{annee}',String(d.getFullYear()));
  }
  function analyze(text,options={}){
    const amounts=extractStrictAmounts(text),match=profileMatch(text,options.supplierId||null),explicit=explicitCopro(text);
    const profile=match.profile;
    /* Un profil ne choisit la copropriété que si son EAN/compteur exact est
       présent. Les simples mots-clés servent au compte, jamais à la copro. */
    const coproId=match.confidence>=95&&profile?.copro_id?profile.copro_id:(explicit?.copro.id||null);
    const dateMatch=String(text||'').match(/(?:date\s+(?:de\s+)?facture|facture\s+du|invoice\s+date)\D{0,12}([0-3]?\d[\/.\-][01]?\d[\/.\-](?:20)?\d{2})/i);
    let iso=options.date||'';if(!iso&&dateMatch){const p=dateMatch[1].split(/[\/.\-]/);const y=p[2].length===2?`20${p[2]}`:p[2];iso=`${y}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}
    return {coproId,coproConfidence:match.confidence>=95?99:(explicit?.score||0),profileId:profile?.id||null,proof:match.proof|| (explicit?'Nom/adresse de copropriété reconnu':''),fields:{
      ...amounts,
      account_id:profile?.account_id||'',
      distribution_key_id:profile?.distribution_key_id||'',
      charge_target:profile?.charge_target||'',
      description:profile?formatLabel(profile,iso):'',
      supply_profile_id:profile?.id||'',
      supply_detection_proof:match.proof||'',
      copro_detection_proof:explicit?'Nom ou adresse présent sur la facture':(match.confidence>=95?match.proof:'')
    }};
  }
  window.WapiOcrV349={analyze,extractStrictAmounts};

  async function loadProfiles(){
    if(!supabaseClient)return;
    const {data,error}=await supabaseClient.from('compta_supply_profiles').select('*').order('label');
    if(!error)state.v349SupplyProfiles=data||[];
  }
  function options(list,selected,label){return `<option value="">${label}</option>`+(list||[]).map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.name||x.display_name||`${x.code||''} - ${x.label||''}`)}</option>`).join('');}
  function openProfiles(){
    const body=`<div class="popup-form"><div class="notice">Un seul fournisseur peut avoir plusieurs profils : électricité, gaz ou plusieurs compteurs d’eau. L’EAN ou le compteur identifie la copropriété et le compte sans créer de fournisseur en double.</div><div class="form-grid">
      <label>Copropriété<select id="v349Copro">${options(state.copros,'','Choisir…')}</select></label>
      <label>Fournisseur<select id="v349Supplier">${options(state.suppliers,'','Choisir…')}</select></label>
      <label>Type<select id="v349Type"><option value="electricity">Électricité</option><option value="gas">Gaz</option><option value="water">Eau</option><option value="other">Autre</option></select></label>
      <label>Nom du profil<input id="v349Label" placeholder="ENGIE — Électricité"></label>
      <label>EAN<input id="v349Ean" placeholder="EAN électricité ou gaz"></label>
      <label>N° compteur<input id="v349Meter" placeholder="Compteur d’eau ou énergie"></label>
      <label>Compte comptable<select id="v349Account">${options((state.accounts||[]).filter(a=>String(a.code||'').startsWith('6')),'','Choisir…')}</select></label>
      <label>Clé de répartition<select id="v349Key">${options(state.distributionKeys,'','Choisir…')}</select></label>
      <label>Mots-clés<input id="v349Keywords" placeholder="électricité, kWh, énergie"></label>
      <label>Libellé automatique<input id="v349Template" value="{service} — {mois} {année}"></label>
    </div><div id="v349ProfileList" class="v349-profile-list"></div></div>`;
    openAppModal('Profils fournisseurs et compteurs',body,'<button class="btn secondary" data-modal-close type="button">Fermer</button><button class="btn" id="v349Save" type="button">Ajouter le profil</button>',{subtitle:'EAN, compteurs et automatisation comptable',size:'wide'});
    renderProfiles();$('v349Save').onclick=saveProfile;
  }
  function renderProfiles(){
    const host=$('v349ProfileList');if(!host)return;
    host.innerHTML=(state.v349SupplyProfiles||[]).map(p=>{const c=(state.copros||[]).find(x=>x.id===p.copro_id),s=(state.suppliers||[]).find(x=>x.id===p.supplier_id),a=(state.accounts||[]).find(x=>x.id===p.account_id);return `<div class="v349-profile-row"><div><strong>${esc(p.label)}</strong><small>${esc(c?.name||'')} · ${esc(s?.name||'')}</small></div><div><strong>${esc(p.ean||p.meter_number||'Sans identifiant')}</strong><small>${esc(p.service_type)}</small></div><div><strong>${esc(a?`${a.code} — ${a.label}`:'Compte à compléter')}</strong></div><div><small>${esc(p.label_template||'')}</small></div><button class="btn danger small" data-v349-delete="${p.id}" type="button">Supprimer</button></div>`;}).join('')||'<div class="notice">Aucun profil enregistré.</div>';
  }
  async function saveProfile(){
    const payload={copro_id:$('v349Copro').value,supplier_id:$('v349Supplier').value||null,service_type:$('v349Type').value,label:$('v349Label').value.trim(),ean:$('v349Ean').value.trim()||null,meter_number:$('v349Meter').value.trim()||null,account_id:$('v349Account').value||null,distribution_key_id:$('v349Key').value||null,keywords:$('v349Keywords').value.split(',').map(x=>x.trim()).filter(Boolean),label_template:$('v349Template').value.trim()||'{service} — {mois} {année}',created_by:currentUser?.id||null};
    if(!payload.copro_id||!payload.label||(!payload.ean&&!payload.meter_number))return alert('Copropriété, nom du profil et EAN ou compteur sont obligatoires.');
    const {error}=await supabaseClient.from('compta_supply_profiles').insert(payload);if(error)return alert(error.message);
    await loadProfiles();renderProfiles();
  }
  async function deleteProfile(id){if(!confirm('Supprimer ce profil ?'))return;const {error}=await supabaseClient.from('compta_supply_profiles').delete().eq('id',id);if(error)return alert(error.message);await loadProfiles();renderProfiles();}
  function installButton(){
    const toolbar=$('invoiceOcrView')?.querySelector('.toolbar');if(!toolbar||$('v349ProfilesBtn'))return;
    toolbar.insertAdjacentHTML('beforeend','<button class="btn secondary" id="v349ProfilesBtn" type="button">EAN et compteurs</button>');
  }
  const oldRender=window.renderInvoiceOcrV13;
  if(typeof oldRender==='function')window.renderInvoiceOcrV13=function(){const out=oldRender.apply(this,arguments);setTimeout(()=>{installButton();const q=(state.validationQueue||[]).find(x=>x.id===state.ocrSelectedQueueId),d={...(q?.extracted_data||{}),...(q?.corrected_data||{})};const fields=document.querySelector('.ocr-fields');if(fields&&!fields.querySelector('.v349-ocr-proof'))fields.insertAdjacentHTML('afterbegin',`<div class="v349-ocr-proof ${d.amount_check==='verified'?'':'warn'}">${d.supply_detection_proof?`Profil : ${esc(d.supply_detection_proof)}. `:''}${d.copro_detection_proof?`Copropriété : ${esc(d.copro_detection_proof)}. `:'Aucune copropriété attribuée sans preuve. '}${d.amount_check==='verified'?'Montants contrôlés.':'Total TVAC non suffisamment fiable : vérification obligatoire.'}</div>`);},0);return out;};
  document.addEventListener('click',e=>{if(e.target.closest?.('#v349ProfilesBtn'))openProfiles();const del=e.target.closest?.('[data-v349-delete]');if(del)deleteProfile(del.dataset.v349Delete);});
  async function install(){await loadProfiles();installButton();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500));else setTimeout(install,500);
})();
