/* WAPI One V33 — fichier intégré unique des améliorations V32.2/V32.3 + nettoyage interface */
/* ============================================================
   WAPI One V33 — intégration fonctionnalités V32.2 stabilisées
   - codes tiers + numérotation facture interne
   - tri factures fournisseurs par colonne
   - CODA paiement/encaissement
   - raccourcis réglages copro
   ============================================================ */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V33 - socle propre';
  const safe = (fn, label='V32.2') => { try { return fn(); } catch (e) { console.warn(label, e); } };
  const esc = (v) => typeof escapeHtml === 'function' ? escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = (v) => typeof money === 'function' ? money(v) : Number(v||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' EUR';
  const id = (x) => document.getElementById(x);

  const ICONS = {
    home:'M3 12 12 3l9 9v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-8Z',
    dashboard:'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
    pilotage:'M4 5h16M4 12h10M4 19h16M17 12h3',
    inbox:'M22 12h-6l-2 3h-4l-2-3H2m20 0-3.5-7h-13L2 12v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7Z',
    search:'M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
    card:'M3 6h18v12H3V6Zm0 4h18M7 15h3',
    send:'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
    receipt:'M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .67V2H4Zm4 6h8M8 12h8M8 16h5',
    megaphone:'M3 11v2a2 2 0 0 0 2 2h2l4 5v-5l8-3V8l-8-3v6H5a2 2 0 0 0-2 2Z',
    bank:'M3 10h18M5 10V8l7-4 7 4v2M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16',
    building:'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 21v-4h2v4M8 7h.01M12 7h.01M8 11h.01M12 11h.01M18 21V9h2v12',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    hash:'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',
    puzzle:'M10 3h4v4h3a2 2 0 1 1 0 4h-3v3h-4v-3H7a2 2 0 1 1 0-4h3V3Z',
    wrench:'M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z',
    book:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V6H6.5A2.5 2.5 0 0 0 4 8.5v11ZM20 2H6.5A2.5 2.5 0 0 0 4 4.5v14',
    euro:'M17 5a7 7 0 1 0 0 14M3 10h10M3 14h10',
    speaker:'M5 9v6h4l5 4V5L9 9H5Zm12 1a4 4 0 0 1 0 4',
    file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h6',
    calendar:'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
    chart:'M3 3v18h18M7 16v-5M12 16V8M17 16v-9',
    archive:'M21 8v13H3V8M1 3h22v5H1V3Zm9 8h4',
    vote:'M9 11h6M12 8v6M5 21h14M7 17h10l2-10H5l2 10ZM9 3h6l2 4H7l2-4Z',
    list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    settings:'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.07a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.07a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.07a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.24.62.8 1 1.55 1H21a2 2 0 1 1 0 4h-.07a1.7 1.7 0 0 0-1.55 1Z',
    shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
    tag:'M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a1.4 1.4 0 0 1 0 2ZM7 7h.01',
    calculator:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 4h6M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01',
    download:'M12 3v12M7 10l5 5 5-5M5 21h14',
    edit:'M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z',
    grid:'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z'
  };
  const svg = (name) => `<svg class="v32-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.grid}"></path></svg>`;
  const textIconMap = {
    'tableau de bord':'dashboard','centre traitement':'inbox','centre de traitement':'inbox','ocr':'search','paiement':'card','envoi':'send','j’informe':'megaphone','journal':'receipt','coda':'bank','copro':'building','lots':'hash','tiers':'users','repartition':'puzzle','répartition':'puzzle','travaux':'wrench','factures':'file','financier':'bank','operations diverses':'edit','opérations diverses':'edit','compteurs':'calculator','budgets':'euro','appels':'speaker','decomptes':'file','décomptes':'file','exercices':'calendar','comptes comptables':'book','grand livre':'book','balance':'chart','bilan':'calculator','fonds':'euro','consultation':'search','assemblees':'vote','assemblées':'vote','catalogue':'list','facturation':'tag','contrats':'calendar','prestations':'tag','export':'archive','reglages':'settings','réglages':'settings','configuration':'settings','utilisateurs':'users','isabel':'card','pilotage':'pilotage','etats comptables':'chart','états comptables':'chart'
  };
  function guessIcon(el){
    const view = el.closest('button')?.dataset?.view || '';
    const title = el.closest('button')?.dataset?.title || el.closest('button')?.title || el.closest('.menu-group__label')?.innerText || el.innerText || '';
    const s = String((view + ' ' + title)).toLowerCase();
    for (const [key, val] of Object.entries(textIconMap)) if (s.includes(key)) return val;
    if (view === 'dashboard') return 'dashboard'; if (view === 'bank') return 'bank'; if (view === 'owners') return 'users';
    return 'grid';
  }
  let iconPending = false;
  function applySidebarIcons(){ iconPending = false; }
  function scheduleIcons(){ /* V33: aucune mutation d’icônes ici */ }
  function addVersionBadge(){ /* La V33.2 affiche sa version dans la barre de page. */ }

  function ownerCode(o){ return o?.code || o?.owner_code || ''; }
  function supplierCode(s){ return s?.code || s?.supplier_code || ''; }
  function tierCode(type, rec){ if(type==='owner') return ownerCode(rec); if(type==='supplier') return supplierCode(rec); return rec?.code || rec?.occupant_code || ''; }
  function ownerLabel(o){ return `${ownerCode(o) ? '['+ownerCode(o)+'] ' : ''}${o?.display_name || ''}`; }
  function supplierLabel(s){ return `${supplierCode(s) ? '['+supplierCode(s)+'] ' : ''}${s?.name || ''}`; }

  function fiscalYearForInvoice(inv){
    const d = inv?.invoice_date || inv?.created_at || '';
    return (state.fiscalYears || []).find(y => (!inv?.copro_id || y.copro_id === inv.copro_id) && d && String(d) >= String(y.starts_on || '0000-01-01') && String(d) <= String(y.ends_on || '9999-12-31')) || null;
  }
  function fallbackCoproCode(copro){
    const src = (copro?.code || copro?.copro_code || copro?.optipro_ref || copro?.name || 'COP');
    const clean = String(src).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
    return (clean || 'COP').slice(0,5);
  }
  function fallbackYearCode(year, date){
    if (year?.code || year?.year_code) return year.code || year.year_code;
    const yy = String(date || new Date().toISOString().slice(0,10)).slice(2,4);
    return 'EX' + yy;
  }
  function invoiceInternalNo(inv){
    if (inv?.internal_invoice_number) return inv.internal_invoice_number;
    const copro = state.copros.find(c=>c.id===inv?.copro_id);
    const year = fiscalYearForInvoice(inv);
    const prefix = `${fallbackCoproCode(copro)}-${fallbackYearCode(year, inv?.invoice_date)}`;
    const same = (state.invoices || []).filter(i => String(i.internal_invoice_number || '').startsWith(prefix + '-'));
    const seq = same.length + 1;
    return `${prefix}-${String(seq).padStart(3,'0')}`;
  }

  async function ensureMissingInternalInvoiceNumbers(){
    if (!supabaseClient || !state?.invoices || state.__v322BackfillRunning) return;
    const missing = state.invoices.filter(i => !i.internal_invoice_number && i.copro_id && (i.invoice_date || i.created_at)).slice(0, 50);
    if (!missing.length) return;
    state.__v322BackfillRunning = true;
    try {
      const used = new Set((state.invoices || []).map(i=>i.internal_invoice_number).filter(Boolean));
      for (const inv of missing) {
        let candidate = invoiceInternalNo(inv);
        let n = 1;
        while (used.has(candidate)) {
          const prefix = candidate.replace(/-\d{3,}$/,'');
          candidate = `${prefix}-${String(++n).padStart(3,'0')}`;
        }
        used.add(candidate);
        const { error } = await supabaseClient.from('compta_invoices').update({ internal_invoice_number: candidate }).eq('id', inv.id);
        if (!error) inv.internal_invoice_number = candidate;
      }
    } catch(e){ console.warn('Numérotation interne V32.2', e.message || e); }
    finally { state.__v322BackfillRunning = false; }
  }

  function sortValueInvoice(inv, key){
    if (key === 'invoice_date') return inv.invoice_date || '';
    if (key === 'internal_invoice_number') return invoiceInternalNo(inv) || '';
    if (key === 'invoice_number') return inv.invoice_number || '';
    if (key === 'supplier') return inv.compta_suppliers?.name || state.suppliers.find(s=>s.id===inv.supplier_id)?.name || '';
    if (key === 'copro') return inv.compta_copros?.name || state.copros.find(c=>c.id===inv.copro_id)?.name || '';
    if (key === 'amount_total') return Number(inv.amount_total || 0);
    if (key === 'payment') return typeof invoicePaymentStatus === 'function' ? invoicePaymentStatus(inv) : (inv.status || '');
    return inv[key] || '';
  }
  function thSort(label, key){
    const s = state.invoiceSort || { key:'invoice_date', dir:'desc' };
    const cls = s.key === key ? `active ${s.dir}` : '';
    return `<button class="invoice-sort-btn ${cls}" type="button" data-v322-invoice-sort="${esc(key)}">${esc(label)}</button>`;
  }
  function renderInvoicesV322(){
    const tableEl = id('invoicesTable'); if (!tableEl) return;
    const s = state.invoiceSort || { key:'invoice_date', dir:'desc' };
    const dir = s.dir === 'asc' ? 1 : -1;
    const rows = (state.invoices || []).filter(i => !state.activeCoproId || i.copro_id === state.activeCoproId).slice().sort((a,b)=>{
      const va = sortValueInvoice(a, s.key), vb = sortValueInvoice(b, s.key);
      if (typeof va === 'number' || typeof vb === 'number') return (Number(va||0)-Number(vb||0))*dir;
      return String(va||'').localeCompare(String(vb||''),'fr',{numeric:true,sensitivity:'base'})*dir;
    });
    const colCount = 11;
    tableEl.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>${thSort('Date','invoice_date')}</th>
      <th>${thSort('Copropriété','copro')}</th>
      <th>${thSort('Fournisseur','supplier')}</th>
      <th>Code tiers</th>
      <th>Compte</th>
      <th>${thSort('N° réel','invoice_number')}</th>
      <th>${thSort('N° interne','internal_invoice_number')}</th>
      <th>${thSort('Montant','amount_total')}</th>
      <th>${thSort('Paiement','payment')}</th>
      <th>PDF</th><th>Actions</th></tr></thead><tbody>${rows.map(i=>{
        const acc = (state.accounts || []).find(a=>a.id===i.account_id);
        const sup = i.compta_suppliers || (state.suppliers||[]).find(s=>s.id===i.supplier_id) || {};
        const supplierDisplay = supplierLabel(sup) || '';
        const rowCls = typeof invoiceRowClass === 'function' ? invoiceRowClass(i) : '';
        const status = typeof invoicePaymentStatus === 'function' ? invoicePaymentStatus(i) : (i.status || '');
        return `<tr class="${rowCls}"><td>${esc(i.invoice_date || '')}</td><td>${esc(i.compta_copros?.name || (state.copros||[]).find(c=>c.id===i.copro_id)?.name || '')}</td><td>${esc(supplierDisplay)}</td><td>${supplierCode(sup) ? `<span class="code-pill">${esc(supplierCode(sup))}</span>` : '-'}</td><td>${esc(acc ? `${acc.code} - ${acc.label || ''}` : 'A classer')}</td><td>${esc(i.invoice_number || '')}</td><td><span class="code-pill">${esc(invoiceInternalNo(i))}</span></td><td>${fmt(i.amount_total)}</td><td>${typeof paymentStatusBadge === 'function' ? paymentStatusBadge(status) : esc(status)}</td><td>${i.file_data_url ? `<button class="pdf-pill" data-show-pdf="${i.id}" type="button">Afficher PDF</button>` : '-'}</td><td><div class="actions-inline"><button class="btn secondary small" data-edit-invoice="${i.id}" type="button">Modifier</button><button class="btn danger small" data-delete-invoice="${i.id}" type="button">Supprimer</button></div></td></tr>`;
      }).join('') || `<tr><td colspan="${colCount}">Aucune facture.</td></tr>`}</tbody></table></div>`;
  }

  function renderCoprosV322(){
    const el = id('coprosTable'); if (!el) return;
    const rows = (state.copros || []).map(c => [
      c.code || c.copro_code ? `<span class="code-pill">${esc(c.code || c.copro_code)}</span>` : '<span class="muted-inline">À définir</span>',
      esc(c.name || ''),
      esc(c.address || ''),
      esc(c.optipro_ref || ''),
      c.active === false ? '<span class="badge">Inactive</span>' : '<span class="badge ok">Active</span>',
      `<div class="actions-inline"><button class="btn secondary small" type="button" data-enter-copro="${c.id}">Entrer</button><button class="btn small" type="button" data-v322-copro-settings="${c.id}">Réglages</button></div>`
    ]);
    el.innerHTML = typeof table === 'function' ? table(['Code','Nom','Adresse','Ref Optipro','Statut','Actions'], rows) : '';
  }

  function renderOwnersV322(){
    const el = id('ownersTable'); if (!el || typeof identityRecords !== 'function') return;
    const selectedCopro = state.activeCoproId || id('ownersFilterCopro')?.value || '';
    const types = identityRecords();
    document.querySelectorAll('[data-identity-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.identityType === state.selectedIdentityType));
    const kind = state.selectedIdentityType === 'supplier' ? 'suppliers' : state.selectedIdentityType === 'occupant' ? 'occupants' : 'owners';
    const records = types[kind] || [];
    const rows = records.map(rec => {
      const code = tierCode(rec._type, rec);
      return [`${code ? `<span class="code-pill">${esc(code)}</span>` : '-'}`, esc(rec._name || ''), esc(rec._email || ''), esc(rec._phone || ''), esc(rec._address || ''), rec.active === false ? '<span class="badge">Inactif</span>' : '<span class="badge ok">Actif</span>', `<button class="btn secondary small" type="button" data-open-identity="${rec._type}|${rec.id}">Ouvrir</button>`];
    });
    el.innerHTML = `<div class="summary-line"><span class="badge">${records.length} tiers</span><span class="badge">Contexte : ${esc(selectedCopro ? ((state.copros||[]).find(c=>c.id===selectedCopro)?.name || '') : 'global')}</span></div>` + (typeof table === 'function' ? table(['Code','Nom','Email','Téléphone','Adresse','Statut','Actions'], rows) : '');
    if (typeof renderIdentityDetail === 'function') renderIdentityDetail();
  }

  function injectCoproSettingsShortcut(){
    const box = document.querySelector('.active-copro-box');
    if (!box || id('activeCoproSettingsBtn')) return;
    const row = document.createElement('div');
    row.className = 'active-copro-settings-row';
    row.innerHTML = '<button class="mini-btn" id="activeCoproSettingsBtn" type="button">Réglages copro</button>';
    box.appendChild(row);
    id('activeCoproSettingsBtn').addEventListener('click', () => {
      if (!state.activeCoproId && id('activeCoproSelect')?.value) setActiveCopro(id('activeCoproSelect').value);
      if (typeof switchToView === 'function') switchToView('coproSettings');
      setTimeout(()=>{ if(id('v28CoproSettingsSelect') && state.activeCoproId) id('v28CoproSettingsSelect').value = state.activeCoproId; }, 0);
    });
  }

  function codaTierOptions(type, selected=''){
    let list = [];
    if (type === 'owner') list = state.owners || [];
    if (type === 'supplier') list = state.suppliers || [];
    if (type === 'occupant') list = state.occupants || [];
    const label = (r) => type === 'supplier' ? supplierLabel(r) : type === 'owner' ? ownerLabel(r) : (r.display_name || r.name || '');
    return '<option value="">Sans tiers</option>' + list.map(r => `<option value="${esc(r.id)}" ${String(selected)===String(r.id)?'selected':''}>${esc(label(r))}</option>`).join('');
  }
  function codaTxForStatement(st){
    return (state.bankTransactions || []).filter(t => String(t.statement_id || '') === String(st.id) || (!t.statement_id && t.bank_account_id === st.bank_account_id && String(t.statement_number || '') === String(st.statement_number || ''))).sort((a,b)=>String(a.transaction_date||'').localeCompare(String(b.transaction_date||'')));
  }
  function renderCodaPilotV322(){
    const el = id('v28CodaTable'); if (!el) return;
    const copro = state.activeCoproId || id('v28CodaCoproFilter')?.value || '';
    const status = id('v28CodaStatusFilter')?.value || '';
    const sort = id('v28CodaSort')?.value || 'created_at';
    let rows = (state.bankStatements || []).filter(s => (!copro || s.copro_id === copro) && (!status || s.status === status));
    rows.sort((a,b)=>String(b[sort] || '').localeCompare(String(a[sort] || ''), 'fr', {numeric:true}));
    el.innerHTML = rows.map(st => {
      const txs = codaTxForStatement(st);
      const open = state.v322OpenCodaId === st.id;
      const debit = txs.filter(t=>Number(t.amount)<0).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
      const credit = txs.filter(t=>Number(t.amount)>0).reduce((s,t)=>s+Number(t.amount||0),0);
      return `<div class="v32-coda-card"><div class="v32-coda-head" data-v322-coda-toggle="${st.id}"><input type="checkbox" data-v322-coda-check="${st.id}" onclick="event.stopPropagation()"><div><strong>${esc(st.compta_copros?.name || (state.copros||[]).find(c=>c.id===st.copro_id)?.name || 'Copropriété')}</strong><div class="muted-note">${esc(st.file_name || 'CODA')} · ${txs.length} mouvement(s)</div></div><div><strong>Extrait</strong><br>${esc(st.statement_number || '-')}</div><div><strong>Date</strong><br>${esc(st.statement_date || '-')}</div><div>${typeof statusBadge==='function'?statusBadge(st.status):esc(st.status||'')}</div></div>
      <div class="v32-coda-content ${open?'':'hidden'}"><div class="v32-coda-summary"><span class="stat-mini">Débit : <strong>${fmt(debit)}</strong></span><span class="stat-mini">Crédit : <strong>${fmt(credit)}</strong></span><span class="stat-mini">Solde initial : <strong>${fmt(st.opening_balance||0)}</strong></span><span class="stat-mini">Solde final : <strong>${fmt(st.closing_balance||0)}</strong></span></div><div class="actions-inline" style="margin-bottom:10px;"><button class="btn secondary small" data-v322-coda-validate="${st.id}" type="button">Valider extrait</button><button class="btn danger small" data-reject-statement="${st.id}" type="button">Rejeter</button></div><div class="v32-coda-lines">${txs.map(t=>{
        const mov = Number(t.amount || 0) < 0 ? 'debit' : 'credit';
        return `<div class="v32-coda-line" data-v322-coda-tx="${t.id}"><input type="date" data-v322-coda-date value="${esc(t.transaction_date||'')}"><input data-v322-coda-label value="${esc(t.communication || t.description || '')}" placeholder="Libellé"><select data-v322-coda-movement><option value="debit" ${mov==='debit'?'selected':''}>Paiement</option><option value="credit" ${mov==='credit'?'selected':''}>Encaissement</option></select><input type="number" step="0.01" data-v322-coda-amount value="${Math.abs(Number(t.amount||0))}"><select data-v322-coda-tier-type><option value="">Sans tiers</option><option value="owner" ${t.tier_type==='owner'?'selected':''}>Copropriétaire</option><option value="supplier" ${t.tier_type==='supplier'?'selected':''}>Fournisseur</option><option value="occupant" ${t.tier_type==='occupant'?'selected':''}>Occupant</option></select><select data-v322-coda-tier>${codaTierOptions(t.tier_type, t.tier_id)}</select><button class="btn secondary small" data-v322-save-coda-tx="${t.id}" type="button">OK</button></div>`;
      }).join('') || '<div class="notice">Aucune ligne détectée.</div>'}</div></div></div>`;
    }).join('') || '<div class="notice">Aucun CODA pour les filtres actuels.</div>';
  }
  async function saveCodaTxV322(txId){
    const row = document.querySelector(`[data-v322-coda-tx="${txId}"]`); if (!row) return;
    const movement = row.querySelector('[data-v322-coda-movement]')?.value || 'credit';
    const abs = Math.abs(Number(row.querySelector('[data-v322-coda-amount]')?.value || 0));
    const amount = movement === 'debit' ? -abs : abs;
    const tierType = row.querySelector('[data-v322-coda-tier-type]')?.value || null;
    const payload = {
      transaction_date: row.querySelector('[data-v322-coda-date]')?.value || null,
      amount,
      communication: row.querySelector('[data-v322-coda-label]')?.value?.trim() || null,
      description: row.querySelector('[data-v322-coda-label]')?.value?.trim() || null,
      tier_type: tierType,
      tier_id: row.querySelector('[data-v322-coda-tier]')?.value || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient.from('compta_bank_transactions').update(payload).eq('id', txId);
    if (error) return alert(error.message);
    const tx = (state.bankTransactions || []).find(t=>String(t.id)===String(txId)); if (tx) Object.assign(tx, payload);
    renderCodaPilotV322();
    if (typeof renderFinancialLedger === 'function') safe(()=>renderFinancialLedger());
  }
  async function validateCodaV322(stId){
    const { error } = await supabaseClient.from('compta_bank_statements').update({ status:'validated', validated_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id', stId);
    if (error) return alert(error.message);
    const st = (state.bankStatements || []).find(s=>String(s.id)===String(stId)); if (st) st.status='validated';
    renderCodaPilotV322();
  }

  window.v33InvoiceInternalNo = invoiceInternalNo;
  window.v33RenderInvoicesV322 = renderInvoicesV322;
  window.v33RenderCoprosV322 = renderCoprosV322;
  window.v33RenderOwnersV322 = renderOwnersV322;
  window.v33RenderCodaPilotV322 = renderCodaPilotV322;
  function afterRender(){
    safe(()=>{ addVersionBadge(); injectCoproSettingsShortcut(); scheduleIcons(); });
    safe(()=>{ if (id('coprosTable')) renderCoprosV322(); });
    safe(()=>{ if (id('ownersTable')) renderOwnersV322(); });
    safe(()=>{ if (id('invoicesTable')) renderInvoicesV322(); });
    safe(()=>{ if (!id('codaPilotView')?.classList.contains('hidden')) renderCodaPilotV322(); });
  }

  function installPatches(){
    if (window.__wapiV322Installed) return; window.__wapiV322Installed = true;
    safe(()=>{
      if (typeof renderInvoices === 'function') renderInvoices = renderInvoicesV322;
      if (typeof renderCopros === 'function') renderCopros = renderCoprosV322;
      if (typeof renderOwners === 'function') renderOwners = renderOwnersV322;
      if (typeof loadAll === 'function') {
        const oldLoadAll = loadAll;
        loadAll = async function(){
          const res = await oldLoadAll.apply(this, arguments);
          await ensureMissingInternalInvoiceNumbers();
          afterRender();
          return res;
        };
      }
      if (typeof renderAll === 'function') {
        const oldRenderAll = renderAll;
        renderAll = function(){ const res = oldRenderAll.apply(this, arguments); setTimeout(afterRender, 0); return res; };
      }
      if (typeof switchToView === 'function') {
        const oldSwitch = switchToView;
        switchToView = function(view){ const res = oldSwitch.apply(this, arguments); setTimeout(afterRender, 0); return res; };
      }
    }, 'install patchs V32.2');
    document.addEventListener('click', (e)=>{
      const s = e.target.closest?.('[data-v322-invoice-sort]');
      if (s) { e.preventDefault(); const key = s.dataset.v322InvoiceSort; const cur = state.invoiceSort || { key:'invoice_date', dir:'desc' }; state.invoiceSort = { key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' }; renderInvoicesV322(); return; }
      const cs = e.target.closest?.('[data-v322-copro-settings]');
      if (cs) { e.preventDefault(); const cid = cs.dataset.v322CoproSettings || ''; if (window.openCoproSettingsPopupV33) window.openCoproSettingsPopupV33(cid); else { if (typeof setActiveCopro === 'function') setActiveCopro(cid); } setTimeout(afterRender,0); return; }
      const tog = e.target.closest?.('[data-v322-coda-toggle]');
      if (tog && !e.target.closest('button,input,select')) { state.v322OpenCodaId = state.v322OpenCodaId === tog.dataset.v322CodaToggle ? '' : tog.dataset.v322CodaToggle; renderCodaPilotV322(); return; }
      const save = e.target.closest?.('[data-v322-save-coda-tx]'); if (save) { e.preventDefault(); saveCodaTxV322(save.dataset.v322SaveCodaTx); return; }
      const valid = e.target.closest?.('[data-v322-coda-validate]'); if (valid) { e.preventDefault(); validateCodaV322(valid.dataset.v322CodaValidate); return; }
      
    }, false);
    document.addEventListener('change', (e)=>{
      const t = e.target;
      if (!t) return;
      if (['v28CodaCoproFilter','v28CodaStatusFilter','v28CodaSort'].includes(t.id)) setTimeout(renderCodaPilotV322, 0);
      if (t.matches?.('[data-v322-coda-tier-type]')) {
        const row = t.closest('[data-v322-coda-tx]'); const sel = row?.querySelector('[data-v322-coda-tier]'); if (sel) sel.innerHTML = codaTierOptions(t.value, '');
      }
    }, false);
    setTimeout(afterRender, 500);
    setTimeout(afterRender, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPatches);
  else installPatches();
})();


/* ============================================================
   WAPI One V32.3 — Gestion multi-utilisateur / gestionnaires
   - lit les utilisateurs Supabase Auth via compta_user_profiles
   - attribue un gestionnaire aux copros dans le popup Réglages copro
   - ajoute un filtre global par gestionnaire pour les modules multi-copro
   - garde une logique sans observer/intervalle pour éviter les boucles
   ============================================================ */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V33 - multi-utilisateurs';
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
      if (badge) badge.textContent = 'WAPI One — V33';
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


/* WAPI One V32.3.1 — Filtres gestionnaire étendus
   Objectif : appliquer le filtre gestionnaire dans les modules multi-copro utiles,
   sans MutationObserver ni boucle de rendu. */
(function(){
  const VERSION = 'WAPI One — V33';
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


/* ============================================================
   WAPI One V33 — socle propre interface/navigation/réglages/compte
   ============================================================ */
(function(){
  'use strict';
  const VERSION = 'WAPI One — V33';
  window.WAPI_ONE_VERSION = 'V33 - socle propre stabilisé';
  const STORAGE_KEY = 'wapi_one_manager_filter_user_id';
  const ACTIVE_COPRO_KEY = 'wapi_compta_active_copro_id';
  const $id = (id) => document.getElementById(id);
  const safe = (fn,label) => { try { return fn(); } catch(e){ console.warn('[V33]', label || 'erreur', e); } };
  const esc = (v) => (typeof escapeHtml === 'function') ? escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moneySafe = (v) => (typeof money === 'function') ? money(v) : Number(v||0).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' EUR';
  const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  function stateOk(){ return typeof state !== 'undefined' && state; }
  function client(){ try { return supabaseClient || window.supabaseClient || null; } catch(e){ return window.supabaseClient || null; } }
  function arr(name){ return stateOk() && Array.isArray(state[name]) ? state[name] : []; }

  /* -----------------------------
     Navigation V33 : une seule source, SVG uniquement.
  ----------------------------- */
  const PATHS = {
    home:'M3 12 12 3l9 9v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-8Z',
    dashboard:'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
    inbox:'M22 12h-6l-2 3h-4l-2-3H2m20 0-3.5-7h-13L2 12v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7Z',
    search:'M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
    card:'M3 6h18v12H3V6Zm0 4h18M7 15h3', send:'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
    receipt:'M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .67V2H4Zm4 6h8M8 12h8M8 16h5',
    megaphone:'M3 11v2a2 2 0 0 0 2 2h2l4 5v-5l8-3V8l-8-3v6H5a2 2 0 0 0-2 2Z',
    bank:'M3 10h18M5 10V8l7-4 7 4v2M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16',
    building:'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 21v-4h2v4M8 7h.01M12 7h.01M8 11h.01M12 11h.01M18 21V9h2v12',
    hash:'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',
    user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    puzzle:'M10 3h4v4h3a2 2 0 1 1 0 4h-3v3h-4v-3H7a2 2 0 1 1 0-4h3V3Z',
    wrench:'M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z',
    book:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V6H6.5A2.5 2.5 0 0 0 4 8.5v11ZM20 2H6.5A2.5 2.5 0 0 0 4 4.5v14',
    euro:'M17 5a7 7 0 1 0 0 14M3 10h10M3 14h10', speaker:'M5 9v6h4l5 4V5L9 9H5Zm12 1a4 4 0 0 1 0 4',
    file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h6',
    calendar:'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
    chart:'M3 3v18h18M7 16v-5M12 16V8M17 16v-9', archive:'M21 8v13H3V8M1 3h22v5H1V3Zm9 8h4',
    vote:'M9 11h6M12 8v6M5 21h14M7 17h10l2-10H5l2 10ZM9 3h6l2 4H7l2-4Z',
    list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    settings:'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.07a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.07a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.07a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.24.62.8 1 1.55 1H21a2 2 0 1 1 0 4h-.07a1.7 1.7 0 0 0-1.55 1Z',
    shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', tag:'M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a1.4 1.4 0 0 1 0 2ZM7 7h.01',
    calculator:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 4h6M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01',
    download:'M12 3v12M7 10l5 5 5-5M5 21h14', edit:'M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z',
    grid:'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z'
  };
  function icon(name){ return '<svg class="v33-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(PATHS[name] || PATHS.grid)+'"></path></svg>'; }
  const MODULES = [
    { id:'home', label:'Accueil', icon:'home', defaultView:'dashboard', tabs:[['dashboard','Tableau de bord','dashboard']] },
    { id:'pilotage', label:'Pilotage', icon:'dashboard', defaultView:'processing', tabs:[['processing','Centre traitement','inbox'],['invoiceOcr','OCR factures','search'],['codaPilot','Validation CODA','bank'],['payments','Paiement factures','card'],['callDispatch','Envoi appels','send'],['inform','J’informe','megaphone'],['sendJournal','Journal envois','receipt']] },
    { id:'copros', label:'Copropriétés', icon:'building', defaultView:'copros', tabs:[['copros','Liste','building'],['lots','Lots','hash'],['owners','Tiers copropriétaires','users'],['suppliers','Fournisseurs','users'],['distribution','Répartitions','puzzle'],['buildings','Bâtiments','building'],['works','Travaux','wrench']] },
    { id:'compta', label:'Comptabilité', icon:'book', defaultView:'invoices', tabs:[['invoices','Factures fournisseurs','file'],['bank','Encodage financier','bank'],['od','Opérations diverses','edit'],['meters','Relevés compteurs','calculator'],['budgets','Budgets','euro'],['calls','Appels','speaker'],['statements','Décomptes','file'],['expensesList','Liste dépenses','receipt'],['exercises','Exercices','calendar']] },
    { id:'states', label:'États comptables', icon:'chart', defaultView:'accountLookup', tabs:[['accountLookup','Compte comptable','search'],['ledger','Grand livre','book'],['financialLedger','Grand livre financier','bank'],['balance','Balance générale','chart'],['thirdBalance','Balance tiers','users'],['journals','Journaux','archive'],['bilan','Bilan','calculator'],['heldFunds','Fonds détenus','euro'],['multicoproConsultation','Consultation multi-copro','search']] },
    { id:'ag', label:'Assemblées générales', icon:'vote', defaultView:'meetings', tabs:[['meetings','Assemblées','vote'],['resolutions','Catalogue résolutions','list']] },
    { id:'syndic', label:'Facturation syndic', icon:'tag', defaultView:'syndicBilling', tabs:[['syndicBilling','Tableau mensuel','calendar','campaigns'],['syndicBilling','Contrats','calendar','contracts'],['syndicBilling','Prestations / mutations','tag','services'],['syndicBilling','Factures','receipt','invoices'],['syndicBilling','Export Clearfact','archive','exports'],['syndicBilling','Réglages','settings','settings']] },
    { id:'config', label:'Configuration', icon:'settings', defaultView:'agency', tabs:[['agency','Agence','building'],['accounts','Plan comptable','book'],['templates','Modèles','list'],['users','Utilisateurs','users'],['journalCodes','Journaux','receipt'],['bankInstitutions','Banques','bank'],['vatCodes','Codes TVA','calculator'],['defaultExpenseTypes','Natures dépenses','list'],['accessControl','Accès','shield'],['auditTrail','Audit','list'],['importsConfig','Imports','download'],['isabel','Isabel','card']] }
  ];
  const VIEW_TO_MODULE = new Map(); MODULES.forEach(m => m.tabs.forEach(t => { if(!VIEW_TO_MODULE.has(t[0])) VIEW_TO_MODULE.set(t[0], m.id); }));
  function currentView(){ const v = [...document.querySelectorAll('.view')].find(x => !x.classList.contains('hidden')); return v ? v.id.replace(/View$/,'') : 'dashboard'; }
  function moduleFor(view){ return MODULES.find(m => m.id === (VIEW_TO_MODULE.get(view) || 'home')) || MODULES[0]; }
  function currentSyndicTab(){ return stateOk() ? (state.syndicBillingTab || 'campaigns') : 'campaigns'; }
  function renderNavigation(viewName){
    viewName = viewName || currentView();
    const mod = moduleFor(viewName);
    const nav = document.querySelector('.nav');
    const tabs = $id('moduleTabs');
    if (nav) {
      nav.dataset.v33Ready = '1';
      nav.innerHTML = MODULES.map(m => '<button type="button" class="main-module-btn '+(m.id===mod.id?'active':'')+'" data-v33-module="'+esc(m.id)+'" title="'+esc(m.label)+'"><span class="main-module-icon">'+icon(m.icon)+'</span><span class="main-module-label">'+esc(m.label)+'</span></button>').join('');
    }
    if (tabs) {
      tabs.innerHTML = mod.tabs.map(t => {
        const view = t[0], label = t[1], ic = t[2], syndicTab = t[3];
        const active = view === viewName && (!syndicTab || currentSyndicTab() === syndicTab);
        const attr = syndicTab ? ' data-v25-syndic-tab="'+esc(syndicTab)+'" data-v23-syndic-tab="'+esc(syndicTab)+'"' : '';
        return '<button type="button" class="module-tab '+(active?'active':'')+'" data-view="'+esc(view)+'" data-title="'+esc(label)+'"'+attr+'><span class="module-tab-icon">'+icon(ic)+'</span><span>'+esc(label)+'</span></button>';
      }).join('');
    }
    const badge = document.querySelector('.app-version-badge') || document.querySelector('.wapi-version-badge');
    if (badge) badge.textContent = VERSION;
    document.title = VERSION;
    ensureSettingsButton();
  }
  function updateTitle(viewName, title){
    const mod = moduleFor(viewName);
    const h = $id('pageTitle'); if(h) h.textContent = title || (mod.tabs.find(t=>t[0]===viewName)?.[1]) || mod.label;
    const sub = $id('pageSubtitle');
    if(sub){
      const c = stateOk() && state.activeCoproId ? arr('copros').find(x => String(x.id) === String(state.activeCoproId)) : null;
      sub.textContent = `${mod.label} • Contexte : ${c ? (c.name || 'Copropriété') : 'Mode global'}`;
    }
  }
  function activateV33(viewName, title, syndicTab){
    if(!viewName) return;
    if(stateOk() && syndicTab) state.syndicBillingTab = syndicTab;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = $id(viewName + 'View'); if(target) target.classList.remove('hidden');
    document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
    renderNavigation(viewName);
    document.querySelectorAll('[data-view="'+CSS.escape(viewName)+'"]').forEach(b => {
      if(!syndicTab || b.dataset.v25SyndicTab === syndicTab || b.dataset.v23SyndicTab === syndicTab) b.classList.add('active');
    });
    updateTitle(viewName, title);
    if(viewName === 'accountLookup') setTimeout(renderAccountLookupV33, 0);
    if(viewName === 'codaPilot' && typeof window.v33RenderCodaPilotV322 === 'function') setTimeout(window.v33RenderCodaPilotV322, 0);
    if(viewName === 'invoices' && typeof window.v33RenderInvoicesV322 === 'function') setTimeout(window.v33RenderInvoicesV322, 0);
    if(viewName === 'copros' && typeof window.v33RenderCoprosV322 === 'function') setTimeout(window.v33RenderCoprosV322, 0);
    setTimeout(() => { applyManagerFilterStrict(); renderNavigation(viewName); }, 0);
  }
  window.v33RenderNavigation = renderNavigation;
  window.v28RenderNav = renderNavigation;
  window.decorateV26Icons = renderNavigation;
  window.switchToView = function(view){ activateV33(view); };
  document.addEventListener('click', (e) => {
    const main = e.target.closest?.('[data-v33-module]');
    if(main){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const m = MODULES.find(x => x.id === main.dataset.v33Module) || MODULES[0]; const t = m.tabs[0]; activateV33(m.defaultView, t[1], t[3]); return; }
    const tab = e.target.closest?.('.module-tab');
    if(tab){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); activateV33(tab.dataset.view, tab.dataset.title, tab.dataset.v25SyndicTab || tab.dataset.v23SyndicTab || ''); }
  }, true);

  /* -----------------------------
     Gestionnaire strict.
  ----------------------------- */
  function managerId(){ return (stateOk() && state.managerFilterUserId) || localStorage.getItem(STORAGE_KEY) || ''; }
  function managerActive(){ return !!managerId(); }
  function userLabel(u){ return (u?.display_name || u?.email || 'Utilisateur').trim(); }
  function managerName(id){ const u = arr('userProfiles').find(x => String(x.id) === String(id)); return u ? userLabel(u) : 'Gestionnaire'; }
  function coproManagerId(c){ return c?.manager_user_id || c?.manager_id || ''; }
  function filteredCopros(){ const list = arr('copros'); const m = managerId(); return m ? list.filter(c => String(coproManagerId(c)) === String(m)) : list; }
  function coproAllowed(id){ if(!managerActive() || !id) return true; return filteredCopros().some(c => String(c.id) === String(id)); }
  function applyManagerFilterStrict(){
    if(!stateOk()) return;
    if(managerActive() && state.activeCoproId && !coproAllowed(state.activeCoproId)){
      state.activeCoproId = '';
      try{ localStorage.removeItem(ACTIVE_COPRO_KEY); }catch(e){}
    }
    const select = $id('activeCoproSelect');
    if(select){
      const list = filteredCopros();
      const keep = state.activeCoproId || '';
      select.innerHTML = '<option value="">Mode global / '+(managerActive() ? 'copros du gestionnaire' : 'toutes les copros')+'</option>' + list.map(c => '<option value="'+esc(c.id)+'">'+esc([c.code || c.copro_code || '', c.name || ''].filter(Boolean).join(' - '))+'</option>').join('');
      select.value = keep && list.some(c => String(c.id) === String(keep)) ? keep : '';
    }
    const activeName = $id('activeCoproName');
    if(activeName){
      const c = arr('copros').find(x => String(x.id) === String(state.activeCoproId));
      activeName.textContent = c ? (c.name || 'Copropriété') : (managerActive() ? `Mode global — ${managerName(managerId())}` : 'Mode global');
    }
  }
  window.v33FilteredCopros = filteredCopros;
  window.v33CoproAllowed = coproAllowed;
  function patchActiveCoproContext(){
    safe(() => {
      if(typeof renderActiveCoproContext !== 'function' || renderActiveCoproContext.__v33Strict) return;
      const old = renderActiveCoproContext;
      const patched = function(){ const r = old.apply(this, arguments); applyManagerFilterStrict(); ensureSettingsButton(); return r; };
      patched.__v33Strict = true;
      renderActiveCoproContext = patched;
    }, 'patch contexte copro');
  }
  document.addEventListener('change', (e) => {
    if(e.target?.id === 'activeManagerFilter'){
      if(stateOk()) state.managerFilterUserId = e.target.value || '';
      if(e.target.value) localStorage.setItem(STORAGE_KEY, e.target.value); else localStorage.removeItem(STORAGE_KEY);
      applyManagerFilterStrict();
      if(typeof renderAll === 'function') renderAll();
      setTimeout(() => { applyManagerFilterStrict(); renderNavigation(); }, 0);
    }
    if(e.target?.id === 'activeCoproSelect' && managerActive() && e.target.value && !coproAllowed(e.target.value)){
      e.target.value = '';
      if(typeof setActiveCopro === 'function') setActiveCopro('');
    }
  }, true);

  /* -----------------------------
     Réglages copro popup, menu gestionnaire select.
  ----------------------------- */
  async function ensureUsersLoaded(){
    if(!stateOk()) return [];
    if(arr('userProfiles').length) return state.userProfiles;
    if(typeof window.loadUserProfilesV323 === 'function') await window.loadUserProfilesV323();
    return state.userProfiles || [];
  }
  function managerOptions(selected){
    const users = arr('userProfiles').filter(u => u.active !== false);
    return '<option value="">Aucun gestionnaire attribué</option>' + users.map(u => {
      const label = userLabel(u) + (u.email && u.email !== userLabel(u) ? ' — ' + u.email : '');
      return '<option value="'+esc(u.id)+'" '+(String(selected||'')===String(u.id)?'selected':'')+'>'+esc(label)+'</option>';
    }).join('');
  }
  function optionList(list, selected, labelFn, empty){ return '<option value="">'+esc(empty || 'Choisir...')+'</option>' + (list || []).map(x => '<option value="'+esc(x.id)+'" '+(String(x.id)===String(selected)?'selected':'')+'>'+esc(labelFn(x))+'</option>').join(''); }
  function yearLabel(y){ return [y?.code || y?.year_code || '', y?.label || ''].filter(Boolean).join(' - ') || 'Exercice'; }
  function coproLabel(c){ return [c?.code || c?.copro_code || '', c?.name || ''].filter(Boolean).join(' - ') || 'Copropriété'; }
  function account55Options(selected){ return optionList(arr('accounts').filter(a => String(a.code || '').startsWith('55')), selected, a => (a.code || '') + ' - ' + (a.label || ''), 'Compte comptable banque'); }
  async function loadSettingsTables(){
    const c = client(); if(!c || !stateOk()) return;
    async function read(table){ try{ const {data,error} = await c.from(table).select('*'); if(error) throw error; return data || []; } catch(e){ console.warn('[V33] table optionnelle', table, e.message || e); return []; } }
    if(!Array.isArray(state.v28CoproBankAccounts)) state.v28CoproBankAccounts = await read('compta_copro_bank_accounts');
    if(!Array.isArray(state.v28Folders)) state.v28Folders = await read('compta_copro_folders');
    if(!Array.isArray(state.v28Documents)) state.v28Documents = await read('compta_copro_documents');
  }
  function openModal(title, body, footer){
    const backdrop = $id('globalModalBackdrop'), modal = $id('globalModal');
    if(!backdrop || !modal || !$id('globalModalBody')){ alert('Popup indisponible. Recharge la page.'); return; }
    $id('globalModalTitle').textContent = title;
    if($id('globalModalSubtitle')) $id('globalModalSubtitle').textContent = 'Réglages propres à la copropriété sélectionnée.';
    $id('globalModalBody').innerHTML = body;
    $id('globalModalFooter').innerHTML = footer || '<button class="btn secondary" type="button" data-modal-close>Fermer</button>';
    modal.classList.remove('narrow'); modal.classList.add('wide'); backdrop.classList.remove('hidden'); backdrop.style.display=''; backdrop.style.pointerEvents='';
  }
  function requestedCoproId(id){ return id || (stateOk() ? (state.activeCoproId || '') : '') || $id('activeCoproSelect')?.value || ''; }
  function settingsBody(coproId){
    const c = arr('copros').find(x => String(x.id) === String(coproId)) || {};
    const years = arr('fiscalYears').filter(y => !coproId || String(y.copro_id) === String(coproId));
    const selectedYear = state.activeFiscalYearId || $id('activeFiscalYearSelect')?.value || years[0]?.id || '';
    const y = years.find(x => String(x.id) === String(selectedYear)) || {};
    const banks = (state.v28CoproBankAccounts || []).filter(b => String(b.copro_id) === String(coproId));
    const folders = (state.v28Folders || []).filter(f => String(f.copro_id) === String(coproId));
    const folderCards = (folders.length ? folders : [{id:'default-acte',name:'Acte de base'},{id:'default-roi',name:'ROI'},{id:'default-pv',name:'PV AG'},{id:'default-contrats',name:'Contrats'}]).map(f => {
      const count = (state.v28Documents || []).filter(d => String(d.folder_id) === String(f.id)).length;
      return '<div class="v3221-folder-card"><strong>'+esc(f.name || 'Dossier')+'</strong><span>'+count+' document(s)</span></div>';
    }).join('');
    const bankRows = banks.map(b => '<tr><td>'+esc(b.label||'')+'</td><td>'+esc(b.iban||'')+'</td><td>'+esc(b.bic||'')+'</td><td>'+esc(b.account_code||'')+'</td><td>'+(b.account_type === 'savings' ? 'Épargne' : 'Vue')+'</td></tr>').join('') || '<tr><td colspan="5">Aucun compte bancaire spécifique encodé.</td></tr>';
    return '<div class="v3221-settings-popup v3234-settings-popup">'
      + '<div class="notice compact"><strong>Copropriété :</strong> '+esc(coproLabel(c))+'</div>'
      + '<div class="form-grid">'
      + '<label>Code copropriété <input id="v33CoproCode" value="'+esc(c.code || c.copro_code || '')+'" placeholder="Ex. ALB"></label>'
      + '<label>Nom copropriété <input id="v33CoproName" value="'+esc(c.name || '')+'"></label>'
      + '<label>BCE <input id="v33CoproBce" value="'+esc(c.bce || '')+'" placeholder="BE...."></label>'
      + '<label>Gestionnaire <select id="v33CoproManagerUser">'+managerOptions(c.manager_user_id || c.manager_id || '')+'</select><div class="v3234-user-select-note">Menu déroulant basé sur les utilisateurs Supabase.</div></label>'
      + '<label style="grid-column:1/-1;">Adresse <textarea id="v33CoproAddress" rows="2">'+esc(c.address || '')+'</textarea></label>'
      + '<label>Exercice <select id="v33FiscalYearSelect">'+optionList(years, y.id || selectedYear, yearLabel, 'Exercice')+'</select></label>'
      + '<label>Code exercice <input id="v33FiscalYearCode" value="'+esc(y.code || y.year_code || '')+'" placeholder="EX26"></label>'
      + '<label>Dernier n° facture interne <input id="v33LastInternalInvoiceNo" type="number" min="0" value="'+Number(y.last_internal_invoice_no || 0)+'"></label>'
      + '</div><hr><div class="toolbar compact"><h3>Comptes bancaires de la copropriété</h3><button class="btn secondary small" id="v33AddBankInlineBtn" type="button">+ Ajouter compte</button></div>'
      + '<div class="v3221-inline-bank hidden" id="v33BankForm"><div class="form-grid"><label>Libellé <input id="v33BankLabel" placeholder="Compte à vue / Réserve"></label><label>IBAN <input id="v33BankIban" placeholder="BE..."></label><label>BIC <input id="v33BankBic" placeholder="GKCCBEBB"></label><label>Compte comptable <select id="v33BankAccountAccounting">'+account55Options('')+'</select></label><label>Type <select id="v33BankType"><option value="current">Compte à vue</option><option value="savings">Compte épargne</option></select></label></div><div class="top-actions"><button class="btn small" id="v33SaveBankBtn" type="button">Ajouter le compte</button></div></div>'
      + '<div class="table-wrap"><table><thead><tr><th>Libellé</th><th>IBAN</th><th>BIC</th><th>Compte</th><th>Type</th></tr></thead><tbody>'+bankRows+'</tbody></table></div>'
      + '<hr><div class="toolbar compact"><h3>Documents copropriété</h3><button class="btn secondary small" id="v33AddFolderBtn" type="button">+ Dossier</button></div><div class="v3221-folder-grid">'+folderCards+'</div></div>';
  }
  async function openSettingsPopup(coproId){
    if(!stateOk()) return;
    coproId = requestedCoproId(coproId);
    if(!coproId){ alert('Choisis d’abord une copropriété.'); return; }
    await ensureUsersLoaded(); await loadSettingsTables();
    if(typeof setActiveCopro === 'function' && String(state.activeCoproId || '') !== String(coproId)) { state.activeCoproId = coproId; try{ localStorage.setItem(ACTIVE_COPRO_KEY, coproId); }catch(e){} }
    openModal('Réglages copropriété', settingsBody(coproId), '<button class="btn secondary" type="button" data-modal-close>Fermer</button><button class="btn" id="v33SaveCoproSettingsBtn" type="button">Enregistrer réglages</button>');
    bindSettingsPopup(coproId);
  }
  window.openCoproSettingsPopupV33 = openSettingsPopup;
  window.openCoproSettingsPopupV3234 = openSettingsPopup;
  window.openCoproSettingsPopupV3221 = openSettingsPopup;
  function bindSettingsPopup(coproId){
    $id('v33FiscalYearSelect')?.addEventListener('change', () => { const y = arr('fiscalYears').find(x => String(x.id) === String($id('v33FiscalYearSelect').value)) || {}; if($id('v33FiscalYearCode')) $id('v33FiscalYearCode').value = y.code || y.year_code || ''; if($id('v33LastInternalInvoiceNo')) $id('v33LastInternalInvoiceNo').value = Number(y.last_internal_invoice_no || 0); });
    $id('v33AddBankInlineBtn')?.addEventListener('click', () => $id('v33BankForm')?.classList.toggle('hidden'));
    $id('v33SaveBankBtn')?.addEventListener('click', () => addBank(coproId));
    $id('v33AddFolderBtn')?.addEventListener('click', () => addFolder(coproId));
    $id('v33SaveCoproSettingsBtn')?.addEventListener('click', () => saveSettings(coproId));
  }
  async function saveSettings(coproId){
    const c = client(); if(!c){ alert('Supabase non connecté.'); return; }
    const managerId = $id('v33CoproManagerUser')?.value || null;
    const manager = arr('userProfiles').find(u => String(u.id) === String(managerId));
    const payload = { code:($id('v33CoproCode')?.value||'').trim(), name:($id('v33CoproName')?.value||'').trim(), bce:($id('v33CoproBce')?.value||'').trim(), address:($id('v33CoproAddress')?.value||'').trim(), manager_user_id:managerId, manager_name:manager ? userLabel(manager) : '' };
    if(!payload.name){ alert('Le nom de la copropriété est obligatoire.'); return; }
    let res = await c.from('compta_copros').update(payload).eq('id', coproId);
    if(res.error && /column|schema|cache/i.test(res.error.message || '')) res = await c.from('compta_copros').update({ code:payload.code, name:payload.name, manager_user_id:payload.manager_user_id, manager_name:payload.manager_name }).eq('id', coproId);
    if(res.error){ alert(res.error.message); return; }
    const yearId = $id('v33FiscalYearSelect')?.value || '';
    if(yearId){
      let yr = await c.from('compta_fiscal_years').update({ code:($id('v33FiscalYearCode')?.value||'').trim(), year_code:($id('v33FiscalYearCode')?.value||'').trim(), last_internal_invoice_no:Number($id('v33LastInternalInvoiceNo')?.value||0) }).eq('id', yearId);
      if(yr.error && /column|schema|cache/i.test(yr.error.message || '')) yr = await c.from('compta_fiscal_years').update({ code:($id('v33FiscalYearCode')?.value||'').trim() }).eq('id', yearId);
      if(yr.error){ alert(yr.error.message); return; }
    }
    if(typeof loadAll === 'function') await loadAll();
    alert('Réglages copropriété enregistrés.');
    await openSettingsPopup(coproId);
  }
  async function addBank(coproId){
    const c = client(); const iban = ($id('v33BankIban')?.value || '').trim(); if(!c || !iban){ alert('IBAN obligatoire.'); return; }
    const accId = $id('v33BankAccountAccounting')?.value || null; const acc = arr('accounts').find(a => String(a.id) === String(accId)) || {};
    const {error} = await c.from('compta_copro_bank_accounts').insert({copro_id:coproId,label:($id('v33BankLabel')?.value||'').trim() || 'Compte bancaire',iban,bic:($id('v33BankBic')?.value||'').trim(),account_id:accId,account_code:acc.code || '',account_type:$id('v33BankType')?.value || 'current',active:true});
    if(error){ alert(error.message); return; } state.v28CoproBankAccounts = null; await openSettingsPopup(coproId);
  }
  async function addFolder(coproId){
    const c = client(); const name = prompt('Nom du dossier'); if(!c || !name) return;
    const {error} = await c.from('compta_copro_folders').insert({copro_id:coproId,name:name.trim()});
    if(error){ alert(error.message); return; } state.v28Folders = null; await openSettingsPopup(coproId);
  }
  function ensureSettingsButton(){
    const select = $id('activeCoproSelect'); if(!select || $id('activeCoproSettingsBtn')) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn secondary small'; btn.id = 'activeCoproSettingsBtn'; btn.dataset.openCoproSettings = 'active'; btn.innerHTML = '<span class="sidebar-action-icon">'+icon('settings')+'</span><span>Réglages copro</span>';
    const box = select.closest('.active-copro-box') || select.parentElement; if(box) box.appendChild(btn);
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-v322-copro-settings], #activeCoproSettingsBtn, [data-open-copro-settings]');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const cid = btn.dataset.v322CoproSettings || (btn.dataset.openCoproSettings === 'active' ? requestedCoproId() : btn.dataset.openCoproSettings) || requestedCoproId();
    openSettingsPopup(cid);
  }, true);

  /* -----------------------------
     Compte comptable : recherche code OU libellé + liste.
  ----------------------------- */
  function accountText(a){ return [a?.code || '', a?.label || ''].filter(Boolean).join(' - '); }
  function accountMatches(query){
    const q = norm(query).replace(/^([0-9]{3,})\s*-.*$/, '$1');
    const accounts = arr('accounts').slice().sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'fr',{numeric:true}));
    if(!q) return accounts;
    return accounts.filter(a => norm(a.code||'').startsWith(q) || norm(a.label||'').includes(q) || norm(accountText(a)).includes(q));
  }
  function accountById(id){ return arr('accounts').find(a => String(a.id) === String(id)) || {}; }
  function accountByCode(code){ return arr('accounts').find(a => String(a.code || '') === String(code || '')) || {}; }
  function bankAccountFor(t){ return arr('bankAccounts').find(x => String(x.id) === String(t.bank_account_id)) || {}; }
  function statementFor(t){ return arr('bankStatements').find(x => String(x.id) === String(t.statement_id)) || {}; }
  function txCoproId(t){ return t.copro_id || bankAccountFor(t).copro_id || statementFor(t).copro_id || ''; }
  function bankCode(t){ const a = bankAccountFor(t); const acc = accountById(a?.account_id); return acc.code || a?.account_code || '550'; }
  function tierCode(type){ return type === 'supplier' ? '440' : type === 'owner' ? '410' : '499'; }
  function dateIn(date, from, to){ return !date || (date >= from && date <= to); }
  function accountingRowsV33(){
    const rows = [];
    function add(code,debit,credit,text,date,ref,copro,type,id){ const a = accountByCode(code); rows.push({code, label:a.label || '', debit:Number(debit||0), credit:Number(credit||0), text:text||'', date:date||'', ref:ref||'', copro_id:copro||'', source_type:type||'', source_id:id||''}); }
    arr('invoices').forEach(i => { const acc = accountById(i.account_id); const code = acc.code || i.account_code || '610'; const amount = Number(i.amount_total || i.amount || 0); add(code, amount, 0, i.description || i.invoice_number || 'Facture fournisseur', i.invoice_date || i.date, i.internal_invoice_number || i.invoice_number, i.copro_id, 'ACH', i.id); add('440', 0, amount, i.description || i.invoice_number || 'Fournisseur', i.invoice_date || i.date, i.internal_invoice_number || i.invoice_number, i.copro_id, 'ACH', i.id); });
    arr('ownerCalls').forEach(c => { const amount = Number(c.amount_due || c.amount || 0); const code = c.accounting_account_code || c.account_code || (c.call_type === 'reserve' ? '160' : c.call_type === 'working_fund' ? '100' : '701'); add('410', amount, 0, c.label || 'Appel de fonds', c.due_date || c.call_date, c.period_label || '', c.copro_id, 'VEN', c.id); add(code, 0, amount, c.label || 'Appel de fonds', c.due_date || c.call_date, c.period_label || '', c.copro_id, 'VEN', c.id); });
    arr('bankTransactions').forEach(t => { const amount = Number(t.amount || 0); const bank = bankCode(t); const tier = tierCode(t.tier_type); const lab = t.communication || t.description || t.counterparty_name || 'Mouvement bancaire'; if(amount >= 0){ add(bank, amount, 0, lab, t.transaction_date, t.statement_number, txCoproId(t), 'FIN', t.id); add(tier, 0, amount, lab, t.transaction_date, t.statement_number, txCoproId(t), 'FIN', t.id); } else { add(tier, Math.abs(amount), 0, lab, t.transaction_date, t.statement_number, txCoproId(t), 'FIN', t.id); add(bank, 0, Math.abs(amount), lab, t.transaction_date, t.statement_number, txCoproId(t), 'FIN', t.id); } });
    arr('entries').forEach(e => { const acc = accountById(e.account_id); add(acc.code || e.account_code || '499', Number(e.debit || 0), Number(e.credit || 0), e.description || e.label || 'OD', e.entry_date || e.date, e.reference, e.copro_id, e.journal_code || 'OD', e.id); });
    return rows;
  }
  function enhanceAccountLookupControl(){
    const input = $id('v28AccountLookupCode'); if(!input) return;
    input.placeholder = 'Tape un numéro OU un libellé — ex. 610, entretien, ascenseur';
    input.setAttribute('list','v33AccountDatalist');
    if(!$id('v33AccountDatalist')){ const dl = document.createElement('datalist'); dl.id = 'v33AccountDatalist'; document.body.appendChild(dl); }
    if(!$id('v33AccountSelect')){ const select = document.createElement('select'); select.id = 'v33AccountSelect'; select.innerHTML = '<option value="">Liste déroulante des comptes</option>'; input.insertAdjacentElement('afterend', select); select.addEventListener('change', () => { const acc = accountById(select.value); input.value = acc.code ? accountText(acc) : ''; renderAccountLookupV33(); }); }
    const parent = input.closest('label'); if(parent && !parent.classList.contains('v33-account-picker')){ parent.classList.add('v33-account-picker'); const help = document.createElement('div'); help.className = 'v33-account-help'; help.textContent = 'Recherche par numéro ou libellé. La liste déroulante est disponible en complément.'; parent.appendChild(help); }
  }
  function refreshAccountLookupOptions(){
    const opts = arr('accounts').slice().sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'fr',{numeric:true}));
    const dl = $id('v33AccountDatalist'); if(dl) dl.innerHTML = opts.map(a => '<option value="'+esc(accountText(a))+'"></option><option value="'+esc(a.code || '')+'"></option><option value="'+esc(a.label || '')+'"></option>').join('');
    const sel = $id('v33AccountSelect'); if(sel){ const keep = sel.value || ''; sel.innerHTML = '<option value="">Liste déroulante des comptes</option>' + opts.map(a => '<option value="'+esc(a.id)+'">'+esc(accountText(a))+'</option>').join(''); sel.value = keep; }
  }
  function renderAccountLookupV33(){
    const table = $id('v28AccountLookupTable'); if(!table || !stateOk()) return;
    enhanceAccountLookupControl(); refreshAccountLookupOptions();
    const raw = ($id('v28AccountLookupCode')?.value || '').trim();
    const matches = accountMatches(raw);
    const codeSet = new Set(matches.map(a => String(a.code || '')));
    const coproId = state.activeCoproId || $id('v28AccountLookupCopro')?.value || '';
    const from = $id('v28AccountLookupFrom')?.value || '0000-01-01';
    const to = $id('v28AccountLookupTo')?.value || '9999-12-31';
    const rows = accountingRowsV33().filter(r => (!raw || codeSet.has(String(r.code || ''))) && (!coproId || String(r.copro_id) === String(coproId)) && dateIn(r.date, from, to)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''),'fr',{numeric:true}));
    const debit = rows.reduce((s,r)=>s+Number(r.debit||0),0), credit = rows.reduce((s,r)=>s+Number(r.credit||0),0);
    if($id('v28AccountDebit')) $id('v28AccountDebit').textContent = moneySafe(debit);
    if($id('v28AccountCredit')) $id('v28AccountCredit').textContent = moneySafe(credit);
    if($id('v28AccountSolde')) $id('v28AccountSolde').textContent = moneySafe(debit-credit);
    table.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Journal</th><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th></tr></thead><tbody>' + (rows.map(r => '<tr><td>'+esc(r.date || '')+'</td><td>'+esc(String(r.source_type || '').toUpperCase())+'</td><td><strong>'+esc(r.code || '')+'</strong> '+esc(r.label || '')+'</td><td>'+esc(r.text || '')+'</td><td>'+(Number(r.debit||0)?moneySafe(r.debit):'')+'</td><td>'+(Number(r.credit||0)?moneySafe(r.credit):'')+'</td></tr>').join('') || '<tr><td colspan="6">Aucune ligne pour ce compte/libellé.</td></tr>') + '</tbody></table></div>';
  }
  window.renderAccountLookupV33 = renderAccountLookupV33;
  document.addEventListener('input', (e) => { if(e.target?.id === 'v28AccountLookupCode') setTimeout(renderAccountLookupV33, 0); }, false);
  document.addEventListener('change', (e) => { if(['v28AccountLookupCode','v28AccountLookupFrom','v28AccountLookupTo','v28AccountLookupCopro','v33AccountSelect'].includes(e.target?.id)) setTimeout(renderAccountLookupV33, 0); }, false);
  document.addEventListener('click', (e) => { if(e.target?.id === 'v28AccountLookupRefreshBtn'){ e.preventDefault(); setTimeout(renderAccountLookupV33, 0); } }, true);

  /* -----------------------------
     Installation V33
  ----------------------------- */
  function patchRenderAll(){
    safe(() => {
      if(typeof renderAll === 'function' && !renderAll.__v33){ const old = renderAll; const wrapped = function(){ const r = old.apply(this, arguments); setTimeout(() => { applyManagerFilterStrict(); ensureSettingsButton(); enhanceAccountLookupControl(); refreshAccountLookupOptions(); renderNavigation(); }, 0); return r; }; wrapped.__v33 = true; renderAll = wrapped; }
      if(typeof loadAll === 'function' && !loadAll.__v33){ const oldLoad = loadAll; const wrappedLoad = async function(){ const r = await oldLoad.apply(this, arguments); if(typeof window.loadUserProfilesV323 === 'function') await window.loadUserProfilesV323(); setTimeout(() => { applyManagerFilterStrict(); renderNavigation(); }, 0); return r; }; wrappedLoad.__v33 = true; loadAll = wrappedLoad; }
    }, 'patch render/load');
  }
  function init(){
    patchActiveCoproContext(); patchRenderAll();
    ensureSettingsButton(); enhanceAccountLookupControl(); refreshAccountLookupOptions(); applyManagerFilterStrict(); renderNavigation(currentView());
    setTimeout(() => { ensureSettingsButton(); enhanceAccountLookupControl(); refreshAccountLookupOptions(); applyManagerFilterStrict(); renderNavigation(currentView()); }, 300);
    setTimeout(() => { if(typeof window.loadUserProfilesV323 === 'function') window.loadUserProfilesV323().then(() => { applyManagerFilterStrict(); renderNavigation(currentView()); }); }, 900);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();

/* ============================================================
   V33.1 — Navigation définitivement stable + contexte de travail
   ============================================================ */
(function(){
  'use strict';
  const VERSION = 'WAPI One — V33.1';
  const STORAGE_KEY = 'wapi_one_manager_filter_user_id';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hasState = () => typeof state !== 'undefined' && state;
  const arr = (key) => hasState() && Array.isArray(state[key]) ? state[key] : [];
  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  const MODULES = [
    { id:'home', badge:'AC', label:'Accueil', hint:'Vue générale', defaultView:'dashboard', tabs:[['dashboard','Tableau de bord']] },
    { id:'pilotage', badge:'PI', label:'Pilotage', hint:'Traitement & envois', defaultView:'processing', tabs:[['processing','Centre traitement'],['invoiceOcr','OCR factures'],['codaPilot','Validation CODA'],['payments','Paiement factures'],['callDispatch','Envoi appels'],['inform','J’informe'],['sendJournal','Journal envois']] },
    { id:'copros', badge:'CP', label:'Copropriétés', hint:'Structure immeubles', defaultView:'copros', tabs:[['copros','Liste'],['lots','Lots'],['owners','Tiers copropriétaires'],['suppliers','Fournisseurs'],['distribution','Répartitions'],['buildings','Bâtiments'],['works','Travaux']] },
    { id:'compta', badge:'CO', label:'Comptabilité', hint:'Achats, banque, OD', defaultView:'invoices', tabs:[['invoices','Factures fournisseurs'],['bank','Encodage financier'],['od','Opérations diverses'],['meters','Relevés compteurs'],['budgets','Budgets'],['calls','Appels'],['statements','Décomptes'],['expensesList','Liste dépenses'],['exercises','Exercices']] },
    { id:'states', badge:'ET', label:'États comptables', hint:'Contrôles & rapports', defaultView:'accountLookup', tabs:[['accountLookup','Compte comptable'],['ledger','Grand livre'],['financialLedger','Grand livre financier'],['balance','Balance générale'],['thirdBalance','Balance tiers'],['journals','Journaux'],['bilan','Bilan'],['heldFunds','Fonds détenus'],['multicoproConsultation','Consultation multi-copro']] },
    { id:'ag', badge:'AG', label:'Assemblées', hint:'AG & résolutions', defaultView:'meetings', tabs:[['meetings','Assemblées'],['resolutions','Catalogue résolutions']] },
    { id:'syndic', badge:'SY', label:'Facturation syndic', hint:'Honoraires & exports', defaultView:'syndicBilling', tabs:[['syndicBilling','Tableau mensuel','campaigns'],['syndicBilling','Contrats','contracts'],['syndicBilling','Prestations / mutations','services'],['syndicBilling','Factures','invoices'],['syndicBilling','Export Clearfact','exports'],['syndicBilling','Réglages','settings']] },
    { id:'config', badge:'CF', label:'Configuration', hint:'Paramètres', defaultView:'agency', tabs:[['agency','Agence'],['accounts','Plan comptable'],['templates','Modèles'],['users','Utilisateurs'],['journalCodes','Journaux'],['bankInstitutions','Banques'],['vatCodes','Codes TVA'],['defaultExpenseTypes','Natures dépenses'],['accessControl','Accès'],['auditTrail','Audit'],['importsConfig','Imports'],['isabel','Isabel']] }
  ];
  const VIEW_TO_MODULE = new Map();
  MODULES.forEach(m => m.tabs.forEach(t => { if(!VIEW_TO_MODULE.has(t[0])) VIEW_TO_MODULE.set(t[0], m.id); }));

  function currentView(){
    const visible = Array.from(document.querySelectorAll('.view')).find(v => !v.classList.contains('hidden'));
    return visible ? visible.id.replace(/View$/,'') : 'dashboard';
  }
  function currentSyndicTab(){ return hasState() ? (state.syndicBillingTab || 'campaigns') : 'campaigns'; }
  function moduleFor(view){ return MODULES.find(m => m.id === (VIEW_TO_MODULE.get(view) || 'home')) || MODULES[0]; }
  function tabLabel(view, syndicTab){
    const m = moduleFor(view);
    const found = m.tabs.find(t => t[0] === view && (!t[2] || !syndicTab || t[2] === syndicTab)) || m.tabs.find(t => t[0] === view);
    return found ? found[1] : m.label;
  }
  function managerId(){ return hasState() ? (state.managerFilterUserId || localStorage.getItem(STORAGE_KEY) || '') : (localStorage.getItem(STORAGE_KEY) || ''); }
  function coproManagerId(c){ return c?.manager_user_id || c?.manager_id || ''; }
  function filteredCopros(){
    const list = arr('copros');
    const m = managerId();
    return m ? list.filter(c => String(coproManagerId(c)) === String(m)) : list;
  }
  function managerLabel(u){ return u?.display_name || u?.email || 'Utilisateur'; }
  function coproLabel(c){ return [c?.code || c?.copro_code || c?.optipro_ref || '', c?.name || ''].filter(Boolean).join(' - ') || 'Copropriété'; }
  function yearLabel(y){ return [y?.code || y?.year_code || '', y?.label || y?.name || ''].filter(Boolean).join(' - ') || 'Exercice'; }
  function setTextButtons(){
    const toggle = $('toggleSidebarBtn');
    const app = $('appScreen');
    if(toggle){
      const collapsed = app?.classList.contains('sidebar-collapsed');
      toggle.innerHTML = '<span class="wapi-btn-text">' + (collapsed ? 'Étendre le menu' : 'Réduire le menu') + '</span>';
      toggle.title = collapsed ? 'Repasser au menu large' : 'Passer au rail compact';
    }
    const hide = $('hideSidebarBtn');
    if(hide){ hide.innerHTML = '<span class="wapi-btn-text">Masquer</span>'; hide.title = 'Masquer complètement la barre latérale'; }
  }

  function renderNavigationStable(viewName){
    viewName = viewName || currentView();
    const mod = moduleFor(viewName);
    const nav = document.querySelector('.nav');
    const tabs = $('moduleTabs');
    document.body.dataset.wapiNav = 'v331';
    window.WAPI_ONE_VERSION = VERSION;
    document.title = VERSION;
    const badge = document.querySelector('.app-version-badge') || document.querySelector('.wapi-version-badge');
    if(badge) badge.textContent = VERSION;
    if(nav){
      nav.innerHTML = MODULES.map(m => {
        const active = m.id === mod.id;
        return '<button type="button" class="wapi-nav-btn ' + (active ? 'active' : '') + '" data-v331-module="' + esc(m.id) + '" title="' + esc(m.label + ' — ' + m.hint) + '">' +
          '<span class="wapi-nav-badge">' + esc(m.badge) + '</span>' +
          '<span class="wapi-nav-label"><strong>' + esc(m.label) + '</strong><span>' + esc(m.hint) + '</span></span>' +
        '</button>';
      }).join('');
    }
    if(tabs){
      tabs.innerHTML = mod.tabs.map(t => {
        const view = t[0], label = t[1], syndicTab = t[2] || '';
        const active = view === viewName && (!syndicTab || currentSyndicTab() === syndicTab);
        const attr = syndicTab ? ' data-v331-syndic-tab="' + esc(syndicTab) + '" data-v25-syndic-tab="' + esc(syndicTab) + '" data-v23-syndic-tab="' + esc(syndicTab) + '"' : '';
        return '<button type="button" class="wapi-tab ' + (active ? 'active' : '') + '" data-v331-tab="1" data-view="' + esc(view) + '" data-title="' + esc(label) + '"' + attr + '>' + esc(label) + '</button>';
      }).join('');
    }
    setTextButtons();
    ensureContextBar();
    refreshContextBar();
  }

  function refreshViewRender(viewName){
    try{
      if(viewName === 'accountLookup' && typeof window.renderAccountLookupV33 === 'function') setTimeout(window.renderAccountLookupV33, 0);
      if(viewName === 'codaPilot' && typeof window.v33RenderCodaPilotV322 === 'function') setTimeout(window.v33RenderCodaPilotV322, 0);
      if(viewName === 'invoices' && typeof window.v33RenderInvoicesV322 === 'function') setTimeout(window.v33RenderInvoicesV322, 0);
      if(viewName === 'copros' && typeof window.v33RenderCoprosV322 === 'function') setTimeout(window.v33RenderCoprosV322, 0);
      if(viewName === 'syndicBilling' && typeof renderSyndicBillingV25 === 'function') setTimeout(renderSyndicBillingV25, 0);
    }catch(e){ console.warn('V33.1 rendu vue', e); }
  }
  function activateStable(viewName, title, syndicTab){
    if(!viewName) return;
    if(hasState() && syndicTab) state.syndicBillingTab = syndicTab;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = $(viewName + 'View');
    if(target) target.classList.remove('hidden');
    const m = moduleFor(viewName);
    const h = $('pageTitle'); if(h) h.textContent = title || tabLabel(viewName, syndicTab);
    const sub = $('pageSubtitle');
    if(sub){
      const c = hasState() && state.activeCoproId ? arr('copros').find(x => String(x.id) === String(state.activeCoproId)) : null;
      sub.textContent = m.label + ' • ' + (c ? coproLabel(c) : (managerId() ? 'Mode global filtré par gestionnaire' : 'Mode global'));
    }
    refreshViewRender(viewName);
    renderNavigationStable(viewName);
  }

  function ensureContextBar(){
    const tabs = $('moduleTabs'); if(!tabs || $('wapiContextBar')) return;
    const bar = document.createElement('div');
    bar.id = 'wapiContextBar';
    bar.className = 'wapi-context-bar';
    bar.innerHTML = '<label class="wapi-context-field"><span>Gestionnaire</span><select id="wapiCtxManager"></select></label>' +
      '<label class="wapi-context-field"><span>Copropriété</span><select id="wapiCtxCopro"></select></label>' +
      '<label class="wapi-context-field"><span>Exercice</span><span id="wapiCtxYearSlot"></span></label>' +
      '<label class="wapi-context-field"><span>Module</span><select id="wapiCtxModule"></select></label>' +
      '<div class="wapi-context-actions"><button class="btn secondary small" type="button" id="wapiCtxSettingsBtn">Réglages copro</button><button class="btn secondary small" type="button" id="wapiCtxAdvancedBtn">Filtres avancés</button></div>' +
      '<div class="wapi-context-hint" id="wapiCtxHint">Choisis le périmètre de travail une seule fois : gestionnaire, copropriété et exercice. Les filtres répétés dans les modules sont masqués par défaut.</div>';
    tabs.parentElement.insertBefore(bar, tabs);
    const year = $('activeFiscalYearSelect');
    const slot = $('wapiCtxYearSlot');
    if(year && slot && year.parentElement !== slot){ slot.appendChild(year); }
    $('wapiCtxManager')?.addEventListener('change', function(){
      if(hasState()) state.managerFilterUserId = this.value || '';
      if(this.value) localStorage.setItem(STORAGE_KEY, this.value); else localStorage.removeItem(STORAGE_KEY);
      const side = $('activeManagerFilter'); if(side) side.value = this.value || '';
      if(hasState() && state.activeCoproId && !filteredCopros().some(c => String(c.id) === String(state.activeCoproId))){
        if(typeof setActiveCopro === 'function') setActiveCopro(''); else state.activeCoproId = '';
      }
      try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
      setTimeout(() => { refreshContextBar(); renderNavigationStable(currentView()); }, 0);
    });
    $('wapiCtxCopro')?.addEventListener('change', function(){
      if(typeof setActiveCopro === 'function') setActiveCopro(this.value || '');
      else if(hasState()) state.activeCoproId = this.value || '';
      const side = $('activeCoproSelect'); if(side) side.value = this.value || '';
      try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
      setTimeout(() => { refreshContextBar(); renderNavigationStable(currentView()); }, 0);
    });
    $('wapiCtxModule')?.addEventListener('change', function(){
      const m = MODULES.find(x => x.id === this.value);
      if(!m) return;
      const t = m.tabs[0];
      activateStable(m.defaultView, t[1], t[2] || '');
    });
    $('wapiCtxSettingsBtn')?.addEventListener('click', function(){
      const cid = hasState() ? (state.activeCoproId || $('wapiCtxCopro')?.value || '') : ($('wapiCtxCopro')?.value || '');
      if(!cid){ alert('Choisis d’abord une copropriété.'); return; }
      if(typeof window.openCoproSettingsPopupV33 === 'function') window.openCoproSettingsPopupV33(cid);
      else if(typeof window.openCoproSettingsPopupV3234 === 'function') window.openCoproSettingsPopupV3234(cid);
    });
    $('wapiCtxAdvancedBtn')?.addEventListener('click', function(){
      document.body.classList.toggle('wapi-show-module-filters');
      this.textContent = document.body.classList.contains('wapi-show-module-filters') ? 'Masquer filtres avancés' : 'Filtres avancés';
    });
  }
  function optionsHtml(list, selected, labelFn, empty){
    return '<option value="">' + esc(empty) + '</option>' + (list || []).map(item => '<option value="' + esc(item.id) + '" ' + (String(selected || '') === String(item.id) ? 'selected' : '') + '>' + esc(labelFn(item)) + '</option>').join('');
  }
  function refreshContextBar(){
    ensureContextBar();
    const managers = arr('userProfiles').filter(u => u.active !== false);
    const selectedManager = managerId();
    const managerSelect = $('wapiCtxManager');
    if(managerSelect){
      const value = managerSelect.value;
      managerSelect.innerHTML = optionsHtml(managers, selectedManager || value, managerLabel, 'Tous les gestionnaires');
      managerSelect.value = selectedManager || '';
    }
    const copros = filteredCopros();
    const selectedCopro = hasState() ? (state.activeCoproId || '') : '';
    const coproSelect = $('wapiCtxCopro');
    if(coproSelect){
      coproSelect.innerHTML = optionsHtml(copros, selectedCopro, coproLabel, selectedManager ? 'Aucune copropriété sélectionnée' : 'Mode global');
      coproSelect.value = copros.some(c => String(c.id) === String(selectedCopro)) ? selectedCopro : '';
    }
    const moduleSelect = $('wapiCtxModule');
    if(moduleSelect){
      const currentModuleId = moduleFor(currentView()).id;
      moduleSelect.innerHTML = MODULES.map(m => '<option value="' + esc(m.id) + '" ' + (m.id === currentModuleId ? 'selected' : '') + '>' + esc(m.label) + '</option>').join('');
    }
    const sideManager = $('activeManagerFilter'); if(sideManager) sideManager.value = selectedManager || '';
    setTextButtons();
  }

  function installStableHooks(){
    window.v33RenderNavigation = renderNavigationStable;
    window.v28RenderNav = renderNavigationStable;
    window.decorateV26Icons = function(){ renderNavigationStable(currentView()); };
    window.switchToView = function(view){ activateStable(view); };

    document.addEventListener('click', function(e){
      const main = e.target.closest?.('[data-v331-module]');
      if(main){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const m = MODULES.find(x => x.id === main.dataset.v331Module) || MODULES[0];
        const t = m.tabs[0];
        activateStable(m.defaultView, t[1], t[2] || '');
        return;
      }
      const tab = e.target.closest?.('[data-v331-tab]');
      if(tab){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        activateStable(tab.dataset.view, tab.dataset.title, tab.dataset.v331SyndicTab || '');
      }
    }, true);

    const delayed = () => { setTimeout(() => renderNavigationStable(currentView()), 0); setTimeout(() => renderNavigationStable(currentView()), 120); };
    $('toggleSidebarBtn')?.addEventListener('click', delayed, true);
    $('hideSidebarBtn')?.addEventListener('click', delayed, true);
    document.querySelector('.sidebar')?.addEventListener('click', function(){ setTimeout(() => renderNavigationStable(currentView()), 80); }, true);

    try{
      if(typeof renderAll === 'function' && !renderAll.__v331){
        const old = renderAll;
        const wrapped = function(){
          const result = old.apply(this, arguments);
          setTimeout(() => { refreshContextBar(); renderNavigationStable(currentView()); }, 0);
          return result;
        };
        wrapped.__v331 = true;
        renderAll = wrapped;
      }
      if(typeof loadAll === 'function' && !loadAll.__v331){
        const oldLoad = loadAll;
        const wrappedLoad = async function(){
          const result = await oldLoad.apply(this, arguments);
          setTimeout(() => { refreshContextBar(); renderNavigationStable(currentView()); }, 0);
          return result;
        };
        wrappedLoad.__v331 = true;
        loadAll = wrappedLoad;
      }
    }catch(e){ console.warn('V33.1 hooks', e); }
  }

  function init(){
    installStableHooks();
    renderNavigationStable(currentView());
    setTimeout(() => renderNavigationStable(currentView()), 300);
    setTimeout(() => { if(typeof window.loadUserProfilesV323 === 'function') window.loadUserProfilesV323().then(() => { refreshContextBar(); renderNavigationStable(currentView()); }); }, 900);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
