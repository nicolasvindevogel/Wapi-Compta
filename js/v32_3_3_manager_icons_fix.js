/* WAPI One V32.3.3 — filtre gestionnaire strict + icônes stables
   Pas de MutationObserver, pas de boucle. Patch ponctuel après rendu. */
(function(){
  'use strict';
  const VERSION = 'WAPI One — V32.3.3';
  const MANAGER_KEY = 'wapi_one_manager_filter_user_id';
  const ACTIVE_COPRO_KEY = 'wapi_one_active_copro';
  const $id = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let busy = false;

  function safe(fn, label){ try { return fn(); } catch(e){ console.warn('[V32.3.3]', label || 'erreur', e); } }
  function stateOk(){ return typeof state !== 'undefined' && state; }
  function managerId(){ return stateOk() ? (state.managerFilterUserId || localStorage.getItem(MANAGER_KEY) || '') : (localStorage.getItem(MANAGER_KEY) || ''); }
  function hasManager(){ return !!managerId(); }
  function userLabel(id){
    if (!stateOk()) return 'Gestionnaire';
    const u = (state.userProfiles || []).find(x => String(x.id) === String(id));
    return (u?.display_name || u?.email || 'Gestionnaire').trim();
  }
  function coproManagerId(c){ return c?.manager_user_id || c?.manager_id || ''; }
  function allCopros(){ return stateOk() ? (state.copros || []) : []; }
  function filteredCoprosStrict(){
    const list = allCopros();
    const m = managerId();
    if (!m) return list;
    return list.filter(c => String(coproManagerId(c)) === String(m));
  }
  function currentActiveCoproAllowed(){
    if (!stateOk() || !state.activeCoproId || !hasManager()) return true;
    return filteredCoprosStrict().some(c => String(c.id) === String(state.activeCoproId));
  }
  function clearActiveCoproIfOutOfFilter(){
    if (!stateOk()) return false;
    if (!currentActiveCoproAllowed()) {
      state.activeCoproId = '';
      localStorage.removeItem(ACTIVE_COPRO_KEY);
      return true;
    }
    return false;
  }
  function optionLabel(c){
    return [c.code || c.copro_code || '', c.name || ''].filter(Boolean).join(' - ') || 'Copropriété';
  }
  function rebuildActiveCoproSelect(){
    if (!stateOk()) return;
    const sel = $id('activeCoproSelect');
    if (!sel) return;
    clearActiveCoproIfOutOfFilter();
    const list = filteredCoprosStrict();
    const prefix = hasManager() ? `Mode global — ${userLabel(managerId())}` : 'Mode global / toutes les copros';
    sel.innerHTML = `<option value="">${esc(prefix)}</option>` + list.map(c => `<option value="${esc(c.id)}">${esc(optionLabel(c))}</option>`).join('');
    sel.value = state.activeCoproId || '';
    const activeName = $id('activeCoproName');
    if (activeName) {
      const c = allCopros().find(x => String(x.id) === String(state.activeCoproId));
      if (c) activeName.textContent = c.name || 'Copropriété';
      else activeName.textContent = hasManager() ? `Mode global — ${userLabel(managerId())}` : 'Mode global';
    }
  }
  function managerOptionsHtml(selected){
    const users = stateOk() ? ((state.userProfiles || []).filter(u => u.active !== false)) : [];
    return '<option value="">Tous les gestionnaires</option>' + users.map(u => {
      const label = [u.display_name || u.email || 'Utilisateur', (u.display_name && u.email) ? u.email : ''].filter(Boolean).join(' — ');
      return `<option value="${esc(u.id)}" ${String(selected||'')===String(u.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
  }
  function refreshManagerSelects(){
    if (!stateOk()) return;
    const current = managerId();
    document.querySelectorAll('#activeManagerFilter, [data-v3231-manager-filter] select').forEach(sel => {
      if (!sel) return;
      sel.innerHTML = managerOptionsHtml(current);
      sel.value = current;
    });
  }
  function rebuildCoproSelect(sel){
    if (!stateOk() || !sel) return;
    const current = sel.value || '';
    const list = state.activeCoproId ? allCopros().filter(c => String(c.id) === String(state.activeCoproId)) : filteredCoprosStrict();
    const label = state.activeCoproId ? 'Copropriété active' : (hasManager() ? `Toutes les copros de ${userLabel(managerId())}` : 'Toutes les copropriétés');
    sel.innerHTML = `<option value="">${esc(label)}</option>` + list.map(c => `<option value="${esc(c.id)}">${esc(optionLabel(c))}</option>`).join('');
    sel.value = current && list.some(c => String(c.id) === String(current)) ? current : (state.activeCoproId || '');
  }
  function refreshModuleCoproFilters(){
    const ids = ['queueFilterCopro','ocrCoproFilter','paymentCoproFilter','callDispatchCoproFilter','codaFilterCopro','v28CodaCoproFilter','callsCoproFilter','thirdBalanceCoproFilter','budgetCoproFilter','settlementCoproFilter','financialLedgerCopro','expensesCoproFilter','v28AccountLookupCopro','v28MeterCopro','informCoproFilter','sendLogCoproFilter','ownersFilterCopro','lotsFilterCopro','distributionCopro','bankAccountCopro'];
    ids.forEach(id => rebuildCoproSelect($id(id)));
  }
  function sanitizeSidebarIcons(){
    document.querySelectorAll('.nav-icon,.menu-group__icon,.sidebar-action-icon').forEach(el => {
      if (el.dataset.v3233IconStable !== '1') {
        el.textContent = '';
        el.setAttribute('aria-hidden','true');
        el.dataset.v3233IconStable = '1';
      }
    });
  }
  function renderCoprosStrict(){
    if (!stateOk()) return;
    const tbl = $id('coprosTable');
    if (!tbl) return;
    const rows = filteredCoprosStrict();
    const managerText = hasManager() ? userLabel(managerId()) : 'Tous les gestionnaires';
    tbl.innerHTML = `
      <div class="v3233-filter-note"><strong>${esc(rows.length)} copropriété(s)</strong> affichée(s) — Gestionnaire : ${esc(managerText)}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Nom</th><th>Adresse</th><th>BCE</th><th>Gestionnaire</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(c => `
            <tr>
              <td>${(c.code || c.copro_code) ? `<span class="code-pill">${esc(c.code || c.copro_code)}</span>` : '<span class="muted-inline">À définir</span>'}</td>
              <td><strong>${esc(c.name || '')}</strong></td>
              <td>${esc(c.address || '')}</td>
              <td>${esc(c.bce || '')}</td>
              <td>${esc(userLabel(c.manager_user_id || c.manager_id || ''))}</td>
              <td>${c.active === false ? '<span class="badge">Inactive</span>' : '<span class="badge ok">Active</span>'}</td>
              <td><div class="actions-inline"><button class="btn secondary small" type="button" data-enter-copro="${esc(c.id)}">Entrer</button><button class="btn small" type="button" data-v322-copro-settings="${esc(c.id)}">Réglages</button></div></td>
            </tr>`).join('') : '<tr><td colspan="7"><div class="v3233-empty-state">Aucune copropriété pour ce gestionnaire.</div></td></tr>'}
        </tbody>
      </table></div>`;
  }
  function applyStrictManagerUi(){
    if (busy) return;
    busy = true;
    safe(() => {
      clearActiveCoproIfOutOfFilter();
      refreshManagerSelects();
      rebuildActiveCoproSelect();
      refreshModuleCoproFilters();
      sanitizeSidebarIcons();
      const badge = document.querySelector('.app-version-badge');
      if (badge) badge.textContent = VERSION;
    }, 'apply strict manager ui');
    busy = false;
  }
  function patchRenderFunction(name, after){
    safe(() => {
      const old = window[name] || eval('typeof '+name+' !== "undefined" ? '+name+' : null');
      if (typeof old !== 'function' || old.__v3233) return;
      const patched = function(){
        const res = old.apply(this, arguments);
        after && after();
        applyStrictManagerUi();
        return res;
      };
      patched.__v3233 = true;
      try { eval(name + ' = patched'); } catch(e) { window[name] = patched; }
    }, 'patch '+name);
  }
  function patchCoprosRenderer(){
    safe(() => {
      const old = window.renderCopros || eval('typeof renderCopros !== "undefined" ? renderCopros : null');
      if (typeof old !== 'function' || old.__v3233Strict) return;
      const patched = function(){
        if (hasManager()) renderCoprosStrict();
        else old.apply(this, arguments);
        applyStrictManagerUi();
      };
      patched.__v3233Strict = true;
      try { renderCopros = patched; } catch(e) { window.renderCopros = patched; }
    }, 'patch copros renderer');
  }
  function installManagerChangeHandler(){
    document.addEventListener('change', (ev) => {
      const target = ev.target;
      if (!target || !(target.id === 'activeManagerFilter' || target.closest?.('[data-v3231-manager-filter]'))) return;
      if (!stateOk()) return;
      const value = target.value || '';
      state.managerFilterUserId = value;
      if (value) localStorage.setItem(MANAGER_KEY, value); else localStorage.removeItem(MANAGER_KEY);
      clearActiveCoproIfOutOfFilter();
      if (typeof renderAll === 'function') renderAll();
      setTimeout(applyStrictManagerUi, 0);
    }, true);
  }
  function init(){
    safe(() => {
      window.WAPI_ONE_VERSION = 'V32.3.3';
      patchRenderFunction('renderActiveCoproContext');
      patchRenderFunction('renderAll');
      patchCoprosRenderer();
      installManagerChangeHandler();
      applyStrictManagerUi();
      setTimeout(applyStrictManagerUi, 300);
      setTimeout(applyStrictManagerUi, 1200);
    }, 'init');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
