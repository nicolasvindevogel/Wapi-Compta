/* WAPI One V35.0 — Outlook / Microsoft Graph (authentification déléguée). */
(() => {
  'use strict';
  window.WAPI_ONE_VERSION = 'V35.0 — Outlook';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SCOPES = ['User.Read', 'Mail.ReadWrite', 'Mail.Send'];
  const state35 = { provider:null, user:null, msal:null, account:null, busy:false };

  function appUser() {
    try { return typeof currentUser !== 'undefined' ? currentUser : null; } catch (_) { return null; }
  }
  function notify(message) {
    let host = $('v35MailProgress');
    if (!host) {
      host = document.createElement('div');
      host.id = 'v35MailProgress';
      host.className = 'v35-mail-progress';
      document.body.appendChild(host);
    }
    host.textContent = message;
    host.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { host.hidden = true; }, 5000);
  }
  async function loadSettings() {
    const user = appUser();
    if (!user || typeof supabaseClient === 'undefined') return;
    const [providerRes, userRes] = await Promise.all([
      supabaseClient.from('compta_mail_provider_settings').select('*').eq('provider','microsoft').maybeSingle(),
      supabaseClient.from('compta_user_mail_settings').select('*').eq('user_id',user.id).maybeSingle()
    ]);
    if (!providerRes.error) state35.provider = providerRes.data;
    if (!userRes.error) state35.user = userRes.data;
  }
  function loadMsalLibrary() {
    if (window.msal?.PublicClientApplication) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-wapi-msal]');
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@4/lib/msal-browser.min.js';
      script.dataset.wapiMsal = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger la connexion Microsoft.'));
      document.head.appendChild(script);
    });
  }
  async function ensureMsal() {
    await loadSettings();
    const cfg = state35.provider;
    if (!cfg?.enabled || !cfg?.client_id) throw new Error('La connexion Microsoft doit d’abord être configurée.');
    await loadMsalLibrary();
    if (!state35.msal) {
      state35.msal = new window.msal.PublicClientApplication({
        auth: {
          clientId: cfg.client_id,
          authority: `https://login.microsoftonline.com/${cfg.tenant_id || 'organizations'}`,
          redirectUri: cfg.redirect_uri || `${location.origin}${location.pathname}`
        },
        cache: { cacheLocation:'localStorage', storeAuthStateInCookie:false }
      });
      await state35.msal.initialize();
      const response = await state35.msal.handleRedirectPromise();
      state35.account = response?.account || state35.msal.getAllAccounts()[0] || null;
    }
    return state35.msal;
  }
  async function connectMicrosoft() {
    try {
      const client = await ensureMsal();
      const response = await client.loginPopup({ scopes:SCOPES, prompt:'select_account' });
      state35.account = response.account;
      const profile = await graph('/me?$select=displayName,mail,userPrincipalName', { token:response.accessToken });
      const user = appUser();
      const payload = {
        user_id:user.id,
        provider:'microsoft',
        mailbox_email:profile.mail || profile.userPrincipalName || state35.account.username,
        mailbox_name:profile.displayName || '',
        default_action:state35.user?.default_action || 'draft',
        signature_html:state35.user?.signature_html || '',
        last_connected_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      };
      const { error } = await supabaseClient.from('compta_user_mail_settings').upsert(payload);
      if (error) throw error;
      state35.user = payload;
      openMailSettings();
      notify('Boîte Outlook connectée.');
    } catch (error) { alert(error.message || 'Connexion Microsoft impossible.'); }
  }
  async function disconnectMicrosoft() {
    try {
      const client = await ensureMsal();
      if (state35.account) await client.logoutPopup({ account:state35.account, postLogoutRedirectUri:location.href });
      state35.account = null;
    } catch (_) {}
    notify('Session Outlook déconnectée.');
    openMailSettings();
  }
  async function token() {
    const client = await ensureMsal();
    if (!state35.account) state35.account = client.getAllAccounts()[0] || null;
    if (!state35.account) {
      const login = await client.loginPopup({ scopes:SCOPES });
      state35.account = login.account;
      return login.accessToken;
    }
    try {
      return (await client.acquireTokenSilent({ account:state35.account, scopes:SCOPES })).accessToken;
    } catch (_) {
      return (await client.acquireTokenPopup({ account:state35.account, scopes:SCOPES })).accessToken;
    }
  }
  async function graph(path, { method='GET', body, token:givenToken }={}) {
    const accessToken = givenToken || await token();
    const response = await fetch(`${GRAPH}${path}`, {
      method,
      headers:{ Authorization:`Bearer ${accessToken}`, ...(body ? {'Content-Type':'application/json'} : {}) },
      body:body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      let detail=''; try { detail=(await response.json())?.error?.message || ''; } catch (_) {}
      throw new Error(detail || `Microsoft Graph : erreur ${response.status}.`);
    }
    if (response.status === 202 || response.status === 204) return {};
    return response.json();
  }
  function connectedAccount() {
    return state35.account || state35.msal?.getAllAccounts?.()[0] || null;
  }
  async function saveMailSettings() {
    const user = appUser();
    const provider = {
      provider:'microsoft',
      tenant_id:$('v35TenantId').value.trim() || 'organizations',
      client_id:$('v35ClientId').value.trim() || null,
      redirect_uri:$('v35RedirectUri').value.trim() || `${location.origin}${location.pathname}`,
      enabled:$('v35ProviderEnabled').checked,
      updated_by:user.id,
      updated_at:new Date().toISOString()
    };
    const mine = {
      user_id:user.id,
      provider:'microsoft',
      mailbox_email:state35.user?.mailbox_email || null,
      mailbox_name:state35.user?.mailbox_name || null,
      default_action:$('v35DefaultAction').value,
      signature_html:$('v35Signature').value,
      updated_at:new Date().toISOString()
    };
    const [p,u] = await Promise.all([
      supabaseClient.from('compta_mail_provider_settings').upsert(provider,{onConflict:'provider'}),
      supabaseClient.from('compta_user_mail_settings').upsert(mine)
    ]);
    if (p.error || u.error) return alert((p.error || u.error).message);
    state35.provider={...(state35.provider||{}),...provider};
    state35.user={...(state35.user||{}),...mine};
    state35.msal=null; state35.account=null;
    notify('Réglages e-mail enregistrés.');
    openMailSettings();
  }
  async function openMailSettings() {
    await loadSettings();
    try { await ensureMsal(); } catch (_) {}
    const account=connectedAccount();
    const cfg=state35.provider||{}, mine=state35.user||{};
    const connected=Boolean(account);
    const body=`<div class="popup-form">
      <div class="v35-mail-status ${connected?'connected':''}"><i></i><div><strong>${connected?'Outlook connecté':'Outlook non connecté'}</strong><small>${esc(mine.mailbox_email || account?.username || 'Aucune boîte liée à cet utilisateur')}</small></div></div>
      <div class="v35-mail-settings-grid" style="margin-top:16px">
        <label>Identifiant de l’application Microsoft<input id="v35ClientId" value="${esc(cfg.client_id||'')}" placeholder="Application (client) ID"></label>
        <label>Tenant Microsoft<input id="v35TenantId" value="${esc(cfg.tenant_id||'organizations')}" placeholder="Tenant ID ou organizations"></label>
        <label class="full">Adresse de redirection<input id="v35RedirectUri" value="${esc(cfg.redirect_uri||`${location.origin}${location.pathname}`)}"></label>
        <label>Action par défaut<select id="v35DefaultAction"><option value="draft">Créer un brouillon Outlook</option><option value="send">Envoyer directement</option></select></label>
        <label class="v35-checkbox"><input id="v35ProviderEnabled" type="checkbox" ${cfg.enabled?'checked':''}> Activer Microsoft Outlook</label>
        <label class="full">Signature<textarea id="v35Signature" rows="5" placeholder="Bien à vous,&#10;WAPI-SYNDIK — DL GROUPE">${esc(mine.signature_html||'')}</textarea></label>
      </div>
      <div class="v35-mail-actions"><button class="btn secondary" id="v35SaveSettings" type="button">Enregistrer</button><button class="btn" id="v35Connect" type="button">${connected?'Changer de compte Outlook':'Connecter ma boîte Outlook'}</button>${connected?'<button class="btn secondary" id="v35Disconnect" type="button">Déconnecter Outlook</button>':''}</div>
      <div class="v35-mail-hint">Chaque collaborateur connecte sa propre boîte. WAPI One ne stocke jamais le mot de passe Microsoft. Le mode brouillon est recommandé au départ afin de contrôler chaque message dans Outlook.</div>
    </div>`;
    openAppModal('Réglages e-mail',body,'<button class="btn secondary" data-modal-close type="button">Fermer</button>',{subtitle:'Outlook / Microsoft 365',size:'wide'});
    $('v35DefaultAction').value=mine.default_action||'draft';
  }
  function rowEmail(row) { return String(row?.owner?.email || row?.owner?._email || row?.email || '').trim(); }
  function template(text,row) {
    const vars={
      owner_name:row?.owner?.display_name || row?.owner?._name || '',
      copro_name:row?.copro?.name || '',
      period_label:row?.period_label || '',
      document_label:row?.document_label || window.v22CurrentComposer?.documentLabel || '',
      amount:row?.amount != null ? new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(Number(row.amount||0)) : '',
      due_date:row?.due_date || '',
      date:new Date().toLocaleDateString('fr-BE')
    };
    return String(text||'').replace(/\{\{(\w+)\}\}/g,(_,key)=>vars[key]??'');
  }
  function textToHtml(text) {
    return esc(text).replace(/\n/g,'<br>');
  }
  function bytesToBase64(buffer) {
    const bytes=new Uint8Array(buffer); let binary='';
    for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(binary);
  }
  async function selectedFiles() {
    const files=[...($('v22ComposerFiles')?.files || [])];
    const total=files.reduce((s,f)=>s+f.size,0);
    if(files.some(f=>f.size>3*1024*1024) || total>4*1024*1024) throw new Error('Pour cette première version, les pièces jointes doivent rester sous 3 Mo par fichier et 4 Mo au total.');
    return Promise.all(files.map(async file=>({
      '@odata.type':'#microsoft.graph.fileAttachment',
      name:file.name,
      contentType:file.type || 'application/octet-stream',
      contentBytes:bytesToBase64(await file.arrayBuffer())
    })));
  }
  function accountStatementAttachment(row) {
    if (!row?.third_row || !window.jspdf?.jsPDF) return null;
    const { jsPDF }=window.jspdf, doc=new jsPDF({unit:'mm',format:'a4'});
    const tier=row.third_row, copro=row.copro||{};
    doc.setFillColor(31,41,55);doc.rect(0,0,210,30,'F');
    doc.setTextColor(255);doc.setFontSize(16);doc.text('WAPI One — Situation de compte',15,18);
    doc.setTextColor(31,41,55);doc.setFontSize(11);
    doc.text(`Copropriété : ${copro.name||''}`,15,42);doc.text(`Tiers : ${tier.name||''}`,15,50);
    let y=64;doc.setFontSize(9);
    doc.text('Date',15,y);doc.text('Libellé',42,y);doc.text('Débit',150,y,{align:'right'});doc.text('Crédit',190,y,{align:'right'});y+=5;
    for(const d of tier.details||[]){
      if(y>275){doc.addPage();y=20;}
      doc.text(String(d.date||''),15,y);doc.text(String(d.label||'').slice(0,70),42,y);
      if(d.debit)doc.text(Number(d.debit).toFixed(2),150,y,{align:'right'});
      if(d.credit)doc.text(Number(d.credit).toFixed(2),190,y,{align:'right'});y+=5;
    }
    doc.setFontSize(11);doc.text(`Solde : ${Number(tier.balance||0).toFixed(2)} EUR`,190,y+7,{align:'right'});
    return {'@odata.type':'#microsoft.graph.fileAttachment',name:`Situation_de_compte_${String(tier.name||'tiers').replace(/[^a-z0-9]+/gi,'_')}.pdf`,contentType:'application/pdf',contentBytes:doc.output('datauristring').split(',')[1]};
  }
  async function logDelivery(row, message, status, mode) {
    const payload={
      copro_id:row.copro_id||null, owner_id:row.owner_id||null,
      document_type:window.v22CurrentComposer?.documentType||'general_notice',
      document_label:row.document_label||window.v22CurrentComposer?.documentLabel||'Document',
      source_type:row.source_type||window.v22CurrentComposer?.documentType||'general_notice',
      source_id:row.source_id||null, channel:'email', status,
      email_to:rowEmail(row), subject:message.subject, body:message.body.content,
      sent_at:mode==='send'?new Date().toISOString():null, prepared_at:new Date().toISOString(),
      provider:'microsoft',provider_message_id:message.id||null,provider_status:status,
      sent_by:appUser()?.id||null,created_by:appUser()?.id||null,
      metadata:{outlook_mode:mode}
    };
    const {error}=await supabaseClient.from('compta_delivery_logs').insert(payload);
    if(error)console.warn('Journal mail',error.message);
  }
  async function sendComposerWithOutlook() {
    if(state35.busy)return;
    const composer=window.v22CurrentComposer;
    if(!composer)return;
    const rows=(composer.rows||[]).filter(r=>r.channel==='email');
    if(!rows.length)return alert('Aucun destinataire e-mail dans la sélection.');
    await loadSettings();
    if(!state35.provider?.enabled || !state35.provider?.client_id) return openMailSettings();
    const mode=state35.user?.default_action||'draft';
    if(!confirm(`${rows.length} message(s) vont être ${mode==='draft'?'créés dans les brouillons Outlook':'envoyés via Outlook'}.\n\nContinuer ?`))return;
    state35.busy=true;notify('Préparation des e-mails Outlook…');
    try{
      const manual=await selectedFiles(), subjectTpl=$('v22ComposerSubject')?.value||'', bodyTpl=$('v22ComposerBody')?.value||'';
      let done=0;
      for(const row of rows){
        const email=rowEmail(row);if(!email)continue;
        const auto=accountStatementAttachment(row);
        const attachments=[...manual,...(auto?[auto]:[])];
        const message={
          subject:template(subjectTpl,row),
          body:{contentType:'HTML',content:`${textToHtml(template(bodyTpl,row))}${state35.user?.signature_html?`<br><br>${textToHtml(state35.user.signature_html)}`:''}`},
          toRecipients:[{emailAddress:{address:email}}],
          attachments
        };
        if(mode==='send'){
          await graph('/me/sendMail',{method:'POST',body:{message,saveToSentItems:true}});
          await logDelivery(row,message,'sent',mode);
        }else{
          const draft=await graph('/me/messages',{method:'POST',body:message});
          await logDelivery(row,{...message,id:draft.id},'pending',mode);
        }
        done++;notify(`${done}/${rows.length} e-mail(s) traité(s)…`);
      }
      const paperRows=(composer.rows||[]).filter(r=>r.channel==='paper');
      if(paperRows.length){
        const paperPayloads=paperRows.map(row=>({
          copro_id:row.copro_id||null,owner_id:row.owner_id||null,
          document_type:composer.documentType||'general_notice',
          document_label:row.document_label||composer.documentLabel||'Document',
          source_type:row.source_type||composer.documentType||'general_notice',
          source_id:row.source_id||null,channel:'paper',status:'paper_ready',
          prepared_at:new Date().toISOString(),created_by:appUser()?.id||null,
          metadata:{mail_batch:true}
        }));
        const {error}=await supabaseClient.from('compta_delivery_logs').insert(paperPayloads);
        if(error)console.warn('Journal courrier',error.message);
      }
      closeAppModal();
      if(typeof loadAll==='function')await loadAll();
      alert(mode==='draft'?`${done} brouillon(s) créé(s) dans Outlook.`:`${done} e-mail(s) envoyé(s) via Outlook.`);
    }catch(error){alert(error.message||'Envoi Outlook impossible.');}
    finally{state35.busy=false;}
  }
  document.addEventListener('click',(event)=>{
    const target=event.target.closest?.('button');
    if(!target)return;
    if(target.id==='w332FutureMail'){event.preventDefault();event.stopImmediatePropagation();document.querySelector('.w332-user-wrap')?.classList.remove('open');openMailSettings();}
    if(target.id==='v35SaveSettings')saveMailSettings();
    if(target.id==='v35Connect')connectMicrosoft();
    if(target.id==='v35Disconnect')disconnectMicrosoft();
    if(target.id==='v22ConfirmSendBtn'){
      event.preventDefault();event.stopImmediatePropagation();
      sendComposerWithOutlook();
    }
  },true);
  window.WapiMailV35={openSettings:openMailSettings,sendComposer:sendComposerWithOutlook};
  setTimeout(loadSettings,1000);
})();
