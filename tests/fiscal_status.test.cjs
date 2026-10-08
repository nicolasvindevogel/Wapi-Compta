const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/v33_2_topnav.js'),'utf8');
for(const [name,year,title] of [
  ['open with old closure timestamp',{id:'y1',status:'open',closed_at:'2026-01-01'},'Exercice ouvert'],
  ['closed',{id:'y1',status:'closed'},'Exercice clôturé'],
  ['historical record without status',{id:'y1',closed_at:'2026-01-01'},'Exercice clôturé'],
  ['no selection',null,'Aucun exercice sélectionné']
])test(`fiscal status: ${name}`,()=>{
  const dot={setAttribute(key,value){this[key]=value;}};
  const context={$:id=>id==='w332FiscalStatus'?dot:{value:'y1'},appState:()=>({fiscalYears:year?[year]:[]})};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function updateFiscalStatus(){'),source.indexOf('  function refreshCoproContext(){')),context);
  context.updateFiscalStatus();assert.equal(dot.title,title);assert.equal(dot['aria-label'],title);
});
