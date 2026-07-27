/* WAPI One V32.3.4 — icônes sidebar définitives + réglages copro gestionnaire select + recherche compte comptable */
(function(){
  'use strict';
  const VERSION_LABEL = 'WAPI One — V32.3.4';
  const $id = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const moneySafe = (v) => {
    try {
      if (typeof money31 === 'function') return money31(v);
      if (typeof money === 'function') return money(v);
    } catch(e) {}
    return Number(v || 0).toLocaleString('fr-BE', { style:'currency', currency:'EUR' });
  };
  function safe(fn, label){ try { return fn(); } catch(e){ console.warn('[V32.3.4] '+(label||'patch'), e); } }
  function stateOk(){ return typeof state !== 'undefined' && state; }
  function client(){ try { return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null); } catch(e){ return null; } }

  /* ------------------------------------------------------------------
     1) Icônes : plus d’emoji, plus de mask, plus de pseudo-élément.
     On remplace le contenu des spans existants par des SVG inline stables.
  ------------------------------------------------------------------ */
  const SVG_PATHS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    dashboard: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
    building: '<path d="M4 21h16"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bank: '<path d="M3 10h18"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 19h18"/><path d="M12 3 3 8h18L12 3Z"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
    chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-9"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.05V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.05-.4H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .4-1.05V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15.4 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.36.68.64.96.28.28.6.5.96.64H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    default: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'
  };
  const VIEW_ICONS = {
    dashboard:'home', processing:'dashboard', invoiceOcr:'search', codaPilot:'bank', payments:'bank', callDispatch:'mail', inform:'mail', sendJournal:'file',
    copros:'building', lots:'building', owners:'users', distribution:'dashboard', buildings:'building', works:'settings',
    invoices:'file', bank:'bank', meters:'dashboard', budgets:'chart', calls:'mail', statements:'file', expensesList:'file', exercises:'calendar',
    accountLookup:'search', accounts:'book', ledger:'book', financialLedger:'bank', balance:'chart', thirdBalance:'users', journals:'book', bilan:'chart', heldFunds:'bank', multicoproConsultation:'search',
    meetings:'calendar', resolutions:'file', syndicBilling:'file', agency:'building', users:'users', accessControl:'settings', bankInstitutions:'bank', propertyTypes:'building', vatCodes:'chart', journalCodes:'file', defaultExpenseTypes:'file', gdpr:'settings', importsConfig:'file', templates:'file', auditTrail:'search', isabel:'bank'
  };
  function svg(name){
    const paths = SVG_PATHS[name] || SVG_PATHS.default;
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+paths+'</svg>';
  }
  function iconNameForElement(el){
    const btn = el.closest('button');
    const view = btn?.dataset?.view || '';
    if (view && VIEW_ICONS[view]) return VIEW_ICONS[view];
    const group = el.closest('.menu-group__header')?.textContent || btn?.dataset?.title || btn?.title || btn?.textContent || '';
    const t = norm(group);
    if (t.includes('pilotage') || t.includes('tableau')) return 'dashboard';
    if (t.includes('copro')) return 'building';
    if (t.includes('compta') || t.includes('etat')) return 'chart';
    if (t.includes('assemble')) return 'calendar';
    if (t.includes('facturation')) return 'file';
    if (t.includes('config') || t.includes('reglage')) return 'settings';
    return 'default';
  }
  function forceStableIcons(){
    safe(() => {
      document.querySelectorAll('.nav-icon,.menu-group__icon,.sidebar-action-icon').forEach(el => {
        const name = iconNameForElement(el);
        if (el.dataset.v3234Icon === name && el.querySelector('svg')) return;
        el.innerHTML = svg(name);
        el.dataset.v3233IconStable = '1';
        el.dataset.v3234Icon = name;
        el.setAttribute('aria-hidden','true');
      });
      const badge = document.querySelector('.app-version-badge');
      if (badge) badge.textContent = VERSION_LABEL;
    }, 'icônes stables');
  }
  function installIconPatch(){
    forceStableIcons();
    [50, 250, 800, 1600].forEach(ms => setTimeout(forceStableIcons, ms));
    document.addEventListener('click', (ev) => {
      if (ev.target?.closest?.('.sidebar, aside, nav')) setTimeout(forceStableIcons, 0);
    }, true);
    safe(() => {
      if (typeof renderAll === 'function' && !renderAll.__v3234Icons) {
        const old = renderAll;
        const patched = function(){ const r = old.apply(this, arguments); setTimeout(forceStableIcons, 0); return r; };
        patched.__v3234Icons = true;
        renderAll = patched;
      }
      if (typeof updateSidebarButtons === 'function' && !updateSidebarButtons.__v3234Icons) {
        const old = updateSidebarButtons;
        const patched = function(){ const r = old.apply(this, arguments); setTimeout(forceStableIcons, 0); return r; };
        patched.__v3234Icons = true;
        updateSidebarButtons = patched;
      }
    }, 'patch render icons');
  }

  /* ------------------------------------------------------------------
     2) Réglages copro : popup avec menu déroulant gestionnaire.
     On intercepte le clic en phase window capture, avant l’ancien listener.
  ------------------------------------------------------------------ */
  function userProfiles(){ return stateOk() ? ((state.userProfiles || []).filter(u => u.active !== false)) : []; }
  function userName(u){ return (u?.display_name || u?.email || 'Utilisateur').trim(); }
  async function ensureUsersLoaded(){
    if (!stateOk()) return [];
    if ((state.userProfiles || []).length) return state.userProfiles;
    if (typeof window.loadUserProfilesV323 === 'function') {
      await window.loadUserProfilesV323();
    }
    return state.userProfiles || [];
  }
  function managerOptions(selected){
    return '<option value="">Aucun gestionnaire attribué</option>' + userProfiles().map(u => {
      const label = userName(u) + (u.email && u.email !== userName(u) ? ' — ' + u.email : '');
      return '<option value="'+esc(u.id)+'" '+(String(selected||'')===String(u.id)?'selected':'')+'>'+esc(label)+'</option>';
    }).join('');
  }
  function coproLabel(c){ return [c?.code || c?.copro_code || '', c?.name || ''].filter(Boolean).join(' - ') || 'Copropriété'; }
  function yearLabel(y){ return [y?.code || y?.year_code || '', y?.label || ''].filter(Boolean).join(' - ') || 'Exercice'; }
  function options(list, selected, labelFn, empty){
    return '<option value="">'+esc(empty || 'Choisir...')+'</option>' + (list || []).map(x => '<option value="'+esc(x.id)+'" '+(String(x.id)===String(selected)?'selected':'')+'>'+esc(labelFn(x))+'</option>').join('');
  }
  function account55Options(selected){
    const accounts = stateOk() ? (state.accounts || []).filter(a => String(a.code || '').startsWith('55')) : [];
    return options(accounts, selected, a => (a.code || '') + ' - ' + (a.label || ''), 'Compte comptable banque');
  }
  function activeOrRequestedCoproId(requestedId){
    return requestedId || (stateOk() ? (state.activeCoproId || '') : '') || $id('activeCoproSelect')?.value || (stateOk() ? (state.copros || [])[0]?.id : '') || '';
  }
  function openModal(title, bodyHtml, footerHtml){
    const backdrop = $id('globalModalBackdrop');
    const modal = $id('globalModal');
    if (!backdrop || !modal || !$id('globalModalBody')) { alert('Fenêtre popup indisponible. Recharge la page puis réessaie.'); return; }
    $id('globalModalTitle').textContent = title || 'Réglages copropriété';
    if ($id('globalModalSubtitle')) $id('globalModalSubtitle').textContent = 'Réglages propres à la copropriété sélectionnée.';
    $id('globalModalBody').innerHTML = bodyHtml || '';
    $id('globalModalFooter').innerHTML = footerHtml || '<button class="btn secondary" type="button" data-modal-close>Fermer</button>';
    modal.classList.remove('narrow');
    modal.classList.add('wide');
    backdrop.classList.remove('hidden');
    backdrop.style.display = '';
    backdrop.style.pointerEvents = '';
  }
  async function loadOptionalSettingsTables(){
    const c = client();
    if (!c || !stateOk()) return;
    async function read(table, select='*'){
      try { const { data, error } = await c.from(table).select(select); if (error) throw error; return data || []; }
      catch(e){ console.warn('[V32.3.4] table optionnelle', table, e.message || e); return []; }
    }
    if (!state.v28CoproBankAccounts) state.v28CoproBankAccounts = await read('compta_copro_bank_accounts','*');
    if (!state.v28Folders) state.v28Folders = await read('compta_copro_folders','*');
    if (!state.v28Documents) state.v28Documents = await read('compta_copro_documents','*');
  }
  function settingsBody(coproId){
    const c = (state.copros || []).find(x => String(x.id) === String(coproId)) || {};
    const years = (state.fiscalYears || []).filter(y => !coproId || String(y.copro_id) === String(coproId));
    const selectedYear = state.activeFiscalYearId || $id('activeFiscalYearSelect')?.value || years[0]?.id || '';
    const y = years.find(x => String(x.id) === String(selectedYear)) || {};
    const banks = (state.v28CoproBankAccounts || []).filter(b => String(b.copro_id) === String(coproId));
    const folders = (state.v28Folders || []).filter(f => String(f.copro_id) === String(coproId));
    const folderCards = (folders.length ? folders : [
      {id:'default-acte', name:'Acte de base'}, {id:'default-roi', name:'ROI'}, {id:'default-pv', name:'PV AG'}, {id:'default-contrats', name:'Contrats'}
    ]).map(f => {
      const count = (state.v28Documents || []).filter(d => String(d.folder_id) === String(f.id)).length;
      return '<div class="v3221-folder-card"><strong>'+esc(f.name || 'Dossier')+'</strong><span>'+count+' document(s)</span></div>';
    }).join('');
    const bankRows = banks.map(b => '<tr><td>'+esc(b.label||'')+'</td><td>'+esc(b.iban||'')+'</td><td>'+esc(b.bic||'')+'</td><td>'+esc(b.account_code||'')+'</td><td>'+(b.account_type === 'savings' ? 'Épargne' : 'Vue')+'</td></tr>').join('') || '<tr><td colspan="5">Aucun compte bancaire spécifique encodé.</td></tr>';
    return '<div class="v3221-settings-popup v3234-settings-popup">'
      + '<div class="notice compact"><strong>Copropriété :</strong> '+esc(coproLabel(c))+'</div>'
      + '<div class="form-grid">'
      + '<label>Code copropriété <input id="v3234CoproCode" value="'+esc(c.code || c.copro_code || '')+'" placeholder="Ex. ALB"></label>'
      + '<label>Nom copropriété <input id="v3234CoproName" value="'+esc(c.name || '')+'"></label>'
      + '<label>BCE <input id="v3234CoproBce" value="'+esc(c.bce || '')+'" placeholder="BE...."></label>'
      + '<label>Gestionnaire <select id="v3234CoproManagerUser">'+managerOptions(c.manager_user_id || c.manager_id || '')+'</select><div class="v3234-user-select-note">Liste issue des utilisateurs Supabase.</div></label>'
      + '<label style="grid-column:1/-1;">Adresse <textarea id="v3234CoproAddress" rows="2">'+esc(c.address || '')+'</textarea></label>'
      + '<label>Exercice <select id="v3234FiscalYearSelect">'+options(years, y.id || selectedYear, yearLabel, 'Exercice')+'</select></label>'
      + '<label>Code exercice <input id="v3234FiscalYearCode" value="'+esc(y.code || y.year_code || '')+'" placeholder="EX26"></label>'
      + '<label>Dernier n° facture interne <input id="v3234LastInternalInvoiceNo" type="number" min="0" value="'+Number(y.last_internal_invoice_no || 0)+'"></label>'
      + '</div><hr>'
      + '<div class="toolbar compact"><h3>Comptes bancaires de la copropriété</h3><button class="btn secondary small" id="v3234AddBankInlineBtn" type="button">+ Ajouter compte</button></div>'
      + '<div class="v3221-inline-bank hidden" id="v3234BankForm"><div class="form-grid">'
      + '<label>Libellé <input id="v3234BankLabel" placeholder="Compte à vue / Réserve"></label>'
      + '<label>IBAN <input id="v3234BankIban" placeholder="BE..."></label>'
      + '<label>BIC <input id="v3234BankBic" placeholder="GKCCBEBB"></label>'
      + '<label>Compte comptable <select id="v3234BankAccountAccounting">'+account55Options('')+'</select></label>'
      + '<label>Type <select id="v3234BankType"><option value="current">Compte à vue</option><option value="savings">Compte épargne</option></select></label>'
      + '</div><div class="top-actions"><button class="btn small" id="v3234SaveBankBtn" type="button">Ajouter le compte</button></div></div>'
      + '<div class="table-wrap"><table><thead><tr><th>Libellé</th><th>IBAN</th><th>BIC</th><th>Compte</th><th>Type</th></tr></thead><tbody>'+bankRows+'</tbody></table></div>'
      + '<hr><div class="toolbar compact"><h3>Documents copropriété</h3><button class="btn secondary small" id="v3234AddFolderBtn" type="button">+ Dossier</button></div>'
      + '<div class="v3221-folder-grid">'+folderCards+'</div></div>';
  }
  async function openSettingsPopup(coproId){
    if (!stateOk()) return;
    coproId = activeOrRequestedCoproId(coproId);
    if (!coproId) { alert('Choisis d’abord une copropriété.'); return; }
    await ensureUsersLoaded();
    await loadOptionalSettingsTables();
    if (typeof setActiveCopro === 'function') setActiveCopro(coproId);
    openModal('Réglages copropriété', settingsBody(coproId), '<button class="btn secondary" type="button" data-modal-close>Fermer</button><button class="btn" id="v3234SaveCoproSettingsBtn" type="button">Enregistrer réglages</button>');
    bindSettingsPopup(coproId);
    forceStableIcons();
  }
  function bindSettingsPopup(coproId){
    $id('v3234FiscalYearSelect')?.addEventListener('change', () => {
      const years = (state.fiscalYears || []).filter(y => String(y.copro_id) === String(coproId));
      const y = years.find(x => String(x.id) === String($id('v3234FiscalYearSelect').value)) || {};
      if ($id('v3234FiscalYearCode')) $id('v3234FiscalYearCode').value = y.code || y.year_code || '';
      if ($id('v3234LastInternalInvoiceNo')) $id('v3234LastInternalInvoiceNo').value = Number(y.last_internal_invoice_no || 0);
    });
    $id('v3234AddBankInlineBtn')?.addEventListener('click', () => $id('v3234BankForm')?.classList.toggle('hidden'));
    $id('v3234SaveBankBtn')?.addEventListener('click', () => addBank(coproId));
    $id('v3234AddFolderBtn')?.addEventListener('click', () => addFolder(coproId));
    $id('v3234SaveCoproSettingsBtn')?.addEventListener('click', () => saveSettings(coproId));
  }
  async function saveSettings(coproId){
    const c = client();
    if (!c) { alert('Supabase non connecté.'); return; }
    const managerId = $id('v3234CoproManagerUser')?.value || null;
    const manager = userProfiles().find(u => String(u.id) === String(managerId));
    const payload = {
      code: ($id('v3234CoproCode')?.value || '').trim(),
      name: ($id('v3234CoproName')?.value || '').trim(),
      bce: ($id('v3234CoproBce')?.value || '').trim(),
      address: ($id('v3234CoproAddress')?.value || '').trim(),
      manager_user_id: managerId || null,
      manager_name: manager ? userName(manager) : ''
    };
    if (!payload.name) { alert('Le nom de la copropriété est obligatoire.'); return; }
    let res = await c.from('compta_copros').update(payload).eq('id', coproId);
    if (res.error) { alert(res.error.message); return; }
    const yearId = $id('v3234FiscalYearSelect')?.value || '';
    if (yearId) {
      res = await c.from('compta_fiscal_years').update({
        code: ($id('v3234FiscalYearCode')?.value || '').trim(),
        last_internal_invoice_no: Number($id('v3234LastInternalInvoiceNo')?.value || 0)
      }).eq('id', yearId);
      if (res.error) { alert(res.error.message); return; }
    }
    if (typeof loadAll === 'function') await loadAll();
    if (typeof window.loadUserProfilesV323 === 'function') await window.loadUserProfilesV323();
    alert('Réglages copropriété enregistrés.');
    await openSettingsPopup(coproId);
    if (typeof renderAll === 'function') renderAll();
    forceStableIcons();
  }
  async function addBank(coproId){
    const c = client();
    const iban = ($id('v3234BankIban')?.value || '').trim();
    if (!c || !iban) { alert('IBAN obligatoire.'); return; }
    const accId = $id('v3234BankAccountAccounting')?.value || null;
    const acc = (state.accounts || []).find(a => String(a.id) === String(accId)) || {};
    const { error } = await c.from('compta_copro_bank_accounts').insert({
      copro_id: coproId,
      label: ($id('v3234BankLabel')?.value || '').trim() || 'Compte bancaire',
      iban,
      bic: ($id('v3234BankBic')?.value || '').trim(),
      account_id: accId,
      account_code: acc.code || '',
      account_type: $id('v3234BankType')?.value || 'current',
      active: true
    });
    if (error) { alert(error.message); return; }
    state.v28CoproBankAccounts = null;
    await openSettingsPopup(coproId);
  }
  async function addFolder(coproId){
    const c = client();
    const name = prompt('Nom du dossier');
    if (!c || !name) return;
    const { error } = await c.from('compta_copro_folders').insert({ copro_id: coproId, name: name.trim() });
    if (error) { alert(error.message); return; }
    state.v28Folders = null;
    await openSettingsPopup(coproId);
  }
  function installSettingsClickInterceptor(){
    window.openCoproSettingsPopupV3234 = openSettingsPopup;
    window.openCoproSettingsPopupV3221 = openSettingsPopup;
    window.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-v322-copro-settings], #activeCoproSettingsBtn, [data-open-copro-settings]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const coproId = btn.dataset.v322CoproSettings || btn.dataset.openCoproSettings || activeOrRequestedCoproId();
      openSettingsPopup(coproId);
    }, true);
  }

  /* ------------------------------------------------------------------
     3) Consultation compte comptable : recherche par numéro OU libellé,
     avec datalist et liste déroulante optionnelle.
  ------------------------------------------------------------------ */
  function accountText(a){ return [a?.code || '', a?.label || ''].filter(Boolean).join(' - '); }
  function enhanceAccountLookupControl(){
    const input = $id('v28AccountLookupCode');
    if (!input || input.dataset.v3234Ready === '1') return;
    input.dataset.v3234Ready = '1';
    input.placeholder = 'Tape un numéro ou un libellé — ex. 610, entretien, ascenseur';
    input.setAttribute('list','v3234AccountDatalist');
    const dl = document.createElement('datalist');
    dl.id = 'v3234AccountDatalist';
    document.body.appendChild(dl);
    const select = document.createElement('select');
    select.id = 'v3234AccountSelect';
    select.innerHTML = '<option value="">Liste déroulante des comptes</option>';
    input.insertAdjacentElement('afterend', select);
    const parent = input.closest('label');
    if (parent && !parent.dataset.v3234Picker) {
      parent.dataset.v3234Picker = '1';
      parent.classList.add('v3234-account-picker');
      const help = document.createElement('div');
      help.className = 'v3234-account-help';
      help.textContent = 'Recherche possible par numéro de compte ou par libellé. La liste déroulante reste disponible en complément.';
      parent.appendChild(help);
    }
    select.addEventListener('change', () => {
      const acc = (state.accounts || []).find(a => String(a.id) === String(select.value));
      input.value = acc ? (acc.code || '') : '';
      renderAccountLookupV3234();
    });
  }
  function refreshAccountOptions(){
    if (!stateOk()) return;
    const dl = $id('v3234AccountDatalist');
    const select = $id('v3234AccountSelect');
    const opts = (state.accounts || []).slice().sort((a,b) => String(a.code||'').localeCompare(String(b.code||''),'fr',{numeric:true}));
    if (dl) dl.innerHTML = opts.map(a => '<option value="'+esc(accountText(a))+'"></option><option value="'+esc(a.code || '')+'"></option>').join('');
    if (select) {
      const keep = select.value || '';
      select.innerHTML = '<option value="">Liste déroulante des comptes</option>' + opts.map(a => '<option value="'+esc(a.id)+'">'+esc(accountText(a))+'</option>').join('');
      select.value = keep;
    }
  }
  function matchedAccounts(query){
    const q = norm(query).replace(/^([0-9]{3,})\s*-.*$/, '$1');
    const accounts = stateOk() ? (state.accounts || []) : [];
    if (!q) return accounts;
    return accounts.filter(a => {
      const code = norm(a.code || '');
      const label = norm(a.label || '');
      const all = norm(accountText(a));
      return code.startsWith(q) || label.includes(q) || all.includes(q);
    });
  }
  function rowAccountMatch(row, accounts){
    if (!accounts.length) return false;
    const codes = new Set(accounts.map(a => String(a.code || '')));
    const ids = new Set(accounts.map(a => String(a.id || '')));
    return codes.has(String(row.code || row.account?.code || '')) || ids.has(String(row.account_id || row.account?.id || ''));
  }
  function renderAccountLookupV3234(){
    const table = $id('v28AccountLookupTable');
    if (!table || !stateOk()) return;
    enhanceAccountLookupControl();
    refreshAccountOptions();
    const raw = ($id('v28AccountLookupCode')?.value || '').trim();
    const accounts = matchedAccounts(raw);
    const coproId = state.activeCoproId || $id('v28AccountLookupCopro')?.value || '';
    const from = $id('v28AccountLookupFrom')?.value || '0000-01-01';
    const to = $id('v28AccountLookupTo')?.value || '9999-12-31';
    let rows = [];
    if (typeof v31AccountingRows === 'function') {
      rows = v31AccountingRows().filter(r => (!raw || rowAccountMatch(r, accounts)) && (!coproId || r.copro_id === coproId) && (!r.date || (r.date >= from && r.date <= to)));
    } else {
      const ids = new Set(accounts.map(a => a.id));
      rows = [
        ...(state.invoices || []).filter(i => ids.has(i.account_id)).map(i => {
          const a = accounts.find(x => x.id === i.account_id) || {};
          return { date:i.invoice_date, source_type:'ACH', code:a.code, label:a.label, text:(i.invoice_number||'')+' '+(i.compta_suppliers?.name||''), debit:Number(i.amount_total||0), credit:0, copro_id:i.copro_id };
        }),
        ...(state.entries || []).filter(e => ids.has(e.account_id)).map(e => {
          const a = accounts.find(x => x.id === e.account_id) || {};
          return { date:e.entry_date, source_type:e.journal_code||'OD', code:a.code, label:a.label, text:e.description||'', debit:Number(e.debit||0), credit:Number(e.credit||0), copro_id:e.copro_id };
        })
      ].filter(r => (!coproId || r.copro_id === coproId) && (!r.date || (r.date >= from && r.date <= to)));
    }
    rows.sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
    const debit = rows.reduce((s,r) => s + Number(r.debit || 0), 0);
    const credit = rows.reduce((s,r) => s + Number(r.credit || 0), 0);
    if ($id('v28AccountDebit')) $id('v28AccountDebit').textContent = moneySafe(debit);
    if ($id('v28AccountCredit')) $id('v28AccountCredit').textContent = moneySafe(credit);
    if ($id('v28AccountSolde')) $id('v28AccountSolde').textContent = moneySafe(debit - credit);
    table.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Journal</th><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th></tr></thead><tbody>'
      + (rows.map(r => '<tr><td>'+esc(r.date || '')+'</td><td>'+esc(String(r.source_type || r.type || '').toUpperCase())+'</td><td>'+esc((r.code || r.account?.code || '')+' - '+String(r.label || r.account?.label || '').replace(/^\d+\s*-\s*/,''))+'</td><td>'+esc(r.text || r.lib || '')+'</td><td>'+(Number(r.debit||0)?moneySafe(r.debit):'')+'</td><td>'+(Number(r.credit||0)?moneySafe(r.credit):'')+'</td></tr>').join('') || '<tr><td colspan="6">Aucune ligne.</td></tr>')
      + '</tbody></table></div>';
  }
  function installAccountLookupPatch(){
    safe(() => {
      window.renderAccountLookupV3234 = renderAccountLookupV3234;
      if (typeof v31RenderAccountLookup === 'function') v31RenderAccountLookup = renderAccountLookupV3234;
      if (typeof searchAccountLookupV28 === 'function') searchAccountLookupV28 = renderAccountLookupV3234;
      enhanceAccountLookupControl();
      refreshAccountOptions();
      document.addEventListener('input', (e) => {
        if (e.target?.id === 'v28AccountLookupCode') renderAccountLookupV3234();
      }, true);
      document.addEventListener('change', (e) => {
        if (['v28AccountLookupCode','v28AccountLookupFrom','v28AccountLookupTo','v28AccountLookupCopro'].includes(e.target?.id)) renderAccountLookupV3234();
      }, true);
      setTimeout(() => { enhanceAccountLookupControl(); refreshAccountOptions(); }, 600);
    }, 'compte comptable');
  }

  function init(){
    safe(() => {
      window.WAPI_ONE_VERSION = 'V32.3.4';
      installIconPatch();
      installSettingsClickInterceptor();
      installAccountLookupPatch();
      const badge = document.querySelector('.app-version-badge');
      if (badge) badge.textContent = VERSION_LABEL;
    }, 'init');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
