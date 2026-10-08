const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/v34_4_structure_setup.js'),'utf8');

for(const type of ['owner','supplier','occupant'])test(`identity modal reads ${type} from lexical application state`,()=>{
  const record={id:'r1',street:'Rue audit',street_number:'7',postal_code:'7500',city:'Tournai',vcs:'+++123/4567/89002+++'};
  const wrap={className:'',innerHTML:'',insertAdjacentHTML(position,html){this.after=html;}};
  let replaced=false;
  const old={closest(){return {replaceWith(){replaced=true;}};}};
  const footer={insertAdjacentHTML(){},onclick:null};
  const state={selectedIdentityType:type,selectedIdentityId:'r1',owners:[],suppliers:[],occupants:[]};
  state[type==='owner'?'owners':type==='supplier'?'suppliers':'occupants']=[record];
  const context={state,window:{},document:{createElement(){return wrap;}},byId(id){return id==='modalIdentityAddress'?old:id==='globalModalFooter'||id==='v344DeleteOwner'?footer:null;},appState:()=>state,list:name=>state[name],esc:String,addressFields(prefix,value){return `${value.street}|${value.street_number}|${value.postal_code}|${value.city}`;},deleteOwner(){}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function enhanceIdentityModal()'),source.indexOf('  async function saveIdentityStructured()')),context);
  context.enhanceIdentityModal();
  assert.equal(replaced,true);
  assert.match(wrap.innerHTML,/Rue audit\|7\|7500\|Tournai/);
  if(type==='owner')assert.match(wrap.after,/123\/4567\/89002/);
  else assert.equal(wrap.after,undefined);
});
