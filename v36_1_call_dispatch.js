/* WAPI One V36.1 — Envoi multicopro des appels, filtrage gestionnaire strict et statut unifie. */
(()=>{
  'use strict';
  window.WAPI_ONE_VERSION='V36.1';
  window.WAPI_ONE_BUILD_DATE='2026-08-05';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur=v=>typeof money==='function'?money(Number(v||0)):new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const fmt=v=>typeof formatDateV20==='function'?formatDateV20(v):(v?new Date(v+'T00:00:00').toLocaleDateString('fr-BE'):'—');
  const filters={manager:localStorage.getItem('wapi_call_dispatch_manager')||'',copro:'',type:'provisions',status:'to_send',from:'',to:'',search:''};

  function managerId(c){return String(c?.manager_user_id||c?.manager_id||c?.gestionnaire_id||'');}
  function profileName(p){return p?.display_name||p?.full_name||p?.name||p?.email||'Utilisateur';}
  function coproOf(call){return (state.copros||[]).find(c=>String(c.id)===String(call.copro_id))||call.compta_copros||{};}
  function ownerOf(call){return (state.owners||[]).find(o=>String(o.id)===String(call.owner_id))||call.compta_owners||{};}
  function ownerName(o){return o?.display_name||o?.name||[o?.first_name,o?.last_name].filter(Boolean).join(' ')||'Copropriétaire';}
  function ownerEmail(o){return String(o?.email||o?._email||'').trim();}
  function accountingStatus(c){return typeof ownerCallAccountingStatus==='function'?ownerCallAccountingStatus(c):(c?.accounting_status||c?.status||'');}
  function logSaysSent(c){return (state.deliveryLogs||[]).some(l=>String(l.source_id)===String(c.id)&&String(l.source_type||'')==='owner_call'&&['sent','paper_ready','prepared','delivered'].includes(String(l.status||l.provider_status||'').toLowerCase()));}
  function isSent(c){const s=String(c?.delivery_status||c?.send_status||c?.email_status||'').toLowerCase();return Boolean(c?.sent_at)||['sent','paper_ready','prepared','delivered','emailed'].includes(s)||logSaysSent(c);}
  function channel(o){if(typeof defaultChannelForOwnerV21==='function')return defaultChannelForOwnerV21(o);return ownerEmail(o)?'email':'paper';}
  function allowedCopros(){return (state.copros||[]).filter(c=>c.active!==false&&(!filters.manager||managerId(c)===String(filters.manager)));}

  function ensureManagerFilter(){
    const copro=$('callDispatchCoproFilter'); if(!copro)return;
    let manager=$('v361CallManager');
    if(!manager){const label=document.createElement('label');label.innerHTML='Gestionnaire <select id="v361CallManager"></select>';copro.closest('label')?.before(label);manager=$('v361CallManager');}
    const profiles=(state.userProfiles||[]).filter(p=>p.active!==false);
    const options='<option value="">Tous les gestionnaires</option>'+profiles.map(p=>`<option value="${esc(p.id)}">${esc(profileName(p))}</option>`).join('');
    if(manager.innerHTML!==options)manager.innerHTML=options;
    if(filters.manager&&!profiles.some(p=>String(p.id)===String(filters.manager)))filters.manager='';
    manager.value=filters.manager;
  }
  function readFilters(){
    filters.manager=$('v361CallManager')?.value||filters.manager||'';
    filters.copro=$('callDispatchCoproFilter')?.value||'';
    filters.type=$('callDispatchTypeFilter')?.value||'provisions';
    filters.status=$('callDispatchStatusFilter')?.value||'to_send';
    filters.from=$('callDispatchFrom')?.value||'';filters.to=$('callDispatchTo')?.value||'';
    filters.search=($('callDispatchSearch')?.value||'').trim().toLowerCase();
  }
  function rows(){
    const permitted=new Set(allowedCopros().map(c=>String(c.id)));
    return (state.ownerCalls||[]).filter(c=>{
      if(accountingStatus(c)!=='accounted')return false;
      if(!permitted.has(String(c.copro_id)))return false;
      if(filters.copro&&String(c.copro_id)!==String(filters.copro))return false;
      if(filters.type!=='all'&&String(c.call_type||c.type||'provisions')!==filters.type)return false;
      const d=String(c.due_date||c.call_date||'');if(filters.from&&d<filters.from)return false;if(filters.to&&d>filters.to)return false;
      const sent=isSent(c);if(filters.status==='sent'&&!sent)return false;if(filters.status==='to_send'&&sent)return false;
      if(filters.search){const o=ownerOf(c),cp=coproOf(c),hay=[cp.name,ownerName(o),o.email,c.period_label,c.label,c.compta_lots?.lot_number].join(' ').toLowerCase();if(!hay.includes(filters.search))return false;}
      return true;
    });
  }
  function groups(data){const m=new Map();data.forEach(c=>{const k=String(c.call_id||`${c.copro_id}|${c.period_label||c.label||''}|${c.due_date||''}`);if(!m.has(k))m.set(k,[]);m.get(k).push(c);});return [...m.entries()].sort((a,b)=>String(a[1][0].due_date||'').localeCompare(String(b[1][0].due_date||''))||String(coproOf(a[1][0]).name||'').localeCompare(String(coproOf(b[1][0]).name||'')));}

  function render(){
    if(!$('callDispatchTable'))return;
    ensureManagerFilter();
    const copros=allowedCopros(),select=$('callDispatchCoproFilter');
    const options='<option value="">Toutes les copropriétés autorisées</option>'+copros.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    select.innerHTML=options;if(filters.copro&&copros.some(c=>String(c.id)===String(filters.copro)))select.value=filters.copro;else filters.copro='';
    $('callDispatchTypeFilter').value=filters.type;$('callDispatchStatusFilter').value=filters.status;$('callDispatchFrom').value=filters.from;$('callDispatchTo').value=filters.to;$('callDispatchSearch').value=filters.search;
    const allPermitted=(state.ownerCalls||[]).filter(c=>accountingStatus(c)==='accounted'&&copros.some(cp=>String(cp.id)===String(c.copro_id)));
    const sentTotal=allPermitted.filter(isSent).length,pendingTotal=allPermitted.length-sentTotal,data=rows();
    if(!(state.callDispatchSelectedIds instanceof Set))state.callDispatchSelectedIds=new Set(state.callDispatchSelectedIds||[]);
    const visible=new Set(data.map(c=>String(c.id)));[...state.callDispatchSelectedIds].forEach(id=>{if(!visible.has(String(id)))state.callDispatchSelectedIds.delete(id);});
    const emailCount=data.filter(c=>channel(ownerOf(c))==='email').length;
    $('callDispatchSummary').innerHTML=`<div class="dispatch-metric"><span>Appels visibles</span><strong>${data.length}</strong></div><div class="dispatch-metric"><span>Montant visible</span><strong>${eur(data.reduce((s,c)=>s+Number(c.amount_due||0),0))}</strong></div><div class="dispatch-metric is-pending"><span>Non envoyés</span><strong>${pendingTotal}</strong></div><div class="dispatch-metric is-sent"><span>Déjà envoyés</span><strong>${sentTotal}</strong></div><div class="dispatch-metric"><span>E-mail / Courrier</span><strong>${emailCount} / ${data.length-emailCount}</strong></div>`;
    if(filters.manager&&!copros.length){$('callDispatchTable').innerHTML='<div class="v361-dispatch-empty"><strong>Aucune copropriété attribuée à ce gestionnaire.</strong><br>Attribuez-lui une copropriété dans ses réglages pour afficher ses appels.</div>';return;}
    $('callDispatchTable').innerHTML=groups(data).map(([key,arr])=>{const first=arr[0],cp=coproOf(first),subtotal=arr.reduce((s,c)=>s+Number(c.amount_due||0),0),allChecked=arr.every(c=>state.callDispatchSelectedIds.has(c.id)),sentCount=arr.filter(isSent).length;return `<div class="dispatch-group" data-dispatch-group="${esc(key)}"><div class="dispatch-group-head"><input type="checkbox" data-dispatch-group-check="${esc(key)}" ${allChecked?'checked':''}><div><h3>${esc(cp.name||'Copropriété')}</h3><small>${esc(first.period_label||first.label||'Appel')} · Échéance ${fmt(first.due_date)}</small></div><div><strong>${arr.length}</strong><small>destinataire(s)</small></div><div><strong>${eur(subtotal)}</strong><small>montant</small></div><div><span class="v361-dispatch-status ${sentCount===arr.length?'is-sent':''}">${sentCount===arr.length?'Envoyé':sentCount?`${sentCount}/${arr.length} envoyés`:'À envoyer'}</span></div><div class="dispatch-actions"><button class="btn secondary small" type="button" data-print-dispatch-group="${esc(key)}">PDF groupe</button><button class="btn secondary small" type="button" data-toggle-dispatch-group="${esc(key)}">Détails</button></div></div><div class="dispatch-details"><div class="table-wrap"><table><thead><tr><th></th><th>Copropriétaire</th><th>Lot</th><th>E-mail</th><th>Montant</th><th>Canal</th><th>Statut</th></tr></thead><tbody>${arr.map(c=>{const o=ownerOf(c),sent=isSent(c),ch=channel(o);return `<tr class="${sent?'dispatch-recipient-row--sent':''}"><td><input class="call-dispatch-check" type="checkbox" data-dispatch-call="${esc(c.id)}" ${state.callDispatchSelectedIds.has(c.id)?'checked':''}></td><td>${esc(ownerName(o))}</td><td>${esc(c.compta_lots?.lot_number||'')}</td><td>${ownerEmail(o)?esc(ownerEmail(o)):'<span class="dispatch-warning">Adresse mail manquante</span>'}</td><td><strong>${eur(c.amount_due)}</strong></td><td>${ch==='email'?'E-mail':ch==='paper'?'Courrier':'Exclu'}</td><td><span class="v361-dispatch-status ${sent?'is-sent':''}">${sent?'Envoyé':'À envoyer'}</span></td></tr>`;}).join('')}</tbody></table></div></div></div>`;}).join('')||'<div class="v361-dispatch-empty">Aucun appel comptabilisé ne correspond à ces filtres.</div>';
  }

  document.addEventListener('change',e=>{if(e.target.id==='v361CallManager'){filters.manager=e.target.value;filters.copro='';localStorage.setItem('wapi_call_dispatch_manager',filters.manager);render();}else if(['callDispatchCoproFilter','callDispatchTypeFilter','callDispatchStatusFilter','callDispatchFrom','callDispatchTo'].includes(e.target.id)){readFilters();render();}},true);
  document.addEventListener('input',e=>{if(e.target.id==='callDispatchSearch'){clearTimeout(filters.timer);filters.timer=setTimeout(()=>{readFilters();render();},150);}},true);
  window.WapiCallDispatchV361={render,rows,isSent};
  window.renderCallDispatchV20=render;
  const oldRender=window.renderAll;if(typeof oldRender==='function')window.renderAll=function(){const out=oldRender.apply(this,arguments);setTimeout(render,0);return out;};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,900));else setTimeout(render,900);
})();
