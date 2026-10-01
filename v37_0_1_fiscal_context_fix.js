/* WAPI One V37.0.1 — stabilisation du sélecteur d'exercice comptable.
 * Correctif front-end uniquement : aucune migration SQL supplémentaire.
 */
(function(){
  'use strict';

  const SELECT_ID='activeFiscalYearSelect';
  const COPRO_ID='activeCoproSelect';
  const STORAGE_KEY='wapi-one-active-fiscal-year';
  let loading=false;
  let repairing=false;
  let lastError='';

  const $=(id)=>document.getElementById(id);
  const appState=()=>{ try{return typeof state!=='undefined'?state:null;}catch(_){return null;} };
  const db=()=>{ try{return typeof supabaseClient!=='undefined'?supabaseClient:null;}catch(_){return null;} };
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]));

  function knownCoproId(){
    const s=appState();
    const selectValue=$(COPRO_ID)?.value||'';
    const stateValue=s?.activeCoproId||'';
    if(stateValue && (s?.copros||[]).some(c=>String(c.id)===String(stateValue))) return String(stateValue);
    return String(selectValue||'');
  }

  function yearLabel(y,includeCopro=false){
    const status=String(y?.status||'open').toLowerCase()==='closed'?'🔴':'🟢';
    const code=y?.year_code||y?.code||'';
    const label=y?.label||code||'Exercice';
    const dates=[y?.starts_on||'',y?.ends_on||''].filter(Boolean).join(' / ');
    const copro=includeCopro?(y?.compta_copros?.name||''):'';
    return [status,copro,code&&code!==label?code:'',label,dates?`— ${dates}`:''].filter(Boolean).join(' ');
  }

  function sortedYears(list){
    return [...(list||[])].sort((a,b)=>String(b?.starts_on||'').localeCompare(String(a?.starts_on||'')));
  }

  async function reloadYears(){
    const s=appState(), client=db();
    if(!s||!client||loading) return false;
    loading=true; lastError='';
    try{
      const {data,error}=await client.from('compta_fiscal_years').select('*, compta_copros(name)').order('starts_on',{ascending:false});
      if(error) throw error;
      s.fiscalYears=data||[];
      return true;
    }catch(error){
      lastError=String(error?.message||error||'Erreur chargement exercices');
      console.warn('WAPI V37.0.1 — exercices comptables :',error);
      return false;
    }finally{ loading=false; }
  }

  function selectorNeedsRepair(select,coproId,years){
    if(!select) return false;
    if(coproId && !select.options.length) return true;
    if(coproId && years.length && ![...select.options].some(o=>o.value)) return true;
    if(coproId && years.length && !years.some(y=>String(y.id)===String(select.value||''))) return true;
    if(!coproId && !select.options.length) return true;
    return false;
  }

  function renderSelector(){
    const s=appState(), select=$(SELECT_ID); if(!s||!select) return;
    const coproId=knownCoproId();
    const all=sortedYears(s.fiscalYears||[]);

    if(!coproId){
      select.innerHTML='<option value="">Mode global — sélectionne une copropriété</option>';
      select.value='';
      s.activeFiscalYearId='';
      return;
    }

    const years=all.filter(y=>String(y?.copro_id||'')===coproId);
    if(!years.length){
      select.innerHTML=`<option value="">${lastError?'Erreur chargement exercices':'Aucun exercice pour cette copropriété'}</option>`;
      select.value='';
      s.activeFiscalYearId='';
      return;
    }

    const saved=localStorage.getItem(STORAGE_KEY)||'';
    const preferred=[s.activeFiscalYearId,select.value,saved]
      .map(String)
      .find(id=>id && years.some(y=>String(y.id)===id));
    const chosen=years.find(y=>String(y.id)===preferred)
      || years.find(y=>String(y.status||'').toLowerCase()==='open')
      || years[0];

    select.innerHTML=years.map(y=>`<option value="${esc(y.id)}">${esc(yearLabel(y,false))}</option>`).join('');
    select.value=String(chosen?.id||'');
    s.activeFiscalYearId=String(chosen?.id||'');
    if(chosen?.id) localStorage.setItem(STORAGE_KEY,String(chosen.id));
  }

  async function repair(forceReload=false){
    if(repairing) return;
    repairing=true;
    try{
      const s=appState(), select=$(SELECT_ID); if(!s||!select) return;
      const coproId=knownCoproId();
      let years=sortedYears((s.fiscalYears||[]).filter(y=>!coproId||String(y?.copro_id||'')===coproId));
      if(forceReload || !s.fiscalYears?.length || (coproId && !years.length)){
        await reloadYears();
        years=sortedYears((s.fiscalYears||[]).filter(y=>!coproId||String(y?.copro_id||'')===coproId));
      }
      if(forceReload || selectorNeedsRepair(select,coproId,years)) renderSelector();
    }finally{repairing=false;}
  }

  function schedule(force=false,delay=40){ setTimeout(()=>repair(force),delay); }

  document.addEventListener('change',(event)=>{
    if(event.target?.id===COPRO_ID) schedule(true,100);
    if(event.target?.id===SELECT_ID){
      const s=appState(); if(!s) return;
      s.activeFiscalYearId=event.target.value||'';
      if(event.target.value) localStorage.setItem(STORAGE_KEY,event.target.value);
    }
  },true);

  window.addEventListener('pageshow',()=>schedule(false,80));
  window.addEventListener('focus',()=>schedule(false,80));

  function init(){
    schedule(false,0);
    schedule(true,500);
    schedule(false,1500);
    const select=$(SELECT_ID);
    if(select && typeof MutationObserver!=='undefined'){
      const observer=new MutationObserver(()=>{
        const s=appState(), coproId=knownCoproId();
        const years=(s?.fiscalYears||[]).filter(y=>!coproId||String(y?.copro_id||'')===String(coproId));
        if(selectorNeedsRepair(select,coproId,years)) schedule(false,20);
      });
      observer.observe(select,{childList:true});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.WapiFiscalContextV3701={repair,reloadYears,renderSelector};
})();
