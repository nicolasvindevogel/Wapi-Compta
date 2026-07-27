/* ============================================================
   WAPI One V32.2 — intégration stable ciblée
   - icônes sidebar SVG sans observer infini
   - codes tiers + numérotation facture interne
   - tri factures fournisseurs par colonne
   - CODA paiement/encaissement
   - raccourcis réglages copro
   ============================================================ */
(function(){
  'use strict';
  window.WAPI_ONE_VERSION = 'V32.2 - codes tiers, factures internes, CODA stable';
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
  function applySidebarIcons(){
    iconPending = false;
    safe(()=>{
      document.querySelectorAll('.nav-icon,.menu-group__icon,.main-module-icon,.module-tab .tab-icon,.module-tab span:first-child').forEach(el=>{
        if (!el || el.querySelector('svg.v32-svg-icon')) return;
        el.innerHTML = svg(guessIcon(el));
      });
    }, 'icones V32.2');
  }
  function scheduleIcons(){ if (iconPending) return; iconPending = true; requestAnimationFrame(applySidebarIcons); }

  function addVersionBadge(){
    safe(()=>{
      const box = document.querySelector('.brand-copy');
      if (box && !document.getElementById('wapiVersionBadge')) box.insertAdjacentHTML('beforeend', '<div class="wapi-version-badge" id="wapiVersionBadge">WAPI One — V32.2</div>');
      document.title = 'WAPI One — V32.2';
    });
  }

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
      if (cs) { e.preventDefault(); if (typeof setActiveCopro === 'function') setActiveCopro(cs.dataset.v322CoproSettings); if (typeof switchToView === 'function') switchToView('coproSettings'); setTimeout(afterRender,0); return; }
      const tog = e.target.closest?.('[data-v322-coda-toggle]');
      if (tog && !e.target.closest('button,input,select')) { state.v322OpenCodaId = state.v322OpenCodaId === tog.dataset.v322CodaToggle ? '' : tog.dataset.v322CodaToggle; renderCodaPilotV322(); return; }
      const save = e.target.closest?.('[data-v322-save-coda-tx]'); if (save) { e.preventDefault(); saveCodaTxV322(save.dataset.v322SaveCodaTx); return; }
      const valid = e.target.closest?.('[data-v322-coda-validate]'); if (valid) { e.preventDefault(); validateCodaV322(valid.dataset.v322CodaValidate); return; }
      setTimeout(scheduleIcons, 0);
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
