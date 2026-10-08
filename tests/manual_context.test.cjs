const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function fixture(){
  const state={activeCoproId:'c1',bankAccounts:[{id:'b2',copro_id:'c2'}],owners:[{id:'o1',copro_id:'c1',display_name:'Owner 1'},{id:'o2',copro_id:'c2',display_name:'Owner 2'}],occupants:[{id:'t1',copro_id:'c1',display_name:'Occupant 1'},{id:'t2',copro_id:'c2',display_name:'Occupant 2'}],suppliers:[{id:'s1',name:'Supplier'}],invoices:[{id:'i1',copro_id:'c1',supplier_id:'s1',invoice_number:'Invoice 1'},{id:'i2',copro_id:'c2',supplier_id:'s1',invoice_number:'Invoice 2'}],ownerCalls:[{id:'a1',copro_id:'c1',owner_id:'o1',label:'Call 1'},{id:'a2',copro_id:'c2',owner_id:'o1',label:'Call 2'}]};
  const account={value:''};const context={state,$:()=>account,escapeHtml:String,money:String,invoicePaymentStatus:()=>'',paidAmountForInvoice:()=>0};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('    function manualStatementCoproId()'),source.indexOf('    function renderManualStatementDraftLines()')),context);
  return {context,account,state};
}
test('manual owner and occupant choices stay within the selected copro',()=>{
  const {context}=fixture();
  assert.match(context.tierOptionsForType('owner'),/Owner 1/);assert.doesNotMatch(context.tierOptionsForType('owner'),/Owner 2/);
  assert.match(context.tierOptionsForType('occupant'),/Occupant 1/);assert.doesNotMatch(context.tierOptionsForType('occupant'),/Occupant 2/);
});
test('manual choices follow the selected bank account',()=>{
  const {context,account}=fixture();account.value='b2';
  assert.match(context.tierOptionsForType('owner'),/Owner 2/);assert.doesNotMatch(context.tierOptionsForType('owner'),/Owner 1/);
});
test('global supplier remains usable but invoices are restricted to the bank copro',()=>{
  const {context}=fixture();assert.match(context.tierOptionsForType('supplier'),/Supplier/);
  const html=context.letterableOptionsForLine({tier_type:'supplier',tier_id:'s1',movement_type:'debit'});
  assert.match(html,/Invoice 1/);assert.doesNotMatch(html,/Invoice 2/);
});
test('owner calls are restricted to the bank copro',()=>{
  const {context}=fixture();const html=context.letterableOptionsForLine({tier_type:'owner',tier_id:'o1',movement_type:'credit'});
  assert.match(html,/Call 1/);assert.doesNotMatch(html,/Call 2/);
});
test('manual save rejects a tier or lettering document from another copro',()=>{
  const {context}=fixture();
  assert.match(context.manualLineContextError({tier_type:'owner',tier_id:'o2'},'c1'),/tiers/);
  assert.match(context.manualLineContextError({tier_type:'supplier',tier_id:'s1',movement_type:'debit',letter_target_id:'i2'},'c1'),/document/);
  assert.equal(context.manualLineContextError({tier_type:'supplier',tier_id:'s1',movement_type:'debit',letter_target_id:'i1'},'c1'),'');
});
test('actual manual save refuses cross-copro owner before any database write',async()=>{
  const {context,state}=fixture();
  state.bankAccounts.push({id:'b1',copro_id:'c1'});
  state.manualStatementDraftLines=[{transaction_date:'2026-10-08',label:'Audit',movement_type:'credit',tier_type:'owner',tier_id:'o2',amount:10}];
  const values={manualModalAccount:'b1',manualModalNumber:'AUDIT',manualModalDate:'2026-10-08',manualModalOpening:'0'};
  context.$=id=>({value:values[id]});
  const alerts=[];let writes=0;
  context.alert=message=>alerts.push(message);
  context.supabaseClient={from(){writes++;throw new Error('Unexpected database write');}};
  const start=source.lastIndexOf('    async function saveManualStatementFromModal(');
  vm.runInContext(source.slice(start,source.indexOf('    const originalRenderAllV11',start)),context);
  await context.saveManualStatementFromModal();
  assert.equal(writes,0);assert.match(alerts[0],/tiers de cette copropriété/);
});
