/* WAPI One V36.14 — factures fournisseurs : source simple + filtres visibles par exercice. */
(()=>{
  'use strict';
  window.WAPI_ONE_VERSION='V36.14';
  window.WAPI_ONE_BUILD_DATE='2026-08-28';
  const $=id=>document.getElementById(id);

  function activeYear(){
    try{
      const y=window.WapiFiscalContextV3611?.getYear?.();
      if(y)return y;
    }catch(_){ }
    const cid=String(state?.activeCoproId||$('activeCoproSelect')?.value||'');
    const yid=String(state?.activeFiscalYearId||$('activeFiscalYearSelect')?.value||'');
    return (state?.fiscalYears||[]).find(y=>String(y.id)===yid&&(!cid||String(y.copro_id)===cid))||null;
  }

  function validInside(v,y){
    return !!v&&!!y&&(!y.starts_on||v>=y.starts_on)&&(!y.ends_on||v<=y.ends_on);
  }

  function applyInvoicePeriod(force=false){
    const from=$('invoiceListFrom'),to=$('invoiceListTo'),y=activeYear();
    if(!from||!to||!y)return;
    const currentValid=validInside(from.value,y)&&validInside(to.value,y)&&from.value<=to.value;
    if(force||!currentValid){
      from.value=y.starts_on||'';
      to.value=y.ends_on||'';
    }
    try{window.v33RenderInvoicesV322?.();}catch(e){console.warn('V36.14 rendu factures',e);}
  }

  function render(){
    try{window.v33RenderInvoicesV322?.();}catch(e){console.warn('V36.14 rendu factures',e);}
  }

  window.addEventListener('wapi:fiscal-context-applied',e=>{
    applyInvoicePeriod(Boolean(e.detail?.force));
  });

  document.addEventListener('change',e=>{
    if(e.target?.id==='activeFiscalYearSelect'||e.target?.id==='activeCoproSelect'){
      setTimeout(()=>applyInvoicePeriod(true),40);
      return;
    }
    if(e.target?.id==='invoiceListFrom'||e.target?.id==='invoiceListTo')render();
  },true);
  document.addEventListener('input',e=>{
    if(e.target?.id==='invoiceListSearch')render();
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#invoiceResetPeriodBtn')){
      e.preventDefault();
      applyInvoicePeriod(true);
    }
  },true);

  function install(){
    document.title='WAPI One — V36.14';
    document.querySelectorAll('.app-version-badge,.wapi-version-badge').forEach(el=>{el.textContent='WAPI One — V36.14';});
    setTimeout(()=>applyInvoicePeriod(false),0);
    setTimeout(()=>applyInvoicePeriod(false),800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,2500));
  else setTimeout(install,2500);
})();
