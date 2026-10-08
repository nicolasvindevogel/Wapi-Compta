const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');

function harness(repairModule=false){
  const state={copros:[{id:'c1',name:'Test'}],fiscalYears:[{id:'cached',copro_id:'c1'}]};
  const calls=[];
  let result={data:[{id:'y1',copro_id:'c1',label:'2026'},{id:'y2',copro_id:'c2',label:'2025'}],error:null};
  const context={state,console:{warn(){}},supabaseClient:{from(table){
    calls.push(table);return {select(columns){calls.push(columns);return {order:async()=>result};}};
  }},document:{readyState:'loading',getElementById:()=>null,addEventListener(){}},window:{addEventListener(){}},setTimeout(){}};
  vm.createContext(context);
  if(repairModule) vm.runInContext(fs.readFileSync(path.join(root,'js/v37_0_1_fiscal_context_fix.js'),'utf8'),context);
  else {
    const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
    const start=source.indexOf('    async function loadFiscalYears()');
    const end=source.indexOf('    async function loadBudgetHeaders()',start);
    assert(start>=0&&end>start);
    vm.runInContext(source.slice(start,end),context);
  }
  return {state,calls,setResult(value){result=value;},load:()=>repairModule?context.window.WapiFiscalContextV3701.reloadYears():context.loadFiscalYears()};
}

for(const repairModule of [false,true]){
  const label=repairModule?'selector recovery':'main loader';
  test(`${label}: load without ambiguous relation, retain all copro IDs`,async()=>{
    const h=harness(repairModule);await h.load();
    assert.deepEqual(h.calls,['compta_fiscal_years','*']);
    assert.equal(h.state.fiscalYears.length,2);
    assert.equal(h.state.fiscalYears[0].compta_copros.name,'Test');
    assert.equal(h.state.fiscalYears[1].copro_id,'c2');
  });
  test(`${label}: transient failure preserves cached years`,async()=>{
    const h=harness(repairModule),cached=h.state.fiscalYears;
    h.setResult({data:null,error:{message:'Temporary failure'}});await h.load();
    assert.equal(h.state.fiscalYears,cached);
  });
  test(`${label}: successful empty response clears stale cache`,async()=>{
    const h=harness(repairModule);h.setResult({data:[],error:null});await h.load();
    assert.equal(h.state.fiscalYears.length,0);
  });
}
