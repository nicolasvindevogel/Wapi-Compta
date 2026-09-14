// Isolated browser tests: synthetic data, no connection to the accounting database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {PDFDocument,StandardFonts}=require('pdf-lib');
const base=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.route(/supabase\./,r=>r.abort());
    const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
    await page.setContent('<select id="budgetCoproFilter"></select><select id="budgetFiscalYearFilter"></select><select id="budgetHeaderFilter"></select><div id="budgetsTable"></div>');
    await page.evaluate(()=>{
      window.$=id=>document.getElementById(id);
      window.state={copros:[{id:'c1',name:'Test'}],fiscalYears:[{id:'y1',copro_id:'c1',label:'2026'}],budgetHeaders:[{id:'b1',copro_id:'c1',fiscal_year_id:'y1',label:'Budget test',status:'draft'}],budgetLines:[{id:'l1',budget_id:'b1',amount:100,label:'Entretien'}],selectedBudgetHeaderId:'b1'};
      window.escapeHtml=s=>s;window.budgetCurrentCoproFilter=()=>$('budgetCoproFilter').value;window.budgetCurrentYearFilter=()=>$('budgetFiscalYearFilter').value;
      window.applyActiveCoproLocksV11=()=>{};window.recalcBudgetTotalsV11=()=>{};
      window.renderSyndicBillingV23=()=>{};
      window.renderBudgetDetailV11=()=>{$('budgetsTable').innerHTML='<button data-back-budget-list><span>Liste</span></button><input data-budget-amount-v11="l1" value="'+state.budgetLines[0].amount+'"><input data-budget-label-v11="l1" value="Entretien">';};
      window.renderBudgetListV11=()=>{$('budgetsTable').innerHTML='<p>Liste des budgets</p>';};
      window.saved=[];window.alerts=[];window.alert=s=>alerts.push(s);
      window.supabaseClient={from:table=>({update:data=>({eq:async()=>{saved.push({table,data});return {error:window.failHeader&&table==='compta_budgets'?{message:'Erreur simulée'}:null};}}),select:()=>({order:async()=>({data:[],error:null})})})};
    });
    const app=fs.readFileSync(path.join(base,'js/app.js'),'utf8');
    const start=app.lastIndexOf('    function renderBudgets() {'),end=app.indexOf('\n    }',start)+6;
    assert(start>=0&&end>start);
    await page.addScriptTag({content:app.slice(start,end)});
    await page.addScriptTag({path:path.join(base,'js/v36_10_stabilisation.js')});
    await page.evaluate(()=>renderBudgets());
    await page.locator('[data-budget-amount-v11]').fill('250');
    await page.getByRole('button',{name:'Enregistrer brouillon'}).click();
    await page.waitForFunction(()=>alerts.includes('Brouillon enregistré.'));
    await page.locator('[data-back-budget-list] span').click();
    assert.equal(await page.locator('#budgetsTable').innerText(),'Liste des budgets');
    assert.equal(await page.locator('#budgetHeaderFilter').inputValue(),'');
    await page.evaluate(()=>{state.selectedBudgetHeaderId='b1';renderBudgets();});
    assert.equal(await page.locator('[data-budget-amount-v11]').inputValue(),'250');
    await page.locator('[data-budget-amount-v11]').fill('275');
    await page.locator('[data-back-budget-list]').click();
    await page.waitForFunction(()=>!state.selectedBudgetHeaderId);
    assert.equal(await page.evaluate(()=>state.budgetLines[0].amount),275);
    await page.evaluate(()=>{state.selectedBudgetHeaderId='b1';renderBudgets();window.failHeader=true;});
    await page.locator('[data-budget-amount-v11]').fill('300');
    await page.locator('[data-back-budget-list]').click();
    await page.waitForFunction(()=>alerts.some(s=>s.includes('Erreur simulée')));
    assert.equal(await page.evaluate(()=>state.selectedBudgetHeaderId),'b1');
    console.log('PASS budget: save, nested back button, reopen, save-on-back, failed save stays open');
    await page.close();

    const pdfPage=await browser.newPage();pdfPage.on('pageerror',e=>errors.push(e.message));
    await pdfPage.goto('about:blank');
    await pdfPage.addScriptTag({url:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});
    await pdfPage.addScriptTag({url:'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'});
    await pdfPage.addScriptTag({path:path.join(base,'js/invoice_document.js')});
    const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
    for(let i=0;i<6;i++){
      const p=doc.addPage();
      for(const [text,y] of [['Facture n° TEST-2026-17',760],['Date facture : 08/09/2026',730],['Échéance : 08/10/2026',700],['Prestations de nettoyage des parties communes',660]])p.drawText(text,{x:50,y,size:14,font});
      if(i===5)p.drawText('Total TVAC : 1.210,00 EUR',{x:50,y:250,size:14,font});
    }
    const bytes=Array.from(await doc.save());
    const embedded=await pdfPage.evaluate(async bytes=>{
      const text=await WapiInvoiceDocument.readPdf(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),{forceOcr:false});
      return {text,fields:WapiInvoiceDocument.extract(text)};
    },bytes);
    assert.equal(embedded.fields.amount,1210);assert.equal(embedded.fields.date,'2026-09-08');assert.equal(embedded.fields.due_date,'2026-10-08');assert.equal(embedded.text.split('\f').length,6);
    console.log('PASS real PDF.js: six-page PDF, amount, reference, invoice date and due date');
    const proximusBytes=Array.from(fs.readFileSync(path.resolve(base,'..','..','outputs','facture-test-proximus-acp-concorde.pdf')));
    const proximus=await pdfPage.evaluate(async bytes=>{
      const text=await WapiInvoiceDocument.readPdf(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),{forceOcr:false});
      return {text,fields:WapiInvoiceDocument.extract(text,'corde.pdf')};
    },proximusBytes);
    for(const [key,value] of Object.entries({amount:119.79,vat_amount:20.79,date:'2026-09-14',due_date:'2026-10-14',reference:'TEST-PROX-2026-0914'}))assert.equal(proximus.fields[key],value,JSON.stringify(proximus));
    console.log('PASS actual test invoice: detects Proximus invoice number, dates and 119,79 EUR without using the filename');
    // Rasterize an invoice to an image-only PDF, then execute the actual OCR worker.
    const png=await pdfPage.evaluate(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=2100;
      const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='36px Arial';
      ['FOURNISSEUR TEST','Facture n° SCAN-2026-42','Date facture : 08/09/2026','Échéance : 08/10/2026','Total HTVA : 1.000,00 EUR','Total TVA : 210,00 EUR','Total TVAC : 1.210,00 EUR'].forEach((s,i)=>ctx.fillText(s,120,160+i*160));
      return c.toDataURL('image/png').split(',')[1];
    });
    const scanned=await PDFDocument.create(),scan=await scanned.embedPng(Buffer.from(png,'base64'));scanned.addPage([600,788]).drawImage(scan,{x:0,y:0,width:600,height:788});
    const scanBytes=Array.from(await scanned.save());
    const ocr=await pdfPage.evaluate(async bytes=>{
      const text=await WapiInvoiceDocument.readPdf(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
      return {text,fields:WapiInvoiceDocument.extract(text)};
    },scanBytes);
    for(const [key,value] of Object.entries({amount:1210,date:'2026-09-08',due_date:'2026-10-08',reference:'SCAN-2026-42'}))assert.equal(ocr.fields[key],value,JSON.stringify(ocr));
    console.log('PASS real Tesseract: scanned PDF amount, reference, invoice date and due date');
    const center=await browser.newPage();center.on('pageerror',e=>errors.push(e.message));
    await center.route('http://wapi-test.local/**',r=>r.fulfill({contentType:'text/html',body:'<div id="invoiceOcrView"><div id="invoiceOcrWorkbench"></div></div>'}));
    await center.goto('http://wapi-test.local/');
    await center.addScriptTag({path:path.join(base,'js/invoice_document.js')});
    await center.evaluate(()=>{
      const initial={amount:100,date:'2026-09-01',due_date:'2026-10-01',reference:'OLD-1',account_id:'a1',copro_id:'c1',supplier_id:'s1'};
      window.currentUser={id:'test'};window.money=n=>String(n);
      window.state={copros:[{id:'c1',name:'Test'}],suppliers:[{id:'s1',name:'Fournisseur test'}],accounts:[{id:'a1',code:'610',label:'Entretien'}],invoices:[],userProfiles:[],importItems:[{id:'i1',file_name:'test.pdf',mime_type:'application/pdf',raw_text:'ancien texte',raw_data:{file_data_url:'data:application/pdf;base64,VEVTVA=='}}],validationQueue:[{id:'q1',item_id:'i1',copro_id:'c1',target_type:'invoice',extracted_data:{...initial},corrected_data:{...initial}}]};
      window.extractInvoiceFieldsV19=()=>({account_id:'a1'});window.pdfReads=0;
      window.WapiInvoiceDocument.readPdf=async blob=>{if(!(blob instanceof Blob))throw Error('Source PDF absente');pdfReads++;return 'Facture n° NEW-2\nDate facture 08/09/2026\nÉchéance 08/10/2026\nTotal TVAC 150,00';};
      window.saved=[];window.alerts=[];window.alert=s=>alerts.push(s);
      window.supabaseClient={from:table=>{
        const query={select(){return query;},order(){return query;},eq(){return query;},update(data){saved.push({table,data});return query;},single:async()=>({data:{},error:null}),then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return query;
      }};
    });
    await center.addScriptTag({path:path.join(base,'js/v36_invoice_center.js')});
    await center.evaluate(()=>renderInvoiceOcrV13());
    await center.locator('#v36FieldTotal').fill('123');
    await center.locator('#v36FieldReference').fill('MANUAL-42');
    await center.locator('#v36Analyze').click();
    await center.waitForFunction(()=>state.validationQueue[0].analysis_attempts===1);
    const actual=await center.evaluate(()=>({reads:pdfReads,data:state.validationQueue[0].corrected_data,saved,alerts}));
    assert.equal(actual.reads,1);assert.equal(actual.data.amount,123);assert.equal(actual.data.reference,'MANUAL-42');assert.equal(actual.data.date,'2026-09-08');assert.equal(actual.data.due_date,'2026-10-08');assert.equal(actual.data.supplier_id,'s1');assert.deepEqual(actual.alerts,[]);
    assert(actual.saved.some(s=>s.table==='compta_import_items'&&s.data.raw_text.includes('NEW-2')));
    console.log('PASS invoice center: re-reads PDF, refreshes dates, preserves manual amount/reference and supplier, saves new text');
    const workflow=await browser.newPage();workflow.on('pageerror',e=>errors.push(e.message));
    await workflow.route('http://wapi-workflow.local/**',r=>r.fulfill({contentType:'text/html',body:'<div id="invoiceOcrView"><div id="invoiceOcrWorkbench"></div></div><div id="importBatchesTable"></div><button data-edit-invoice="inv1">Modifier</button>'}));
    await workflow.goto('http://wapi-workflow.local/');
    await workflow.evaluate(()=>{
      window.$=id=>document.getElementById(id);window.escapeHtml=s=>String(s);window.money=n=>Number(n).toFixed(2)+' EUR';window.currentUser={id:'test'};
      const ready=(reference,amount=121)=>({copro_id:'c1',supplier_id:'s1',account_id:'a1',reference,date:'2026-09-08',due_date:'2026-10-08',amount,vat_rate:21,amount_excl_vat:100,vat_amount:21,ocr_warnings:[]});
      window.state={copros:[{id:'c1',name:'CONCORDE'}],suppliers:[{id:'s1',name:'Proximus'}],accounts:[{id:'a1',code:'6150',label:'Téléphone'}],invoices:[{id:'inv1',ocr_source_item_id:'i1',source:'processing_center',file_name:'encoded.pdf',copro_id:'c1'}],userProfiles:[],importItems:[{id:'i1',file_name:'encoded.pdf',import_type:'invoice',created_at:'2026-09-14T08:00:00Z',status:'validated',raw_data:{}},{id:'i2',file_name:'ready-1.pdf',import_type:'invoice',created_at:'2026-09-14T08:01:00Z',raw_data:{}},{id:'i3',file_name:'missing.pdf',import_type:'invoice',created_at:'2026-09-14T08:02:00Z',raw_data:{}},{id:'i4',file_name:'ready-2.pdf',import_type:'invoice',created_at:'2026-09-14T08:03:00Z',raw_data:{}}],validationQueue:[{id:'q1',item_id:'i1',target_type:'invoice',status:'validated',workflow_bucket:'posted',copro_id:'c1',corrected_data:ready('ENC-1')},{id:'q2',item_id:'i2',target_type:'invoice',status:'to_validate',workflow_bucket:'to_validate',copro_id:'c1',corrected_data:ready('READY-1')},{id:'q3',item_id:'i3',target_type:'invoice',status:'to_verify',copro_id:'c1',corrected_data:{copro_id:'c1',supplier_id:'s1'}},{id:'q4',item_id:'i4',target_type:'invoice',status:'to_validate',workflow_bucket:'to_validate',copro_id:'c1',corrected_data:ready('READY-2',242)}]};
      window.WapiInvoiceDocument={extract:()=>({}),mergeAnalysis:(a,b)=>({...a,...b})};window.extractInvoiceFieldsV19=()=>({});window.extractInvoiceFieldsV13=()=>({});window.extractSimpleFieldsFromText=()=>({});window.detectSupplierFromText=()=>({});window.detectCoproFromText=()=>({});
      window.views=[];window.switchToView=v=>views.push(v);window.renderImportBatches=()=>{};document.querySelector('[data-edit-invoice]').onclick=()=>window.openedInvoice='inv1';
      window.alerts=[];window.alert=s=>alerts.push(s);window.supabaseClient={from(table){
        const chain={
          select(){return chain;},order(){return chain;},eq(){return chain;},update(){return chain;},insert(){return chain;},
          maybeSingle:async()=>({data:{id:'link1'},error:null}),
          single:async()=>({data:{id:'created-'+Math.random()},error:null}),
          then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}
        };return chain;
      }};
    });
    await workflow.addScriptTag({path:path.join(base,'js/v36_invoice_center.js')});
    assert.equal(await workflow.evaluate(()=>typeof window.renderInvoiceOcrV13),'function');
    await workflow.waitForTimeout(750);await workflow.evaluate(()=>{renderInvoiceOcrV13();renderImportBatches();});
    await workflow.locator('[data-v36-history-open="i1"]').first().click();await workflow.waitForFunction(()=>window.openedInvoice==='inv1');
    await workflow.locator('[data-v36-history-open="i3"]').first().click();await workflow.waitForFunction(()=>state.ocrSelectedQueueId==='q3');
    await workflow.locator('[data-v36-tab="to_validate"]').click();await workflow.locator('#v36SelectVisible').check();
    assert.equal(await workflow.locator('[data-v36-select]:checked').count(),2);
    await workflow.locator('#v36BulkValidate').click();await workflow.waitForFunction(()=>state.invoices.length===3);
    assert.equal(await workflow.evaluate(()=>state.validationQueue.filter(q=>q.status==='validated').length),3);
    assert.match(await workflow.evaluate(()=>alerts.at(-1)),/2 facture/);
    console.log('PASS workflow: import history opens the encoded invoice or OCR, ready invoices select and validate in bulk');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
