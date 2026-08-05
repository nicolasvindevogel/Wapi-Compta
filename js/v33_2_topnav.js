/* WAPI One V34 — interface unique inspirée d'Optipro, sans observateur ni boucle. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const appState = () => {
    try { return typeof state !== 'undefined' ? state : null; }
    catch (_) { return null; }
  };
  const appUser = () => {
    try { return typeof currentUser !== 'undefined' ? currentUser : null; }
    catch (_) { return null; }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iconPaths = {
    Accueil:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5M9 21v-6h6v6"/>',
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
  const mainModules = [
    ['home','Accueil','Accueil','dashboard'],
    ['pilotage','Plan de travail','Pilotage','processing'],
    ['copros','Infrastructures','Infrastructures','copros'],
    ['compta','Comptabilité','Comptabilite','invoices'],
    ['states','États comptables','Etats comptables','accountLookup'],
    ['ag','Assemblées générales','Assemblees generales','meetings'],
    ['syndic','Facturation syndic','Facturation syndic','syndicBilling'],
    ['config','Configuration','Configuration','agency']
  ];

  function buildTopNavigation(){
    const app = $('appScreen'), topbar = app?.querySelector('.topbar');
    if (!app || !topbar || $('w332PrimaryNav')) return;
    document.body.dataset.wapiV332 = 'ready';
    document.body.dataset.wapiVersion = '34.4.1';
    document.title = 'WAPI One — V36.5';

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
    if (left) {
      const legacy = document.createElement('div');
      legacy.className = 'w332-legacy-controls';
      while (left.firstChild) legacy.appendChild(left.firstChild);
      left.append(brand, legacy);
    }

    const nav = document.createElement('nav');
    nav.id = 'w332PrimaryNav';
    nav.className = 'w332-primary-nav';
    mainModules.forEach(([id,label,iconName,defaultView], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `w332-nav-trigger${index === 0 ? ' active' : ''}`;
      button.dataset.w332Module = id;
      button.innerHTML = `${icon(iconName)}<span>${esc(label)}</span>`;
      button.addEventListener('click', () => {
        if (typeof window.switchToView === 'function') {
          window.switchToView(defaultView);
        } else {
          const source = document.querySelector(`.nav [data-v331-module="${id}"]`);
          if (source) source.click();
        }
        nav.querySelectorAll('.w332-nav-trigger').forEach(item => item.classList.toggle('active', item === button));
      });
      nav.appendChild(button);
    });
    left?.insertAdjacentElement('afterend', nav);
    buildContext(topbar);
    document.addEventListener('click', event => {
      if (!event.target.closest('.w332-user-wrap')) document.querySelector('.w332-user-wrap.open')?.classList.remove('open');
    });
  }

  function buildContext(topbar){
    const oldActions = [...topbar.querySelectorAll(':scope > .top-actions')].at(-1);
    const fiscalSelect = $('activeFiscalYearSelect');
    const context = document.createElement('div');
    context.className = 'w332-context';
    context.innerHTML = `
      <label class="w332-context-field w332-copro-field"><span>Copropriété</span><span id="w332CoproHost"></span></label>
      <button class="w332-icon-btn" id="w332CoproSettings" type="button" title="Réglages de la copropriété" aria-label="Réglages de la copropriété">${icon('Configuration')}</button>
      <label class="w332-context-field w332-year-field"><span>Exercice</span><span class="w332-year-control"><span id="w332FiscalHost"></span><i id="w332FiscalStatus" class="w332-fiscal-dot unknown" aria-label="Statut de l’exercice"></i></span></label>
      <button class="w332-icon-btn" id="w332GlobalSearch" type="button" title="Recherche globale" aria-label="Recherche globale"><span class="w332-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span></button>
      <div class="w332-user-wrap">
        <button class="w332-icon-btn" id="w332UserButton" type="button" title="Compte utilisateur" aria-label="Compte utilisateur"><span class="w332-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span></button>
        <div class="w332-user-menu">
          <div class="w332-user-name"><span id="w332UserName">Utilisateur</span><small id="w332UserEmail"></small></div>
          <button type="button" id="w332FutureMail">Réglages e-mail <small>(prochainement)</small></button>
          <button type="button" id="w332Logout">Déconnexion</button>
        </div>
      </div>`;
    if (fiscalSelect) context.querySelector('#w332FiscalHost')?.appendChild(fiscalSelect);
    if (oldActions) {
      oldActions.classList.add('w332-legacy-controls');
      oldActions.insertAdjacentElement('afterend', context);
    } else {
      topbar.appendChild(context);
    }
    const coproHost = $('w332CoproHost'), coproSelect = $('activeCoproSelect');
    if (coproHost && coproSelect) {
      coproSelect.classList.remove('smart-combo-source');
      coproSelect.dataset.smartComboReady = '1';
      coproSelect.style.display = 'block';
      coproSelect.style.position = 'static';
      coproSelect.style.opacity = '1';
      coproSelect.style.pointerEvents = 'auto';
      coproHost.appendChild(coproSelect);
      coproHost.querySelectorAll('.smart-combo').forEach(combo => combo.remove());
    }
    if (coproSelect) {
      coproSelect.addEventListener('change', () => {
        const coproId = coproSelect.value || '';
        try { if (typeof setActiveCopro === 'function') setActiveCopro(coproId); } catch (_) {}
        setTimeout(() => syncFiscalContext(true), 0);
      });
    }
    fiscalSelect?.addEventListener('change', updateFiscalStatus);
    fiscalSelect?.addEventListener('focus', () => syncFiscalContext(false));
    $('w332UserButton')?.addEventListener('click', event => { event.stopPropagation(); event.currentTarget.closest('.w332-user-wrap').classList.toggle('open'); });
    $('w332Logout')?.addEventListener('click', () => $('logoutBtn')?.click());
    $('w332CoproSettings')?.addEventListener('click', () => {
      const coproId = coproSelect?.value || appState()?.activeCoproId || '';
      if (!coproId) return alert('Sélectionnez d’abord une copropriété.');
      const st = appState();
      if (st) st.activeCoproId = coproId;
      try { localStorage.setItem('wapi-compta-active-copro', coproId); } catch (_) {}
      if (typeof window.openCoproSettingsPopupV33 === 'function') {
        window.openCoproSettingsPopupV33(coproId);
        return;
      }
      if (typeof window.openCoproSettingsPopupV3234 === 'function') {
        window.openCoproSettingsPopupV3234(coproId);
        return;
      }
      const relay = document.createElement('button');
      relay.type = 'button';
      relay.hidden = true;
      relay.dataset.v322CoproSettings = coproId;
      document.body.appendChild(relay);
      relay.click();
      relay.remove();
    });
    $('w332GlobalSearch')?.addEventListener('click', () => {
      const search = $('globalSearchInput') || $('searchInput');
      if (search) { search.focus(); search.scrollIntoView({behavior:'smooth',block:'center'}); }
      else alert('La recherche globale sera reliée ici lors de la prochaine étape.');
    });
    syncUser();
    setTimeout(() => syncFiscalContext(true), 50);
  }

  function fiscalYearsForActiveCopro(){
    const st = appState();
    const coproId = $('activeCoproSelect')?.value || st?.activeCoproId || '';
    const seen = new Set();
    return (st?.fiscalYears || []).filter(year => {
      if (coproId && String(year.copro_id) !== String(coproId)) return false;
      const key = String(year.id || [year.copro_id, year.code, year.year_code, year.label].join('|'));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function fiscalLabel(year){
    return [year?.year_code || year?.code || '', year?.label || ''].filter(Boolean).join(' — ') ||
      [year?.starts_on || '', year?.ends_on || ''].filter(Boolean).join(' → ') || 'Exercice';
  }
  function syncFiscalContext(selectDefault){
    const select = $('activeFiscalYearSelect');
    const st = appState();
    if (!select || !st) return;
    const years = fiscalYearsForActiveCopro();
    const previous = select.value || st.activeFiscalYearId || '';
    select.innerHTML = '<option value="">Choisir un exercice</option>' +
      years.map(year => `<option value="${esc(year.id)}">${esc(fiscalLabel(year))}</option>`).join('');
    const selected = years.some(year => String(year.id) === String(previous))
      ? previous
      : (selectDefault ? (years.find(year => String(year.status || '').toLowerCase() !== 'closed') || years[0])?.id || '' : '');
    select.value = selected;
    if (selected && String(st.activeFiscalYearId || '') !== String(selected)) {
      st.activeFiscalYearId = selected;
      try { localStorage.setItem('wapi-one-active-fiscal-year', selected); } catch (_) {}
    }
    updateFiscalStatus();
  }
  function updateFiscalStatus(){
    const dot = $('w332FiscalStatus');
    const select = $('activeFiscalYearSelect');
    const st = appState();
    if (!dot || !select || !st) return;
    const year = (st.fiscalYears || []).find(item => String(item.id) === String(select.value));
    const closed = year && (String(year.status || '').toLowerCase() === 'closed' || Boolean(year.closed_at));
    dot.className = `w332-fiscal-dot ${year ? (closed ? 'closed' : 'open') : 'unknown'}`;
    dot.title = year ? (closed ? 'Exercice clôturé' : 'Exercice ouvert') : 'Aucun exercice sélectionné';
    dot.setAttribute('aria-label', dot.title);
  }

  function refreshCoproContext(){
    document.title = 'WAPI One — V36.5';
    const st = appState(), select = $('activeCoproSelect');
    if (!st || !select) return;
    const selected = st.activeCoproId || select.value || '';
    const copros = Array.isArray(st.copros) ? st.copros : [];
    select.classList.remove('smart-combo-source');
    select.dataset.smartComboReady = '1';
    select.style.display = 'block';
    select.parentElement?.querySelectorAll('.smart-combo').forEach(combo => combo.remove());
    select.innerHTML = '<option value="">Mode global</option>' +
      copros.map(c => {
        const label = [c.code || c.copro_code || c.optipro_ref || '', c.name || '']
          .filter(Boolean).join(' — ') || 'Copropriété';
        return `<option value="${esc(c.id)}">${esc(label)}</option>`;
      }).join('');
    select.value = copros.some(c => String(c.id) === String(selected)) ? String(selected) : '';
    if (select.value) st.activeCoproId = select.value;
    syncFiscalContext(true);
  }

  function syncTopUniverse(){
    const source = document.querySelector('.nav [data-v331-module].active');
    const moduleId = source?.dataset?.v331Module || 'home';
    document.querySelectorAll('[data-w332-module]').forEach(button => {
      button.classList.toggle('active', button.dataset.w332Module === moduleId);
    });
  }

  function installStableRefreshHooks(){
    try {
      if (typeof renderAll === 'function' && !renderAll.__v34) {
        const previous = renderAll;
        const wrapped = function(){
          const result = previous.apply(this, arguments);
          if (!wrapped.pending) {
            wrapped.pending = true;
            setTimeout(() => {
              wrapped.pending = false;
              refreshCoproContext();
              syncUser();
              syncTopUniverse();
              enhanceAccountLookup();
            }, 0);
          }
          return result;
        };
        wrapped.__v34 = true;
        renderAll = wrapped;
      }
      if (typeof loadAll === 'function' && !loadAll.__v34) {
        const previousLoad = loadAll;
        const wrappedLoad = async function(){
          const result = await previousLoad.apply(this, arguments);
          refreshCoproContext();
          syncUser();
          return result;
        };
        wrappedLoad.__v34 = true;
        loadAll = wrappedLoad;
      }
    } catch (error) {
      console.warn('V34 refresh hooks', error);
    }
  }

  function profileList(){
    const st = appState();
    return st?.userProfiles || st?.profiles || st?.users || [];
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
    const user = appUser();
    const email = user?.email || $('userPill')?.textContent || '';
    const profile = profileList().find(p => String(p.id) === String(user?.id)) || {};
    if ($('w332UserName')) $('w332UserName').textContent = profile.full_name || profile.name || 'Utilisateur connecté';
    if ($('w332UserEmail')) $('w332UserEmail').textContent = email;
  }

  function closeGlobalModal(){
    const backdrop = $('globalModalBackdrop');
    const modal = $('globalModal');
    if (!backdrop) return;
    backdrop.classList.add('hidden');
    backdrop.classList.remove('copro-settings-backdrop');
    /* Ne jamais conserver display:none/pointer-events:none en style inline :
       openAppModal retire la classe hidden lors de la prochaine ouverture. */
    backdrop.style.removeProperty('display');
    backdrop.style.removeProperty('pointer-events');
    modal?.classList.remove('copro-settings-modal');
  }

  function bindModalControls(){
    $('globalModalCloseBtn')?.addEventListener('click', closeGlobalModal);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-modal-close]')) closeGlobalModal();
    });
  }

  function accountRows(){
    const code = ($('v28AccountLookupCode')?.value || '').trim().split(/\s+-\s+/)[0];
    const coproId = appState()?.activeCoproId || $('v28AccountLookupCopro')?.value || '';
    const from = $('v28AccountLookupFrom')?.value || '0000-01-01';
    const to = $('v28AccountLookupTo')?.value || '9999-12-31';
    if (typeof window.v31AccountingRows !== 'function') return [];
    return window.v31AccountingRows().filter(r => (!code || String(r.code) === code || String(r.code).startsWith(code)) && (!coproId || String(r.copro_id) === String(coproId)) && (!r.date || (r.date >= from && r.date <= to))).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  }
  function enhanceAccountLookup(){
    if(document.querySelector('script[src*="v35_2_vcs_billing_config_accounts"]')) return;
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
      const accounts = appState()?.accounts || [];
      list.innerHTML = accounts.map(a => `<option value="${esc(a.code)} - ${esc(a.label)}"></option>`).join('');
      select.innerHTML = '<option value="">Afficher tous les comptes…</option>' + accounts.map(a => `<option value="${esc(a.code)}">${esc(a.code)} — ${esc(a.label)}</option>`).join('');
    };
    refreshOptions();
    select.addEventListener('change', () => { input.value=select.value; input.dispatchEvent(new Event('input',{bubbles:true})); });
    input.addEventListener('change', () => { const found=(appState()?.accounts||[]).find(a => input.value.includes(a.code)); if(found){input.value=found.code;select.value=found.code;} });
    setTimeout(refreshOptions,1000);
  }
  function printable(title, body, extraCss=''){
    const popup = window.open('','_blank');
    if (!popup) return alert('Le navigateur a bloqué la fenêtre PDF.');
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px Arial,sans-serif;color:#1d2435;margin:20mm}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;color:#5f6678;margin:0 0 16px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f4f8}.num{text-align:right}.summary{display:flex;gap:18px;margin:14px 0;font-weight:bold}${extraCss}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
    popup.document.close();
  }
  function exportAccountPdf(){
    const raw = ($('v28AccountLookupCode')?.value || '').trim();
    const code = raw.split(/\s+-\s+/)[0];
    const account = (appState()?.accounts || []).find(a => String(a.code) === code) || {};
    if (!code) return alert('Sélectionnez un compte comptable.');
    const renderedTable = $('v28AccountLookupTable')?.innerHTML || '<p>Aucune écriture.</p>';
    printable(`Compte ${code}`, `<h1>Compte ${esc(code)}</h1><h2>${esc(account.label || '')}</h2><div class="summary"><span>Débit : ${esc($('v28AccountDebit')?.textContent || '')}</span><span>Crédit : ${esc($('v28AccountCredit')?.textContent || '')}</span><span>Solde : ${esc($('v28AccountSolde')?.textContent || '')}</span></div>${renderedTable}`);
  }
  function exportBilanSideBySide(){
    const actif=$('bilanActifTable')?.innerHTML||'', passif=$('bilanPassifTable')?.innerHTML||'', summary=$('bilanSummary')?.innerHTML||'';
    const st = appState();
    printable('Bilan comptable', `<h1>Bilan comptable</h1><h2>${esc((st?.copros||[]).find(c=>String(c.id)===String(st?.activeCoproId))?.name || 'Vue globale')}</h2><div class="bilan"><section><h3>ACTIF</h3>${actif}</section><section><h3>PASSIF</h3>${passif}</section></div><div class="summary">${summary}</div>`,'.bilan{display:grid;grid-template-columns:1fr 1fr;gap:10mm;align-items:start}.bilan h3{text-align:center;background:#172033;color:white;padding:8px;margin:0}.bilan button{display:none}.summary button{display:none}');
  }
  document.addEventListener('click', event => {
    const bilanBtn = event.target.closest('[data-v31-bilan-pdf],[data-v30-bilan-pdf],#v29BilanPdfBtn');
    if (bilanBtn) { event.preventDefault(); event.stopImmediatePropagation(); exportBilanSideBySide(); }
    if (event.target.closest('[data-v29-close-year]')) setTimeout(() => syncFiscalContext(false), 1200);
  }, true);

  function init(){
    const st = appState();
    if (st) st.managerFilterUserId = '';
    try { localStorage.removeItem('wapi_one_manager_filter_user_id'); } catch (_) {}
    buildTopNavigation();
    installStableRefreshHooks();
    bindModalControls();
    try { if (typeof renderActiveCoproContext === 'function') renderActiveCoproContext(); } catch (_) {}
    refreshCoproContext();
    enhanceAccountLookup();
    document.body.classList.remove('wapi-show-module-filters');
    const version = document.createElement('span'); version.className='badge'; version.textContent='V36.5'; document.querySelector('.w332-page-head')?.appendChild(version);
    // L'ancien moteur termine un chargement différé des profils ; on réaffirme
    // une seule fois la version et le contexte, sans observateur ni intervalle.
    setTimeout(() => {
      document.title = 'WAPI One — V36.5';
      refreshCoproContext();
      syncTopUniverse();
    }, 1600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init,0), {once:true});
  else setTimeout(init,0);
})();
