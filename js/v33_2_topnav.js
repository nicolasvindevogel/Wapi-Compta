/* WAPI One V33.2 — couche d'interface unique, sans observateur ni rerendu en boucle. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iconPaths = {
    Pilotage:'<path d="M4 19V9m8 10V5m8 14v-7"/><path d="M2 19h20"/>',
    Infrastructures:'<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
    Comptabilite:'<path d="M4 3h16v18H4zM8 7h8M8 11h2m3 0h3M8 15h2m3 0h3"/>',
    'Facturation syndic':'<path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6"/>',
    'Etats comptables':'<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    'Assemblees generales':'<path d="M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21v-2a5 5 0 0 1 5-5h2m13 7v-2a5 5 0 0 0-5-5h-2m-5 4 2 2 4-5"/>',
    Configuration:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'
  };
  const plain = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\s/’-]/g,'').trim();
  const icon = name => `<span class="w332-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[name] || iconPaths.Configuration}</svg></span>`;

  function buildTopNavigation(){
    const app = $('appScreen'), sidebar = app?.querySelector('.sidebar'), topbar = app?.querySelector('.topbar');
    if (!app || !sidebar || !topbar || $('w332PrimaryNav')) return;
    document.body.dataset.wapiV332 = 'ready';

    const left = topbar.querySelector('.topbar-left');
    const pageWrap = left?.querySelector('.page-title-wrap');
    if (pageWrap) {
      const pageHead = document.createElement('div');
      pageHead.className = 'w332-page-head';
      pageWrap.parentNode.removeChild(pageWrap);
      pageHead.appendChild(pageWrap);
      topbar.insertAdjacentElement('afterend', pageHead);
    }
    const brand = document.createElement('div');
    brand.className = 'w332-brand';
    brand.innerHTML = `<img src="assets/logo-wapi-one.png" alt="WAPI One"><div><strong>WAPI One</strong><small>Gestion de copropriétés</small></div>`;
    if (left) left.replaceChildren(brand);

    const nav = document.createElement('nav');
    nav.id = 'w332PrimaryNav';
    nav.className = 'w332-primary-nav';
    sidebar.querySelectorAll('.menu-group').forEach(group => {
      const rawName = group.querySelector('.menu-group__text')?.textContent || 'Menu';
      const name = plain(rawName);
      const wrap = document.createElement('div');
      wrap.className = 'w332-nav-menu';
      wrap.innerHTML = `<button type="button" class="w332-nav-trigger">${icon(name)}<span>${esc(rawName)}</span></button><div class="w332-dropdown"></div>`;
      const dropdown = wrap.querySelector('.w332-dropdown');
      group.querySelectorAll('.menu-group__body > button[data-view]').forEach(button => dropdown.appendChild(button));
      wrap.querySelector('.w332-nav-trigger').addEventListener('click', event => {
        event.stopPropagation();
        document.querySelectorAll('.w332-nav-menu.open').forEach(item => { if (item !== wrap) item.classList.remove('open'); });
        wrap.classList.toggle('open');
      });
      dropdown.addEventListener('click', () => wrap.classList.remove('open'));
      nav.appendChild(wrap);
    });
    left?.insertAdjacentElement('afterend', nav);
    buildContext(topbar);
    document.addEventListener('click', event => {
      if (!event.target.closest('.w332-nav-menu')) document.querySelectorAll('.w332-nav-menu.open').forEach(x => x.classList.remove('open'));
      if (!event.target.closest('.w332-user-wrap')) document.querySelector('.w332-user-wrap.open')?.classList.remove('open');
    });
  }

  function buildContext(topbar){
    const oldActions = [...topbar.querySelectorAll(':scope > .top-actions')].at(-1);
    const context = document.createElement('div');
    context.className = 'w332-context';
    context.innerHTML = `
      <select id="w332ManagerSelect" aria-label="Filtrer par gestionnaire"><option value="">Toutes les copropriétés</option></select>
      <span id="w332CoproHost"></span>
      <button class="w332-icon-btn" id="w332CoproSettings" type="button" title="Réglages de la copropriété" aria-label="Réglages de la copropriété">${icon('Configuration')}</button>
      <button class="w332-icon-btn" id="w332GlobalSearch" type="button" title="Recherche globale" aria-label="Recherche globale"><span class="w332-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span></button>
      <div class="w332-user-wrap">
        <button class="w332-icon-btn" id="w332UserButton" type="button" title="Compte utilisateur" aria-label="Compte utilisateur"><span class="w332-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span></button>
        <div class="w332-user-menu">
          <div class="w332-user-name"><span id="w332UserName">Utilisateur</span><small id="w332UserEmail"></small></div>
          <button type="button" id="w332FutureMail">Réglages e-mail <small>(prochainement)</small></button>
          <button type="button" id="w332Logout">Déconnexion</button>
        </div>
      </div>`;
    oldActions?.replaceWith(context);
    const coproHost = $('w332CoproHost'), coproSelect = $('activeCoproSelect');
    if (coproHost && coproSelect) coproHost.appendChild(coproSelect);
    $('w332UserButton')?.addEventListener('click', event => { event.stopPropagation(); event.currentTarget.closest('.w332-user-wrap').classList.toggle('open'); });
    $('w332Logout')?.addEventListener('click', () => $('logoutBtn')?.click());
    $('w332CoproSettings')?.addEventListener('click', () => {
      if (!window.state?.activeCoproId) return alert('Sélectionnez d’abord une copropriété.');
      if (typeof window.v322OpenCoproSettings === 'function') return window.v322OpenCoproSettings(window.state.activeCoproId);
      document.querySelector(`[data-v322-copro-settings="${CSS.escape(String(window.state.activeCoproId))}"]`)?.click();
    });
    $('w332GlobalSearch')?.addEventListener('click', () => {
      const search = $('globalSearchInput') || $('searchInput');
      if (search) { search.focus(); search.scrollIntoView({behavior:'smooth',block:'center'}); }
      else alert('La recherche globale sera reliée ici lors de la prochaine étape.');
    });
    populateManagers();
    syncUser();
  }

  function profileList(){
    return window.state?.userProfiles || window.state?.profiles || window.state?.users || [];
  }
  function managerId(copro){ return copro?.manager_user_id || copro?.manager_id || ''; }
  function populateManagers(){
    const select = $('w332ManagerSelect'); if (!select) return;
    const selected = localStorage.getItem('wapi_one_manager_filter_user_id') || '';
    select.innerHTML = '<option value="">Toutes les copropriétés</option>' + profileList().filter(p => p.active !== false).map(p => `<option value="${esc(p.id)}">${esc(p.full_name || p.name || p.email || 'Utilisateur')}</option>`).join('');
    select.value = selected;
    select.addEventListener('change', () => applyManagerFilter(select.value));
    select.addEventListener('focus', () => {
      const current = select.value;
      select.innerHTML = '<option value="">Toutes les copropriétés</option>' + profileList().filter(p => p.active !== false).map(p => `<option value="${esc(p.id)}">${esc(p.full_name || p.name || p.email || 'Utilisateur')}</option>`).join('');
      select.value = current;
    });
    applyManagerFilter(selected, false);
    setTimeout(() => {
      const current = select.value;
      select.innerHTML = '<option value="">Toutes les copropriétés</option>' + profileList().filter(p => p.active !== false).map(p => `<option value="${esc(p.id)}">${esc(p.full_name || p.name || p.email || 'Utilisateur')}</option>`).join('');
      select.value = current;
      applyManagerFilter(current, false);
    }, 1200);
  }
  function applyManagerFilter(id, rerender=true){
    if (!window.state) return;
    window.state.managerFilterUserId = id || '';
    if (id) localStorage.setItem('wapi_one_manager_filter_user_id', id); else localStorage.removeItem('wapi_one_manager_filter_user_id');
    const all = window.state.copros || [];
    const allowed = id ? all.filter(c => String(managerId(c)) === String(id)) : all;
    const activeSelect = $('activeCoproSelect');
    if (activeSelect) {
      const current = window.state.activeCoproId || '';
      activeSelect.innerHTML = '<option value="">Mode global</option>' + allowed.map(c => `<option value="${esc(c.id)}">${esc(c.name || c.code || 'Copropriété')}</option>`).join('');
      if (current && allowed.some(c => String(c.id) === String(current))) activeSelect.value = current;
      else if (current && id) {
        window.state.activeCoproId = '';
        activeSelect.value = '';
      }
    }
    document.querySelectorAll('select[data-v3231-manager-filter], .v3231-manager-filter-row, .manager-filter-box, #wapiAdvancedFiltersBtn').forEach(el => el.closest('.v3231-manager-filter-row,.manager-filter-box')?.remove() || (el.style.display='none'));
    if (rerender && typeof window.renderAll === 'function') window.renderAll();
    if (id && !allowed.length) showManagerEmpty();
  }
  function showManagerEmpty(){
    const view = document.querySelector('.view:not(.hidden) .card');
    if (!view || view.querySelector('.w332-manager-empty')) return;
    view.insertAdjacentHTML('afterbegin','<div class="w332-manager-empty">Aucune copropriété n’est attribuée à ce gestionnaire.</div>');
  }
  function syncUser(){
    const email = window.currentUser?.email || $('userPill')?.textContent || '';
    const profile = profileList().find(p => String(p.id) === String(window.currentUser?.id)) || {};
    if ($('w332UserName')) $('w332UserName').textContent = profile.full_name || profile.name || 'Utilisateur connecté';
    if ($('w332UserEmail')) $('w332UserEmail').textContent = email;
  }

  function accountRows(){
    const code = ($('v28AccountLookupCode')?.value || '').trim().split(/\s+-\s+/)[0];
    const coproId = window.state?.activeCoproId || $('v28AccountLookupCopro')?.value || '';
    const from = $('v28AccountLookupFrom')?.value || '0000-01-01';
    const to = $('v28AccountLookupTo')?.value || '9999-12-31';
    if (typeof window.v31AccountingRows !== 'function') return [];
    return window.v31AccountingRows().filter(r => (!code || String(r.code) === code || String(r.code).startsWith(code)) && (!coproId || String(r.copro_id) === String(coproId)) && (!r.date || (r.date >= from && r.date <= to))).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  }
  function enhanceAccountLookup(){
    const input = $('v28AccountLookupCode'), view = $('accountLookupView');
    if (!input || !view || $('w332AccountSelect')) return;
    const form = input.closest('.form-grid');
    input.setAttribute('list','w332AccountDatalist');
    input.placeholder = 'Tapez un numéro ou un libellé…';
    const list = document.createElement('datalist'); list.id='w332AccountDatalist'; document.body.appendChild(list);
    const select = document.createElement('select'); select.id='w332AccountSelect'; select.innerHTML='<option value="">Afficher tous les comptes…</option>';
    const label = document.createElement('label'); label.textContent='Liste complète'; label.appendChild(select); form?.insertBefore(label, input.closest('label')?.nextSibling || null);
    const toolbar = view.querySelector('.toolbar');
    const pdf = document.createElement('button'); pdf.type='button'; pdf.className='btn secondary'; pdf.textContent='Exporter le compte en PDF'; pdf.addEventListener('click', exportAccountPdf); toolbar?.appendChild(pdf);
    const refreshOptions = () => {
      const accounts = window.state?.accounts || [];
      list.innerHTML = accounts.map(a => `<option value="${esc(a.code)} - ${esc(a.label)}"></option>`).join('');
      select.innerHTML = '<option value="">Afficher tous les comptes…</option>' + accounts.map(a => `<option value="${esc(a.code)}">${esc(a.code)} — ${esc(a.label)}</option>`).join('');
    };
    refreshOptions();
    select.addEventListener('change', () => { input.value=select.value; input.dispatchEvent(new Event('input',{bubbles:true})); });
    input.addEventListener('change', () => { const found=(window.state?.accounts||[]).find(a => input.value.includes(a.code)); if(found){input.value=found.code;select.value=found.code;} });
    setTimeout(refreshOptions,1000);
  }
  function printable(title, body, extraCss=''){
    const popup = window.open('','_blank','noopener,noreferrer');
    if (!popup) return alert('Le navigateur a bloqué la fenêtre PDF.');
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px Arial,sans-serif;color:#1d2435;margin:20mm}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;color:#5f6678;margin:0 0 16px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f4f8}.num{text-align:right}.summary{display:flex;gap:18px;margin:14px 0;font-weight:bold}${extraCss}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
    popup.document.close();
  }
  function exportAccountPdf(){
    const raw = ($('v28AccountLookupCode')?.value || '').trim();
    const code = raw.split(/\s+-\s+/)[0];
    const account = (window.state?.accounts || []).find(a => String(a.code) === code) || {};
    if (!code) return alert('Sélectionnez un compte comptable.');
    const renderedTable = $('v28AccountLookupTable')?.innerHTML || '<p>Aucune écriture.</p>';
    printable(`Compte ${code}`, `<h1>Compte ${esc(code)}</h1><h2>${esc(account.label || '')}</h2><div class="summary"><span>Débit : ${esc($('v28AccountDebit')?.textContent || '')}</span><span>Crédit : ${esc($('v28AccountCredit')?.textContent || '')}</span><span>Solde : ${esc($('v28AccountSolde')?.textContent || '')}</span></div>${renderedTable}`);
  }
  function exportBilanSideBySide(){
    const actif=$('bilanActifTable')?.innerHTML||'', passif=$('bilanPassifTable')?.innerHTML||'', summary=$('bilanSummary')?.innerHTML||'';
    printable('Bilan comptable', `<h1>Bilan comptable</h1><h2>${esc((window.state?.copros||[]).find(c=>String(c.id)===String(window.state?.activeCoproId))?.name || 'Vue globale')}</h2><div class="bilan"><section><h3>ACTIF</h3>${actif}</section><section><h3>PASSIF</h3>${passif}</section></div><div class="summary">${summary}</div>`,'.bilan{display:grid;grid-template-columns:1fr 1fr;gap:10mm;align-items:start}.bilan h3{text-align:center;background:#172033;color:white;padding:8px;margin:0}.bilan button{display:none}.summary button{display:none}');
  }
  document.addEventListener('click', event => {
    const bilanBtn = event.target.closest('[data-v31-bilan-pdf],[data-v30-bilan-pdf],#v29BilanPdfBtn');
    if (bilanBtn) { event.preventDefault(); event.stopImmediatePropagation(); exportBilanSideBySide(); }
  }, true);

  function init(){
    buildTopNavigation();
    enhanceAccountLookup();
    document.body.classList.remove('wapi-show-module-filters');
    const version = document.createElement('span'); version.className='badge'; version.textContent='V33.2'; document.querySelector('.w332-page-head')?.appendChild(version);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init,0), {once:true});
  else setTimeout(init,0);
})();
