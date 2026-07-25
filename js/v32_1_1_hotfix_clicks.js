/* WAPI One V32.1.1 — correctif anti-page non cliquable
   Objectif : fermer au démarrage tout popup/backdrop vide qui pourrait rester affiché
   et bloquer l'interface. Ne modifie pas les données. */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V32.1.1 - correctif clics';

  function byId(id){ return document.getElementById(id); }
  function isBlankHtml(html){ return !String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim(); }

  function hideBackdrop(backdrop){
    if(!backdrop) return;
    backdrop.classList.add('hidden');
    backdrop.classList.add('wapi-empty-modal');
    backdrop.style.display = 'none';
    backdrop.style.pointerEvents = 'none';
    backdrop.style.visibility = 'hidden';
  }

  function restoreBackdrop(backdrop){
    if(!backdrop) return;
    backdrop.classList.remove('wapi-empty-modal');
    backdrop.style.display = '';
    backdrop.style.pointerEvents = '';
    backdrop.style.visibility = '';
  }

  function cleanupEmptyStartupModals(){
    document.body.classList.add('wapi-modal-cleanup');

    const global = byId('globalModalBackdrop');
    const globalBody = byId('globalModalBody');
    const globalFooter = byId('globalModalFooter');
    if(global && globalBody && isBlankHtml(globalBody.innerHTML)){
      if(globalFooter) globalFooter.innerHTML = '';
      hideBackdrop(global);
    }

    const lot = byId('lotModalBackdrop');
    // Au chargement, ce modal ne doit jamais être ouvert d'office.
    if(lot && !lot.classList.contains('hidden')) hideBackdrop(lot);

    // Après le nettoyage initial, on rend les vrais popups à nouveau possibles.
    setTimeout(function(){
      document.body.classList.remove('wapi-modal-cleanup');
      [global, lot].forEach(function(b){
        if(b && b.classList.contains('hidden')){
          b.classList.remove('wapi-empty-modal');
          b.style.display = '';
          b.style.pointerEvents = '';
          b.style.visibility = '';
        }
      });
    }, 450);
  }

  // Protège aussi contre une ouverture de modal vide déclenchée après rendu.
  function guardEmptyModalOpen(){
    const global = byId('globalModalBackdrop');
    const body = byId('globalModalBody');
    if(global && body && !global.classList.contains('hidden') && isBlankHtml(body.innerHTML)){
      hideBackdrop(global);
    }
  }

  function installObserver(){
    const global = byId('globalModalBackdrop');
    const body = byId('globalModalBody');
    if(!global || !body) return;
    const obs = new MutationObserver(function(){ setTimeout(guardEmptyModalOpen, 0); });
    obs.observe(global, {attributes:true, attributeFilter:['class','style']});
    obs.observe(body, {childList:true, subtree:true, characterData:true});
  }

  function updateVersionBadge(){
    document.title = 'WAPI One — V32.1.1';
    document.querySelectorAll('.app-version-badge').forEach(function(b){ b.textContent = window.WAPI_ONE_VERSION; });
  }

  function start(){
    cleanupEmptyStartupModals();
    installObserver();
    updateVersionBadge();
    setTimeout(cleanupEmptyStartupModals, 100);
    setTimeout(cleanupEmptyStartupModals, 700);
    setInterval(guardEmptyModalOpen, 1500);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
