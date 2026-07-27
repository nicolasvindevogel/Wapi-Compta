/* ============================================================
   WAPI One V32.2.1 — Réglages copropriété en popup
   - retire l'onglet Réglages copro des onglets Copropriétés
   - fait fonctionner le bouton Réglages dans la sidebar
   - fait fonctionner le bouton Réglages dans la liste des copros
   ============================================================ */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V32.3 - multi-utilisateurs';

  const $id = (x) => document.getElementById(x);
  const esc = (v) => typeof escapeHtml === 'function'
    ? escapeHtml(v ?? '')
    : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function safe(fn, label='V32.2.1'){
    try { return fn(); } catch(e){ console.warn(label, e); }
  }

  function coproLabel(c){
    return [c?.code || c?.copro_code || c?.optipro_ref || '', c?.name || ''].filter(Boolean).join(' - ');
  }

  function yearLabel(y){
    return [y?.code || y?.year_code || '', y?.label || ''].filter(Boolean).join(' - ');
  }

  function options(list, selected, labelFn, empty='Choisir...'){
    return `<option value="">${esc(empty)}</option>` + (list || []).map(item =>
      `<option value="${esc(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${esc(labelFn(item))}</option>`
    ).join('');
  }

  function account55Options(selected=''){
    const accounts = (state.accounts || []).filter(a => String(a.code || '').startsWith('55'));
    return options(accounts, selected, a => `${a.code || ''} - ${a.label || ''}`, 'Compte comptable banque');
  }

  function activeOrRequestedCoproId(requestedId){
    return requestedId || state.activeCoproId || $id('activeCoproSelect')?.value || (state.copros || [])[0]?.id || '';
  }

  function openModal(title, bodyHtml, footerHtml){
    const backdrop = $id('globalModalBackdrop');
    const modal = $id('globalModal');
    if (!backdrop || !modal || !$id('globalModalBody')) {
      alert('Fenêtre popup indisponible. Recharge la page puis réessaie.');
      return;
    }
    $id('globalModalTitle').textContent = title || 'Réglages copropriété';
    if ($id('globalModalSubtitle')) $id('globalModalSubtitle').textContent = 'Les réglages sont liés à la copropriété sélectionnée.';
    $id('globalModalBody').innerHTML = bodyHtml || '<div class="notice">Aucun contenu.</div>';
    $id('globalModalFooter').innerHTML = footerHtml || '<button class="btn secondary" type="button" data-modal-close>Fermer</button>';
    modal.classList.remove('narrow');
    modal.classList.add('wide');
    backdrop.classList.remove('hidden');
    backdrop.style.display = '';
    backdrop.style.pointerEvents = '';
  }

  function closeModal(){
    const b = $id('globalModalBackdrop');
    if (b) b.classList.add('hidden');
    if ($id('globalModalBody')) $id('globalModalBody').innerHTML = '';
    if ($id('globalModalFooter')) $id('globalModalFooter').innerHTML = '';
  }

  async function loadOptionalSettingsTables(){
    if (!supabaseClient) return;
    async function read(table, select='*'){
      try {
        const { data, error } = await supabaseClient.from(table).select(select);
        if (error) throw error;
        return data || [];
      } catch(e){
        console.warn('Table optionnelle réglages copro', table, e.message || e);
        return [];
      }
    }
    state.v28CoproBankAccounts = state.v28CoproBankAccounts || await read('compta_copro_bank_accounts','*');
    state.v28Folders = state.v28Folders || await read('compta_copro_folders','*');
    state.v28Documents = state.v28Documents || await read('compta_copro_documents','*');
  }

  function settingsBody(coproId){
    const c = (state.copros || []).find(x => String(x.id) === String(coproId)) || {};
    const years = (state.fiscalYears || []).filter(y => !coproId || String(y.copro_id) === String(coproId));
    const selectedYear = state.activeFiscalYearId || $id('activeFiscalYearSelect')?.value || years[0]?.id || '';
    const y = years.find(x => String(x.id) === String(selectedYear)) || {};
    const banks = (state.v28CoproBankAccounts || []).filter(b => String(b.copro_id) === String(coproId));
    const folders = (state.v28Folders || []).filter(f => String(f.copro_id) === String(coproId));
    const folderCards = (folders.length ? folders : [
      {id:'default-acte', name:'Acte de base'},
      {id:'default-roi', name:'ROI'},
      {id:'default-pv', name:'PV AG'},
      {id:'default-contrats', name:'Contrats'}
    ]).map(f => {
      const count = (state.v28Documents || []).filter(d => String(d.folder_id) === String(f.id)).length;
      return `<div class="v3221-folder-card"><strong>${esc(f.name || 'Dossier')}</strong><span>${count} document(s)</span></div>`;
    }).join('');

    const bankRows = banks.map(b => `<tr><td>${esc(b.label || '')}</td><td>${esc(b.iban || '')}</td><td>${esc(b.bic || '')}</td><td>${esc(b.account_code || '')}</td><td>${b.account_type === 'savings' ? 'Épargne' : 'Vue'}</td></tr>`).join('') || '<tr><td colspan="5">Aucun compte bancaire spécifique encodé.</td></tr>';
    const managers = (state.userProfiles || []).filter(u => u.active !== false);
    const managerOptions = options(managers, c.manager_user_id || '', u => `${u.display_name || u.email || 'Utilisateur'}${u.email ? ' — ' + u.email : ''}`, 'Aucun gestionnaire');

    return `
      <div class="v3221-settings-popup">
        <div class="notice compact"><strong>Copropriété :</strong> ${esc(coproLabel(c) || 'Non sélectionnée')}</div>
        <div class="form-grid">
          <label>Code copropriété <input id="v3221CoproCode" value="${esc(c.code || c.copro_code || '')}" placeholder="Ex. ALB"></label>
          <label>Nom copropriété <input id="v3221CoproName" value="${esc(c.name || '')}"></label>
          <label>BCE <input id="v3221CoproBce" value="${esc(c.bce || '')}" placeholder="BE...."></label>
          <label>Gestionnaire <select id="v3221CoproManagerUser">${managerOptions}</select><small class="muted-note">Liste issue des utilisateurs Supabase Auth.</small></label>
          <label style="grid-column:1/-1;">Adresse <textarea id="v3221CoproAddress" rows="2">${esc(c.address || '')}</textarea></label>
          <label>Exercice <select id="v3221FiscalYearSelect">${options(years, y.id || selectedYear, yearLabel, 'Exercice')}</select></label>
          <label>Code exercice <input id="v3221FiscalYearCode" value="${esc(y.code || y.year_code || '')}" placeholder="EX26"></label>
          <label>Dernier n° facture interne <input id="v3221LastInternalInvoiceNo" type="number" min="0" value="${Number(y.last_internal_invoice_no || 0)}"></label>
        </div>
        <hr>
        <div class="toolbar compact"><h3>Comptes bancaires de la copropriété</h3><button class="btn secondary small" id="v3221AddBankInlineBtn" type="button">+ Ajouter compte</button></div>
        <div class="v3221-inline-bank hidden" id="v3221BankForm">
          <div class="form-grid">
            <label>Libellé <input id="v3221BankLabel" placeholder="Compte à vue / Réserve"></label>
            <label>IBAN <input id="v3221BankIban" placeholder="BE..."></label>
            <label>BIC <input id="v3221BankBic" placeholder="GKCCBEBB"></label>
            <label>Compte comptable <select id="v3221BankAccountAccounting">${account55Options('')}</select></label>
            <label>Type <select id="v3221BankType"><option value="current">Compte à vue</option><option value="savings">Compte épargne</option></select></label>
          </div>
          <div class="top-actions"><button class="btn small" id="v3221SaveBankBtn" type="button">Ajouter le compte</button></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Libellé</th><th>IBAN</th><th>BIC</th><th>Compte</th><th>Type</th></tr></thead><tbody>${bankRows}</tbody></table></div>
        <hr>
        <div class="toolbar compact"><h3>Documents copropriété</h3><button class="btn secondary small" id="v3221AddFolderBtn" type="button">+ Dossier</button></div>
        <div class="v3221-folder-grid">${folderCards}</div>
      </div>
    `;
  }

  async function openCoproSettingsPopup(coproId){
    coproId = activeOrRequestedCoproId(coproId);
    if (!coproId) return alert('Choisis d’abord une copropriété.');
    await loadOptionalSettingsTables();
    if (typeof setActiveCopro === 'function') setActiveCopro(coproId);
    openModal('Réglages copropriété', settingsBody(coproId), `
      <button class="btn secondary" type="button" data-modal-close>Fermer</button>
      <button class="btn" id="v3221SaveCoproSettingsBtn" type="button">Enregistrer réglages</button>
    `);
    bindSettingsPopup(coproId);
  }

  function bindSettingsPopup(coproId){
    $id('v3221FiscalYearSelect')?.addEventListener('change', () => {
      const years = (state.fiscalYears || []).filter(y => String(y.copro_id) === String(coproId));
      const y = years.find(x => String(x.id) === String($id('v3221FiscalYearSelect').value)) || {};
      if ($id('v3221FiscalYearCode')) $id('v3221FiscalYearCode').value = y.code || y.year_code || '';
      if ($id('v3221LastInternalInvoiceNo')) $id('v3221LastInternalInvoiceNo').value = Number(y.last_internal_invoice_no || 0);
    });
    $id('v3221AddBankInlineBtn')?.addEventListener('click', () => $id('v3221BankForm')?.classList.toggle('hidden'));
    $id('v3221SaveBankBtn')?.addEventListener('click', () => addBankFromPopup(coproId));
    $id('v3221AddFolderBtn')?.addEventListener('click', () => addFolderFromPopup(coproId));
    $id('v3221SaveCoproSettingsBtn')?.addEventListener('click', () => saveSettingsPopup(coproId));
  }

  async function saveSettingsPopup(coproId){
    if (!supabaseClient) return alert('Supabase non connecté.');
    const managerId = ($id('v3221CoproManagerUser')?.value || '').trim();
    const manager = (state.userProfiles || []).find(u => String(u.id) === String(managerId)) || null;
    const payload = {
      code: ($id('v3221CoproCode')?.value || '').trim(),
      name: ($id('v3221CoproName')?.value || '').trim(),
      bce: ($id('v3221CoproBce')?.value || '').trim(),
      address: ($id('v3221CoproAddress')?.value || '').trim(),
      manager_user_id: managerId || null,
      manager_name: manager ? (manager.display_name || manager.email || '') : ''
    };
    if (!payload.name) return alert('Le nom de la copropriété est obligatoire.');
    let res = await supabaseClient.from('compta_copros').update(payload).eq('id', coproId);
    if (res.error) return alert(res.error.message);
    const yearId = $id('v3221FiscalYearSelect')?.value || '';
    if (yearId) {
      res = await supabaseClient.from('compta_fiscal_years').update({
        code: ($id('v3221FiscalYearCode')?.value || '').trim(),
        last_internal_invoice_no: Number($id('v3221LastInternalInvoiceNo')?.value || 0)
      }).eq('id', yearId);
      if (res.error) return alert(res.error.message);
    }
    if (typeof loadAll === 'function') await loadAll();
    await openCoproSettingsPopup(coproId);
    alert('Réglages copropriété enregistrés.');
  }

  async function addBankFromPopup(coproId){
    const iban = ($id('v3221BankIban')?.value || '').trim();
    if (!iban) return alert('IBAN obligatoire.');
    const accId = $id('v3221BankAccountAccounting')?.value || null;
    const acc = (state.accounts || []).find(a => String(a.id) === String(accId)) || {};
    const payload = {
      copro_id: coproId,
      label: ($id('v3221BankLabel')?.value || '').trim() || 'Compte bancaire',
      iban,
      bic: ($id('v3221BankBic')?.value || '').trim(),
      account_id: accId,
      account_code: acc.code || '',
      account_type: $id('v3221BankType')?.value || 'current',
      active: true
    };
    const { error } = await supabaseClient.from('compta_copro_bank_accounts').insert(payload);
    if (error) return alert(error.message);
    state.v28CoproBankAccounts = null;
    await openCoproSettingsPopup(coproId);
  }

  async function addFolderFromPopup(coproId){
    const name = prompt('Nom du dossier');
    if (!name) return;
    const { error } = await supabaseClient.from('compta_copro_folders').insert({ copro_id: coproId, name: name.trim() });
    if (error) return alert(error.message);
    state.v28Folders = null;
    await openCoproSettingsPopup(coproId);
  }

  function hideOldCoproSettingsEntry(){
    safe(() => {
      document.querySelectorAll('.module-tab[data-view="coproSettings"], button[data-view="coproSettings"]').forEach(el => el.remove());
      const view = $id('coproSettingsView');
      if (view) view.classList.add('hidden');
      if (document.querySelector('.view:not(.hidden)')?.id === 'coproSettingsView' && typeof switchToView === 'function') switchToView('copros');
    });
  }

  function installCoproSettingsPopupPatch(){
    if (window.__wapiV3221CoproSettingsPopup) return;
    window.__wapiV3221CoproSettingsPopup = true;
    window.openCoproSettingsPopupV3221 = openCoproSettingsPopup;

    // Si un ancien code tente d’ouvrir la vue Réglages copro, on ouvre le popup à la place.
    safe(() => {
      if (typeof switchToView === 'function' && !switchToView.__v3221Patched) {
        const oldSwitch = switchToView;
        const patched = function(viewName){
          if (viewName === 'coproSettings') {
            openCoproSettingsPopup(activeOrRequestedCoproId());
            return;
          }
          return oldSwitch.apply(this, arguments);
        };
        patched.__v3221Patched = true;
        switchToView = patched;
      }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-v322-copro-settings], #activeCoproSettingsBtn, [data-open-copro-settings]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const coproId = btn.dataset.v322CoproSettings || btn.dataset.openCoproSettings || activeOrRequestedCoproId();
      openCoproSettingsPopup(coproId);
    }, true);

    document.addEventListener('click', (e) => {
      if (e.target?.matches?.('[data-modal-close]')) closeModal();
    }, true);

    setTimeout(hideOldCoproSettingsEntry, 300);
    setTimeout(hideOldCoproSettingsEntry, 900);
    setTimeout(hideOldCoproSettingsEntry, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCoproSettingsPopupPatch, { once:true });
  else installCoproSettingsPopupPatch();
})();
