/* WAPI One V34.5 - Décomptes inspirés du flux Optipro.
   Calcul en centimes, lot par lot, puis regroupement par copropriétaire. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V34.5 - Décomptes Optipro';
  const byId=(id)=>document.getElementById(id);
  const n=(v)=>Number(v||0);
  const cents=(v)=>Math.round((n(v)+Number.EPSILON)*100);
  const fromCents=(v)=>v/100;
  const esc=(v)=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'');

  function installSettlementOptions(){
    const filters=document.querySelector('#statementsView .list-filters');
    if(!filters || byId('settlementDisplayBy')) return;
    filters.insertAdjacentHTML('afterend',`
      <div class="settlement-optipro-options">
        <label>Présentation
          <select id="settlementDisplayBy">
            <option value="account">Détail par compte</option>
            <option value="key">Détail par clé</option>
          </select>
        </label>
        <label>Niveau
          <select id="settlementDetailLevel">
            <option value="simple">Vue simple</option>
            <option value="detailed">Vue détaillée</option>
          </select>
        </label>
        <label><input id="settlementGroupMainLots" type="checkbox"> Regrouper par lots principaux</label>
        <label><input id="settlementShowVat" type="checkbox"> Afficher la TVA</label>
        <label><input id="settlementShowOccupant" type="checkbox" checked> Afficher la part occupant</label>
        <label><input id="settlementSubtractOccupant" type="checkbox"> Soustraire la part occupant</label>
        <label><input id="settlementIncludeSituation" type="checkbox" checked> Situation de compte sur PDF</label>
        <label>Échéance <input id="settlementPaymentDeadline" type="date"></label>
      </div>`);
    ['settlementDisplayBy','settlementDetailLevel','settlementGroupMainLots','settlementShowVat',
      'settlementShowOccupant','settlementSubtractOccupant','settlementIncludeSituation','settlementPaymentDeadline']
      .forEach(id=>byId(id)?.addEventListener('change',()=>window.renderStatementsV17?.()));
  }

  function yearFor(coproId,yearId){
    return (state.fiscalYears||[]).find(y=>y.id===yearId) ||
      (state.fiscalYears||[]).find(y=>y.copro_id===coproId) || null;
  }
  function daysInclusive(a,b){
    const x=new Date(`${a}T00:00:00`),y=new Date(`${b}T00:00:00`);
    return Math.max(1,Math.round((y-x)/86400000)+1);
  }
  function lotProrata(lot,year){
    if(!year) return {days:365,totalDays:365,ratio:1};
    const totalDays=daysInclusive(year.starts_on,year.ends_on);
    const start=lot.mutation_date && lot.mutation_date>year.starts_on && lot.mutation_date<=year.ends_on
      ? lot.mutation_date : year.starts_on;
    const days=daysInclusive(start,year.ends_on);
    return {days,totalDays,ratio:days/totalDays};
  }
  function accountFor(id){ return (state.accounts||[]).find(a=>a.id===id)||{}; }
  function keyFor(id,coproId){
    return (state.distributionKeys||[]).find(k=>k.id===id) ||
      (state.distributionKeys||[]).find(k=>k.copro_id===coproId&&k.is_default) ||
      (state.distributionKeys||[]).find(k=>k.copro_id===coproId)||{};
  }
  function weightsForKey(keyId,coproId){
    const lots=(state.lots||[]).filter(l=>l.copro_id===coproId&&l.active!==false);
    const items=(state.distributionItems||[]).filter(i=>i.distribution_key_id===keyId&&i.included!==false);
    const map=new Map(items.map(i=>[i.lot_id,n(i.quotities)]));
    return lots.map(l=>({lot:l,weight:map.has(l.id)?map.get(l.id):n(l.quotities)})).filter(x=>x.weight>0);
  }
  function allocateCents(totalAmount,weightedLots,year){
    const source=cents(totalAmount);
    const rows=weightedLots.map(x=>{
      const p=lotProrata(x.lot,year);
      return {...x,prorata:p,effective:x.weight*p.ratio};
    });
    const denominator=rows.reduce((s,x)=>s+x.effective,0)||1;
    const raw=rows.map((x,index)=>{
      const exact=source*x.effective/denominator;
      const floor=exact>=0?Math.floor(exact):Math.ceil(exact);
      return {...x,index,exact,allocated:floor,remainder:Math.abs(exact-floor)};
    });
    let residual=source-raw.reduce((s,x)=>s+x.allocated,0);
    const order=[...raw].sort((a,b)=>b.remainder-a.remainder||String(a.lot.lot_number||'').localeCompare(String(b.lot.lot_number||'')));
    for(let i=0;residual!==0&&order.length;i=(i+1)%order.length){
      order[i].allocated+=residual>0?1:-1; residual+=residual>0?-1:1;
    }
    return raw;
  }
  function ownerLots(ownerId,coproId,year){
    return (state.lots||[]).filter(l=>l.copro_id===coproId&&l.owner_id===ownerId&&l.active!==false)
      .map(l=>({...l,_prorata:lotProrata(l,year)}));
  }
  function invoices(coproId,year){
    return (state.invoices||[]).filter(i=>i.copro_id===coproId&&(!year||!i.invoice_date||(i.invoice_date>=year.starts_on&&i.invoice_date<=year.ends_on)))
      .filter(i=>String(accountFor(i.account_id).code||'').startsWith('6'));
  }
  function meterLines(coproId,yearId){
    const batches=new Map((state.v28MeterBatches||[]).filter(b=>b.copro_id===coproId&&(!yearId||b.fiscal_year_id===yearId)&&b.status==='validated').map(b=>[b.id,b]));
    return (state.v28MeterLines||[]).filter(l=>batches.has(l.batch_id)).map(l=>({...l,batch:batches.get(l.batch_id)}));
  }
  function balanceRow(ownerId,coproId,yearId){
    try{return thirdRowsFor('owners',coproId,yearId).find(r=>r.id===ownerId)||{balance:0,details:[]};}
    catch(e){return {balance:0,details:[]};}
  }
  function buildOwner(ownerId,coproId,yearId){
    const owner=(state.owners||[]).find(o=>o.id===ownerId)||{};
    const year=yearFor(coproId,yearId);
    const lots=ownerLots(ownerId,coproId,year);
    const lotIds=new Set(lots.map(l=>l.id));
    const lines=[]; let common=0,occupant=0,privateCharges=0,building=0;
    invoices(coproId,year).forEach(inv=>{
      const amount=n(inv.amount_total); if(!amount) return;
      const target=inv.charge_target||'common_owner';
      if(target==='meter_pending'||target==='private_balance') return;
      const acc=accountFor(inv.account_id),key=keyFor(inv.distribution_key_id,coproId);
      const label=inv.settlement_note||inv.description||`Facture ${inv.invoice_number||''}`;
      if(target==='private_settlement'){
        if(inv.private_owner_id!==ownerId)return;
        const lot=lots[0]||{};
        lines.push({kind:'private',lot,account:acc,key,label,building:amount,owner:amount,occupant:0,weight:0,totalWeight:0,prorata:lot._prorata});
        privateCharges+=amount; building+=amount; return;
      }
      const allocations=allocateCents(amount,weightsForKey(key.id,coproId),year);
      allocations.filter(a=>lotIds.has(a.lot.id)).forEach(a=>{
        const share=fromCents(a.allocated),isOcc=target==='common_occupant';
        lines.push({kind:'common',lot:a.lot,account:acc,key,label,building:amount,owner:isOcc?0:share,occupant:isOcc?share:0,weight:a.weight,totalWeight:allocations.reduce((s,x)=>s+x.weight,0),prorata:a.prorata});
        if(isOcc)occupant+=share;else common+=share;
      });
      building+=amount;
    });
    const consumptions=meterLines(coproId,yearId).filter(l=>lotIds.has(l.lot_id)).map(l=>{
      const lot=lots.find(x=>x.id===l.lot_id)||{}; const acc=accountFor(l.batch.account_id);
      return {kind:'meter',lot,account:acc,key:{name:'Consommation individuelle'},label:l.batch.label||'Consommation',
        indexStart:n(l.index_start),indexEnd:n(l.index_end),consumption:n(l.consumption),unitPrice:n(l.batch.unit_price)||((n(l.batch.invoice_total)&&n(l.consumption))?n(l.amount)/n(l.consumption):0),
        building:n(l.batch.invoice_total),owner:n(l.amount),occupant:0,prorata:lot._prorata};
    });
    const consumptionTotal=consumptions.reduce((s,l)=>s+l.owner,0);
    const bal=balanceRow(ownerId,coproId,yearId);
    const subtractOcc=!!byId('settlementSubtractOccupant')?.checked;
    const charged=common+privateCharges+consumptionTotal+(subtractOcc?0:occupant);
    return {owner,year,lots,lines,consumptions,common,occupant,privateCharges,consumptionTotal,totalCharges:charged,building,balanceRow:bal,final:n(bal.balance)+charged};
  }
  function ownerRows(coproId,yearId){
    const year=yearFor(coproId,yearId),search=(byId('settlementSearch')?.value||'').toLowerCase();
    return (state.owners||[]).filter(o=>o.copro_id===coproId).filter(o=>{
      const lots=ownerLots(o.id,coproId,year);
      return !search||[o.code,o.display_name,...lots.map(l=>l.lot_number)].join(' ').toLowerCase().includes(search);
    }).sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||'')));
  }
  function selectedContext(){
    const coproId=state.activeCoproId||byId('settlementCoproFilter')?.value||state.copros?.[0]?.id||'';
    const years=(state.fiscalYears||[]).filter(y=>y.copro_id===coproId);
    const yearId=byId('settlementYearFilter')?.value||state.activeFiscalYearId||years[0]?.id||'';
    return {coproId,yearId,year:yearFor(coproId,yearId)};
  }
  function groupLines(calc){
    const display=byId('settlementDisplayBy')?.value||'account';
    const groups=new Map();
    calc.lines.forEach(l=>{
      const id=display==='key'?(l.key.id||l.key.name):(l.account.id||l.account.code||l.account.label);
      if(!groups.has(id))groups.set(id,{label:display==='key'?(l.key.name||'Clé'):[l.account.code,l.account.label].filter(Boolean).join(' - '),building:0,owner:0,occupant:0,lines:[]});
      const g=groups.get(id);g.building+=l.building;g.owner+=l.owner;g.occupant+=l.occupant;g.lines.push(l);
    });
    return [...groups.values()];
  }
  function commonHtml(calc){
    const detailed=byId('settlementDetailLevel')?.value==='detailed';
    const showOcc=byId('settlementShowOccupant')?.checked!==false;
    return calc.lots.map(lot=>{
      const rows=calc.lines.filter(l=>l.lot.id===lot.id&&l.kind!=='private');
      const grouped=new Map();
      rows.forEach(l=>{const key=`${l.account.id||l.account.code}|${l.key.id||l.key.name}`;if(!grouped.has(key))grouped.set(key,{...l,owner:0,occupant:0});const g=grouped.get(key);g.owner+=l.owner;g.occupant+=l.occupant;});
      const body=[...grouped.values()].map(l=>`<tr><td><strong>${esc([l.account.code,l.account.label].filter(Boolean).join(' - '))}</strong>${detailed?`<div class="subtle">${esc(l.key.name||'Clé')} · ${n(l.weight).toLocaleString('fr-BE')} / ${n(l.totalWeight).toLocaleString('fr-BE')} · ${l.prorata.days}/${l.prorata.totalDays} jours</div>`:''}</td><td class="amount">${money(l.owner)}</td>${showOcc?`<td class="amount">${money(l.occupant)}</td>`:''}</tr>`).join('');
      const own=rows.reduce((s,x)=>s+x.owner,0),occ=rows.reduce((s,x)=>s+x.occupant,0);
      return `<div class="settlement-lot-block"><div class="settlement-lot-title">${esc(lot.lot_number||'Lot')} · ${esc(lot.lot_type||'')} · ${lot._prorata.days}/${lot._prorata.totalDays} jours</div><table class="settlement-table"><thead><tr><th>Compte et répartition</th><th class="amount">Part propriétaire</th>${showOcc?'<th class="amount">Part occupant</th>':''}</tr></thead><tbody>${body||`<tr><td colspan="${showOcc?3:2}">Aucune charge commune.</td></tr>`}<tr class="total-row"><td>Total du lot</td><td class="amount">${money(own)}</td>${showOcc?`<td class="amount">${money(occ)}</td>`:''}</tr></tbody></table></div>`;
    }).join('');
  }
  function consumptionHtml(calc){
    const rows=calc.consumptions.map(l=>`<tr><td>${esc(l.lot.lot_number||'')}</td><td>${esc(l.label)}</td><td class="amount">${l.indexStart.toLocaleString('fr-BE')}</td><td class="amount">${l.indexEnd.toLocaleString('fr-BE')}</td><td class="amount">${l.consumption.toLocaleString('fr-BE')}</td><td class="amount">${money(l.owner)}</td></tr>`).join('');
    return `<table class="settlement-table"><thead><tr><th>Lot</th><th>Compteur</th><th class="amount">Index début</th><th class="amount">Index fin</th><th class="amount">Consommation</th><th class="amount">Montant</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Aucune consommation validée pour cet exercice.</td></tr>'}</tbody></table>`;
  }
  function situationHtml(calc){
    return table(['Date','Journal / libellé','Débit','Crédit'],(calc.balanceRow.details||[]).map(d=>[
      d.date||'',`${esc(d.journal_code||d.journal||'')} ${esc(d.label||'')}`,d.debit?money(d.debit):'',d.credit?money(d.credit):''
    ]));
  }
  function renderDetail(ownerId){
    const {coproId,yearId}=selectedContext(),calc=buildOwner(ownerId,coproId,yearId),el=byId('settlementDetail');if(!el)return;
    el.classList.add('is-open');
    el.innerHTML=`<div class="settlement-detail-head"><div><h3>${esc(calc.owner.code||'')} ${esc(calc.owner.display_name||'')}</h3><p class="muted-note">${esc(calc.year?.label||'Exercice')} · ${esc(coproNameByIdV14(coproId))}</p></div><div class="actions-inline"><button class="btn secondary small" data-close-settlement-detail type="button">Retour à la liste</button><button class="btn small" data-v345-pdf-owner="${ownerId}" type="button">Exporter PDF</button></div></div>
      <div class="settlement-section"><h3 class="settlement-section-title">Charges communes <span>${money(calc.common+calc.occupant)}</span></h3>${commonHtml(calc)}</div>
      <div class="settlement-section"><h3 class="settlement-section-title">Consommations <span>${money(calc.consumptionTotal)}</span></h3>${consumptionHtml(calc)}</div>
      <div class="settlement-section"><h3 class="settlement-section-title">Total charges</h3><div class="settlement-result-grid"><div class="settlement-result-card"><span>Charges communes</span><strong>${money(calc.common+calc.occupant)}</strong></div><div class="settlement-result-card"><span>Consommations et privatifs</span><strong>${money(calc.consumptionTotal+calc.privateCharges)}</strong></div><div class="settlement-result-card"><span>Total imputé</span><strong>${money(calc.totalCharges)}</strong></div></div></div>
      <div class="settlement-section"><h3 class="settlement-section-title">Situation de compte au ${esc(calc.year?.ends_on||'')}</h3>${situationHtml(calc)}</div>
      <div class="settlement-big-result ${calc.final>=0?'positive':'negative'}"><div><strong>${calc.final>=0?'Montant à payer':'Montant à recevoir'}</strong><div class="muted-note">Solde avant décompte ${money(calc.balanceRow.balance)} + charges réelles ${money(calc.totalCharges)}</div></div><strong>${money(Math.abs(calc.final))}</strong></div>`;
  }
  function render(){
    installSettlementOptions();
    const coproSelect=byId('settlementCoproFilter'),yearSelect=byId('settlementYearFilter');if(!coproSelect||!yearSelect)return;
    const oldC=coproSelect.value;
    coproSelect.innerHTML=(state.copros||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    coproSelect.value=state.activeCoproId||oldC||state.copros?.[0]?.id||'';
    const coproId=coproSelect.value,years=(state.fiscalYears||[]).filter(y=>y.copro_id===coproId),oldY=yearSelect.value;
    yearSelect.innerHTML=years.map(y=>`<option value="${y.id}">${esc(y.code||'')} ${esc(y.label||'Exercice')}</option>`).join('');
    yearSelect.value=years.some(y=>y.id===oldY)?oldY:(state.activeFiscalYearId&&years.some(y=>y.id===state.activeFiscalYearId)?state.activeFiscalYearId:years[0]?.id||'');
    const yearId=yearSelect.value,year=yearFor(coproId,yearId),owners=ownerRows(coproId,yearId),calcs=owners.map(o=>buildOwner(o.id,coproId,yearId));
    const sourceCents=invoices(coproId,year).filter(i=>!['private_balance','meter_pending'].includes(i.charge_target)).reduce((s,i)=>s+cents(i.amount_total),0);
    const distributedCents=calcs.reduce((s,c)=>s+cents(c.common+c.occupant+c.privateCharges),0);
    byId('settlementSummary').innerHTML=`<div class="settlement-metric"><span>Exercice</span><strong>${esc(year?.label||'Non défini')}</strong></div><div class="settlement-metric"><span>Charges à répartir</span><strong>${money(fromCents(sourceCents))}</strong></div><div class="settlement-metric"><span>Copropriétaires</span><strong>${owners.length}</strong></div><div class="settlement-metric"><span>Contrôle centimes</span><strong class="${sourceCents===distributedCents?'settlement-reconcile-ok':'settlement-reconcile-warn'}">${sourceCents===distributedCents?'Équilibré':money(fromCents(sourceCents-distributedCents))}</strong></div>`;
    byId('settlementOwnerList').innerHTML=owners.map((o,i)=>`<div class="settlement-owner-row"><input type="checkbox" data-settlement-select="${o.id}"><div><strong>${esc(o.code||'')} ${esc(o.display_name||'')}</strong><div class="settlement-owner-row__lots">${esc(calcs[i].lots.map(l=>`${l.lot_number} (${l.lot_type||'lot'})`).join(', ')||'Aucun lot')}</div></div><span class="settlement-owner-row__count">${calcs[i].lots.length} lot(s)</span><strong class="amount">${money(calcs[i].totalCharges)}</strong><button class="btn secondary small" data-v345-open-owner="${o.id}" type="button">Consulter</button></div>`).join('')||'<div class="notice">Aucun copropriétaire pour cette copropriété.</div>';
    if(!state.selectedSettlementOwnerId)byId('settlementDetail').innerHTML='<div class="notice">Sélectionne « Consulter » pour ouvrir un décompte détaillé.</div>';
  }
  function ownerAddress(owner){
    const line1=[owner.street,owner.street_number].filter(Boolean).join(' ')||owner.address||'';
    const line2=[owner.postal_code,owner.city].filter(Boolean).join(' ');
    return [owner.display_name,line1,line2,owner.country].filter(Boolean).map(esc).join('<br>');
  }
  function pdfHtml(ownerId){
    const {coproId,yearId}=selectedContext(),calc=buildOwner(ownerId,coproId,yearId),copro=(state.copros||[]).find(c=>c.id===coproId)||{};
    const groups=groupLines(calc);
    const commonRows=groups.map(g=>`<tr><td>${esc(g.label)}</td><td class="amount">${money(g.building)}</td><td class="amount">${money(g.owner)}</td><td class="amount">${money(g.occupant)}</td></tr>`).join('');
    const consumptionRows=calc.consumptions.map(l=>`<tr><td>${esc(l.lot.lot_number||'')}</td><td>${esc(l.label)}</td><td>${l.indexStart} → ${l.indexEnd}</td><td class="amount">${money(l.owner)}</td></tr>`).join('');
    const balanceRows=(calc.balanceRow.details||[]).map(d=>`<tr><td>${esc(d.date||'')}</td><td>${esc(d.journal_code||d.journal||'')}</td><td>${esc(d.label||'')}</td><td class="amount">${d.debit?money(d.debit):''}</td><td class="amount">${d.credit?money(d.credit):''}</td></tr>`).join('');
    const deadline=byId('settlementPaymentDeadline')?.value||'';
    const bank=(state.v28CoproBankAccounts||[]).find(b=>b.copro_id===coproId&&b.active!==false)||(state.bankAccounts||[]).find(b=>b.copro_id===coproId)||{};
    const situation=byId('settlementIncludeSituation')?.checked!==false?`<section class="page">${agPdfHeaderV15('Situation de compte',copro.name||'')}<div class="window-address window-address-right">${ownerAddress(calc.owner)}</div><div class="with-window-space"><table><tr><th>Date</th><th>Journal</th><th>Libellé</th><th class="amount">Débit</th><th class="amount">Crédit</th></tr>${balanceRows}</table><div class="settlement-pay"><h2 class="${calc.final>=0?'debit':'credit'}">${calc.final>=0?'Montant à payer':'Montant à recevoir'} : ${money(Math.abs(calc.final))}</h2>${deadline?`<p><strong>Échéance :</strong> ${esc(deadline)}</p>`:''}${calc.final>=0?`<p><strong>IBAN :</strong> ${esc(bank.iban||'À compléter')}<br><strong>Communication structurée :</strong> ${esc(calc.owner.vcs||'À compléter')}</p>`:''}</div></div>${agPdfFooterV15('Décompte - situation')}</section>`:'';
    return `<section class="page">${agPdfHeaderV15('Décompte individuel',copro.name||'')}<div class="window-address window-address-right">${ownerAddress(calc.owner)}</div><div class="with-window-space"><div class="box"><h2>${esc(calc.owner.code||'')} ${esc(calc.owner.display_name||'')}</h2><p><strong>Période :</strong> ${esc(calc.year?.starts_on||'')} au ${esc(calc.year?.ends_on||'')} · <strong>Lots :</strong> ${esc(calc.lots.map(l=>l.lot_number).join(', ')||'-')}</p></div><h2>Charges communes</h2><table><tr><th>Compte / clé</th><th class="amount">Total immeuble</th><th class="amount">Part propriétaire</th><th class="amount">Part occupant</th></tr>${commonRows}<tr><th>Total</th><th></th><th class="amount">${money(calc.common)}</th><th class="amount">${money(calc.occupant)}</th></tr></table><h2>Consommations et charges privatives</h2><table><tr><th>Lot</th><th>Libellé</th><th>Index</th><th class="amount">Montant</th></tr>${consumptionRows||'<tr><td colspan="4">Aucune consommation.</td></tr>'}<tr><th colspan="3">Total charges réelles</th><th class="amount">${money(calc.totalCharges)}</th></tr></table></div>${agPdfFooterV15('Décompte - charges')}</section>${situation}`;
  }
  function pdf(ownerId){
    const owner=(state.owners||[]).find(o=>o.id===ownerId)||{};
    openPrintWindowV16(`Décompte ${owner.display_name||''}`,pdfHtml(ownerId));
  }
  window.renderStatementsV17=render;
  window.renderSettlementDetailV17=function(){if(state.selectedSettlementOwnerId)renderDetail(state.selectedSettlementOwnerId);};
  window.settlementPdfForOwnerV17=pdfHtml;
  window.printSettlementRowsV17=function(ids){
    if(!(ids||[]).length)return alert('Sélectionne au moins un copropriétaire.');
    openPrintWindowV16('Décomptes',ids.map(pdfHtml).join(''));
  };
  window.WapiSettlementV345={buildOwner,ownerRows,selectedContext,pdfHtml,pdf,render,renderDetail};

  document.addEventListener('click',e=>{
    const open=e.target.closest('[data-v345-open-owner]');if(open){state.selectedSettlementOwnerId=open.dataset.v345OpenOwner;renderDetail(state.selectedSettlementOwnerId);}
    if(e.target.closest('[data-close-settlement-detail]')){state.selectedSettlementOwnerId='';byId('settlementDetail')?.classList.remove('is-open');render();}
    const one=e.target.closest('[data-v345-pdf-owner]');if(one)pdf(one.dataset.v345PdfOwner);
  },true);
  document.addEventListener('change',e=>{
    const check=e.target.closest?.('[data-settlement-select]');
    if(check && check.checked){state.selectedSettlementOwnerId=check.dataset.settlementSelect;renderDetail(state.selectedSettlementOwnerId);}
  },true);
  window.addEventListener('load',()=>{installSettlementOptions();setTimeout(render,250);});
})();
