(function(){
  'use strict';
  const VERSION = 'WAPI One — V36.7';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profiles = () => Array.isArray(state?.userProfiles) ? state.userProfiles : [];
  const coprosFor = (id) => (state?.copros || []).filter(c => String(c.manager_user_id || c.manager_id || '') === String(id));

  function modal(title, body, footer=''){
    $('globalModalTitle').textContent = title;
    $('globalModalSubtitle').textContent = 'Configuration des accès WAPI One';
    $('globalModalBody').innerHTML = body;
    $('globalModalFooter').innerHTML = footer || '<button class="btn secondary" type="button" data-modal-close>Fermer</button>';
    $('globalModal').classList.remove('narrow');
    $('globalModal').classList.add('wide');
    $('globalModalBackdrop').classList.remove('hidden');
  }
  function close(){ $('globalModalBackdrop')?.classList.add('hidden'); }

  function renderUsers(){
    const host = $('v367UsersTable'); if(!host) return;
    const rows = profiles().slice().sort((a,b)=>String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||''),'fr'));
    host.innerHTML = `<div class="v367-user-summary"><strong>${rows.filter(u=>u.active!==false).length}</strong><span>accès actifs</span><strong>${rows.filter(u=>u.role==='admin').length}</strong><span>administrateur(s)</span></div>
      <div class="table-wrap"><table><thead><tr><th>Collaborateur</th><th>Coordonnées</th><th>Rôle</th><th>Copropriétés</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${rows.map(u=>{
        const assigned=coprosFor(u.id);
        return `<tr><td><strong>${esc(u.display_name||u.email||'Utilisateur')}</strong><div class="muted-note">${esc(u.initials||'')}</div></td><td>${esc(u.email||'')}<div class="muted-note">${esc(u.phone||'')}</div></td><td><span class="badge">${u.role==='admin'?'Administrateur':'Gestionnaire'}</span></td><td><strong>${assigned.length}</strong><div class="muted-note">${esc(assigned.slice(0,3).map(c=>c.name).join(', '))}${assigned.length>3?'…':''}</div></td><td>${u.active===false?'<span class="badge warn">Désactivé</span>':'<span class="badge ok">Actif</span>'}</td><td><div class="actions-inline"><button class="btn secondary small" data-v367-edit-user="${esc(u.id)}">Modifier</button><button class="btn secondary small" data-v367-reset-user="${esc(u.email||'')}">Réinitialiser le mot de passe</button></div></td></tr>`;
      }).join('') || '<tr><td colspan="6">Aucun utilisateur trouvé.</td></tr>'}</tbody></table></div>`;
  }

  function createForm(){
    modal('Créer un accès collaborateur', `<form id="v367CreateUserForm" class="form-grid">
      <label>Nom affiché<input id="v367NewName" required></label><label>Adresse e-mail<input id="v367NewEmail" type="email" required></label>
      <label>Mot de passe temporaire<input id="v367NewPassword" type="password" minlength="8" required></label><label>Rôle<select id="v367NewRole"><option value="gestionnaire">Gestionnaire</option><option value="admin">Administrateur</option></select></label>
      <label>Téléphone<input id="v367NewPhone"></label><label>Initiales<input id="v367NewInitials" maxlength="5"></label>
      <div class="notice form-span">Le collaborateur pourra se connecter immédiatement. Il est conseillé de lui envoyer ensuite une réinitialisation de mot de passe.</div>
    </form>`, '<button class="btn secondary" type="button" data-modal-close>Annuler</button><button class="btn" id="v367ConfirmCreateUser" type="button">Créer l’accès</button>');
  }

  async function createUser(){
    const payload={display_name:$('v367NewName')?.value.trim(),email:$('v367NewEmail')?.value.trim(),password:$('v367NewPassword')?.value,role:$('v367NewRole')?.value||'gestionnaire',phone:$('v367NewPhone')?.value.trim(),initials:$('v367NewInitials')?.value.trim()};
    if(!payload.display_name||!payload.email||!payload.password) return alert('Complète le nom, l’adresse e-mail et le mot de passe temporaire.');
    const btn=$('v367ConfirmCreateUser'); if(btn){btn.disabled=true;btn.textContent='Création…';}
    const {data,error}=await supabaseClient.functions.invoke('admin-create-user',{body:payload});
    if(error || data?.error){ if(btn){btn.disabled=false;btn.textContent='Créer l’accès';} return alert(error?.message||data?.error||'Création impossible.'); }
    close();
    if(typeof window.loadUserProfilesV323==='function') await window.loadUserProfilesV323();
    renderUsers(); alert('Accès créé.');
  }

  function editForm(id){
    const u=profiles().find(x=>String(x.id)===String(id)); if(!u) return;
    modal('Modifier le collaborateur', `<form class="form-grid"><label>Nom affiché<input id="v367EditName" value="${esc(u.display_name||'')}"></label><label>E-mail<input value="${esc(u.email||'')}" disabled></label><label>Téléphone<input id="v367EditPhone" value="${esc(u.phone||'')}"></label><label>Initiales<input id="v367EditInitials" maxlength="5" value="${esc(u.initials||'')}"></label><label>Rôle<select id="v367EditRole"><option value="gestionnaire" ${u.role!=='admin'?'selected':''}>Gestionnaire</option><option value="admin" ${u.role==='admin'?'selected':''}>Administrateur</option></select></label><label>Accès<select id="v367EditActive"><option value="true" ${u.active!==false?'selected':''}>Actif</option><option value="false" ${u.active===false?'selected':''}>Désactivé</option></select></label></form>`, `<button class="btn secondary" type="button" data-modal-close>Annuler</button><button class="btn" type="button" data-v367-save-user="${esc(u.id)}">Enregistrer</button>`);
  }
  async function saveUser(id){
    const payload={display_name:$('v367EditName')?.value.trim()||null,phone:$('v367EditPhone')?.value.trim()||null,initials:$('v367EditInitials')?.value.trim()||null,role:$('v367EditRole')?.value||'gestionnaire',active:$('v367EditActive')?.value==='true',updated_at:new Date().toISOString()};
    const {error}=await supabaseClient.from('compta_user_profiles').update(payload).eq('id',id); if(error) return alert(error.message);
    const p=profiles().find(x=>String(x.id)===String(id)); if(p) Object.assign(p,payload);
    close(); renderUsers();
  }
  async function resetPassword(email){
    if(!email) return alert('Cet utilisateur n’a pas d’adresse e-mail.');
    if(!confirm(`Envoyer un lien de réinitialisation à ${email} ?`)) return;
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    alert(error ? error.message : 'Le lien de réinitialisation a été envoyé.');
  }

  document.addEventListener('click', async e=>{
    if(e.target.closest('#v367AddUserBtn')) createForm();
    const edit=e.target.closest('[data-v367-edit-user]'); if(edit) editForm(edit.dataset.v367EditUser);
    const save=e.target.closest('[data-v367-save-user]'); if(save) await saveUser(save.dataset.v367SaveUser);
    const reset=e.target.closest('[data-v367-reset-user]'); if(reset) await resetPassword(reset.dataset.v367ResetUser);
    if(e.target.closest('#v367ConfirmCreateUser')) await createUser();
    if(e.target.closest('[data-modal-close]')) close();
    if(e.target.closest('[data-view="users"]')) setTimeout(renderUsers,0);
  });
  window.v367RenderUsers=renderUsers;
  window.WAPI_ONE_VERSION='V36.7';
  function markVersion(){
    document.title=VERSION;
    document.querySelectorAll('.app-version-badge,.wapi-version-badge').forEach(el=>el.textContent=VERSION);
  }
  document.addEventListener('DOMContentLoaded',()=>{ markVersion(); setTimeout(()=>{ markVersion(); renderUsers(); },500); });
})();
