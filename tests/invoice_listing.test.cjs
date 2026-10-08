const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const navigation=fs.readFileSync(path.join(root,'js/v33_integrated.js'),'utf8');
function context(){
  const table={innerHTML:''};
  const ctx={state:{activeCoproId:'c1',activeFiscalYearId:'y1',copros:[{id:'c1',name:'Test'}],suppliers:[{id:'s1',name:'Supplier',supplier_code:'F-001'}],accounts:[],fiscalYears:[{id:'y1',copro_id:'c1',starts_on:'2026-01-01',ends_on:'2026-12-31'}],invoices:[{id:'i1',copro_id:'c1',supplier_id:'s1',invoice_date:'2026-03-15',invoice_number:'CURRENT',internal_invoice_number:'TEST-EX26-007',file_name:'invoice.pdf',compta_suppliers:{name:'Supplier'}},{id:'i2',copro_id:'c1',invoice_date:'2025-12-31',invoice_number:'PRIOR'}]},id:()=>table,esc:String,fmt:String};
  vm.createContext(ctx);
  vm.runInContext(navigation.slice(navigation.indexOf('  function ownerCode('),navigation.indexOf('  function renderCoprosV322(')),ctx);
  return {ctx,table};
}
test('invoice listing uses persisted number, global supplier code and lazy PDF metadata',()=>{
  const {ctx,table}=context();ctx.renderInvoicesV322();
  assert.match(table.innerHTML,/TEST-EX26-007/);
  assert.match(table.innerHTML,/F-001/);
  assert.match(table.innerHTML,/data-show-pdf="i1"/);
});
test('missing accounting identifier is not replaced with a fabricated number',()=>{
  const {ctx}=context();assert.equal(ctx.invoiceInternalNo({copro_id:'c1',invoice_date:'2026-03-15'}),'—');
});
test('invoice listing respects active fiscal dates and permits all years when cleared',()=>{
  const {ctx,table}=context();ctx.renderInvoicesV322();
  assert.match(table.innerHTML,/CURRENT/);assert.doesNotMatch(table.innerHTML,/PRIOR/);
  ctx.state.activeFiscalYearId='';ctx.renderInvoicesV322();assert.match(table.innerHTML,/PRIOR/);
});
test('invoice loading includes persisted number and excludes large PDF data',async()=>{
  const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');let selected;
  const ctx={state:{},console,supabaseClient:{from(){return {select(columns){selected=columns;return {order(){return {limit:async()=>({data:[{id:'i1',internal_invoice_number:'TEST-EX26-007'}],error:null})};}};}};}}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('    async function loadInvoices()'),source.indexOf('    async function loadBankAccounts()')),ctx);
  await ctx.loadInvoices();assert(selected.split(',').includes('internal_invoice_number'));assert(!selected.split(',').includes('file_data_url'));
  assert.equal(ctx.state.invoices[0].internal_invoice_number,'TEST-EX26-007');
});
test('refresh hook does not renumber invoices or write to Supabase',async()=>{
  let writes=0,reads=0;
  const ctx={window:{},document:{addEventListener(){}},state:{},supabaseClient:{from(){writes++;throw Error('Unexpected write');}},loadAll:async()=>{reads++;},safe:fn=>fn(),afterRender(){},setTimeout(){},ensureMissingInternalInvoiceNumbers:async()=>{writes++;}};
  vm.createContext(ctx);
  vm.runInContext(navigation.slice(navigation.indexOf('  function installPatches()'),navigation.indexOf("  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPatches);")),ctx);
  ctx.installPatches();await ctx.loadAll();assert.equal(reads,1);assert.equal(writes,0);
});
