(function () {
  'use strict';

  const VERSION = '34.4';
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const appState = () => typeof state !== 'undefined' ? state : null;
  const list = (name) => Array.isArray(appState()?.[name]) ? appState()[name] : [];
  const db = () => typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  const userId = () => typeof currentUser !== 'undefined' ? currentUser?.id || null : null;
  const currentCoproId = () => appState()?.activeCoproId || byId('activeCoproSelect')?.value || '';
  const fullAddress = (x) => [
    [x?.street, x?.street_number].filter(Boolean).join(' '),
    [x?.postal_code, x?.city].filter(Boolean).join(' '),
    x?.country
  ].filter(Boolean).join(', ');

  function setVersion() {
    document.querySelectorAll('[data-version-badge], .app-version, .version-badge').forEach((el) => {
      if (/WAPI|V3|version/i.test(el.textContent || '')) el.textContent = `WAPI One — V${VERSION}`;
    });
  }

  function modal(title, body, footer, subtitle = '') {
    if (typeof window.openAppModal === 'function') {
      window.openAppModal(title, body, footer, { subtitle, size: 'wide' });
      return;
    }
    const back = byId('globalModalBackdrop');
    byId('globalModalTitle').textContent = title;
    byId('globalModalSubtitle').textContent = subtitle;
    byId('globalModalBody').innerHTML = body;
    byId('globalModalFooter').innerHTML = footer;
    back.classList.remove('hidden');
    back.style.display = '';
    back.style.pointerEvents = '';
  }

  async function reload() {
    if (typeof window.loadAll === 'function') await window.loadAll();
    else if (typeof window.renderAll === 'function') window.renderAll();
    setTimeout(refreshActiveCoproSelect, 0);
  }

  function managerOptions(selected = '') {
    return '<option value="">Aucun gestionnaire</option>' + list('userProfiles')
      .filter((u) => u.active !== false)
      .map((u) => {
        const label = u.full_name || u.display_name || u.name || u.email || 'Utilisateur';
        return `<option value="${esc(u.id)}" ${String(u.id) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`;
      }).join('');
  }

  function addressFields(prefix, record = {}) {
    return `<div class="v344-address-grid">
      <label class="v344-street">Rue<input id="${prefix}Street" value="${esc(record.street || '')}" autocomplete="street-address"></label>
      <label>Numéro<input id="${prefix}StreetNumber" value="${esc(record.street_number || '')}"></label>
      <label>Code postal<input id="${prefix}PostalCode" value="${esc(record.postal_code || '')}" inputmode="numeric"></label>
      <label>Ville<input id="${prefix}City" value="${esc(record.city || '')}"></label>
      <label>Pays<input id="${prefix}Country" value="${esc(record.country || 'Belgique')}"></label>
    </div>`;
  }

  function readAddress(prefix) {
    const out = {
      street: byId(prefix + 'Street')?.value.trim() || null,
      street_number: byId(prefix + 'StreetNumber')?.value.trim() || null,
      postal_code: byId(prefix + 'PostalCode')?.value.trim() || null,
      city: byId(prefix + 'City')?.value.trim() || null,
      country: byId(prefix + 'Country')?.value.trim() || 'Belgique'
    };
    out.address = fullAddress(out);
    return out;
  }

  /* Assistant de création d'une copropriété et de sa structure initiale. */
  let wizard = null;
  function newWizard() {
    const year = new Date().getFullYear();
    return {
      step: 1,
      copro: { name: '', code: '', bce: '', street: '', street_number: '', postal_code: '', city: '', country: 'Belgique', manager_user_id: '' },
      year: { create: true, label: String(year), code: `EX${String(year).slice(-2)}`, starts_on: `${year}-01-01`, ends_on: `${year}-12-31` },
      lots: []
    };
  }
  function wizardSteps() {
    return ['Copropriété', 'Exercice', 'Lots', 'Confirmation'].map((label, i) =>
      `<span class="v344-step ${wizard.step === i + 1 ? 'active' : ''} ${wizard.step > i + 1 ? 'done' : ''}"><b>${i + 1}</b>${label}</span>`
    ).join('');
  }
  function saveWizardScreen() {
    if (!wizard) return;
    if (wizard.step === 1) {
      wizard.copro = {
        ...wizard.copro,
        name: byId('v344NewName')?.value.trim() || '',
        code: byId('v344NewCode')?.value.trim().toUpperCase() || '',
        bce: byId('v344NewBce')?.value.trim() || '',
        manager_user_id: byId('v344NewManager')?.value || '',
        ...readAddress('v344New')
      };
    } else if (wizard.step === 2) {
      wizard.year = {
        create: byId('v344CreateYear')?.checked !== false,
        label: byId('v344YearLabel')?.value.trim() || '',
        code: byId('v344YearCode')?.value.trim().toUpperCase() || '',
        starts_on: byId('v344YearStart')?.value || '',
        ends_on: byId('v344YearEnd')?.value || ''
      };
    } else if (wizard.step === 3) {
      wizard.lots = [...document.querySelectorAll('[data-v344-lot-row]')].map((row) => ({
        lot_number: row.querySelector('[data-field="number"]').value.trim(),
        lot_type: row.querySelector('[data-field="type"]').value,
        quotities: Number(row.querySelector('[data-field="quotities"]').value || 0)
      })).filter((x) => x.lot_number);
    }
  }
  function wizardBody() {
    let content = '';
    if (wizard.step === 1) {
      content = `<div class="form-grid">
        <label>Nom de la copropriété<input id="v344NewName" value="${esc(wizard.copro.name)}" placeholder="Résidence..." autofocus></label>
        <label>Code copro<input id="v344NewCode" value="${esc(wizard.copro.code)}" placeholder="ALB" maxlength="12"></label>
        <label>BCE<input id="v344NewBce" value="${esc(wizard.copro.bce)}" placeholder="BE 0..."></label>
        <label>Gestionnaire<select id="v344NewManager">${managerOptions(wizard.copro.manager_user_id)}</select></label>
      </div><h3>Adresse</h3>${addressFields('v344New', wizard.copro)}`;
    } else if (wizard.step === 2) {
      content = `<label class="v344-check"><input id="v344CreateYear" type="checkbox" ${wizard.year.create ? 'checked' : ''}> Créer immédiatement le premier exercice comptable</label>
        <div class="form-grid">
          <label>Libellé<input id="v344YearLabel" value="${esc(wizard.year.label)}"></label>
          <label>Code exercice<input id="v344YearCode" value="${esc(wizard.year.code)}" placeholder="EX26"></label>
          <label>Date de début<input id="v344YearStart" type="date" value="${esc(wizard.year.starts_on)}"></label>
          <label>Date de fin<input id="v344YearEnd" type="date" value="${esc(wizard.year.ends_on)}"></label>
        </div><div class="notice">L'exercice apparaîtra aussi dans <strong>Exercices comptables</strong>. Une clé « Quotités générales » sera créée automatiquement.</div>`;
    } else if (wizard.step === 3) {
      content = `<div class="v344-lot-generator">
        <label>Type<select id="v344LotType">${['Appartement','Parking','Garage','Cave','Commerce','Autre'].map(x=>`<option>${x}</option>`).join('')}</select></label>
        <label>Préfixe<input id="v344LotPrefix" value="A"></label>
        <label>Nombre<input id="v344LotCount" type="number" min="1" value="5"></label>
        <label>Départ<input id="v344LotStart" type="number" min="0" value="1"></label>
        <button class="btn secondary" id="v344GenerateLots" type="button">Ajouter les lots</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>N° lot</th><th>Type</th><th>Quotités</th><th></th></tr></thead>
      <tbody id="v344LotsBody">${wizard.lots.map((lot, i) => lotRow(lot, i)).join('') || '<tr class="v344-empty"><td colspan="4">Tu peux créer les lots maintenant ou les compléter plus tard.</td></tr>'}</tbody></table></div>`;
    } else {
      const totalQ = wizard.lots.reduce((sum, x) => sum + Number(x.quotities || 0), 0);
      content = `<div class="v344-summary">
        <div><span>Copropriété</span><strong>${esc(wizard.copro.code)} — ${esc(wizard.copro.name)}</strong><small>${esc(fullAddress(wizard.copro))}</small></div>
        <div><span>Exercice</span><strong>${wizard.year.create ? esc(`${wizard.year.code} — ${wizard.year.label}`) : 'À créer plus tard'}</strong></div>
        <div><span>Structure</span><strong>${wizard.lots.length} lot(s)</strong><small>${totalQ.toLocaleString('fr-BE')} quotités encodées</small></div>
      </div><div class="notice">Après création, tu pourras compléter les propriétaires, les clés spéciales et les coordonnées bancaires depuis les modules habituels.</div>`;
    }
    return `<div class="v344-wizard"><div class="v344-steps">${wizardSteps()}</div><div class="v344-step-content">${content}</div></div>`;
  }
  function lotRow(lot, i) {
    return `<tr data-v344-lot-row="${i}"><td><input data-field="number" value="${esc(lot.lot_number)}"></td>
      <td><select data-field="type">${['Appartement','Parking','Garage','Cave','Commerce','Autre'].map(x=>`<option ${x===lot.lot_type?'selected':''}>${x}</option>`).join('')}</select></td>
      <td><input data-field="quotities" type="number" min="0" step="0.0001" value="${Number(lot.quotities || 0)}"></td>
      <td><button class="btn danger small" type="button" data-v344-remove-lot="${i}">Supprimer</button></td></tr>`;
  }
  function showWizard() {
    const footer = `<button class="btn secondary" type="button" data-modal-close>Annuler</button>
      ${wizard.step > 1 ? '<button class="btn secondary" id="v344Prev" type="button">Retour</button>' : ''}
      <button class="btn" id="${wizard.step === 4 ? 'v344CreateCopro' : 'v344Next'}" type="button">${wizard.step === 4 ? 'Créer la copropriété' : 'Continuer'}</button>`;
    modal('Nouvelle copropriété', wizardBody(), footer, 'Créer l’essentiel en une seule fois');
    byId('v344Prev')?.addEventListener('click', () => { saveWizardScreen(); wizard.step--; showWizard(); });
    byId('v344Next')?.addEventListener('click', () => {
      saveWizardScreen();
      if (wizard.step === 1 && (!wizard.copro.name || !wizard.copro.code)) return alert('Le nom et le code copro sont obligatoires.');
      if (wizard.step === 2 && wizard.year.create && (!wizard.year.code || !wizard.year.starts_on || !wizard.year.ends_on)) return alert('Complète le code et les dates de l’exercice.');
      wizard.step++; showWizard();
    });
    byId('v344GenerateLots')?.addEventListener('click', () => {
      saveWizardScreen();
      const type = byId('v344LotType').value, prefix = byId('v344LotPrefix').value.trim();
      const count = Math.max(1, Number(byId('v344LotCount').value || 1)), start = Number(byId('v344LotStart').value || 1);
      for (let i = 0; i < count; i++) wizard.lots.push({ lot_number: `${prefix}${start + i}`, lot_type: type, quotities: 0 });
      showWizard();
    });
    byId('v344CreateCopro')?.addEventListener('click', createCoproStructure);
  }
  async function createCoproStructure() {
    const manager = list('userProfiles').find((u) => String(u.id) === String(wizard.copro.manager_user_id));
    const pCopro = { ...wizard.copro, manager_name: manager?.full_name || manager?.display_name || manager?.email || '' };
    const button = byId('v344CreateCopro'); button.disabled = true; button.textContent = 'Création…';
    const { data, error } = await db().rpc('wapi_create_copro_structure', { p_copro: pCopro, p_year: wizard.year, p_lots: wizard.lots });
    if (error) { button.disabled = false; button.textContent = 'Créer la copropriété'; return alert(error.message + '\n\nVérifie que la migration SQL V34.4 a bien été exécutée.'); }
    if (typeof window.closeAppModal === 'function') window.closeAppModal();
    if (appState()) {
      state.activeCoproId = data?.copro_id || '';
      state.activeFiscalYearId = data?.fiscal_year_id || '';
      localStorage.setItem('compta_active_copro_id', state.activeCoproId);
    }
    await reload();
    if (typeof window.switchToView === 'function') window.switchToView('copros');
  }

  /* Réglages copro : adresse structurée et création d'exercice. */
  function enhanceSettings() {
    const old = byId('v33CoproAddress');
    if (!old || byId('v344SettingsStreet')) return;
    const copro = list('copros').find((c) => String(c.id) === String(currentCoproId())) || {};
    const label = old.closest('label');
    const wrap = document.createElement('div');
    wrap.className = 'v344-address-section';
    wrap.innerHTML = `<h3>Adresse structurée</h3>${addressFields('v344Settings', copro)}`;
    label.replaceWith(wrap);
    const year = byId('v33FiscalYearSelect');
    if (year && !byId('v344NewYearBtn')) {
      const btn = document.createElement('button');
      btn.id = 'v344NewYearBtn'; btn.type = 'button'; btn.className = 'btn secondary small'; btn.textContent = '+ Nouvel exercice';
      year.closest('label').appendChild(btn);
      btn.addEventListener('click', openNewYear);
    }
  }
  function openNewYear() {
    const id = currentCoproId(); if (!id) return alert('Sélectionne une copropriété.');
    const year = new Date().getFullYear() + 1;
    modal('Créer un exercice', `<div class="form-grid">
      <label>Libellé<input id="v344NyLabel" value="${year}"></label><label>Code<input id="v344NyCode" value="EX${String(year).slice(-2)}"></label>
      <label>Début<input id="v344NyStart" type="date" value="${year}-01-01"></label><label>Fin<input id="v344NyEnd" type="date" value="${year}-12-31"></label>
    </div>`, '<button class="btn secondary" type="button" data-modal-close>Annuler</button><button class="btn" id="v344SaveYear" type="button">Créer</button>', 'Disponible immédiatement dans Exercices comptables');
    byId('v344SaveYear').onclick = async () => {
      const payload = { copro_id:id, label:byId('v344NyLabel').value.trim(), code:byId('v344NyCode').value.trim().toUpperCase(), year_code:byId('v344NyCode').value.trim().toUpperCase(), starts_on:byId('v344NyStart').value, ends_on:byId('v344NyEnd').value, status:'open', created_by:userId() };
      const {data,error} = await db().from('compta_fiscal_years').insert(payload).select().single();
      if(error) return alert(error.message);
      if(appState()) state.activeFiscalYearId = data.id;
      await reload();
      window.openCoproSettingsPopupV33?.(id);
    };
  }
  async function saveSettingsStructured(coproId) {
    const managerId = byId('v33CoproManagerUser')?.value || null;
    const manager = list('userProfiles').find((u) => String(u.id) === String(managerId));
    const payload = {
      code: byId('v33CoproCode').value.trim().toUpperCase(), name: byId('v33CoproName').value.trim(),
      bce: byId('v33CoproBce').value.trim() || null, manager_user_id: managerId,
      manager_name: manager?.full_name || manager?.display_name || manager?.email || '',
      ...readAddress('v344Settings')
    };
    if (!payload.name) return alert('Le nom est obligatoire.');
    const {error} = await db().from('compta_copros').update(payload).eq('id', coproId);
    if(error) return alert(error.message);
    const yearId = byId('v33FiscalYearSelect')?.value;
    if(yearId) {
      const code = byId('v33FiscalYearCode')?.value.trim().toUpperCase() || '';
      const {error:yearError} = await db().from('compta_fiscal_years').update({code,year_code:code,last_internal_invoice_no:Number(byId('v33LastInternalInvoiceNo')?.value||0)}).eq('id',yearId);
      if(yearError) return alert(yearError.message);
    }
    await reload();
    alert('Réglages enregistrés.');
    window.openCoproSettingsPopupV33?.(coproId);
  }

  /* Tiers : adresses structurées, VCS et suppression sécurisée. */
  function enhanceIdentityModal() {
    const old = byId('modalIdentityAddress');
    if (!old || byId('v344IdentityStreet')) return;
    const type = window.state?.selectedIdentityType || 'owner';
    const id = window.state?.selectedIdentityId;
    const source = type === 'supplier' ? list('suppliers') : type === 'occupant' ? list('occupants') : list('owners');
    const record = source.find((x) => String(x.id) === String(id)) || {};
    const label = old.closest('label'), wrap = document.createElement('div');
    wrap.className = 'v344-address-section'; wrap.innerHTML = `<h3>Adresse structurée</h3>${addressFields('v344Identity', record)}`;
    label.replaceWith(wrap);
    if(type === 'owner') {
      wrap.insertAdjacentHTML('afterend', `<label class="v344-vcs">Communication structurée VCS<input value="${esc(record.vcs || 'Générée automatiquement à l’enregistrement')}" readonly></label>`);
      if(id && !byId('v344DeleteOwner')) {
        byId('globalModalFooter').insertAdjacentHTML('afterbegin', '<button class="btn danger" id="v344DeleteOwner" type="button">Supprimer le copropriétaire</button>');
        byId('v344DeleteOwner').onclick = () => deleteOwner(id);
      }
    }
  }
  async function saveIdentityStructured() {
    const type=state.selectedIdentityType || 'owner', id=state.selectedIdentityId;
    const name=byId('modalIdentityName').value.trim(); if(!name) return alert('Indique le nom / la dénomination.');
    let table='compta_owners';
    const payload={email:byId('modalIdentityEmail').value.trim()||null,phone:byId('modalIdentityPhone').value.trim()||null,iban:byId('modalIdentityIban').value.trim()||null,...readAddress('v344Identity')};
    if(type==='owner'){payload.display_name=name;payload.delivery_preference=byId('modalIdentityDeliveryPreference')?.value||'email';}
    if(type==='supplier'){table='compta_suppliers';payload.name=name;}
    if(type==='occupant'){table='compta_occupants';payload.display_name=name;}
    if(type!=='supplier'){payload.copro_id=byId('modalIdentityCopro')?.value||currentCoproId()||null;if(!payload.copro_id)return alert('Choisis une copropriété.');}
    if(!id) payload.created_by=userId();
    const request=id?db().from(table).update(payload).eq('id',id):db().from(table).insert(payload);
    const {error}=await request;if(error)return alert(error.message);
    window.closeAppModal?.();await reload();
  }
  async function deleteOwner(id) {
    if(!confirm('Supprimer ce copropriétaire ? Cette action sera refusée si un lot ou une opération comptable lui est lié.')) return;
    const {data,error}=await db().rpc('wapi_delete_owner_if_unused',{p_owner_id:id});
    if(error) return alert(error.message);
    if(!data?.deleted) return alert(`Suppression impossible : ${data?.lots||0} lot(s) et ${data?.accounting||0} opération(s) comptable(s) sont liés.`);
    window.closeAppModal?.();await reload();
  }
  function renderOwnersV344() {
    const host=byId('ownersTable');if(!host)return;
    const type=state.selectedIdentityType||'owner', copro=currentCoproId();
    let rows=type==='supplier'?list('suppliers').map(x=>({...x,_name:x.name,_type:'supplier'})):type==='occupant'?list('occupants').filter(x=>!copro||x.copro_id===copro).map(x=>({...x,_name:x.display_name,_type:'occupant'})):list('owners').filter(x=>!copro||x.copro_id===copro||list('lots').some(l=>l.copro_id===copro&&l.owner_id===x.id)).map(x=>({...x,_name:x.display_name,_type:'owner'}));
    host.innerHTML=`<div class="summary-line"><span class="badge">${rows.length} tiers</span></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th>${type==='owner'?'<th>Communication VCS</th>':''}<th>Email</th><th>Adresse</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><span class="code-pill">${esc(type==='supplier'?x.supplier_code:x.owner_code||'—')}</span></td><td>${esc(x._name)}</td>${type==='owner'?`<td><code>${esc(x.vcs||'À générer')}</code></td>`:''}<td>${esc(x.email||'')}</td><td>${esc(fullAddress(x)||x.address||'')}</td><td>${x.active===false?'<span class="badge">Inactif</span>':'<span class="badge ok">Actif</span>'}</td><td><button class="btn secondary small" data-open-identity="${x._type}|${x.id}">Ouvrir</button></td></tr>`).join('')||`<tr><td colspan="${type==='owner'?7:6}">Aucun tiers.</td></tr>`}</tbody></table></div>`;
  }

  /* Copropriétés actives / archivées. */
  let coproTab='active';
  function filteredCopros() {
    const base=typeof window.v33FilteredCopros==='function'?window.v33FilteredCopros():list('copros');
    return base.filter(c=>coproTab==='archived'?c.active===false:c.active!==false);
  }
  function renderCoprosV344() {
    const host=byId('coprosTable');if(!host)return;
    const active=list('copros').filter(c=>c.active!==false).length, archived=list('copros').filter(c=>c.active===false).length, rows=filteredCopros();
    host.innerHTML=`<div class="v344-copro-tabs"><button class="${coproTab==='active'?'active':''}" data-v344-copro-tab="active">Actives <b>${active}</b></button><button class="${coproTab==='archived'?'active':''}" data-v344-copro-tab="archived">Archivées <b>${archived}</b></button></div>
    <div class="table-wrap"><table><thead><tr><th>Code</th><th>Nom</th><th>Adresse</th><th>Gestionnaire</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${rows.map(c=>`<tr><td><span class="code-pill">${esc(c.code||'—')}</span></td><td><strong>${esc(c.name)}</strong></td><td>${esc(fullAddress(c)||c.address||'')}</td><td>${esc(c.manager_name||'Non attribué')}</td><td>${c.active===false?'<span class="badge">Archivée</span>':'<span class="badge ok">Active</span>'}</td><td class="v344-actions">${c.active!==false?`<button class="btn small" data-enter-copro="${c.id}">Entrer</button>`:''}<button class="btn secondary small" data-open-copro-settings="${c.id}">Réglages</button><button class="btn secondary small" data-v344-archive="${c.id}|${c.active===false?'restore':'archive'}">${c.active===false?'Désarchiver':'Archiver'}</button></td></tr>`).join('')||'<tr><td colspan="6">Aucune copropriété dans cette liste.</td></tr>'}</tbody></table></div>`;
  }
  async function archiveCopro(id, restore) {
    const copro=list('copros').find(c=>String(c.id)===String(id));if(!copro)return;
    if(!confirm(`${restore?'Désarchiver':'Archiver'} « ${copro.name} » ?`))return;
    const payload=restore?{active:true,archived_at:null,archived_by:null}:{active:false,archived_at:new Date().toISOString(),archived_by:userId()};
    const {error}=await db().from('compta_copros').update(payload).eq('id',id);if(error)return alert(error.message);
    if(!restore&&String(currentCoproId())===String(id)){state.activeCoproId='';localStorage.removeItem('compta_active_copro_id');}
    await reload();renderCoprosV344();
  }
  function refreshActiveCoproSelect() {
    const select=byId('activeCoproSelect');if(!select)return;
    const selected=state.activeCoproId||select.value||'';
    const active=list('copros').filter(c=>c.active!==false);
    select.innerHTML='<option value="">Mode global / toutes les copros</option>'+active.map(c=>`<option value="${esc(c.id)}">${esc([c.code,c.name].filter(Boolean).join(' — '))}</option>`).join('');
    select.value=active.some(c=>String(c.id)===String(selected))?selected:'';
  }

  document.addEventListener('click',(e)=>{
    if(e.target.closest('#saveCoproBtn')){e.preventDefault();e.stopImmediatePropagation();wizard=newWizard();showWizard();return;}
    const remove=e.target.closest('[data-v344-remove-lot]');if(remove){saveWizardScreen();wizard.lots.splice(Number(remove.dataset.v344RemoveLot),1);showWizard();return;}
    const tab=e.target.closest('[data-v344-copro-tab]');if(tab){coproTab=tab.dataset.v344CoproTab;renderCoprosV344();return;}
    const archive=e.target.closest('[data-v344-archive]');if(archive){const[id,action]=archive.dataset.v344Archive.split('|');archiveCopro(id,action==='restore');return;}
    if(e.target.closest('[data-open-identity]'))setTimeout(enhanceIdentityModal,0);
    if(e.target.closest('[data-open-copro-settings],#activeCoproSettingsBtn,[data-v322-copro-settings]'))setTimeout(enhanceSettings,0);
    if(e.target.closest('#v33SaveCoproSettingsBtn')&&byId('v344SettingsStreet')){e.preventDefault();e.stopImmediatePropagation();saveSettingsStructured(currentCoproId());}
    if(e.target.closest('#modalSaveIdentityBtn')&&byId('v344IdentityStreet')){e.preventDefault();e.stopImmediatePropagation();saveIdentityStructured();}
  },true);

  // Le gestionnaire de réglages historique écoute déjà en phase de capture
  // sur document. L'écoute au niveau window permet d'améliorer le popup
  // après son ouverture sans réintroduire de surveillance permanente.
  window.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-open-copro-settings],#activeCoproSettingsBtn,[data-v322-copro-settings]')) {
      setTimeout(enhanceSettings, 30);
    }
  }, true);

  function install() {
    setVersion();refreshActiveCoproSelect();
    const modalBody = byId('globalModalBody');
    if (modalBody && !modalBody.dataset.v344Observed) {
      modalBody.dataset.v344Observed = 'true';
      const observer = new MutationObserver(() => {
        if (byId('v33CoproAddress') && !byId('v344SettingsStreet')) enhanceSettings();
        if (byId('modalIdentityAddress') && !byId('v344IdentityStreet')) enhanceIdentityModal();
      });
      observer.observe(modalBody, { childList: true, subtree: true });
    }
    window.renderCopros=renderCoprosV344;window.v33RenderCoprosV322=renderCoprosV344;
    window.renderOwners=renderOwnersV344;
    const oldRender=window.renderAll;
    if(typeof oldRender==='function'&&!oldRender.__v344){const wrapped=function(){const out=oldRender.apply(this,arguments);setTimeout(()=>{refreshActiveCoproSelect();renderCoprosV344();renderOwnersV344();setVersion();},0);return out;};wrapped.__v344=true;window.renderAll=wrapped;}
    renderCoprosV344();renderOwnersV344();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
})();
