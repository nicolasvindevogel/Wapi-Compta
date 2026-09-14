/* Lecture des documents et extraction des champs : module unique, sans état métier. */
(function(root){
  'use strict';
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const clean=s=>String(s||'')
    .replace(/[\u00a0\u202f]/g,' ').replace(/[−–]/g,'-')
    // Certains PDF encodent mal un caractère accentué dans les libellés.
    // On restaure les deux libellés comptables qui servent à l'extraction.
    .replace(/\b[Nn](?:um)?[^\r\n]{0,3}ro\s+(?:de\s+)?facture\b/g,'Numero de facture')
    .replace(/\b[Rr][^\r\n]{0,3}rence\s+facture\b/g,'Reference facture')
    // Un PDF dont l'ordre de lecture est imparfait peut coller l'année d'une
    // date au montant suivant. Une coupure rend les deux champs indépendants.
    .replace(/(\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2})\s+(?=\d{1,3}(?:[ .']\d{3})*[,.]\d{2}\b)/g,'$1\n')
    .replace(/(\b(?:19|20)\d{2})\s+(?=\d{1,3}(?:[ .']\d{3})*[,.]\d{2}\b)/g,'$1\n');
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  function money(raw){
    let s=clean(raw).replace(/[€\s'’]/g,'').replace(/EUR/gi,'');
    if(!/^-?\d+(?:[.,]\d+)*$/.test(s))return null;
    const decimal=s.match(/[.,](\d{2})$/);
    if(decimal){const pos=s.length-3;s=s.slice(0,pos).replace(/[.,]/g,'')+'.'+s.slice(pos+1);}
    else if(/[.,]/.test(s)){if(!/^-?\d{1,3}(?:[.,]\d{3})+$/.test(s))return null;s=s.replace(/[.,]/g,'');}
    const n=Number(s);return Number.isFinite(n)&&Math.abs(n)<1e9?n:null;
  }
  function amounts(line){
    const out=[],text=clean(line);
    const rx=/-?\d{1,3}(?:[ .,\u0027’]\d{3})+(?:[.,]\d{2})?|-?\d+(?:[.,]\d{2})?/g;
    for(const m of text.matchAll(rx)){
      const before=text.slice(0,m.index),after=text.slice(m.index+m[0].length);
      // No fragments of identifiers, dates, percentages, telephone or bank numbers.
      if(/[\w/.,+\-]$/.test(before)||/^[\w/.,+\-]/.test(after)||/^\s*(?:%|kwh\b|m[³3]\b|litres?\b)/i.test(after))continue;
      if(/^\s*(?:19|20)\d{2}\s*$/.test(m[0])||/\b(?:19|20)\d{2}\s*$/.test(before)||/^(?:19|20)\d{2}\s+\d{1,3}[,.]\d{2}$/.test(m[0]))continue;
      const decimal=/[.,]\d{2}$/.test(m[0]),currency=/^\s*(?:€|EUR\b)/i.test(after)||/(?:€|\bEUR)\s*$/i.test(before);
      if(!decimal&&!currency&&!/^\s*[:=]?\s*-?\d+\s*$/.test(text))continue;
      const value=money(m[0]);if(value!==null)out.push({value,index:m.index,raw:m[0]});
    }
    return out;
  }
  const labels=[
    ['base',/\b(?:total\s+(?:htva|ht|hors\s+(?:tva|taxes?))|montant\s+htva|base\s+imposable|sous[- ]total|subtotal|subtotaal|(?:totaal|bedrag)\s+excl\.?\s*(?:btw|vat)|total\s+excl\.?\s*(?:vat|tax))\b/g,90],
    ['tax',/\b(?:(?:montant|total)\s+tva(?!\s+(?:comprise|incluse))|vat\s+(?:amount|total)|btw[- ]?bedrag|totaal\s+btw)\b/g,90],
    ['tax',/\b(?:tva|vat|btw)\s+\d{1,2}(?:[.,]\d+)?\s*%(?=\s|$)/g,86],
    ['total',/\b(?:(?:total|montant)\s+(?:tvac|ttc)|total\s+tva\s+(?:comprise|incluse)|total\s+taxes?\s+comprises?|(?:total|montant)\s+(?:de\s+la\s+)?facture|(?:totaal|bedrag)\s+incl\.?\s*(?:btw|vat)|factuurtotaal|factuurbedrag|invoice\s+total|grand\s+total|total\s+(?:incl\.?\s*(?:vat|tax)|vat\s+included))\b/g,110],
    ['payable',/\b(?:(?:net|total|montant|solde|reste)\s+a\s+(?:payer|acquitter)|total\s+du|balance\s+due|amount\s+due|total\s+due|te\s+betalen(?:\s+bedrag)?|nog\s+te\s+betalen)\b/g,95],
    ['total',/\b(?:montant\s+total|total\s+general|totaal\s+bedrag|total\s+amount)\b/g,85],
    ['total',/\b(?:total|totaal)\b/g,55]
  ];
  function moneyLabels(line){
    const text=fold(line),found=[];
    for(const [kind,rx,score] of labels){
      rx.lastIndex=0;
      for(const m of text.matchAll(rx)){
        if(found.some(f=>m.index<f.end&&m.index+m[0].length>f.index))continue;
        if(score===55&&/\b(?:htva|hors|excl|tva|vat|btw|acompte|subtotal|subtotaal)\b/.test(text))continue;
        found.push({kind,score,index:m.index,end:m.index+m[0].length});
      }
    }
    return found.sort((a,b)=>a.index-b.index);
  }
  function iso(y,m,d){
    y=Number(y);m=Number(m);d=Number(d);if(y<100)y+=2000;
    if(y<1900||y>2199||m<1||m>12||d<1||d>31)return '';
    const dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
  }
  const months={janvier:1,jan:1,january:1,januari:1,fevrier:2,fev:2,feb:2,february:2,februari:2,mars:3,mar:3,march:3,maart:3,avril:4,avr:4,apr:4,april:4,mai:5,may:5,mei:5,juin:6,jun:6,june:6,juni:6,juillet:7,juil:7,jul:7,july:7,juli:7,aout:8,aug:8,august:8,augustus:8,septembre:9,sep:9,sept:9,september:9,octobre:10,oct:10,october:10,oktober:10,okt:10,novembre:11,nov:11,november:11,decembre:12,dec:12,december:12};
  function dates(text){
    const out=[],source=fold(clean(text));
    const rx=/\b(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\b|\b(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4}|\d{2})\b|\b(\d{1,2})\s+([a-z]+)\.?\s+(\d{4}|\d{2})\b/g;
    for(const m of source.matchAll(rx)){const value=m[1]?iso(m[1],m[2],m[3]):m[4]?iso(m[6],m[5],m[4]):iso(m[9],months[m[8]],m[7]);if(value)out.push({value,index:m.index,end:m.index+m[0].length});}
    return out;
  }
  function dateLabels(line){
    const text=fold(line),out=[];
    const rx=/\b(date\s+(?:de\s+)?(?:la\s+)?facture|facture\s+du|invoice\s+date|date\s+of\s+issue|issue\s+date|factuurdatum|datum\s+factuur|emise?\s+le|date\s+d['’]emission|date\s+d['’]echeance|date\s+(?:d\s*)?echeance|echeance|due\s+date|vervaldatum|a\s+payer\s+avant|payable\s+avant|uiterste\s+betaaldatum|date|datum)\b/g;
    for(const m of text.matchAll(rx)){
      const generic=/^(date|datum)$/.test(m[0]);
      if(generic&&(/(?:delivery|payment|service|order|livraison|paiement)\s*$/.test(text.slice(0,m.index))||/^\s+(?:(?:de\s+|du\s+|d['’])?(?:livraison|paiement|prestation|commande|releve|intervention|debut|fin)|of\s+(?:delivery|payment))\b/.test(text.slice(m.index+m[0].length))))continue;
      const due=/echeance|due|verval|payer|payable|betaal/.test(m[0]);out.push({kind:due?'due_date':'date',score:generic?50:100,index:m.index,end:m.index+m[0].length});
    }
    return out;
  }
  function collect(lines,labeler,reader){
    const candidates=[];
    lines.forEach((line,i)=>{
      const ls=labeler(line);if(!ls.length)return;
      const next=lines[i+1]||'',nextVals=labeler(next).length?[]:reader(next);
      ls.forEach((l,j)=>{
        const segment=line.slice(l.end,ls[j+1]?.index??line.length);
        let vals=reader(segment),source=line;
        if(!vals.length&&nextVals.length){
          // Column headings above values: align in reading order only with matching counts.
          if(ls.length===nextVals.length)vals=[nextVals[j]];
          else if(ls.length===1&&nextVals.length===1)vals=nextVals;
          source=next;
        }
        if(vals.length===1)candidates.push({...l,value:vals[0].value,line:source,page:line.page});
      });
    });
    return candidates;
  }
  function pick(rows,kind){
    const eligible=rows.filter(r=>r.kind===kind).sort((a,b)=>b.score-a.score);
    if(!eligible.length)return {value:'',score:0,conflict:false};
    const best=eligible[0],peers=eligible.filter(r=>r.score>=best.score-10);
    return {...best,conflict:new Set(peers.map(r=>r.value)).size>1};
  }
  function reference(text,fileName){
    const source=clean(text),lines=source.split(/\r?\n|\f/).map(s=>s.trim()).filter(Boolean);
    const rx=/(?:\b(?:n(?:um(?:e|é)?ro)?[°ºo.]?\s*(?:de\s+)?(?:la\s+)?facture|facture\s*(?:n(?:um(?:e|é)?ro)?[°ºo.]?|#)|r(?:e|é)f(?:e|é)rence\s+facture|invoice\s*(?:number|no\.?|#)|factuurnummer|factuur\s*(?:nr\.?|nummer))\s*[:#]?\s*)([A-Z0-9][A-Z0-9._\/-]{1,39})/gi;
    const refs=[];
    for(const m of source.matchAll(rx)){const v=m[1].replace(/[.,;:]+$/,'');if(!/\d/.test(v)||dates(v).length||/^BE\d{8,}$/i.test(v)||/^\d+[,.]\d{2}$/.test(v))continue;refs.push(v);}
    const label=/^(?:n(?:um(?:e|é)?ro)?[°ºo.]?\s*(?:de\s+)?(?:la\s+)?facture|r(?:e|é)f(?:e|é)rence\s+facture|invoice\s*(?:number|no\.?|#)|factuurnummer|factuur\s*(?:nr\.?|nummer))\s*[:#-]?$/i;
    for(let index=0;index<lines.length-1;index++){
      if(!label.test(lines[index]))continue;
      const value=lines[index+1].replace(/[.,;:]+$/,'').trim();
      if(/^[A-Z0-9][A-Z0-9._\/-]{1,39}$/i.test(value)&&/\d/.test(value)&&!dates(value).length&&!/^BE\d{8,}$/i.test(value)){refs.push(value);break;}
    }
    // En-têtes alignés d'un tableau PDF : « Numéro facture | Date | Échéance »
    // suivis des trois valeurs sur la ligne suivante.
    const referenceMarker=/\b(?:n(?:um(?:e|é)?ro)?[°ºo.]?\s*(?:de\s+)?(?:la\s+)?facture|r(?:e|é)f(?:e|é)rence\s+facture|invoice\s*(?:number|no\.?|#)|factuurnummer|factuur\s*(?:nr\.?|nummer))\b/ig;
    const otherMarker=/\b(?:date\s+(?:de\s+)?(?:la\s+)?facture|facture\s+du|invoice\s+date|echeance|due\s+date|vervaldatum)\b/ig;
    for(let index=0;index<lines.length-1;index++){
      const heading=lines[index],markers=[];referenceMarker.lastIndex=0;otherMarker.lastIndex=0;
      for(const m of heading.matchAll(referenceMarker))markers.push({index:m.index,reference:true});
      for(const m of heading.matchAll(otherMarker))markers.push({index:m.index,reference:false});
      markers.sort((a,b)=>a.index-b.index);const refIndex=markers.findIndex(m=>m.reference);
      if(refIndex<0||markers.length<2)continue;
      const values=lines[index+1].split(/\s{2,}/).map(v=>v.trim()).filter(Boolean),value=values[refIndex]?.replace(/[.,;:]+$/,'');
      if(value&&/^[A-Z0-9][A-Z0-9._\/-]{1,39}$/i.test(value)&&/\d/.test(value)&&!dates(value).length&&!/^BE\d{8,}$/i.test(value)){refs.push(value);break;}
    }
    const distinct=[...new Set(refs)];if(distinct.length)return {value:distinct[0],conflict:distinct.length>1};
    // Un nom de fichier est une information d'aide, jamais un numéro de facture fiable.
    return {value:'',fallback:false,fileName};
  }
  function extract(text,fileName=''){
    const lines=clean(text).split(/\r?\n|\f/).map(s=>s.trim()).filter(Boolean),warnings=[];
    const monetary=collect(lines,moneyLabels,amounts);
    const total=pick(monetary,'total'),payable=pick(monetary,'payable'),base=pick(monetary,'base'),tax=pick(monetary,'tax');
    let chosen=total.score>=85?total:payable.score?payable:total;
    let check=chosen.score>=85?'detected':chosen.score?'review':'missing';
    if(base.value!==''&&tax.value!==''&&!base.conflict&&!tax.conflict){
      const sum=round(base.value+tax.value);
      if(chosen.value===''){chosen={value:sum,score:90};check='calculated';warnings.push('TVAC calculé à partir du HTVA et de la TVA : à confirmer sur le PDF.');}
      else if(Math.abs(sum-chosen.value)<=0.02){check='consistent';}
      else {check='mismatch';warnings.push('Le HTVA + la TVA ne correspondent pas au total détecté.');}
    }
    if(chosen.conflict){check='review';warnings.push('Plusieurs totaux différents ont été trouvés : vérifiez le montant et le nombre de factures dans ce PDF.');}
    if(total.value!==''&&payable.value!==''&&Math.abs(total.value-payable.value)>0.02)warnings.push('Le total de la facture et le solde à payer diffèrent (acompte ou paiement antérieur possible).');
    if(chosen.score&&chosen.score<85)warnings.push('Montant associé à un libellé général « total » : à confirmer.');
    const temporal=collect(lines,dateLabels,dates),issued=pick(temporal,'date'),due=pick(temporal,'due_date');
    if(issued.score===50)warnings.push('Date trouvée sous un libellé général : vérifiez la date de facture.');
    if(issued.conflict)warnings.push('Plusieurs dates de facture différentes ont été trouvées.');
    if(due.conflict)warnings.push('Plusieurs échéances différentes ont été trouvées.');
    if(issued.value&&due.value&&due.value<issued.value)warnings.push('L’échéance précède la date de facture.');
    const ref=reference(text,fileName);if(ref.conflict)warnings.push('Plusieurs numéros de facture ont été trouvés.');if(ref.fallback&&ref.value)warnings.push('Numéro proposé à partir du nom du fichier : à confirmer.');
    const rates=new Set();for(const line of lines){if(!/\b(tva|vat|btw)\b/.test(fold(line)))continue;for(const m of line.matchAll(/\b(\d{1,2}(?:[.,]\d+)?)\s*%/g)){const n=Number(m[1].replace(',','.'));if(n<=100)rates.add(n);}}
    if(rates.size>1)warnings.push('Plusieurs taux de TVA : conservez la ventilation indiquée sur la facture.');
    if(chosen.value==='')warnings.push('Montant TVAC non identifié.');if(!issued.value)warnings.push('Date de facture non identifiée.');if(!ref.value)warnings.push('Numéro de facture non identifié.');
    return {amount:chosen.value,date:issued.value,due_date:due.value,reference:ref.value,amount_excl_vat:base.value,vat_amount:tax.value,vat_rate:rates.size===1?[...rates][0]:'',amount_check:check,ocr_warnings:warnings,ocr_engine:'document-36.10.3',ocr_evidence:{amount:chosen.line||'',date:issued.line||'',due_date:due.line||''}};
  }
  // Restore visual reading order instead of flattening the PDF text stream.
  function textFromItems(items,viewport){
    const rows=[];
    for(const it of items||[]){
      if(!it.str?.trim())continue;
      const t=it.transform||[1,0,0,1,0,0],point=viewport?.convertToViewportPoint?.(t[4],t[5]);
      const x=point?point[0]:t[4],y=point?point[1]:-t[5],h=Math.max(1,Math.abs(it.height||Math.hypot(t[2],t[3])||10));
      let row=rows.find(r=>Math.abs(r.y-y)<=Math.max(2,Math.min(r.h,h)*0.35));
      if(!row){row={y,h,items:[]};rows.push(row);}row.items.push({x,width:it.width||0,str:it.str});
    }
    return rows.sort((a,b)=>a.y-b.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map((it,i,list)=>{
      const prev=list[i-1];return (prev?(it.x-prev.x-prev.width>16?'    ':' '):'')+it.str;
    }).join('')).join('\n');
  }
  async function createWorker(progress){
    if(!root.Tesseract?.createWorker)throw new Error('Le moteur OCR n’est pas chargé. Vérifiez la connexion puis rechargez la page.');
    const worker=await root.Tesseract.createWorker('fra+eng+nld',1,{logger:m=>{if(m.status==='recognizing text')progress?.(Math.round((m.progress||0)*100));}});
    await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1',user_defined_dpi:'300'});
    return worker;
  }
  function textScore(text){const f=extract(text);return ['amount','date','reference'].filter(k=>f[k]!=='').length*100+Math.min(String(text).replace(/\W/g,'').length,99);}
  async function recognize(worker,image){
    await worker.setParameters({tessedit_pageseg_mode:'3'});
    const first=await worker.recognize(image,{rotateAuto:true});
    if(Number(first.data?.confidence||0)>=80&&textScore(first.data?.text||'')>=300)return {...first.data,conflict:false};
    // A second layout pass helps sparse invoices without mixing contradictory readings.
    await worker.setParameters({tessedit_pageseg_mode:'6'});
    const second=await worker.recognize(image,{rotateAuto:true});
    const a=first.data||{},b=second.data||{};
    const fa=extract(a.text),fb=extract(b.text),conflict=['amount','date','reference'].some(k=>fa[k]!==''&&fb[k]!==''&&fa[k]!==fb[k]);
    const chosen=textScore(b.text||'')+Number(b.confidence||0)>textScore(a.text||'')+Number(a.confidence||0)?b:a;
    return {...chosen,conflict};
  }
  async function readPdf(blob,options={}){
    if(!root.pdfjsLib)throw new Error('Le lecteur PDF n’est pas chargé. Rechargez la page.');
    root.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const task=root.pdfjsLib.getDocument({data:await blob.arrayBuffer()});let pdf,worker;
    try{
      pdf=await task.promise;const pages=[],warnings=[];
      // Read every page: totals often occur on the last page, including mixed PDFs.
      for(let p=1;p<=pdf.numPages;p++){
        options.onProgress?.(`Lecture de la page ${p}/${pdf.numPages}`);
        const page=await pdf.getPage(p),content=await page.getTextContent(),viewport=page.getViewport({scale:1});
        const embedded=textFromItems(content.items,viewport);
        let text=embedded;
        const sparse=embedded.replace(/\s/g,'').length<80||/[\uFFFD]{2,}/.test(embedded);
        const fields=extract(embedded),needsFields=fields.amount===''||!fields.date||!fields.reference;
        if((sparse&&needsFields)||(options.forceOcr!==false&&needsFields)){
          if(!worker)worker=await createWorker(n=>options.onProgress?.(`Reconnaissance page ${p}/${pdf.numPages} : ${n} %`));
          const scale=Math.min(3,Math.sqrt(14000000/(viewport.width*viewport.height))),v=page.getViewport({scale});
          const canvas=root.document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
          try{
            await page.render({canvasContext:canvas.getContext('2d'),viewport:v,background:'rgb(255,255,255)'}).promise;
            const scanned=await recognize(worker,canvas);
            if(textScore(scanned.text||'')>textScore(embedded)){
              text=scanned.text||embedded;
              if(Number(scanned.confidence||0)<75)warnings.push(`Page ${p} : reconnaissance peu sûre, vérifiez les chiffres sur le PDF.`);
              if(scanned.conflict)warnings.push(`Page ${p} : les deux lectures OCR donnent des champs différents, à vérifier.`);
            }
          }finally{canvas.width=canvas.height=0;}
        }
        pages.push(text);page.cleanup();
      }
      options.onDiagnostics?.({warnings});
      return pages.join('\n\f\n').trim();
    }finally{try{if(worker)await worker.terminate();}finally{if(pdf)await pdf.destroy();else await task.destroy();}}
  }
  async function readImage(blob,options={}){let worker;try{worker=await createWorker(options.onProgress);const result=await recognize(worker,blob);options.onDiagnostics?.({warnings:Number(result.confidence||0)<75||result.conflict?['Reconnaissance de l’image incertaine : vérifiez les chiffres.']:[]});return result.text||'';}finally{if(worker)await worker.terminate();}}
  function mergeAnalysis(previous,current,extracted){
    const next={...current,...extracted},same=(a,b)=>String(a??'')===String(b??'');
    for(const key of ['amount','date','due_date','reference','vat_rate','vat_amount','amount_excl_vat']){
      if(Object.prototype.hasOwnProperty.call(current,key)&&!same(current[key],previous[key]))next[key]=current[key];
    }
    for(const key of ['copro_id','supplier_id','account_id','description','notes'])if(current[key])next[key]=current[key];
    return next;
  }
  const api={extract,money,amounts,dates,textFromItems,readPdf,readImage,mergeAnalysis};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WapiInvoiceDocument=api;
})(typeof window==='object'?window:globalThis);
