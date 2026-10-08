const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
test('complete entry page loads and navigates with isolated Supabase fixtures',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();const errors=[],missing=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const fixtures={
        compta_copros:[{id:'c1',code:'TEST',name:'Test One',manager_user_id:'u1',active:true},{id:'c2',code:'TEST2',name:'Test Two',manager_user_id:'u1',active:true}],
        compta_fiscal_years:[{id:'y1',copro_id:'c1',label:'2026',starts_on:'2026-01-01',ends_on:'2026-12-31',status:'open'},{id:'y2',copro_id:'c2',label:'2025',starts_on:'2025-01-01',ends_on:'2025-12-31',status:'open'}],
        compta_user_profiles:[{id:'u1',email:'test@example.invalid',display_name:'Test User',role:'admin',active:true}],
        compta_accounts:[{id:'a1',code:'610',label:'Entretien',active:true}]
      };
      window.mockWrites=[];
      const client={auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'test@example.invalid'}}}})},rpc:async()=>({data:null,error:{message:'Could not find the function wapi_v37_capabilities'}}),from(table){
        let single=false;const query={then(resolve,reject){return Promise.resolve({data:single?(fixtures[table]?.[0]||null):structuredClone(fixtures[table]||[]),error:null}).then(resolve,reject);}};
        for(const method of ['select','order','eq','neq','in','is','limit','range','gte','lte','gt','lt','or','not'])query[method]=()=>query;
        for(const method of ['insert','update','upsert','delete'])query[method]=payload=>{mockWrites.push({table,method});return query;};
        for(const method of ['single','maybeSingle'])query[method]=()=>{single=true;return query;};
        return query;
      }};
      window.supabase={createClient:()=>client};
    });
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='wapi-isolated.local')return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'application/javascript',body:''});
      const localPath=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(!localPath.startsWith(root+path.sep)||!fs.existsSync(localPath)){missing.push(url.pathname);return route.fulfill({status:404,body:'Missing'});}
      const ext=path.extname(localPath);return route.fulfill({contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'}[ext]||'application/octet-stream',body:fs.readFileSync(localPath)});
    });
    await page.goto('http://wapi-isolated.local/');
    await page.getByRole('combobox',{name:'Copropriété active',exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Copropriété active',exact:true}).selectOption('c1');
    await page.waitForFunction(()=>document.getElementById('activeFiscalYearSelect').value==='y1');
    for(const [main,sub,heading] of [
      ['Copropriétés','Lots','Lots'],['Copropriétés','Tiers','Tiers'],
      ['Comptabilité','Budgets','Budgets'],['Comptabilité','Appels','Appels de fonds'],
      ['Comptabilité','Factures fournisseurs','Factures fournisseurs'],['Comptabilité','Encodage financier','Financier'],
      ['Comptabilité','Opérations diverses','Opérations diverses'],['Comptabilité','Décomptes','Décomptes'],
      ['États comptables','Grand livre','Grand livre'],['États comptables','Balance générale','Balance'],
      ['Configuration','Utilisateurs','Utilisateurs et gestionnaires'],['Configuration','Modèles','Modèles d’e-mail']
    ]){
      await page.getByRole('button',{name:main,exact:true}).click();
      await page.getByRole('button',{name:sub,exact:true}).click();
      await page.getByRole('heading',{name:heading,exact:true}).waitFor({state:'visible'});
    }
    await page.getByRole('button',{name:'Utilisateurs',exact:true}).click();
    await page.locator('#v367UsersTable').getByText('Test User',{exact:true}).waitFor({state:'visible'});
    await page.getByRole('combobox',{name:'Copropriété active',exact:true}).selectOption('c2');
    await page.waitForFunction(()=>document.getElementById('activeFiscalYearSelect').value==='y2');
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    assert.deepEqual(await page.evaluate(()=>mockWrites),[]);
  }finally{await browser.close();}
});
test('exercise selector: switch copro, preserve selection, recover from network error',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<select id="activeCoproSelect"><option value="c1">Test 1</option><option value="c2">Test 2</option></select><select id="activeFiscalYearSelect"></select>'}));
    await page.goto('http://wapi-regression.local/');
    await page.evaluate(()=>{
      window.state={activeCoproId:'c1',activeFiscalYearId:'',copros:[{id:'c1',name:'Test 1'},{id:'c2',name:'Test 2'}],fiscalYears:[]};
      window.columns=[];window.fail=false;
      window.supabaseClient={from(table){if(table!=='compta_fiscal_years')throw Error('Unexpected table');return {select(cols){columns.push(cols);return {order:async()=>fail?{error:{message:'Temporary error'}}:{data:[{id:'y1',copro_id:'c1',label:'2026',status:'open',starts_on:'2026-01-01'},{id:'y0',copro_id:'c1',label:'2025',status:'closed',starts_on:'2025-01-01'},{id:'y2',copro_id:'c2',label:'2026',status:'open',starts_on:'2026-01-01'}],error:null}};}};}};
      document.getElementById('activeCoproSelect').addEventListener('change',e=>{state.activeCoproId=e.target.value;});
    });
    await page.addScriptTag({path:path.join(root,'js/v37_0_1_fiscal_context_fix.js')});
    await page.waitForFunction(()=>document.getElementById('activeFiscalYearSelect').value==='y1');
    assert.equal(await page.locator('#activeFiscalYearSelect option').count(),2);
    await page.locator('#activeFiscalYearSelect').selectOption('y0');
    await page.evaluate(()=>WapiFiscalContextV3701.repair(true));
    assert.equal(await page.locator('#activeFiscalYearSelect').inputValue(),'y0');
    await page.locator('#activeCoproSelect').selectOption('c2');
    await page.waitForFunction(()=>document.getElementById('activeFiscalYearSelect').value==='y2');
    assert.equal(await page.locator('#activeFiscalYearSelect option').count(),1);
    await page.evaluate(async()=>{fail=true;await WapiFiscalContextV3701.repair(true);});
    assert.equal(await page.locator('#activeFiscalYearSelect').inputValue(),'y2');
    assert.deepEqual(await page.evaluate(()=>[...new Set(columns)]),['*']);
    assert.deepEqual(errors,[]);
    assert.deepEqual(requests,['http://wapi-regression.local/']);
  }finally{await browser.close();}
});
test('navigation refresh renders current users and refreshes accounting modules',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());
    await page.setContent('<div id="v367UsersTable"></div><button id="open-users">Utilisateurs</button>');
    await page.evaluate(()=>{window.state={userProfiles:[{id:'test-user',display_name:'Gestionnaire test',role:'admin',active:true}],copros:[]};window.refreshes=0;window.WapiAccountingV37={refresh:()=>refreshes++};});
    await page.addScriptTag({path:path.join(root,'js/v36_7_users_auth.js')});
    const source=fs.readFileSync(path.join(root,'js/v33_integrated.js'),'utf8');
    await page.addScriptTag({content:source.slice(source.indexOf('  function refreshViewRender('),source.indexOf('  function activateStable('))});
    await page.evaluate(()=>{document.getElementById('open-users').addEventListener('click',e=>{e.stopImmediatePropagation();refreshViewRender('users');},true);document.getElementById('v367UsersTable').textContent='Stale list';});
    await page.getByRole('button',{name:'Utilisateurs'}).click();
    await page.getByText('Gestionnaire test',{exact:true}).waitFor();
    assert.equal(await page.getByText('Administrateur',{exact:true}).count(),1);
    await page.evaluate(()=>refreshViewRender('ledger'));
    await page.waitForFunction(()=>refreshes===1);
  }finally{await browser.close();}
});
