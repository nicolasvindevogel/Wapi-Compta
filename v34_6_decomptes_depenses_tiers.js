/* WAPI One V34.3.1 — Balance des tiers et mémorisation de l'écran */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const htmlEscape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const formatMoney = (value) => typeof safeMoney === 'function'
    ? safeMoney(Number(value || 0))
    : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

  function currentThirdRowsV343() {
    if (Array.isArray(window.v29CurrentThirdRows)) return window.v29CurrentThirdRows;
    if (typeof rowsForCurrentThirdBalanceV11 === 'function') return rowsForCurrentThirdBalanceV11();
    return [];
  }

  function tierRecordV343(row) {
    if (!row) return null;
    return row.type === 'owner'
      ? (state.owners || []).find((item) => String(item.id) === String(row.id))
      : (state.suppliers || []).find((item) => String(item.id) === String(row.id));
  }

  function selectedCoproV343(record) {
    const coproId = state.activeCoproId || byId('thirdBalanceCoproFilter')?.value || record?.copro_id || '';
    return (state.copros || []).find((item) => String(item.id) === String(coproId)) || null;
  }

  function selectedYearV343() {
    const yearId = byId('thirdBalanceYearFilter')?.value || '';
    return (state.fiscalYears || []).find((item) => String(item.id) === String(yearId))
      || (state.fiscalYears || []).find((item) => !state.activeCoproId || item.copro_id === state.activeCoproId)
      || null;
  }

  function tierCodeV343(row, record) {
    return row.type === 'owner'
      ? (record?.owner_code || record?.code || '')
      : (record?.supplier_code || record?.code || '');
  }

  function detailsTableV343(row) {
    const lines = (row.details || []).map((detail) => `
      <tr>
        <td>${htmlEscape(detail.date || '')}</td>
        <td>${htmlEscape(detail.label || '')}</td>
        <td>${detail.debit ? formatMoney(detail.debit) : ''}</td>
        <td>${detail.credit ? formatMoney(detail.credit) : ''}</td>
      </tr>`).join('');
    return `
      <div class="v343-third-table table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Libellé</th><th>Débit</th><th>Crédit</th></tr></thead>
          <tbody>${lines || '<tr><td colspan="4">Aucun mouvement dans la période sélectionnée.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function openThirdSituationV343(key) {
    const [type, id] = String(key || '').split('|');
    const row = currentThirdRowsV343().find((item) => item.type === type && String(item.id) === String(id));
    if (!row) return alert('La situation de ce tiers n’est plus disponible dans le filtre actuel.');

    const record = tierRecordV343(row);
    const copro = selectedCoproV343(record);
    const year = selectedYearV343();
    const code = tierCodeV343(row, record);
    const totalDebit = (row.details || []).reduce((sum, item) => sum + Number(item.debit || 0), 0);
    const totalCredit = (row.details || []).reduce((sum, item) => sum + Number(item.credit || 0), 0);
    const isDebit = Number(row.balance || 0) >= 0;

    const body = `
      <div class="popup-form">
        <div class="v343-third-modal-summary">
          <div class="v343-third-metric">
            <span>Tiers</span>
            <strong class="v343-third-identity">${code ? `<em class="v343-third-code">${htmlEscape(code)}</em>` : ''}${htmlEscape(row.name || '')}</strong>
          </div>
          <div class="v343-third-metric">
            <span>Contexte</span>
            <strong>${htmlEscape(copro?.name || 'Toutes les copropriétés')}</strong>
            <small>${htmlEscape(year?.label || 'Période sélectionnée')}</small>
          </div>
          <div class="v343-third-metric ${isDebit ? 'is-debit' : 'is-credit'}">
            <span>${isDebit ? 'Solde débiteur' : 'Solde créditeur'}</span>
            <strong>${formatMoney(Math.abs(Number(row.balance || 0)))}</strong>
          </div>
        </div>
        ${detailsTableV343(row)}
        <div class="v343-third-total">
          <span>Total débit : ${formatMoney(totalDebit)}</span>
          <span>Total crédit : ${formatMoney(totalCredit)}</span>
        </div>
      </div>`;

    const hasEmail = Boolean(record?.email);
    const mailLabel = hasEmail ? 'Préparer l’e-mail' : 'E-mail manquant';
    const footer = `
      <button class="btn secondary" type="button" data-modal-close>Fermer</button>
      <button class="btn secondary" type="button" data-v343-third-pdf="${htmlEscape(key)}">Exporter en PDF</button>
      <button class="btn" type="button" data-v343-third-mail="${htmlEscape(key)}" ${hasEmail ? '' : 'disabled'}>${mailLabel}</button>`;

    const backdrop = byId('globalModalBackdrop');
    if (backdrop) {
      backdrop.style.removeProperty('display');
      backdrop.style.removeProperty('pointer-events');
    }
    openAppModal('Situation de compte', body, footer, {
      subtitle: `${row.labelType || 'Tiers'} — ${row.name || ''}`,
      size: 'wide'
    });
  }

  function printThirdSituationV343(key) {
    const [type, id] = String(key || '').split('|');
    const row = currentThirdRowsV343().find((item) => item.type === type && String(item.id) === String(id));
    if (!row) return alert('Situation de compte introuvable.');
    if (typeof printThirdRowsV11 === 'function') return printThirdRowsV11([row], false);
    alert('L’export PDF n’est pas disponible dans cette version.');
  }

  function prepareThirdMailV343(key) {
    const [type, id] = String(key || '').split('|');
    const row = currentThirdRowsV343().find((item) => item.type === type && String(item.id) === String(id));
    const record = tierRecordV343(row);
    if (!row || !record) return alert('Tiers introuvable.');
    if (!record.email) return alert('Aucune adresse e-mail n’est renseignée pour ce tiers.');

    if (row.type === 'owner' && typeof v22OpenComposer === 'function') {
      const copro = selectedCoproV343(record);
      closeAppModal();
      return v22OpenComposer({
        title: 'Envoyer la situation de compte',
        documentType: 'account_statement',
        documentLabel: 'Situation de compte',
        recipients: [{
          owner: record,
          owner_id: record.id,
          copro,
          copro_id: copro?.id || record.copro_id || null,
          document_type: 'account_statement',
          document_label: 'Situation de compte',
          source_type: 'account_statement',
          source_id: null,
          third_row: row,
          amount: Math.abs(Number(row.balance || 0)),
          metadata: { balance: Number(row.balance || 0) }
        }],
        allowAttachments: true
      });
    }

    const subject = encodeURIComponent(`Situation de compte — ${row.name || ''}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver la situation de compte de ${row.name || ''}.\n\nBien à vous,\nWAPI One`);
    window.location.href = `mailto:${encodeURIComponent(record.email)}?subject=${subject}&body=${body}`;
  }

  function renderThirdBalanceV343() {
    if (!byId('thirdBalanceTable') || typeof thirdRowsFor !== 'function') return;
    if (typeof v29EnsureThirdDateFilters === 'function') v29EnsureThirdDateFilters();

    const coproSelect = byId('thirdBalanceCoproFilter');
    const yearSelect = byId('thirdBalanceYearFilter');
    const keepCopro = state.activeCoproId || coproSelect?.value || '';
    const keepYear = yearSelect?.value || '';
    if (coproSelect) {
      coproSelect.innerHTML = '<option value="">Toutes</option>' + (state.copros || [])
        .map((copro) => `<option value="${htmlEscape(copro.id)}">${htmlEscape(copro.name)}</option>`).join('');
      coproSelect.value = keepCopro;
    }
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">Exercice courant / tous</option>' + (state.fiscalYears || [])
        .filter((year) => !keepCopro || year.copro_id === keepCopro)
        .map((year) => `<option value="${htmlEscape(year.id)}">${htmlEscape(year.label)}</option>`).join('');
      yearSelect.value = keepYear;
    }

    const type = byId('thirdBalanceTypeFilter')?.value || 'all';
    const coproId = state.activeCoproId || coproSelect?.value || '';
    const yearId = yearSelect?.value || '';
    const search = (byId('thirdBalanceSearch')?.value || '').toLowerCase();
    const from = byId('thirdBalanceFrom')?.value || '0000-01-01';
    const to = byId('thirdBalanceTo')?.value || '9999-12-31';
    let rows = thirdRowsFor(type, coproId, yearId)
      .map((row) => {
        const details = (row.details || []).filter((detail) => !detail.date || (detail.date >= from && detail.date <= to));
        const rawBalance = details.reduce((sum, detail) => sum + Number(detail.debit || 0) - Number(detail.credit || 0), 0);
        return { ...row, details, balance: row.type === 'supplier' ? -rawBalance : rawBalance };
      })
      .filter((row) => !search || String(row.name || '').toLowerCase().includes(search));

    const debitTotal = rows.filter((row) => row.balance > 0).reduce((sum, row) => sum + row.balance, 0);
    const creditTotal = rows.filter((row) => row.balance < 0).reduce((sum, row) => sum + Math.abs(row.balance), 0);
    byId('thirdBalanceSummary').innerHTML = `
      <span class="badge">Tiers : ${rows.length}</span>
      <span class="badge warn">Débiteur : ${formatMoney(debitTotal)}</span>
      <span class="badge ok">Créditeur : ${formatMoney(creditTotal)}</span>
      <button class="btn secondary small" data-print-third-selected type="button">PDF sélection</button>
      <button class="btn secondary small" data-v29-send-third-selected type="button">Préparer envoi sélection</button>`;

    byId('thirdBalanceTable').innerHTML = `<div class="table-wrap">${rows.map((row) => `
      <div class="third-balance-row v11">
        <input type="checkbox" data-third-select="${htmlEscape(`${row.type}|${row.id}`)}">
        <div>
          <strong>${htmlEscape(row.name || '')}</strong>
          <div class="muted-note">${htmlEscape(row.labelType || '')}</div>
        </div>
        <div>${row.balance >= 0
          ? '<span class="status-pill-strong red">Débiteur</span>'
          : '<span class="status-pill-strong green">Créditeur</span>'}</div>
        <div class="${row.balance >= 0 ? 'amount-red' : 'amount-green'}">${formatMoney(Math.abs(row.balance))}</div>
        <button class="btn secondary small v343-third-open" data-v343-third-open="${htmlEscape(`${row.type}|${row.id}`)}" type="button">Voir la situation</button>
      </div>`).join('') || '<div class="notice">Aucun tiers à afficher.</div>'}</div>`;
    window.v29CurrentThirdRows = rows;
  }

  if (typeof renderThirdBalance === 'function') renderThirdBalance = renderThirdBalanceV343;
  window.renderThirdBalanceV343 = renderThirdBalanceV343;

  const LAST_VIEW_KEY = 'wapi-one-last-view-v3431';
  const LAST_SYNDIC_TAB_KEY = 'wapi-one-last-syndic-tab-v3431';
  let lastViewRestored = false;

  function visibleViewV3431() {
    const view = [...document.querySelectorAll('.view')].find((item) => !item.classList.contains('hidden'));
    return view?.id?.replace(/View$/, '') || '';
  }

  function saveCurrentViewV3431() {
    const view = visibleViewV3431();
    if (!view || !byId(`${view}View`)) return;
    try {
      localStorage.setItem(LAST_VIEW_KEY, view);
      if (view === 'syndicBilling' && state?.syndicBillingTab) {
        localStorage.setItem(LAST_SYNDIC_TAB_KEY, String(state.syndicBillingTab));
      }
    } catch (_) {}
  }

  function restoreLastViewV3431() {
    if (lastViewRestored || typeof window.switchToView !== 'function') return;
    let view = '';
    let syndicTab = '';
    try {
      view = localStorage.getItem(LAST_VIEW_KEY) || '';
      syndicTab = localStorage.getItem(LAST_SYNDIC_TAB_KEY) || '';
    } catch (_) {}
    if (!view || !byId(`${view}View`)) {
      lastViewRestored = true;
      return;
    }
    if (view === 'syndicBilling' && syndicTab && typeof state === 'object') {
      state.syndicBillingTab = syndicTab;
    }
    lastViewRestored = true;
    window.switchToView(view);
  }

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest?.('[data-v343-third-open]');
    if (openButton) {
      event.preventDefault();
      event.stopPropagation();
      return openThirdSituationV343(openButton.dataset.v343ThirdOpen);
    }
    const pdfButton = event.target.closest?.('[data-v343-third-pdf]');
    if (pdfButton) {
      event.preventDefault();
      return printThirdSituationV343(pdfButton.dataset.v343ThirdPdf);
    }
    const mailButton = event.target.closest?.('[data-v343-third-mail]');
    if (mailButton) {
      event.preventDefault();
      return prepareThirdMailV343(mailButton.dataset.v343ThirdMail);
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-view], [data-w332-module], [data-v331-module], [data-v33-module]')) {
      setTimeout(saveCurrentViewV3431, 0);
    }
  });
  window.addEventListener('beforeunload', saveCurrentViewV3431);

  const previousRenderAll = typeof renderAll === 'function' ? renderAll : null;
  if (previousRenderAll) {
    renderAll = function renderAllV343() {
      previousRenderAll();
      try { renderThirdBalanceV343(); } catch (error) { console.warn('V34.3 balance tiers', error); }
      setTimeout(restoreLastViewV3431, 0);
    };
  }
  setTimeout(restoreLastViewV3431, 1200);
})();
