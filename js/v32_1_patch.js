/* WAPI One V32.1 — patch de stabilisation étape 1
   Objectif : corriger les icônes, afficher la version, tableau de bord clair,
   codes tiers, suppression sécurisée des tiers, recherche compte par libellé.
*/
(function wapiOneV321(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V32.1 - stabilisation étape 1';
  window.WAPI_ONE_BUILD_DATE = '2026-07-25';

  const $id = (id) => document.getElementById(id);
  const esc = (v) => {
    try { return escapeHtml(v ?? ''); }
    catch(e){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  };
  const eur = (v) => {
    try { return money(Number(v || 0)).replace('EUR','€'); }
    catch(e){ return Number(v || 0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'; }
  };
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const cleanCode = (v) => String(v || '').trim();
  function ownerCode(o){ return cleanCode(o?.code || o?.owner_code || o?.third_code || ''); }
  function supplierCode(s){ return cleanCode(s?.code || s?.supplier_code || s?.third_code || ''); }
  function tierCode(type, rec){ return type === 'supplier' ? supplierCode(rec) : type === 'owner' ? ownerCode(rec) : cleanCode(rec?.code || rec?.occupant_code || ''); }
  function tierCodeBadge(type, rec){ const c = tierCode(type, rec); return c ? `<span class="tier-code-badge">${esc(c)}</span>` : '<span class="tier-code-badge muted">code auto</span>'; }

  /* ------------------------------------------------------------------
     1) Icônes définitives : plus aucun emoji/caractère spécial dans la sidebar.
     ------------------------------------------------------------------ */
  const iconPaths = {
    dashboard:'M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-11h7V4h-7v5Z',
    processing:'M4 5h16v4H4V5Zm0 6h16v8H4v-8Zm3 2v4h3v-4H7Z',
    invoiceOcr:'M6 3h9l5 5v13H6V3Zm8 1v5h5',
    payments:'M3 7h18v10H3V7Zm2 3h14',
    callDispatch:'M4 6h16v12H4V6Zm2 3h12M6 13h8',
    sendJournal:'M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h5',
    inform:'M4 11h4l9-5v12l-9-5H4v-2Zm4 2v5',
    bank:'M3 10l9-6 9 6v2H3v-2Zm2 4h2v5H5v-5Zm6 0h2v5h-2v-5Zm6 0h2v5h-2v-5ZM3 20h18',
    copros:'M4 20V9l8-5 8 5v11h-6v-6h-4v6H4Z',
    buildings:'M5 20V4h10v16M15 9h4v11M8 7h2M8 11h2M8 15h2',
    lots:'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
    owners:'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0',
    distribution:'M12 3v4M12 17v4M5 12H3M21 12h-2M7 7l-2-2M19 19l-2-2M17 7l2-2M5 19l2-2M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    works:'M14 4l6 6-10 10H4v-6L14 4Z',
    articles:'M4 7l8-4 8 4-8 4-8-4Zm0 4l8 4 8-4M4 15l8 4 8-4',
    exercises:'M7 3v4M17 3v4M4 8h16M5 5h14v16H5V5Z',
    budgets:'M4 19V5h16v14H4Zm4-10h8M8 13h4M8 17h8',
    calls:'M5 4h14v16H5V4Zm4 4h6M9 12h6M9 16h3',
    invoices:'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm4 5h5M10 12h5M10 16h3',
    eInvoice:'M4 6h16v12H4V6Zm4 4h8M8 14h5',
    financier:'M4 7h16v10H4V7Zm3 3h3M14 13h3',
    od:'M5 4h14v16H5V4Zm3 5h8M8 13h8M8 17h5',
    scheduler:'M7 3v4M17 3v4M4 8h16M7 12h3v3H7v-3Z',
    simulation:'M4 18c4-8 8 2 16-10M5 5h4v4H5V5Zm10 10h4v4h-4v-4Z',
    settlements:'M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h6',
    syndicContracts:'M6 3h12v18H6V3Zm3 5h6M9 12h6M9 16h4',
    syndicServices:'M12 5v14M5 12h14',
    syndicInvoices:'M6 3h12v18H6V3Zm4 6h4M9 14h6',
    syndicSettings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3M12 18v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M3 12h3M18 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1',
    accounts:'M4 5h16v4H4V5Zm0 6h16v8H4v-8Z',
    entries:'M6 4h12v16H6V4Zm3 4h6M9 12h6M9 16h4',
    financialLedger:'M4 7h16v10H4V7Zm2 3h12M8 14h8',
    balance:'M12 4v16M5 8h14M7 8l-3 6h6L7 8Zm10 0l-3 6h6l-3-6Z',
    thirdBalance:'M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0',
    journals:'M5 4h14v16H5V4Zm4 4h6M9 12h6M9 16h5',
    bilan:'M4 5h7v14H4V5Zm9 0h7v14h-7V5Z',
    heldFunds:'M12 3c4 0 7 2 7 5s-3 5-7 5-7-2-7-5 3-5 7-5Zm-7 9c0 3 3 5 7 5s7-2 7-5M5 16c0 3 3 5 7 5s7-2 7-5',
    expensesList:'M6 3h12v18H6V3Zm3 5h6M9 12h6M9 16h5',
    multicoproConsultation:'M10 4a6 6 0 1 0 4.2 10.2L20 20',
    meetings:'M5 4h14v16H5V4Zm4 4h6M8 12h8M8 16h5',
    resolutions:'M6 4h12v16H6V4Zm4 4h4M9 12h6M9 16h6',
    agency:'M4 20V7l8-4 8 4v13H4Zm5-8h6M9 16h6',
    users:'M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0',
    accessControl:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Z',
    bankInstitutions:'M3 10l9-6 9 6v2H3v-2Zm2 4h14v6H5v-6Z',
    propertyTypes:'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
    vatCodes:'M6 18L18 6M7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    journalCodes:'M6 4h12v16H6V4Zm3 5h6M9 13h6M9 17h4',
    defaultExpenseTypes:'M5 5h14v14H5V5Zm4 4h6M9 13h4',
    gdpr:'M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z',
    importsConfig:'M12 3v12M7 10l5 5 5-5M5 20h14',
    templates:'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
    auditTrail:'M5 4h14v16H5V4Zm4 5h6M9 13h4M9 17h6',
    isabel:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3 9h6',
    default:'M5 5h14v14H5V5Z'
  };
  const groupIcons = {
    'Pilotage':'dashboard','Infrastructures':'copros','Comptabilite':'accounts','Facturation syndic':'syndicInvoices','Etats comptables':'balance','Assemblees generales':'meetings','Configuration':'syndicSettings'
  };
  function svg(name){
    const path = iconPaths[name] || iconPaths.default;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
  }
  function patchIcons(){
    document.querySelectorAll('.nav button[data-view]').forEach(btn => {
      const icon = btn.querySelector('.nav-icon'); if(!icon) return;
      const view = btn.dataset.view || 'default';
      if(icon.dataset.v321 === view) return;
      icon.dataset.v321 = view;
      icon.innerHTML = svg(view);
      icon.classList.add('wapi-svg-icon');
    });
    document.querySelectorAll('.menu-group__header').forEach(btn => {
      const icon = btn.querySelector('.menu-group__icon'); if(!icon) return;
      const label = btn.querySelector('.menu-group__text')?.textContent?.trim() || '';
      const key = groupIcons[label] || 'default';
      if(icon.dataset.v321 === key) return;
      icon.dataset.v321 = key;
      icon.innerHTML = svg(key);
      icon.classList.add('wapi-svg-icon');
    });
  }

  /* ------------------------------------------------------------------
     2) Version visible et démarrage plus lisible.
     ------------------------------------------------------------------ */
  function setVersionBadge(){
    document.querySelectorAll('.app-version-badge').forEach(b => b.textContent = window.WAPI_ONE_VERSION);
    if(!document.querySelector('.app-version-badge')){
      const sidebar = document.querySelector('.sidebar') || document.querySelector('aside');
      if(sidebar){
        const badge = document.createElement('div');
        badge.className = 'app-version-badge';
        badge.textContent = window.WAPI_ONE_VERSION;
        sidebar.appendChild(badge);
      }
    }
    document.title = 'WAPI One — V32.1';
  }

  /* ------------------------------------------------------------------
     3) Tableau de bord simple, par copro active ou global.
     ------------------------------------------------------------------ */
  function lotKind(lot){
    const t = norm(lot.lot_type || lot.nature || lot.type || lot.label || lot.lot_number);
    if(t.includes('appart')) return 'appartements';
    if(t.includes('garage') || t.includes('parking') || t.includes('emplacement')) return 'parkings';
    if(t.includes('cave')) return 'caves';
    return 'autres';
  }
  function scopedRows(rows){
    const cid = state?.activeCoproId || '';
    return cid ? (rows || []).filter(r => r.copro_id === cid) : (rows || []);
  }
  function latestStatementForAccount(accountId){
    return (state.bankStatements || [])
      .filter(s => s.bank_account_id === accountId && s.closing_balance !== null && s.closing_balance !== undefined)
      .sort((a,b) => String(b.statement_date || b.created_at || '').localeCompare(String(a.statement_date || a.created_at || '')))[0] || null;
  }
  function dashboardBankInfo(coproId){
    const accounts = (state.bankAccounts || []).filter(a => !coproId || a.copro_id === coproId);
    let total = 0;
    let latest = null;
    accounts.forEach(acc => {
      const st = latestStatementForAccount(acc.id);
      if(st){
        total += Number(st.closing_balance || 0);
        if(!latest || String(st.statement_date || st.created_at || '') > String(latest.statement_date || latest.created_at || '')) latest = st;
      }
    });
    return {total, latest, count:accounts.length};
  }
  function unpaidInvoices(coproId){
    return (state.invoices || []).filter(inv => {
      if(coproId && inv.copro_id !== coproId) return false;
      const ps = inv.payment_status || inv.status || '';
      if(['paid','lettered','reconciled','cancelled','credited','rejected'].includes(ps)) return false;
      if(inv.do_not_pay || inv.ne_pas_payer) return false;
      return true;
    });
  }
  function ownerCountForLots(lots){
    return new Set((lots || []).map(l => l.owner_id).filter(Boolean)).size;
  }
  const oldRenderDashboard = typeof renderDashboard === 'function' ? renderDashboard : null;
  renderDashboard = function(){
    try{
      const panel = $id('dashboardView');
      if(!panel){ if(oldRenderDashboard) oldRenderDashboard(); return; }
      const cid = state.activeCoproId || '';
      const copro = cid ? (state.copros || []).find(c => c.id === cid) : null;
      const lots = scopedRows(state.lots || []);
      const counts = lots.reduce((acc, lot) => { acc[lotKind(lot)]++; return acc; }, {appartements:0, parkings:0, caves:0, autres:0});
      const bank = dashboardBankInfo(cid);
      const invs = unpaidInvoices(cid);
      const invTotal = invs.reduce((s,i) => s + Number(i.amount_total || i.amount || 0), 0);
      const title = copro ? (copro.name || 'Copropriété') : 'Mode global';
      const address = copro ? [copro.address, copro.postal_code, copro.city].filter(Boolean).join(' ') : 'Toutes les copropriétés';
      panel.innerHTML = `
        <div class="dashboard-hero-v321">
          <div><div class="eyebrow">Tableau de bord</div><h2>${esc(title)}</h2><p>${esc(address || 'Adresse non renseignée')}</p></div>
          <div class="dashboard-hero-balance"><span>Solde bancaire</span><strong>${eur(bank.total)}</strong><small>${cid ? (bank.latest ? 'Dernier extrait pris en compte' : 'Aucun extrait encodé') : 'Total des derniers soldes par compte'}</small></div>
        </div>
        <div class="dashboard-grid-v321">
          <div class="dash-card"><span>Total lots</span><strong>${lots.length}</strong></div>
          <div class="dash-card"><span>Appartements</span><strong>${counts.appartements}</strong></div>
          <div class="dash-card"><span>Parkings / garages</span><strong>${counts.parkings}</strong></div>
          <div class="dash-card"><span>Caves</span><strong>${counts.caves}</strong></div>
          <div class="dash-card"><span>Autres lots</span><strong>${counts.autres}</strong></div>
          <div class="dash-card"><span>Copropriétaires</span><strong>${ownerCountForLots(lots)}</strong></div>
          <div class="dash-card highlight"><span>Factures à payer</span><strong>${eur(invTotal)}</strong><small>${invs.length} facture(s)</small></div>
          <div class="dash-card"><span>Comptes bancaires</span><strong>${bank.count}</strong></div>
        </div>
        ${cid ? `<div class="dashboard-last-statement-v321"><strong>Dernier extrait encodé</strong><span>${bank.latest ? `N° ${esc(bank.latest.statement_number || '-')} · ${esc(bank.latest.statement_date || bank.latest.created_at || '')}` : 'Aucun extrait encodé'}</span></div>` : ''}
      `;
    }catch(err){ console.warn('Dashboard V32.1 fallback', err); if(oldRenderDashboard) oldRenderDashboard(); }
  };

  /* ------------------------------------------------------------------
     4) Tiers : codes visibles, onglets fiables, suppression sécurisée.
     ------------------------------------------------------------------ */
  function ownerRowsForCurrentFilter(){
    const selectedCopro = state.activeCoproId || $id('ownersFilterCopro')?.value || '';
    const q = norm($id('identityListSearch')?.value || '');
    return (state.owners || []).filter(o => {
      // Les propriétaires sont globaux/repris via les lots, donc on filtre surtout par les lots liés.
      if(selectedCopro){
        const hasLot = (state.lots || []).some(l => l.copro_id === selectedCopro && l.owner_id === o.id);
        if(!hasLot && o.copro_id !== selectedCopro) return false;
      }
      if(q && !norm([ownerCode(o), o.display_name, o.email, o.phone, o.address].join(' ')).includes(q)) return false;
      return true;
    });
  }
  function supplierRowsForCurrentFilter(){
    const q = norm($id('identityListSearch')?.value || '');
    return (state.suppliers || []).filter(s => !q || norm([supplierCode(s), s.name, s.email, s.vat_number, s.vat, s.iban, s.address].join(' ')).includes(q));
  }
  const oldRenderOwners = typeof renderOwners === 'function' ? renderOwners : null;
  renderOwners = function(){
    try{
      const tableEl = $id('ownersTable'); if(!tableEl){ if(oldRenderOwners) oldRenderOwners(); return; }
      const type = state.selectedIdentityType || 'owner';
      document.querySelectorAll('[data-identity-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.identityType === type));
      let rows = [];
      if(type === 'supplier') rows = supplierRowsForCurrentFilter().map(r => ({...r, _type:'supplier', _name:r.name, _email:r.email, _phone:r.phone || '', _address:r.address || ''}));
      else if(type === 'occupant') rows = (state.occupants || []).map(r => ({...r, _type:'occupant', _name:r.display_name, _email:r.email, _phone:r.phone || '', _address:r.address || ''}));
      else rows = ownerRowsForCurrentFilter().map(r => ({...r, _type:'owner', _name:r.display_name, _email:r.email, _phone:r.phone || '', _address:r.address || ''}));
      tableEl.innerHTML = `<div class="summary-line"><span class="badge">${rows.length} tiers</span><span class="badge">${type === 'supplier' ? 'Fournisseurs' : type === 'occupant' ? 'Occupants' : 'Copropriétaires'}</span></div>
        <div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th>Actions</th></tr></thead><tbody>
        ${rows.map(rec => `<tr><td>${tierCodeBadge(rec._type, rec)}</td><td><strong>${esc(rec._name || '')}</strong></td><td>${esc(rec._email || '')}</td><td>${esc(rec._phone || '')}</td><td>${esc(rec._address || '')}</td><td><div class="actions-inline"><button class="btn secondary small" type="button" data-open-identity="${rec._type}|${rec.id}">Ouvrir</button><button class="btn danger small" type="button" data-v321-delete-tier="${rec._type}|${rec.id}">Supprimer</button></div></td></tr>`).join('') || '<tr><td colspan="6">Aucun tiers.</td></tr>'}
        </tbody></table></div>`;
      if(typeof renderIdentityDetail === 'function') renderIdentityDetail();
    }catch(err){ console.warn('Tiers V32.1 fallback', err); if(oldRenderOwners) oldRenderOwners(); }
  };
  const oldRenderSuppliers = typeof renderSuppliers === 'function' ? renderSuppliers : null;
  renderSuppliers = function(){
    try{
      const el = $id('suppliersTable'); if(!el){ if(oldRenderSuppliers) oldRenderSuppliers(); return; }
      el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>Email</th><th>TVA</th><th>IBAN</th><th>Actions</th></tr></thead><tbody>${(state.suppliers||[]).map(s=>`<tr><td>${tierCodeBadge('supplier',s)}</td><td>${esc(s.name||'')}</td><td>${esc(s.email||'')}</td><td>${esc(s.vat_number||s.vat||'')}</td><td>${esc(s.iban||'')}</td><td><button class="btn danger small" type="button" data-v321-delete-tier="supplier|${s.id}">Supprimer</button></td></tr>`).join('') || '<tr><td colspan="6">Aucun fournisseur.</td></tr>'}</tbody></table></div>`;
    }catch(err){ if(oldRenderSuppliers) oldRenderSuppliers(); }
  };
  async function deleteTierSafe(type, id){
    if(type === 'owner'){
      const owner = (state.owners || []).find(o => o.id === id); if(!owner) return;
      const linkedLots = (state.lots || []).filter(l => l.owner_id === id).length;
      const linkedCalls = (state.ownerCalls || []).filter(c => c.owner_id === id).length;
      const linkedTx = (state.bankTransactions || []).filter(t => t.tier_type === 'owner' && t.tier_id === id).length;
      if(linkedLots || linkedCalls || linkedTx) return alert(`Suppression refusée : ce copropriétaire est lié à ${linkedLots} lot(s), ${linkedCalls} appel(s) et ${linkedTx} mouvement(s).`);
      if(!confirm(`Supprimer définitivement ${owner.display_name || 'ce copropriétaire'} ?`)) return;
      const { error } = await supabaseClient.from('compta_owners').delete().eq('id', id); if(error) return alert(error.message);
    } else if(type === 'supplier'){
      const supplier = (state.suppliers || []).find(s => s.id === id); if(!supplier) return;
      const linkedInvoices = (state.invoices || []).filter(i => i.supplier_id === id).length;
      const linkedTx = (state.bankTransactions || []).filter(t => t.tier_type === 'supplier' && t.tier_id === id).length;
      if(linkedInvoices || linkedTx) return alert(`Suppression refusée : ce fournisseur est lié à ${linkedInvoices} facture(s) et ${linkedTx} mouvement(s).`);
      if(!confirm(`Supprimer définitivement ${supplier.name || 'ce fournisseur'} ?`)) return;
      const { error } = await supabaseClient.from('compta_suppliers').delete().eq('id', id); if(error) return alert(error.message);
    } else return alert('Suppression non prévue pour ce type de tiers.');
    await loadAll();
  }
  if(typeof findOrCreateOwner === 'function'){
    findOrCreateOwner = async function(coproId, ownerName){
      const cleanName = String(ownerName || '').trim();
      if(!cleanName) return null;
      const existing = (state.owners || []).find(o => norm(o.display_name) === norm(cleanName) || (o.email && norm(o.email) === norm(cleanName)));
      if(existing) return existing.id;
      const { data, error } = await supabaseClient.from('compta_owners').insert({copro_id:coproId, display_name:cleanName, created_by:currentUser.id}).select('id').single();
      if(error) throw error;
      return data.id;
    };
  }

  /* ------------------------------------------------------------------
     5) Recherche compte comptable par numéro ou libellé sur les sélecteurs.
     ------------------------------------------------------------------ */
  const accountSelectIds = new Set(['invoiceAccount','modalInvoiceAccount','odDebitAccount','odCreditAccount','modalOdAccount','v31OdAccount','v31OdDebitAccount','v31OdCreditAccount']);
  function ensureAccountDatalist(){
    let dl = $id('v321AccountDatalist');
    if(!dl){ dl = document.createElement('datalist'); dl.id = 'v321AccountDatalist'; document.body.appendChild(dl); }
    dl.innerHTML = (state.accounts || []).map(a => `<option data-id="${esc(a.id)}" value="${esc((a.code||'') + ' - ' + (a.label||''))}"></option>`).join('');
  }
  function enhanceAccountSelect(select){
    if(!select || select.dataset.v321AccountEnhanced === '1') return;
    if(select.tagName !== 'SELECT') return;
    const optionText = [...select.options].map(o=>o.textContent || '').join(' ').toLowerCase();
    const idLooks = accountSelectIds.has(select.id) || /account/i.test(select.id || '');
    const hasAccountOptions = /\b6\d{2,}|\b4\d{2,}|\b5\d{2,}|\b1\d{2,}/.test(optionText);
    if(!idLooks && !hasAccountOptions) return;
    select.dataset.v321AccountEnhanced = '1';
    select.classList.add('v321-account-original-select');
    const input = document.createElement('input');
    input.className = 'v321-account-search';
    input.setAttribute('list','v321AccountDatalist');
    input.placeholder = 'Rechercher par compte ou libellé…';
    input.autocomplete = 'off';
    const syncFromSelect = () => { const opt = select.options[select.selectedIndex]; input.value = opt && opt.value ? opt.textContent.trim() : ''; };
    const syncToSelect = () => {
      const q = norm(input.value);
      let match = [...select.options].find(o => norm(o.textContent) === q) || [...select.options].find(o => norm(o.textContent).includes(q));
      if(!match && state.accounts){
        const acc = state.accounts.find(a => norm((a.code||'')+' '+(a.label||'')).includes(q));
        if(acc) match = [...select.options].find(o => o.value === acc.id || norm(o.textContent).includes(norm(acc.code)));
      }
      if(match){ select.value = match.value; select.dispatchEvent(new Event('change', {bubbles:true})); }
    };
    input.addEventListener('change', syncToSelect);
    input.addEventListener('input', () => { if(input.value.length >= 2) syncToSelect(); });
    select.parentNode.insertBefore(input, select);
    syncFromSelect();
    select.addEventListener('change', syncFromSelect);
  }
  function enhanceAccountSearches(){
    ensureAccountDatalist();
    document.querySelectorAll('select').forEach(enhanceAccountSelect);
    // Cas spécial : ancien champ de consultation compte comptable en input libre.
    const lookup = $id('v28AccountLookupCode');
    if(lookup && lookup.dataset.v321Lookup !== '1'){
      lookup.dataset.v321Lookup = '1';
      lookup.setAttribute('list','v321AccountDatalist');
      lookup.placeholder = 'Compte ou libellé, ex : 61050 ou nettoyage';
      lookup.addEventListener('change', () => {
        const q = norm(lookup.value);
        const acc = (state.accounts || []).find(a => norm(`${a.code} - ${a.label}`) === q || norm(`${a.code} ${a.label}`).includes(q));
        if(acc){ lookup.value = acc.code || ''; lookup.dispatchEvent(new Event('input', {bubbles:true})); }
      });
    }
  }

  /* ------------------------------------------------------------------
     6) Hooks et surveillance légère.
     ------------------------------------------------------------------ */
  const oldRenderAll = typeof renderAll === 'function' ? renderAll : null;
  renderAll = function(){
    if(oldRenderAll) oldRenderAll();
    setTimeout(() => { patchIcons(); setVersionBadge(); enhanceAccountSearches(); }, 0);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('button');
    if(!b) return;
    if(b.dataset.v321DeleteTier){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const [type,id] = b.dataset.v321DeleteTier.split('|');
      return deleteTierSafe(type, id);
    }
  }, true);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-identity-type]');
    if(!btn) return;
    state.selectedIdentityType = btn.dataset.identityType || 'owner';
    setTimeout(() => renderOwners(), 0);
  }, true);
  document.addEventListener('input', (e) => {
    if(e.target?.id === 'identityListSearch') setTimeout(() => renderOwners(), 0);
  });
  document.addEventListener('change', (e) => {
    if(e.target?.id === 'ownersFilterCopro') setTimeout(() => renderOwners(), 0);
  });
  const obs = new MutationObserver(() => { patchIcons(); enhanceAccountSearches(); });
  function start(){
    patchIcons(); setVersionBadge(); enhanceAccountSearches();
    obs.observe(document.body, {childList:true, subtree:true});
    setInterval(patchIcons, 1500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
