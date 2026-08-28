/* WAPI One V36.13 — récupération fiable des factures fournisseurs. */
(()=>{
  'use strict';
  window.WAPI_ONE_VERSION='V36.13';
  window.WAPI_ONE_BUILD_DATE='2026-08-28';
  function setVersion(){
    document.title='WAPI One — V36.13';
    document.querySelectorAll('.app-version-badge,.wapi-version-badge').forEach(el=>{el.textContent='WAPI One — V36.13';});
  }
  window.addEventListener('wapi:fiscal-context-applied',()=>{
    try{ if(typeof window.v33RenderInvoicesV322==='function' && !document.getElementById('invoicesView')?.classList.contains('hidden')) window.v33RenderInvoicesV322(); }catch(e){console.warn('V36.13 rendu factures',e);}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setVersion,2400));
  else setTimeout(setVersion,2400);
})();
