/* WAPI One V36.11 — contexte d'exercice central, filtres de dates synchronisés, navigation syndic stabilisée. */
(()=>{
  'use strict';
  window.WAPI_ONE_VERSION='V36.11';
  window.WAPI_ONE_BUILD_DATE='2026-08-28';

  const $=id=>document.getElementById(id);
  let syncing=false;
  let timers=[];

  const YEAR_SELECTS=[
    'budgetFiscalYearFilter',
    'callsFiscalYearFilter',
    'settlementYearFilter',
    'thirdBalanceYearFilter',
    'v356BilanYear',
    'v28MeterYear',
    'v346ExpensesYear',
    'v28FiscalYearSettingsSelect',
    'v33FiscalYearSelect'
  ];

  const DATE_RANGES=[
    ['callDispatchFrom','callDispatchTo'],
    ['sendLogFromFilter','sendLogToFilter'],
    ['v28AccountLookupFrom','v28AccountLookupTo'],
    ['w352AccountFrom','w352AccountTo'],
    ['thirdBalanceFrom','thirdBalanceTo']
  ];

  function activeCoproId(){
    return String(state?.activeCoproId||$('activeCoproSelect')?.value||'');
  }

  function activeFiscalYear(){
    const coproId=activeCoproId();
    if(!coproId)return null;
    const topId=$('activeFiscalYearSelect')?.value||state?.activeFiscalYearId||'';
    const years=(state?.fiscalYears||[]).filter(y=>String(y.copro_id)===coproId);
    return years.find(y=>String(y.id)===String(topId))||null;
  }

  function optionExists(el,value){
    return !!el&&[...el.options].some(o=>String(o.value)===String(value));
  }

  function dateInside(value,year){
    if(!value||!year)return false;
    return (!year.starts_on||value>=year.starts_on)&&(!year.ends_on||value<=year.ends_on);
  }

  function setYearSelect(id,year){
    const el=$(id);
    if(!el||!optionExists(el,year.id)||String(el.value)===String(year.id))return false;
    el.value=year.id;
    return true;
  }

  function setDateRange(fromId,toId,year,force){
    const from=$(fromId),to=$(toId);
    if(!from||!to)return false;
    const currentValid=dateInside(from.value,year)&&dateInside(to.value,year)&&from.value<=to.value;
    if(!force&&currentValid)return false;
    const nextFrom=year.starts_on||'',nextTo=year.ends_on||'';
    const changed=from.value!==nextFrom||to.value!==nextTo;
    if(!changed)return false;
    from.value=nextFrom;
    to.value=nextTo;
    return true;
  }

  function notifyRange(fromId,toId){
    const to=$(toId)||$(fromId);
    if(!to)return;
    try{to.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){ }
  }

  function refreshVisibleModules(changedRanges){
    try{
      if(changedRanges.has('callDispatchFrom')) window.WapiCallDispatchV361?.render?.();
      if(changedRanges.has('thirdBalanceFrom')){
        if(typeof window.renderThirdBalanceV343==='function')window.renderThirdBalanceV343();
        else if(typeof window.renderThirdBalance==='function')window.renderThirdBalance();
      }
      if(!$('statementsView')?.classList.contains('hidden')) window.WapiSettlementV345?.render?.();
      if(!$('expensesListView')?.classList.contains('hidden')) window.WapiExpensesV346?.render?.();
      const q=$('w352AccountQuery');
      if(changedRanges.has('w352AccountFrom')&&q?.dataset?.code&&!$('accountLookupView')?.classList.contains('hidden')) $('w352AccountRun')?.click();
    }catch(error){console.warn('V36.11 rafraîchissement période',error);}
  }

  function applyFiscalContext(force=false){
    if(syncing)return;
    const year=activeFiscalYear();
    if(!year||!year.starts_on||!year.ends_on)return;
    syncing=true;
    try{
      if(state)state.activeFiscalYearId=year.id;
      try{localStorage.setItem('wapi-one-active-fiscal-year',year.id);}catch(_){ }

      YEAR_SELECTS.forEach(id=>setYearSelect(id,year));

      const changedRanges=new Set();
      DATE_RANGES.forEach(([fromId,toId])=>{
        if(setDateRange(fromId,toId,year,force))changedRanges.add(fromId);
      });

      /* Certains anciens modules gardent leurs filtres dans une closure privée.
         Un seul événement après avoir posé les 2 bornes synchronise leur état interne. */
      if(changedRanges.has('callDispatchFrom'))notifyRange('callDispatchFrom','callDispatchTo');
      if(changedRanges.has('sendLogFromFilter'))notifyRange('sendLogFromFilter','sendLogToFilter');
      if(changedRanges.has('v28AccountLookupFrom'))notifyRange('v28AccountLookupFrom','v28AccountLookupTo');
      if(changedRanges.has('thirdBalanceFrom'))notifyRange('thirdBalanceFrom','thirdBalanceTo');

      refreshVisibleModules(changedRanges);
      window.dispatchEvent(new CustomEvent('wapi:fiscal-context-applied',{detail:{copro_id:activeCoproId(),fiscal_year_id:year.id,starts_on:year.starts_on,ends_on:year.ends_on,force}}));
    }finally{
      syncing=false;
    }
  }

  function schedule(force=false){
    timers.forEach(clearTimeout);timers=[];
    [0,60,220,650].forEach((delay,index)=>{
      timers.push(setTimeout(()=>applyFiscalContext(force&&index===0),delay));
    });
  }

  /* La V36.10 est le seul rendu autorisé pour Facturation syndic.
     Les anciennes navigations sont encore chargées pour compatibilité, mais ne doivent plus recréer leurs sous-onglets. */
  function stabilizeSyndicNavigation(){
    const view=$('syndicBillingView');
    if(!view||view.classList.contains('hidden'))return;
    const tabs=$('moduleTabs');
    if(tabs){
      const legacy=[...tabs.querySelectorAll('[data-v25-syndic-tab],[data-v23-syndic-tab],[data-syndic-tab]')];
      if(legacy.length||tabs.querySelectorAll('[data-view="syndicBilling"]').length!==1){
        tabs.innerHTML='<button type="button" class="module-tab active" data-view="syndicBilling" data-title="Pilotage facturation"><span>Pilotage facturation</span></button>';
      }else{
        tabs.querySelectorAll('.module-tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='syndicBilling'));
      }
    }
    state.syndicBillingTab='campaigns';
    if(typeof window.wapiRenderSyndicBilling==='function')window.wapiRenderSyndicBilling();
    else if(typeof renderSyndicBillingV23==='function')renderSyndicBillingV23();
  }

  const previousSwitch=typeof window.switchToView==='function'?window.switchToView:null;
  if(previousSwitch){
    window.switchToView=function(viewName){
      const out=previousSwitch.apply(this,arguments);
      setTimeout(()=>{if(viewName==='syndicBilling')stabilizeSyndicNavigation();schedule(false);},0);
      setTimeout(()=>{if(viewName==='syndicBilling')stabilizeSyndicNavigation();schedule(false);},180);
      return out;
    };
  }

  const previousRenderAll=typeof window.renderAll==='function'?window.renderAll:null;
  if(previousRenderAll){
    window.renderAll=function(){
      const out=previousRenderAll.apply(this,arguments);
      setTimeout(()=>schedule(false),0);
      return out;
    };
  }

  document.addEventListener('change',event=>{
    const id=event.target?.id;
    if(id==='activeFiscalYearSelect'){
      const selected=event.target.value||'';
      if(state)state.activeFiscalYearId=selected;
      schedule(true);
      return;
    }
    if(id==='activeCoproSelect'){
      schedule(true);
      return;
    }
  },true);

  document.addEventListener('click',event=>{
    const nav=event.target.closest?.('[data-view],[data-v31-module],[data-v33-module],[data-module],[data-w3610-nav]');
    if(!nav)return;
    setTimeout(()=>{
      if(nav.dataset?.view==='syndicBilling'||nav.dataset?.v31Module==='syndic'||nav.dataset?.v33Module==='syndic'||nav.dataset?.module==='syndic'||nav.dataset?.w3610Nav!==undefined)stabilizeSyndicNavigation();
      schedule(false);
    },40);
  },false);

  function install(){
    const badge=document.querySelector('.app-version-badge,.wapi-version-badge');
    if(badge)badge.textContent='WAPI One — V36.11';
    document.title='WAPI One — V36.11';
    schedule(false);
    if(!$('syndicBillingView')?.classList.contains('hidden'))setTimeout(stabilizeSyndicNavigation,80);
  }

  window.WapiFiscalContextV3611={
    getYear:activeFiscalYear,
    getRange:()=>{const y=activeFiscalYear();return y?{starts_on:y.starts_on,ends_on:y.ends_on,fiscal_year_id:y.id,copro_id:y.copro_id}:null;},
    apply:applyFiscalContext,
    schedule,
    stabilizeSyndicNavigation
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,2300));
  else setTimeout(install,2300);
})();
