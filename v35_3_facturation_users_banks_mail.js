/* WAPI One V34.8 — compréhension structurée des factures. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION='V34.8 — OCR intelligent';
  const $=id=>document.getElementById(id);
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const moneyNumber=raw=>{
    if(raw===null||raw===undefined||raw==='')return null;
    let value=String(raw).replace(/[€\s']/g,'');
    if(value.includes(',')&&value.includes('.')) value=value.lastIndexOf(',')>value.lastIndexOf('.')?value.replace(/\./g,'').replace(',','.'):value.replace(/,/g,'');
    else value=value.replace(',','.');
    const n=Number(value.replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null;
  };
  const lines=text=>String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);

  function tokenScore(a,b){
    const aa=new Set(norm(a).split(' ').filter(x=>x.length>2)),bb=new Set(norm(b).split(' ').filter(x=>x.length>2));
    if(!aa.size||!bb.size)return 0;let same=0;aa.forEach(x=>{if(bb.has(x))same++;});
    return same/Math.max(aa.size,bb.size);
  }
  function bestKnown(list,name,address){
    let best=null,score=0;
    for(const row of list||[]){
      const rowName=row.display_name||row.name||'',rowAddress=[row.address,row.street,row.postal_code,row.city].filter(Boolean).join(' ');
      const s=Math.max(tokenScore(name,rowName),tokenScore(address,rowAddress),norm(name)===norm(rowName)?1:0);
      if(s>score){best=row;score=s;}
    }
    return {row:score>=.58?best:null,score};
  }
  function supplierGuess(text){
    const ls=lines(text),vatLine=ls.findIndex(l=>/(?:TVA|VAT|BTW)[\s:.-]*(?:BE|FR|NL|LU)?\s*[0-9. ]{8,}/i.test(l)),ibanLine=ls.findIndex(l=>/\b[A-Z]{2}\s*\d{2}(?:\s*[A-Z0-9]){10,30}\b/i.test(l));
    const boundary=[vatLine,ibanLine].filter(i=>i>=0).sort((a,b)=>a-b)[0]??Math.min(ls.length,8);
    const forbidden=/facture|invoice|avoir|credit note|date|echeance|client|destinataire|facture a|bill to|ship to|association des coproprietaires|\bACP\b|residence|copropriete|total|tva|iban|bic|www\.|@/i;
    const candidates=ls.slice(0,Math.max(3,boundary+1)).map((line,index)=>({line,index,score:0}))
      .filter(x=>x.line.length>=3&&x.line.length<=80&&!forbidden.test(x.line)&&!/\d{4,}/.test(x.line));
    candidates.forEach(x=>{
      if(/srl|sprl|sa\b|s\.a\.|bv\b|nv\b|asbl|company|services|belgium/i.test(x.line))x.score+=35;
      if(x.index<4)x.score+=18-x.index*3;
      if(/^[A-Z0-9 &.'-]+$/.test(x.line))x.score+=8;
    });
    return candidates.sort((a,b)=>b.score-a.score)[0]?.line||'';
  }
  function coproGuess(text){
    const ls=lines(text);
    for(let i=0;i<ls.length;i++){
      if(/association des copropri[eé]taires|\bACP\b|copropri[eé]t[eé]|r[eé]sidence|residence|immeuble|factur[eé]\s+[aà]|bill\s+to|client\s*:/i.test(ls[i])){
        const inline=ls[i].replace(/^.*?(?:association des copropri[eé]taires|\bACP\b|copropri[eé]t[eé]|r[eé]sidence|residence|immeuble|factur[eé]\s+[aà]|bill\s+to|client\s*:)\s*[:\-]?\s*/i,'').trim();
        if(inline.length>2)return inline;
        if(ls[i+1])return ls[i+1];
      }
    }
    return '';
  }
  function amountNear(text,patterns){
    const ls=lines(text),rxMoney=/([0-9]{1,3}(?:[ .'][0-9]{3})*(?:[,.][0-9]{2})|[0-9]{1,8}(?:[,.][0-9]{2}))/g;
    const found=[];
    ls.forEach((line,index)=>{
      const context=norm(`${ls[index-1]||''} ${line} ${ls[index+1]||''}`);
      let score=0;patterns.forEach((p,i)=>{if(p.test(context))score+=100-i*5;});
      if(!score)return;
      const matches=[...line.matchAll(rxMoney)];
      const source=matches.length?matches:[...(ls[index+1]||'').matchAll(rxMoney)];
      source.forEach(m=>{const v=moneyNumber(m[1]);if(v!==null)found.push({v,score,index});});
    });
    return found.sort((a,b)=>b.score-a.score||b.v-a.v)[0]?.v??null;
  }
  function historyAccount(supplierId,coproId){
    if(!supplierId)return '';
    const counts=new Map();
    (state.invoices||[]).filter(i=>i.supplier_id===supplierId&&(!coproId||i.copro_id===coproId)&&i.account_id)
      .forEach(i=>counts.set(i.account_id,(counts.get(i.account_id)||0)+1));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  }
  function intelligentFields(text,fileName=''){
    const supplierName=supplierGuess(text),coproName=coproGuess(text);
    const supplierMatch=bestKnown(state.suppliers||[],supplierName,'');
    const coproMatch=bestKnown(state.copros||[],coproName,coproName);
    const htva=amountNear(text,[/total htva|total hors tva|hors taxe|subtotal|sous total|base imposable/]);
    const vat=amountNear(text,[/montant tva|total tva|vat amount|btw bedrag/]);
    let tvac=amountNear(text,[/net a payer|total a payer|total tvac|total ttc|grand total|balance due|montant total/]);
    if(tvac===null&&htva!==null&&vat!==null)tvac=Number((htva+vat).toFixed(2));
    let rate=null;
    const rateMatch=String(text||'').match(/(?:TVA|VAT|BTW)[^0-9]{0,15}([0-9]{1,2}(?:[,.][0-9]+)?)\s*%/i);
    if(rateMatch)rate=moneyNumber(rateMatch[1]);
    if(rate===null&&htva&&vat!==null)rate=Number((vat/htva*100).toFixed(2));
    return {supplier_name_guess:supplierName,copro_name_guess:coproName,amount_excl_vat:htva??'',vat_amount:vat??'',amount:tvac??'',vat_rate:rate??'',_supplier_match:supplierMatch,_copro_match:coproMatch};
  }

  const oldSupplierDetection=window.detectSupplierFromText;
  if(typeof oldSupplierDetection==='function')window.detectSupplierFromText=function(text){
    const old=oldSupplierDetection.apply(this,arguments)||{supplier:null,confidence:0};
    const guess=supplierGuess(text),match=bestKnown(state.suppliers||[],guess,'');
    const smart={supplier:match.row,confidence:match.row?Math.round(55+match.score*40):0,guessed_name:guess};
    return Number(old.confidence||0)>=Number(smart.confidence||0)?{...old,guessed_name:guess}:smart;
  };
  const oldCoproDetection=window.detectCoproFromText;
  if(typeof oldCoproDetection==='function')window.detectCoproFromText=function(text){
    const old=oldCoproDetection.apply(this,arguments)||{copro:null,confidence:0};
    const guess=coproGuess(text),match=bestKnown(state.copros||[],guess,guess);
    const smart={copro:match.row,confidence:match.row?Math.round(55+match.score*40):0,guessed_name:guess};
    /* L'ancien moteur utilisait parfois la copro active comme simple valeur par
       défaut (confiance 40). Ce n'est pas une détection et ne doit pas remplir
       automatiquement la facture. */
    if(!match.row&&Number(old.confidence||0)<=40)return smart;
    return Number(old.confidence||0)>=Number(smart.confidence||0)?{...old,guessed_name:guess}:smart;
  };

  const oldExtract19=window.extractInvoiceFieldsV19;
  const oldExtract13=window.extractInvoiceFieldsV13;
  function enhancedExtract(text,fileName=''){
    const base=(typeof oldExtract19==='function'?oldExtract19(text,fileName):typeof oldExtract13==='function'?oldExtract13(text,fileName):{})||{};
    const smart=intelligentFields(text,fileName);
    const detectedSupplier=typeof window.detectSupplierFromText==='function'?window.detectSupplierFromText(text):{supplier:smart._supplier_match.row};
    const detectedCopro=typeof window.detectCoproFromText==='function'?window.detectCoproFromText(text):{copro:smart._copro_match.row};
    const supplierId=detectedSupplier.supplier?.id||'';
    const coproId=detectedCopro.copro?.id||'';
    const accountFromHistory=historyAccount(supplierId,coproId);
    return {...base,
      supplier_name_guess:smart.supplier_name_guess,
      copro_name_guess:smart.copro_name_guess,
      amount_excl_vat:smart.amount_excl_vat!==''?smart.amount_excl_vat:(base.amount_excl_vat||''),
      vat_amount:smart.vat_amount!==''?smart.vat_amount:(base.vat_amount||''),
      amount:smart.amount!==''?smart.amount:(base.amount||''),
      vat_rate:smart.vat_rate!==''?smart.vat_rate:(base.vat_rate||''),
      account_id:accountFromHistory||base.account_id||'',
      account_detection_source:accountFromHistory?'Historique du fournisseur':(base.account_id?'Libellé de la facture':'')
    };
  }
  if(typeof window.extractInvoiceFieldsV19==='function')window.extractInvoiceFieldsV19=enhancedExtract;
  if(typeof window.extractInvoiceFieldsV13==='function')window.extractInvoiceFieldsV13=enhancedExtract;
  if(typeof window.extractSimpleFieldsFromText==='function'){
    const oldSimple=window.extractSimpleFieldsFromText;
    window.extractSimpleFieldsFromText=function(text,fileName,type){return type==='invoice'?enhancedExtract(text,fileName):oldSimple.apply(this,arguments);};
  }

  const oldRender=window.renderInvoiceOcrV13;
  if(typeof oldRender==='function')window.renderInvoiceOcrV13=function(){
    const out=oldRender.apply(this,arguments);
    setTimeout(enhanceOcrPanel,0);
    return out;
  };
  function enhanceOcrPanel(){
    const q=(state.validationQueue||[]).find(x=>x.id===state.ocrSelectedQueueId);if(!q)return;
    const item=(state.importItems||[]).find(x=>x.id===q.item_id)||{},data={...(q.extracted_data||{}),...(q.corrected_data||{})};
    const grid=document.querySelector('.ocr-fields .ocr-field-grid');if(!grid||$('ocrFieldAmountExclVat'))return;
    const coproSelect=$('ocrFieldCopro'),supplierSelect=$('ocrFieldSupplier');
    if(coproSelect&&!coproSelect.value&&data.copro_id)coproSelect.value=data.copro_id;
    if(supplierSelect&&!supplierSelect.value&&data.supplier_id)supplierSelect.value=data.supplier_id;
    if(coproSelect&&!coproSelect.value&&data.copro_name_guess){
      coproSelect.closest('label')?.insertAdjacentHTML('afterend',`<div class="ocr-smart-suggestion"><strong>Copropriété lue sur la facture</strong><span>${esc(data.copro_name_guess)}</span><div class="muted-note">Non associée automatiquement : sélectionne la copropriété existante.</div></div>`);
    }
    if(supplierSelect&&!supplierSelect.value&&data.supplier_name_guess){
      supplierSelect.closest('label')?.insertAdjacentHTML('afterend',`<div class="ocr-smart-suggestion"><strong>Fournisseur lu sur la facture</strong><span>${esc(data.supplier_name_guess)}</span><div class="muted-note">Ce fournisseur n’existe pas encore dans WAPI One.</div><div class="actions-inline"><button class="btn secondary small" id="ocrCreateDetectedSupplier" type="button">Créer ce fournisseur</button></div></div>`);
    }
    const amountInput=$('ocrFieldAmount');if(amountInput){
      amountInput.closest('label')?.insertAdjacentHTML('beforebegin',`<label>Montant HTVA<input id="ocrFieldAmountExclVat" type="number" step="0.01" value="${esc(data.amount_excl_vat||'')}"></label>`);
    }
    const ht=Number(data.amount_excl_vat||0),vat=Number(data.vat_amount||0),ttc=Number(data.amount||0),ok=ht>0&&ttc>0&&Math.abs((ht+vat)-ttc)<.02;
    grid.insertAdjacentHTML('beforeend',`<div class="ocr-amount-check ${ok?'is-valid':'is-warning'}"><div><span>HTVA</span><strong>${typeof money==='function'?money(ht):ht}</strong></div><div><span>TVA</span><strong>${typeof money==='function'?money(vat):vat}</strong></div><div><span>TVAC</span><strong>${typeof money==='function'?money(ttc):ttc}</strong></div></div>`);
    if(data.account_detection_source&&$('ocrFieldAccount'))$('ocrFieldAccount').closest('label')?.insertAdjacentHTML('beforeend',`<span class="ocr-smart-source">${esc(data.account_detection_source)}</span>`);
    $('ocrCreateDetectedSupplier')?.addEventListener('click',createDetectedSupplier);
  }
  async function createDetectedSupplier(){
    const q=(state.validationQueue||[]).find(x=>x.id===state.ocrSelectedQueueId),data={...(q?.extracted_data||{}),...(q?.corrected_data||{})};
    const name=String(data.supplier_name_guess||'').trim();if(!q||!name)return;
    const {data:created,error}=await supabaseClient.from('compta_suppliers').insert({name,active:true,created_by:currentUser?.id||null}).select('*').single();
    if(error)return alert(error.message);
    const corrected={...data,supplier_id:created.id};
    await supabaseClient.from('compta_validation_queue').update({corrected_data:corrected}).eq('id',q.id);
    await loadAll();state.ocrSelectedQueueId=q.id;renderInvoiceOcrV13();
  }
  const oldPayload=window.getOcrPayloadFromFieldsV13;
  if(typeof oldPayload==='function')window.getOcrPayloadFromFieldsV13=function(){
    const payload=oldPayload.apply(this,arguments),q=(state.validationQueue||[]).find(x=>x.id===state.ocrSelectedQueueId),old={...(q?.extracted_data||{}),...(q?.corrected_data||{})};
    return {...old,...payload,amount_excl_vat:$('ocrFieldAmountExclVat')?.value?Number($('ocrFieldAmountExclVat').value):null};
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceOcrPanel,600));else setTimeout(enhanceOcrPanel,600);
})();
