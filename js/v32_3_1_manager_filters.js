/* WAPI One V32.3.1 — Filtres gestionnaire étendus
   Objectif : appliquer le filtre gestionnaire dans les modules multi-copro utiles,
   sans MutationObserver ni boucle de rendu. */
(function(){
  const VERSION = 'WAPI One — V32.3.2';
  const STORAGE_KEY = 'wapi_one_manager_filter_user_id';
  const patched = new Set();
  const coproSelectIds = [
    'queueFilterCopro','ocrCoproFilter','paymentCoproFilter','callDispatchCoproFilter',
    'codaFilterCopro','v28CodaCoproFilter','callsCoproFilter','thirdBalanceCoproFilter',
    'budgetCoproFilter','settlementCoproFilter','financialLedgerCopro','expensesCoproFilter',
    'v28AccountLookupCopro','v28MeterCopro','informCoproFilter','sendLogCoproFilter',
    'ownersFilterCopro','lotsFilterCopro','distributionCopro','bankAccountCopro'
  ];

  const renderFunctionNames = [
    'renderDashboard','renderProcessing','renderValidationQueue','renderImportBatches','renderCopros',
    'renderInvoices','renderBank','renderBankTransactions','renderFinancialLedger','renderExpensesList',
    'renderBudgets','renderCalls','renderThirdBalance','renderPayments','renderInvoiceOcrV13',
    'renderCallDispatchV20','renderStatementsV17','renderSyndicBillingV23','renderSyndicBillingV25',
    'renderCodaPilotV28','v30RenderCodaPilot','v30RenderHeldFunds','v30RenderMultiSearch'
  ];

  const filteredStateKeys = [
    'copros','lots','invoices','bankAccounts','bankStatements','bankTransactions','validationQueue',
    'importBatches','budgetHeaders','budgetLines','callHeaders','ownerCalls','thirdOpeningBalances',
    'entries','settlementHeaders','settlementLines','syndicContracts','syndicInvoices','syndicServices'
  ];

  function safe(fn, label){
    try { return fn(); } catch(e) { console.warn('[V32.3.1]', label || 'erreur', e); }
  }
  function $(id){ return document.getElementById(id); }
  function esc(v){
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function currentManagerId(){
    return (typeof state !== 'undefined' && state.managerFilterUserId) || localStorage.getItem(STORAGE_KEY) || '';
  }
  function managerActive(){ return !!currentManagerId(); }
  function managerName(id){
    const u = (typeof state !== 'undefined' && state.userProfiles || []).find(x => String(x.id) === String(id));
    return u ? (u.display_name || u.email || 'Gestionnaire') : 'Gestionnaire';
  }
  function coproManagerId(c){ return c?.manager_user_id || c?.manager_id || ''; }
  function allCopros(){ return (typeof state !== 'undefined' && state.copros) || []; }
  function filteredCoprosByManager(){
    const list = allCopros();
    const m = currentManagerId();
    if (!m) return list;
    return list.filter(c => String(coproManagerId(c)) === String(m));
  }
  function allowedCoproIds(){
    if (typeof state === 'undefined') return new Set();
    if (state.activeCoproId) return new Set([state.activeCoproId]);
    return new Set(filteredCoprosByManager().map(c => c.id));
  }
  function coproIsAllowed(coproId){
    if (!managerActive() || typeof state === 'undefined') return true;
    if (!coproId) return true;
    return allowedCoproIds().has(coproId);
  }
  function itemCoproId(item){
    if (!item) return '';
    if (item.copro_id) return item.copro_id;
    if (item.compta_copros?.id) return item.compta_copros.id;
    if (item.bank_account_id && typeof state !== 'undefined') {
      const ba = (state.bankAccounts || []).find(a => String(a.id) === String(item.bank_account_id));
      if (ba?.copro_id) return ba.copro_id;
    }
    if (item.statement_id && typeof state !== 'undefined') {
      const st = (state.bankStatements || []).find(s => String(s.id) === String(item.statement_id));
      if (st?.copro_id) return st.copro_id;
    }
    if (item.budget_header_id && typeof state !== 'undefined') {
      const h = (state.budgetHeaders || []).find(b => String(b.id) === String(item.budget_header_id));
      if (h?.copro_id) return h.copro_id;
    }
    if (item.call_header_id && typeof state !== 'undefined') {
      const h = (state.callHeaders || []).find(c => String(c.id) === String(item.call_header_id));
      if (h?.copro_id) return h.copro_id;
    }
    return '';
  }
  function filterListByManager(list){
    if (!managerActive() || typeof state === 'undefined' || state.activeCoproId) return list;
    const allowed = allowedCoproIds();
    return (list || []).filter(item => {
      const cid = itemCoproId(item);
      return !cid || allowed.has(cid);
    });
  }
  function withFilteredState(fn){
    if (!managerActive() || typeof state === 'undefined' || state.activeCoproId) return fn();
    const backup = {};
    filteredStateKeys.forEach(k => {
      if (Array.isArray(state[k])) {
        backup[k] = state[k];
        if (k === 'copros') state[k] = filteredCoprosByManager();
        else state[k] = filterListByManager(state[k]);
      }
    });
    try { return fn(); }
    finally {
      Object.entries(backup).forEach(([k,v]) => { state[k] = v; });
    }
  }
  function getGlobalFn(name){
    try { return eval(name); } catch(e) { return null; }
  }
  function setGlobalFn(name, fn){
    try { eval(name + ' = fn'); } catch(e) { window[name] = fn; }
  }
  function patchRender(name){
    if (patched.has(name)) return;
    const old = getGlobalFn(name);
    if (typeof old !== 'function') return;
    const wrapped = function(){
      return withFilteredState(() => {
        const result = old.apply(this, arguments);
        refreshManagerFiltersUi();
        return result;
      });
    };
    wrapped.__v3231 = true;
    setGlobalFn(name, wrapped);
    patched.add(name);
  }

  function managerSelectHtml(id, selected){
    const users = ((typeof state !== 'undefined' && state.userProfiles) || []).filter(u => u.active !== false);
    return `<label class="v3231-manager-label">Gestionnaire
      <select id="${id}">
        <option value="">Tous les gestionnaires</option>
        ${users.map(u => `<option value="${esc(u.id)}" ${String(selected||'')===String(u.id)?'selected':''}>${esc(u.display_name || u.email || 'Utilisateur')}</option>`).join('')}
      </select>
    </label>`;
  }
  function ensureInlineManagerFilter(anchorId, key){
    const anchor = $(anchorId);
    if (!anchor) return;
    const card = anchor.closest('.card') || anchor.parentElement;
    if (!card || card.querySelector(`[data-v3231-manager-filter="${key}"]`)) return;
    const row = document.createElement('div');
    row.className = 'v3231-manager-filter-row';
    row.dataset.v3231ManagerFilter = key;
    row.innerHTML = `<span class="v3231-filter-title">Filtre gestionnaire</span>${managerSelectHtml('v3231Manager_' + key, currentManagerId())}<span class="v3231-filter-hint">Laisse vide pour afficher toutes les copropriétés.</span>`;
    const existingFilters = card.querySelector('.list-filters, .form-grid, .toolbar + .notice');
    if (existingFilters && existingFilters.parentElement === card) card.insertBefore(row, existingFilters.nextSibling);
    else card.insertBefore(row, anchor);
    const sel = row.querySelector('select');
    sel?.addEventListener('change', () => {
      if (typeof state !== 'undefined') state.managerFilterUserId = sel.value || '';
      if (sel.value) localStorage.setItem(STORAGE_KEY, sel.value); else localStorage.removeItem(STORAGE_KEY);
      syncMainManagerSelect();
      if (typeof renderAll === 'function') renderAll();
      else refreshManagerFiltersUi();
    });
  }
  function syncMainManagerSelect(){
    const main = $('activeManagerFilter');
    if (main) main.value = currentManagerId();
  }
  function managerOptionsHtml(selected=''){
    const users = ((typeof state !== 'undefined' && state.userProfiles) || []).filter(u => u.active !== false);
    return `<option value="">Tous les gestionnaires</option>` + users.map(u => {
      const label = [u.display_name || u.email || 'Utilisateur', u.email && u.display_name ? u.email : ''].filter(Boolean).join(' — ');
      return `<option value="${esc(u.id)}" ${String(selected||'')===String(u.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
  }

  function refreshInlineManagerSelects(){
    const cur = currentManagerId();
    document.querySelectorAll('[data-v3231-manager-filter] select').forEach(sel => {
      const previous = sel.value || cur || '';
      // Les filtres créés avant le chargement des utilisateurs étaient bloqués sur
      // "Tous les gestionnaires". On reconstruit donc les options à chaque refresh,
      // sans observer ni boucle.
      sel.innerHTML = managerOptionsHtml(previous);
      sel.value = previous && Array.from(sel.options).some(o => String(o.value) === String(previous)) ? previous : cur;
    });
  }
  function applyCoproSelectFilter(id){
    const sel = $(id);
    if (!sel || sel.dataset.v3231KeepAll === '1') return;
    if (typeof state === 'undefined') return;
    const current = sel.value || '';
    const allLabel = managerActive() && !state.activeCoproId ? `Toutes les copros de ${managerName(currentManagerId())}` : 'Toutes les copropriétés';
    const chooseLabel = id.includes('Copro') || id.includes('copro') ? allLabel : 'Toutes';
    const list = state.activeCoproId ? allCopros().filter(c => c.id === state.activeCoproId) : filteredCoprosByManager();
    // Ne pas forcer les selects de création lorsque le module attend une copro précise, mais limiter la liste.
    const first = `<option value="">${esc(chooseLabel)}</option>`;
    sel.innerHTML = first + list.map(c => `<option value="${esc(c.id)}">${esc([c.code || c.copro_code || '', c.name || ''].filter(Boolean).join(' - '))}</option>`).join('');
    sel.value = current && list.some(c => String(c.id) === String(current)) ? current : (state.activeCoproId || '');
  }
  function refreshCoproSelects(){
    coproSelectIds.forEach(applyCoproSelectFilter);
  }
  function ensureModuleManagerFilters(){
    const defs = [
      ['coprosTable','copros'], ['validationQueueTable','processing'], ['v28CodaTable','codaPilot'],
      ['bankStatementsTable','codaBank'], ['paymentsTable','payments'], ['callDispatchTable','callDispatch'],
      ['invoicesTable','invoices'], ['callsTable','calls'], ['thirdBalanceTable','thirdBalance'],
      ['budgetsTable','budgets'], ['settlementOwnersTable','settlements'], ['invoiceOcrWorkbench','ocr'],
      ['financialLedgerTable','financialLedger'], ['expensesListTable','expenses'], ['syndicBillingContent','syndicBilling'],
      ['sendJournalTable','sendJournal'], ['v28AccountLookupTable','accountLookup'], ['v28MeterTable','meters'],
      ['v30GlobalResults','multiSearch'], ['heldFundsView','heldFunds']
    ];
    defs.forEach(([anchor,key]) => ensureInlineManagerFilter(anchor,key));
  }
  function refreshManagerFiltersUi(){
    safe(() => {
      ensureModuleManagerFilters();
      refreshInlineManagerSelects();
      refreshCoproSelects();
      const badge = document.querySelector('.app-version-badge');
      if (badge) badge.textContent = VERSION;
    }, 'refresh UI filtres gestionnaire');
  }
  function patchAll(){
    renderFunctionNames.forEach(patchRender);
    refreshManagerFiltersUi();
  }
  window.v3231RefreshManagerFilters = refreshManagerFiltersUi;
  window.v3231ManagerAllowedCoproIds = allowedCoproIds;
  window.v3231CoproIsAllowed = coproIsAllowed;
  window.v3231FilterListByManager = filterListByManager;
  setTimeout(patchAll, 0);
  setTimeout(patchAll, 500);
  document.addEventListener('DOMContentLoaded', () => setTimeout(patchAll, 50));

  // Rechargement ponctuel des profils : si les filtres inline ont été rendus avant
  // que Supabase ait renvoyé les utilisateurs, on recharge les options une fois les
  // profils disponibles. Pas de MutationObserver / pas de boucle.
  setTimeout(() => {
    try {
      if (typeof window.loadUserProfilesV323 === 'function') {
        window.loadUserProfilesV323().then(() => {
          refreshManagerFiltersUi();
        });
      } else {
        refreshManagerFiltersUi();
      }
    } catch(e) { console.warn('[V32.3.2] refresh profils gestionnaires', e); }
  }, 900);
})();
