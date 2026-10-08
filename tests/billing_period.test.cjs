const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/v36_10_stabilisation.js'),'utf8');
const context={};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  function contractStart('),source.indexOf('  function dateInContract(')),context);
for(const [name,start,end,expected] of [
  ['calendar year','2026-01-01','2026-12-31',12],
  ['leap year','2024-01-01','2024-12-31',12],
  ['fiscal year','2026-07-01','2027-06-30',12],
  ['one month','2026-02-01','2026-02-28',1],
  ['partial months','2026-01-31','2026-02-01',2],
  ['reversed dates','2026-03-01','2026-02-28',0]
])test(`contract months: ${name}`,()=>assert.equal(context.contractMonthCount({starts_on:start,ends_on:end}),expected));
test('contract table displays twelve monthly fees for a calendar year',()=>{
  context.state={syndicContracts:[{id:'test',copro_id:'c1',monthly_amount_htva:300,starts_on:'2026-01-01',ends_on:'2026-12-31'}]};
  context.esc=String;context.eur=value=>`${Number(value).toFixed(2)} EUR`;context.copro=()=>({name:'Test'});
  vm.runInContext(source.slice(source.indexOf('  function renderContracts('),source.indexOf('  function renderServices(')),context);
  const root={};context.renderContracts(root);
  assert.match(root.innerHTML,/3600\.00 EUR HTVA/);
  assert.doesNotMatch(root.innerHTML,/3900\.00/);
});
