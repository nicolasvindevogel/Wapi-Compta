/* ============================================================
   WAPI One V32.3 — Gestion multi-utilisateur / gestionnaires
   - lit les utilisateurs Supabase Auth via compta_user_profiles
   - attribue un gestionnaire aux copros dans le popup Réglages copro
   - ajoute un filtre global par gestionnaire pour les modules multi-copro
   - garde une logique sans observer/intervalle pour éviter les boucles
   ============================================================ */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V32.3 - multi-utilisateurs';
  const STORAGE_KEY = 'wapi_one_manager_filter_user_id';
  const $id = (id) => document.getElementById(id);
  const esc = (v) => typeof escapeHtml === 'function' ? escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const moneyFmt = (v) => typeof money === 'function' ? money(v) : Number(v||0).toLocaleString('fr-BE', {style:'currency', currency:'EUR'});

  function safe(fn, label){ try { return fn(); } catch(e){ console.warn(label || 'V32.3', e); } }

  if (typeof state !== 'undefined') {
    state.userProfiles = state.userProfiles || [];
    state.managerFilterUserId = localStorage.getItem(STORAGE_KEY) || '';
  }

  function userLabel(u){
    if (!u) return '—';
    return (u.display_name || u.email || '').trim() || 'Utilisateur';
  }

  async function loadUserProfilesV323(){
    if (!window.supabaseClient && typeof supabaseClient === 'undefined') return [];
    const client = window.supabaseClient || supabaseClient;
    if (!client) return [];
    try {
      const { data, error } = await client
        .from('compta_user_profiles')
        .select('id,email,display_name,role,active,initials')
        .order('display_name', { ascending: true });
      if (error) throw error;
      state.userProfiles = data || [];
      return state.userProfiles;
    } catch(e) {
      console.warn('V32.3 profils utilisateurs non disponibles. Exécute le SQL 028_v32_3_multi_utilisateurs.sql.', e.message || e);
      state.userProfiles = state.userProfiles || [];
      return state.userProfiles;
    }
  }
  window.loadUserProfilesV323 = loadUserProfilesV323;

  function managerId(){ return state.managerFilterUserId || ''; }
  function managerIsActive(){ return !!managerId(); }
  function coproManagerId(c){ return c?.manager_user_id || c?.manager_id || ''; }
  function coproAllowedByManager(coproId){
    if (!managerIsActive()) return true;
    const c = (state.copros || []).find(x => String(x.id) === String(coproId));
    return !!c && String(coproManagerId(c)) === String(managerId());
  }
  window.v323CoproAllowedByManager = coproAllowedByManager;

  function filteredCopros(){
    const list = state.copros || [];
    if (!managerIsActive()) return list;
    return list.filter(c => String(coproManagerId(c)) === String(managerId()));
  }
  window.v323FilteredCopros = filteredCopros;

  function managerOptionsHtml(selected=''){
    const users = (state.userProfiles || []).filter(u => u.active !== false);
    return '<option value="">Tous les gestionnaires</option>' + users.map(u => {
      const label = `${userLabel(u)}${u.email ? ' — ' + u.email : ''}`;
      return `<option value="${esc(u.id)}" ${String(selected)===String(u.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
  }
  window.v323ManagerOptionsHtml = managerOptionsHtml;

  function managerNameById(id){
    const u = (state.userProfiles || []).find(x => String(x.id) === String(id));
    return userLabel(u);
  }

  function ensureManagerFilterUi(){
    const box = document.querySelector('.active-copro-box');
    if (!box || $id('activeManagerFilterBox')) return;
    const wrap = document.createElement('div');
    wrap.id = 'activeManagerFilterBox';
    wrap.className = 'manager-filter-box';
    wrap.innerHTML = `
      <label>Gestionnaire</label>
      <select id="activeManagerFilter"></select>
      <div class="manager-filter-hint">Filtre les vues multi-copro.</div>
    `;
    const btnRow = box.querySelector('div[style*="display:flex"]') || box.lastElementChild;
    box.insertBefore(wrap, btnRow || null);
    const sel = $id('activeManagerFilter');
    sel.innerHTML = managerOptionsHtml(managerId());
    sel.value = managerId();
    sel.addEventListener('change', () => {
      state.managerFilterUserId = sel.value || '';
      localStorage.setItem(STORAGE_KEY, state.managerFilterUserId);
      if (!state.managerFilterUserId) localStorage.removeItem(STORAGE_KEY);
      if (typeof renderAll === 'function') renderAll();
      setTimeout(refreshManagerUi, 0);
    });
  }

  function refreshManagerUi(){
    safe(() => {
      ensureManagerFilterUi();
      const sel = $id('activeManagerFilter');
      if (sel) {
        const current = state.managerFilterUserId || '';
        sel.innerHTML = managerOptionsHtml(current);
        sel.value = current;
      }
      const badge = document.querySelector('.app-version-badge');
      if (badge) badge.textContent = 'WAPI One — V32.3';
    }, 'refresh manager ui');
  }

  // Filtrer proprement la liste de copro active selon le gestionnaire sélectionné.
  function patchActiveCoproSelector(){
    safe(() => {
      if (typeof renderActiveCoproContext !== 'function' || renderActiveCoproContext.__v323) return;
      const previous = renderActiveCoproContext;
      const patched = function(){
        previous.apply(this, arguments);
        const select = $id('activeCoproSelect');
        if (!select) return;
        const current = state.activeCoproId || select.value || '';
        const list = filteredCopros();
        let html = '<option value="">Mode global / toutes les copros</option>' + list.map(c => `<option value="${esc(c.id)}">${esc([c.code || c.copro_code || '', c.name || ''].filter(Boolean).join(' - '))}</option>`).join('');
        if (current && !list.some(c => String(c.id) === String(current))) {
          const c = (state.copros || []).find(x => String(x.id) === String(current));
          if (c) html += `<option value="${esc(c.id)}">${esc(c.name || '')} — hors filtre gestionnaire</option>`;
        }
        select.innerHTML = html;
        select.value = current;
        if ($id('activeCoproName')) {
          const c = (state.copros || []).find(x => String(x.id) === String(state.activeCoproId));
          $id('activeCoproName').textContent = c ? (c.name || 'Copropriété') : (managerIsActive() ? `Mode global — ${managerNameById(managerId())}` : 'Mode global');
        }
      };
      patched.__v323 = true;
      renderActiveCoproContext = patched;
    }, 'patch active copro selector');
  }

  // Liste copros avec gestionnaire visible et filtre gestionnaire.
  function patchCoprosList(){
    safe(() => {
      if (typeof renderCopros !== 'function' || renderCopros.__v323) return;
      const patched = function(){
        const tbl = $id('coprosTable');
        if (!tbl) return;
        const rows = filteredCopros();
        tbl.innerHTML = `<div class="v323-copro-toolbar"><span class="badge">${rows.length} copropriété(s)</span><span class="muted-note">Filtre gestionnaire : ${esc(managerIsActive() ? managerNameById(managerId()) : 'Tous')}</span></div>` +
          `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>Adresse</th><th>BCE</th><th>Gestionnaire</th><th>Statut</th><th>Actions</th></tr></thead><tbody>` +
          (rows.map(c => `<tr><td>${c.code || c.copro_code ? `<span class="code-pill">${esc(c.code || c.copro_code)}</span>` : '<span class="muted-inline">À définir</span>'}</td><td>${esc(c.name || '')}</td><td>${esc(c.address || '')}</td><td>${esc(c.bce || '')}</td><td>${esc(c.manager_name || managerNameById(c.manager_user_id) || '')}</td><td>${c.active === false ? '<span class="badge">Inactive</span>' : '<span class="badge ok">Active</span>'}</td><td><div class="actions-inline"><button class="btn secondary small" type="button" data-enter-copro="${esc(c.id)}">Entrer</button><button class="btn small" type="button" data-v322-copro-settings="${esc(c.id)}">Réglages</button></div></td></tr>`).join('') || '<tr><td colspan="7">Aucune copropriété pour ce filtre.</td></tr>') +
          '</tbody></table></div>';
      };
      patched.__v323 = true;
      renderCopros = patched;
    }, 'patch copros list');
  }

  // Dashboard : s'il y a un filtre gestionnaire en global, les compteurs suivent ce filtre.
  function patchDashboard(){
    safe(() => {
      if (typeof renderDashboard !== 'function' || renderDashboard.__v323) return;
      const old = renderDashboard;
      const patched = function(){
        old.apply(this, arguments);
        const allowedIds = new Set((state.activeCoproId ? (state.copros || []).filter(c => c.id === state.activeCoproId) : filteredCopros()).map(c => c.id));
        const filterByCopro = (arr) => (arr || []).filter(x => !x.copro_id || allowedIds.has(x.copro_id));
        if ($id('statCopros')) $id('statCopros').textContent = state.activeCoproId ? 1 : allowedIds.size;
        if ($id('statLots')) $id('statLots').textContent = filterByCopro(state.lots).length;
        if ($id('statInvoices')) $id('statInvoices').textContent = filterByCopro(state.invoices).filter(i => ['to_validate','draft','unpaid'].includes(String(i.status || i.payment_status || '').toLowerCase())).length;
        if ($id('statAmount')) $id('statAmount').textContent = moneyFmt(filterByCopro(state.invoices).reduce((s,i)=>s+Number(i.amount_total||0),0));
        if ($id('statBankTransactions')) $id('statBankTransactions').textContent = filterByCopro(state.bankTransactions).length;
        if ($id('statProcessingQueue')) $id('statProcessingQueue').textContent = filterByCopro(state.validationQueue).filter(q => !['validated','rejected'].includes(q.status)).length;
      };
      patched.__v323 = true;
      renderDashboard = patched;
    }, 'patch dashboard');
  }

  // Paiement factures : le filtre gestionnaire s'applique en plus du filtre copropriété.
  function patchPaymentFilter(){
    safe(() => {
      if (typeof paymentInvoiceFilterV12 === 'function' && !paymentInvoiceFilterV12.__v323) {
        const old = paymentInvoiceFilterV12;
        const patched = function(inv){
          if (managerIsActive() && !coproAllowedByManager(inv.copro_id)) return false;
          return old.apply(this, arguments);
        };
        patched.__v323 = true;
        paymentInvoiceFilterV12 = patched;
      }
      if (typeof renderPayments === 'function' && !renderPayments.__v323ui) {
        const oldRender = renderPayments;
        const patchedRender = function(){
          oldRender.apply(this, arguments);
          const sel = $id('paymentCoproFilter');
          if (sel && managerIsActive() && !state.activeCoproId) {
            const current = sel.value || '';
            sel.innerHTML = '<option value="">Toutes les copros du gestionnaire</option>' + filteredCopros().map(c => `<option value="${esc(c.id)}">${esc(c.name || '')}</option>`).join('');
            sel.value = current && coproAllowedByManager(current) ? current : '';
          }
        };
        patchedRender.__v323ui = true;
        renderPayments = patchedRender;
      }
    }, 'patch payment filter');
  }

  // Centre de traitement / file de validation : filtre en global par gestionnaire.
  function patchValidationQueue(){
    safe(() => {
      if (typeof renderValidationQueue !== 'function' || renderValidationQueue.__v323) return;
      const old = renderValidationQueue;
      const patched = function(){
        if (!managerIsActive() || state.activeCoproId) return old.apply(this, arguments);
        const original = state.validationQueue;
        state.validationQueue = original.filter(q => !q.copro_id || coproAllowedByManager(q.copro_id));
        try { return old.apply(this, arguments); }
        finally { state.validationQueue = original; }
      };
      patched.__v323 = true;
      renderValidationQueue = patched;
    }, 'patch validation queue');
  }

  // CODA / Banque : filtre les extraits en global par gestionnaire.
  function patchBankRender(){
    safe(() => {
      if (typeof renderBank !== 'function' || renderBank.__v323) return;
      const old = renderBank;
      const patched = function(){
        if (!managerIsActive() || state.activeCoproId) return old.apply(this, arguments);
        const originalCopros = state.copros;
        const originalStatements = state.bankStatements;
        const originalAccounts = state.bankAccounts;
        state.copros = filteredCopros();
        state.bankStatements = originalStatements.filter(s => !s.copro_id || coproAllowedByManager(s.copro_id));
        state.bankAccounts = originalAccounts.filter(a => !a.copro_id || coproAllowedByManager(a.copro_id));
        try { return old.apply(this, arguments); }
        finally { state.copros = originalCopros; state.bankStatements = originalStatements; state.bankAccounts = originalAccounts; }
      };
      patched.__v323 = true;
      renderBank = patched;
    }, 'patch bank render');
  }

  function patchLoadAll(){
    safe(() => {
      if (typeof loadAll !== 'function' || loadAll.__v323) return;
      const old = loadAll;
      const patched = async function(){
        const res = await old.apply(this, arguments);
        await loadUserProfilesV323();
        refreshManagerUi();
        return res;
      };
      patched.__v323 = true;
      loadAll = patched;
    }, 'patch load all');
  }

  function install(){
    patchLoadAll();
    patchActiveCoproSelector();
    patchCoprosList();
    patchDashboard();
    patchPaymentFilter();
    patchValidationQueue();
    patchBankRender();
    loadUserProfilesV323().then(() => {
      refreshManagerUi();
      if (typeof renderAll === 'function') renderAll();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
