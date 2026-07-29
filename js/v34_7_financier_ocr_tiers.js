/* WAPI One V34.7 — Tiers, Financier strict par copro, OCR récurrent. */
(function () {
  'use strict';

  window.WAPI_ONE_VERSION = 'V34.7 — Stabilisation financière';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = (value) => Number(value || 0);
  let showInactiveOwnersV347 = false;

  function currentCoproId() {
    return state.activeCoproId || '';
  }

  function ownerIsActive(owner) {
    return owner.active !== false && (state.lots || []).some((lot) =>
      lot.owner_id === owner.id && lot.active !== false &&
      (!currentCoproId() || lot.copro_id === currentCoproId()));
  }

  function ownerBelongsToCopro(owner, coproId) {
    if (!coproId) return true;
    return owner.copro_id === coproId ||
      (state.lots || []).some((lot) => lot.copro_id === coproId && lot.owner_id === owner.id);
  }

  function formatAddress(row) {
    return [
      [row.street, row.street_number].filter(Boolean).join(' '),
      [row.postal_code, row.city].filter(Boolean).join(' '),
      row.country
    ].filter(Boolean).join(', ') || row.address || '';
  }

  function setIdentityTabs(type) {
    document.querySelectorAll('[data-identity-type]').forEach((button) => {
      button.classList.toggle('active', button.dataset.identityType === type);
      button.setAttribute('aria-selected', button.dataset.identityType === type ? 'true' : 'false');
    });
  }

  function renderTiersV347() {
    const host = $('ownersTable');
    if (!host) return;
    const type = state.selectedIdentityType || 'owner';
    const coproId = currentCoproId() || $('ownersFilterCopro')?.value || '';
    setIdentityTabs(type);

    if (type === 'owner') {
      let rows = (state.owners || []).filter((owner) => ownerBelongsToCopro(owner, coproId));
      if (!showInactiveOwnersV347) rows = rows.filter(ownerIsActive);
      const activeCount = rows.filter(ownerIsActive).length;
      host.innerHTML = `
        <div class="v347-tier-toolbar">
          <div><strong>${rows.length} copropriétaire(s)</strong><div class="muted-note">${showInactiveOwnersV347 ? `${activeCount} actif(s), ${rows.length-activeCount} non actif(s)` : 'Copropriétaires actifs'}</div></div>
          <div class="actions-inline">
            <label><input id="v347ShowInactiveOwners" type="checkbox" ${showInactiveOwnersV347 ? 'checked' : ''}> Afficher aussi les copropriétaires non actifs</label>
            <button class="btn secondary" id="v344GenerateAllVcs" type="button">Générer les VCS manquantes</button>
          </div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>VCS</th><th>Email</th><th>Adresse</th><th>Statut</th><th></th></tr></thead>
        <tbody>${rows.map((owner) => `<tr>
          <td><span class="code-pill">${esc(owner.owner_code || '—')}</span></td>
          <td>${esc(owner.display_name || '')}</td><td><code>${esc(owner.vcs || 'À générer')}</code></td>
          <td>${esc(owner.email || '')}</td><td>${esc(formatAddress(owner))}</td>
          <td>${ownerIsActive(owner) ? '<span class="badge ok">Actif</span>' : '<span class="badge">Non actif</span>'}</td>
          <td><button class="btn secondary small" data-open-identity="owner|${owner.id}" type="button">Ouvrir</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="v347-empty">Aucun copropriétaire dans cette vue.</td></tr>'}</tbody></table></div>`;
      return;
    }

    if (type === 'supplier') {
      const usedIds = new Set((state.invoices || []).filter((invoice) => !coproId || invoice.copro_id === coproId).map((invoice) => invoice.supplier_id));
      const rows = (state.suppliers || []).filter((supplier) => !coproId || supplier.copro_id === coproId || usedIds.has(supplier.id));
      host.innerHTML = `<div class="v347-tier-toolbar"><strong>${rows.length} fournisseur(s)</strong><button class="btn" data-add-identity="supplier" type="button">Nouveau fournisseur</button></div>
        <div class="table-wrap"><table><thead><tr><th>Code</th><th>Fournisseur</th><th>TVA</th><th>Email</th><th>IBAN</th><th>Adresse</th><th></th></tr></thead><tbody>
        ${rows.map((supplier) => `<tr><td><span class="code-pill">${esc(supplier.supplier_code || '—')}</span></td><td>${esc(supplier.name || '')}</td><td>${esc(supplier.vat_number || '')}</td><td>${esc(supplier.email || '')}</td><td>${esc(supplier.iban || '')}</td><td>${esc(formatAddress(supplier))}</td><td><button class="btn secondary small" data-open-identity="supplier|${supplier.id}" type="button">Ouvrir</button></td></tr>`).join('') || '<tr><td colspan="7" class="v347-empty">Aucun fournisseur.</td></tr>'}
        </tbody></table></div>`;
      return;
    }

    const lotIds = new Set((state.lots || []).filter((lot) => !coproId || lot.copro_id === coproId).map((lot) => lot.id));
    const rows = (state.occupants || []).filter((occupant) => !coproId || occupant.copro_id === coproId || lotIds.has(occupant.lot_id));
    host.innerHTML = `<div class="v347-tier-toolbar"><strong>${rows.length} occupant(s)</strong><button class="btn" data-add-identity="occupant" type="button">Nouvel occupant</button></div>
      <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th></th></tr></thead><tbody>
      ${rows.map((occupant) => `<tr><td>${esc(occupant.display_name || '')}</td><td>${esc(occupant.email || '')}</td><td>${esc(occupant.phone || '')}</td><td>${esc(formatAddress(occupant))}</td><td><button class="btn secondary small" data-open-identity="occupant|${occupant.id}" type="button">Ouvrir</button></td></tr>`).join('') || '<tr><td colspan="5" class="v347-empty">Aucun occupant.</td></tr>'}
      </tbody></table></div>`;
  }

  function accountsForCopro(coproId) {
    if (!coproId) return [];
    return (state.bankAccounts || []).filter((account) =>
      account.copro_id === coproId && account.active !== false);
  }

  function accountLabel(account) {
    return [account.account_code, account.label, account.iban].filter(Boolean).join(' — ');
  }

  function strictAccountOptions(selected = '') {
    const coproId = currentCoproId();
    const rows = accountsForCopro(coproId);
    return '<option value="">Choisir le compte bancaire de cette copropriété…</option>' +
      rows.map((account) => `<option value="${account.id}" ${account.id === selected ? 'selected' : ''}>${esc(accountLabel(account))}</option>`).join('');
  }

  function installFinancialContext() {
    const manualPane = $('bankPaneManual');
    if (manualPane && !$('v347FinancialContext')) {
      const copro = (state.copros || []).find((item) => item.id === currentCoproId());
      manualPane.insertAdjacentHTML('afterbegin', `<div class="v347-financial-context" id="v347FinancialContext"><span class="status-dot"></span><span>Contexte financier : <strong>${esc(copro?.name || 'sélectionne une copropriété')}</strong>. Seuls ses comptes bancaires sont autorisés.</span></div>`);
    }
  }

  function enforceBankSelectors() {
    const coproId = currentCoproId();
    const copro = (state.copros || []).find((item) => item.id === coproId);
    const context = $('v347FinancialContext');
    if (context) context.innerHTML = `<span class="status-dot"></span><span>Contexte financier : <strong>${esc(copro?.name || 'sélectionne une copropriété')}</strong>. Seuls ses comptes bancaires sont autorisés.</span>`;
    const accountSelect = $('manualModalAccount');
    if (accountSelect) {
      const previous = accountSelect.value;
      accountSelect.innerHTML = strictAccountOptions(previous);
      if (!accountsForCopro(coproId).some((account) => account.id === previous)) accountSelect.value = '';
    }
    const statementSelect = $('bankTxStatement');
    if (statementSelect) {
      const previous = statementSelect.value;
      const statements = (state.bankStatements || []).filter((statement) => statement.copro_id === coproId);
      statementSelect.innerHTML = '<option value="">Choisir un extrait de cette copropriété…</option>' +
        statements.map((statement) => `<option value="${statement.id}">${esc(statement.statement_number || statement.file_name || 'Extrait')}</option>`).join('');
      if (statements.some((statement) => statement.id === previous)) statementSelect.value = previous;
    }
    const ledgerCopro = $('financialLedgerCopro');
    if (ledgerCopro && coproId) {
      ledgerCopro.value = coproId;
      ledgerCopro.disabled = true;
      ledgerCopro.title = 'Le grand livre suit la copropriété active.';
    } else if (ledgerCopro) {
      ledgerCopro.disabled = false;
      ledgerCopro.title = '';
    }
    const ledgerAccount = $('financialLedgerAccount');
    if (ledgerAccount) {
      const previous = ledgerAccount.value;
      const rows = accountsForCopro(coproId || ledgerCopro?.value || '');
      ledgerAccount.innerHTML = '<option value="">Tous les comptes bancaires de la copropriété</option>' +
        rows.map((account) => `<option value="${account.id}">${esc(accountLabel(account))}</option>`).join('');
      if (rows.some((account) => account.id === previous)) ledgerAccount.value = previous;
    }
    const codaCopro = $('codaFilterCopro');
    if (codaCopro && coproId) {
      codaCopro.value = coproId;
      codaCopro.disabled = true;
      codaCopro.title = 'La validation CODA suit la copropriété active.';
    } else if (codaCopro) {
      codaCopro.disabled = false;
      codaCopro.title = '';
    }
  }

  /* Renforce l'extraction sans remplacer le moteur existant : les variantes
     fréquentes de date, total TVAC et numéro de document complètent seulement
     les champs qui n'ont pas été reconnus. */
  const previousInvoiceExtractor = window.extractInvoiceFieldsV13;
  if (typeof previousInvoiceExtractor === 'function') {
    window.extractInvoiceFieldsV13 = function (text, fileName) {
      const result = previousInvoiceExtractor.apply(this, arguments) || {};
      const flat = `${fileName || ''}\n${text || ''}`.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
      const parseMoney = (raw) => {
        if (!raw) return '';
        let value = String(raw).replace(/[€\s']/g, '');
        if (value.includes(',') && value.includes('.')) {
          value = value.lastIndexOf(',') > value.lastIndexOf('.') ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
        } else value = value.replace(',', '.');
        const number = Number(value.replace(/[^0-9.-]/g, ''));
        return Number.isFinite(number) ? number : '';
      };
      const totalPatterns = [
        /(?:total\s+(?:à|a)\s+payer|net\s+(?:à|a)\s+payer|total\s+tvac|montant\s+tvac|grand\s+total|total\s+ttc)\D{0,24}([0-9][0-9 .']*(?:[,.][0-9]{2}))/i,
        /([0-9][0-9 .']*(?:[,.][0-9]{2}))\s*(?:EUR|€)\s*(?:à|a)\s*payer/i
      ];
      if (!result.amount) {
        for (const pattern of totalPatterns) {
          const match = flat.match(pattern);
          if (match) { result.amount = parseMoney(match[1]); break; }
        }
      }
      if (!result.reference) {
        const match = flat.match(/(?:réf(?:érence)?|reference|document|facture|invoice)\s*(?:n[°o.]?|nr|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/_\-.]{2,})/i);
        if (match) result.reference = match[1];
      }
      if (!result.date) {
        const match = flat.match(/(?:date\s+(?:de\s+)?facture|invoice\s+date|date\s+document)\D{0,12}([0-3]?\d[\/.\-][01]?\d[\/.\-](?:20)?\d{2})/i);
        if (match && typeof normalizeDateV13 === 'function') result.date = normalizeDateV13(match[1]);
      }
      return result;
    };
  }

  function recurringSignature(queue) {
    const item = (state.importItems || []).find((candidate) => candidate.id === queue.item_id) || {};
    const data = {...(queue.extracted_data || {}), ...(queue.corrected_data || {})};
    return {
      item, data,
      coproId: queue.copro_id || data.copro_id || item.detected_copro_id || '',
      supplierId: data.supplier_id || item.detected_supplier_id || '',
      accountId: data.account_id || '',
      value: amount(data.amount),
      reference: String(data.reference || '').trim()
    };
  }

  function isSafeRecurring(queue) {
    const signature = recurringSignature(queue);
    if (!signature.coproId || !signature.supplierId || !signature.accountId || signature.value <= 0 || !signature.reference || !signature.data.date) return false;
    const duplicate = (state.invoices || []).some((invoice) =>
      invoice.copro_id === signature.coproId && invoice.supplier_id === signature.supplierId &&
      String(invoice.invoice_number || '').trim().toLowerCase() === signature.reference.toLowerCase());
    if (duplicate) return false;
    const history = (state.invoices || []).filter((invoice) =>
      invoice.copro_id === signature.coproId && invoice.supplier_id === signature.supplierId &&
      invoice.account_id === signature.accountId &&
      Math.abs(amount(invoice.amount_total) - signature.value) < .01);
    return history.length >= 2;
  }

  function installRecurringToolbar() {
    const workbench = $('invoiceOcrWorkbench');
    if (!workbench || $('v347RecurringBatch')) return;
    const safe = (state.validationQueue || []).filter((queue) => {
      const item = (state.importItems || []).find((candidate) => candidate.id === queue.item_id) || {};
      return (queue.target_type || item.import_type) === 'invoice' &&
        !['validated', 'rejected'].includes(queue.status) && isSafeRecurring(queue);
    });
    workbench.insertAdjacentHTML('beforebegin', `<div class="v347-ocr-batch" id="v347RecurringBatch">
      <div><strong>Factures récurrentes reconnues</strong><div class="muted-note">${safe.length} facture(s) correspondent exactement à l’historique et sont sans doublon.</div></div>
      <button class="btn" id="v347ValidateRecurring" type="button" ${safe.length ? '' : 'disabled'}>Valider les récurrentes sûres</button>
    </div>`);
    safe.forEach((queue) => document.querySelector(`[data-select-ocr="${queue.id}"]`)?.classList.add('v347-recurring-safe'));
  }

  async function validateSafeRecurring() {
    const safe = (state.validationQueue || []).filter((queue) => {
      const item = (state.importItems || []).find((candidate) => candidate.id === queue.item_id) || {};
      return (queue.target_type || item.import_type) === 'invoice' &&
        !['validated', 'rejected'].includes(queue.status) && isSafeRecurring(queue);
    });
    if (!safe.length) return alert('Aucune facture récurrente suffisamment sûre.');
    if (!confirm(`Valider ${safe.length} facture(s) récurrente(s) ?\n\nChaque facture a été comparée à l’historique et contrôlée contre les doublons.`)) return;
    let done = 0;
    for (const queue of safe) {
      const signature = recurringSignature(queue);
      try {
        await createInvoiceFromQueue(queue, signature.item, signature.data);
        await supabaseClient.from('compta_validation_queue').update({
          status:'validated', validated_by:currentUser.id, validated_at:new Date().toISOString(),
          notes:'Validation groupée — récurrence sûre confirmée par l’historique.'
        }).eq('id', queue.id);
        if (queue.item_id) await supabaseClient.from('compta_import_items').update({status:'validated'}).eq('id', queue.item_id);
        done++;
      } catch (error) {
        console.error('Validation récurrente interrompue', error);
        alert(`${done} facture(s) validée(s). Arrêt sur une anomalie : ${error.message || error}`);
        break;
      }
    }
    await loadAll();
    if (typeof renderInvoiceOcrV13 === 'function') renderInvoiceOcrV13();
    installRecurringToolbar();
    if (done === safe.length) alert(`${done} facture(s) récurrente(s) validée(s).`);
  }

  const previousRenderAll = window.renderAll;
  if (typeof previousRenderAll === 'function') {
    window.renderAll = function () {
      const result = previousRenderAll.apply(this, arguments);
      setTimeout(() => {
        renderTiersV347();
        installFinancialContext();
        enforceBankSelectors();
        $('v347RecurringBatch')?.remove();
        installRecurringToolbar();
      }, 0);
      return result;
    };
  }

  const previousRenderBank = window.renderBank;
  if (typeof previousRenderBank === 'function') {
    window.renderBank = function () {
      const result = previousRenderBank.apply(this, arguments);
      installFinancialContext();
      enforceBankSelectors();
      return result;
    };
  }

  const previousFinancialLedger = window.renderFinancialLedger;
  if (typeof previousFinancialLedger === 'function') {
    window.renderFinancialLedger = function () {
      const result = previousFinancialLedger.apply(this, arguments);
      enforceBankSelectors();
      return result;
    };
  }

  const previousOpenManual = window.openManualStatementModal;
  if (typeof previousOpenManual === 'function') {
    window.openManualStatementModal = function (statementId) {
      if (!currentCoproId()) {
        alert('Sélectionne d’abord une copropriété. Un extrait ne peut jamais être encodé en mode global.');
        return;
      }
      if (statementId) {
        const statement = (state.bankStatements || []).find((item) => item.id === statementId);
        if (statement && statement.copro_id !== currentCoproId()) {
          alert('Cet extrait appartient à une autre copropriété.');
          return;
        }
      }
      const result = previousOpenManual.apply(this, arguments);
      enforceBankSelectors();
      return result;
    };
  }

  const previousSaveManual = window.saveManualStatementFromModal;
  if (typeof previousSaveManual === 'function') {
    window.saveManualStatementFromModal = async function () {
      const coproId = currentCoproId();
      const account = (state.bankAccounts || []).find((item) => item.id === $('manualModalAccount')?.value);
      if (!coproId) return alert('Sélectionne une copropriété.');
      if (!account || account.copro_id !== coproId) return alert('Compte bancaire invalide : choisis un compte de la copropriété active.');
      return previousSaveManual.apply(this, arguments);
    };
  }

  document.addEventListener('click', (event) => {
    const identityTab = event.target.closest?.('[data-identity-type]');
    if (identityTab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.selectedIdentityType = identityTab.dataset.identityType;
      state.selectedIdentityId = null;
      renderTiersV347();
      return;
    }
    if (event.target.closest?.('#v347ValidateRecurring')) {
      event.preventDefault();
      validateSafeRecurring();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.id === 'v347ShowInactiveOwners') {
      showInactiveOwnersV347 = event.target.checked;
      renderTiersV347();
    }
    if (event.target.id === 'ownersFilterCopro') renderTiersV347();
  }, true);

  function install() {
    renderTiersV347();
    installFinancialContext();
    enforceBankSelectors();
    installRecurringToolbar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 500));
  else setTimeout(install, 500);
})();
