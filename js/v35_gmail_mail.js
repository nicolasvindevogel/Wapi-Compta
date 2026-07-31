/* WAPI One V35.0 — Gmail Workspace via Supabase Edge Function. */
(() => {
  'use strict';
  window.WAPI_ONE_VERSION = 'V35.0 — Gmail';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mailState = { settings:null, busy:false };

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
    if (!user || typeof supabaseClient === 'undefined') return null;
    const { data, error } = await supabaseClient
      .from('compta_user_mail_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && error.code !== '42P01') console.warn('Réglages Gmail', error.message);
    mailState.settings = data || null;
    return mailState.settings;
  }
  async function invokeGmail(payload) {
    const { data, error } = await supabaseClient.functions.invoke('gmail-send', { body:payload });
    if (error) {
      let message = error.message || 'Envoi Gmail impossible.';
      try {
        const detail = await error.context?.json?.();
        if (detail?.error) message = detail.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (!data?.ok) throw new Error(data?.error || 'Envoi Gmail refusé.');
    return data;
  }
  async function saveMailSettings() {
    const user = appUser();
    if (!user) return alert('Connecte-toi à WAPI One.');
    const email = $('v35MailboxEmail').value.trim().toLowerCase();
    if (!/^[^\s@]+@wapisyndik\.com$/i.test(email)) {
      return alert('Indique une adresse Google Workspace @wapisyndik.com.');
    }
    const payload = {
      user_id:user.id,
      provider:'google',
      mailbox_email:email,
      mailbox_name:$('v35MailboxName').value.trim() || null,
      default_action:'send',
      signature_html:$('v35Signature').value,
      last_connected_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const { error } = await supabaseClient
      .from('compta_user_mail_settings')
      .upsert(payload, { onConflict:'user_id' });
    if (error) return alert(error.message);
    mailState.settings = payload;
    notify('Réglages Gmail enregistrés.');
    openMailSettings();
  }
  async function sendTestMail() {
    if (mailState.busy) return;
    const to = $('v35TestRecipient').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return alert('Indique une adresse de test valide.');
    mailState.busy = true;
    notify('Envoi du message de test…');
    try {
      const sender = $('v35MailboxEmail').value.trim() || 'Gmail WAPI One';
      const result = await invokeGmail({
        to,
        subject:'Test WAPI One — Gmail opérationnel',
        text:`Bonjour,\n\nCeci est un message de test envoyé depuis WAPI One via ${sender}.\n\nWAPI-SYNDIK — DL GROUPE`,
        html:`<p>Bonjour,</p><p>Ceci est un message de test envoyé depuis <strong>WAPI One</strong> via ${esc(sender)}.</p><p>WAPI-SYNDIK — DL GROUPE</p>`
      });
      alert(`Message envoyé avec succès.\nRéférence Gmail : ${result.messageId}`);
    } catch (error) { alert(error.message); }
    finally { mailState.busy = false; }
  }
  async function openMailSettings() {
    await loadSettings();
    const user = appUser();
    const settings = mailState.settings || {};
    const suggested = settings.mailbox_email || (String(user?.email || '').endsWith('@wapisyndik.com') ? user.email : '');
    const connected = Boolean(settings.mailbox_email);
    const body = `<div class="popup-form">
      <div class="v35-mail-status ${connected?'connected':''}"><i></i><div><strong>${connected?'Gmail configuré':'Gmail à configurer'}</strong><small>${esc(settings.mailbox_email || 'Choisis la boîte Google Workspace de cet utilisateur')}</small></div></div>
      <div class="v35-mail-settings-grid" style="margin-top:16px">
        <label>Adresse d’envoi Google Workspace<input id="v35MailboxEmail" type="email" value="${esc(suggested)}" placeholder="prenom@wapisyndik.com"></label>
        <label>Nom affiché<input id="v35MailboxName" value="${esc(settings.mailbox_name || '')}" placeholder="Prénom Nom — WAPI-SYNDIK"></label>
        <label class="full">Signature<textarea id="v35Signature" rows="5" placeholder="Bien à vous,&#10;WAPI-SYNDIK — DL GROUPE">${esc(settings.signature_html || '')}</textarea></label>
        <label class="full">Destinataire du test<input id="v35TestRecipient" type="email" value="${esc(settings.mailbox_email || suggested)}" placeholder="adresse@exemple.be"></label>
      </div>
      <div class="v35-mail-actions"><button class="btn secondary" id="v35SaveSettings" type="button">Enregistrer</button><button class="btn" id="v35TestMail" type="button">Envoyer un mail de test</button></div>
      <div class="v35-mail-hint">Chaque collaborateur choisit sa boîte @wapisyndik.com. La clé Google reste exclusivement dans les secrets Supabase et n’est jamais envoyée au navigateur.</div>
    </div>`;
    openAppModal('Réglages e-mail', body, '<button class="btn secondary" data-modal-close type="button">Fermer</button>', { subtitle:'Google Workspace / Gmail', size:'wide' });
  }
  function rowEmail(row) {
    return String(row?.owner?.email || row?.owner?._email || row?.email || '').trim();
  }
  function template(text, row) {
    const vars = {
      owner_name:row?.owner?.display_name || row?.owner?._name || '',
      copro_name:row?.copro?.name || '',
      period_label:row?.period_label || '',
      document_label:row?.document_label || window.v22CurrentComposer?.documentLabel || '',
      amount:row?.amount != null ? new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(Number(row.amount || 0)) : '',
      due_date:row?.due_date || '',
      date:new Date().toLocaleDateString('fr-BE')
    };
    return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  }
  function textToHtml(text) { return esc(text).replace(/\n/g, '<br>'); }
  function bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer); let binary = '';
    for (let i=0; i<bytes.length; i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(binary);
  }
  async function selectedFiles() {
    const files = [...($('v22ComposerFiles')?.files || [])];
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.some(file => file.size > 8*1024*1024) || total > 12*1024*1024) {
      throw new Error('Maximum 8 Mo par fichier et 12 Mo au total.');
    }
    return Promise.all(files.map(async file => ({
      filename:file.name,
      mimeType:file.type || 'application/octet-stream',
      contentBase64:bytesToBase64(await file.arrayBuffer())
    })));
  }
  function accountStatementAttachment(row) {
    if (!row?.third_row || !window.jspdf?.jsPDF) return null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const tier = row.third_row, copro = row.copro || {};
    doc.setFillColor(31,41,55); doc.rect(0,0,210,30,'F');
    doc.setTextColor(255); doc.setFontSize(16); doc.text('WAPI One — Situation de compte',15,18);
    doc.setTextColor(31,41,55); doc.setFontSize(11);
    doc.text(`Copropriété : ${copro.name || ''}`,15,42); doc.text(`Tiers : ${tier.name || ''}`,15,50);
    let y=64; doc.setFontSize(9);
    doc.text('Date',15,y); doc.text('Libellé',42,y); doc.text('Débit',150,y,{align:'right'}); doc.text('Crédit',190,y,{align:'right'}); y+=5;
    for (const detail of tier.details || []) {
      if (y>275) { doc.addPage(); y=20; }
      doc.text(String(detail.date || ''),15,y); doc.text(String(detail.label || '').slice(0,70),42,y);
      if (detail.debit) doc.text(Number(detail.debit).toFixed(2),150,y,{align:'right'});
      if (detail.credit) doc.text(Number(detail.credit).toFixed(2),190,y,{align:'right'}); y+=5;
    }
    doc.setFontSize(11); doc.text(`Solde : ${Number(tier.balance || 0).toFixed(2)} EUR`,190,y+7,{align:'right'});
    return {
      filename:`Situation_de_compte_${String(tier.name || 'tiers').replace(/[^a-z0-9]+/gi,'_')}.pdf`,
      mimeType:'application/pdf',
      contentBase64:doc.output('datauristring').split(',')[1]
    };
  }
  async function logDelivery(row, subject, body, result) {
    const payload = {
      copro_id:row.copro_id || null, owner_id:row.owner_id || null,
      document_type:window.v22CurrentComposer?.documentType || 'general_notice',
      document_label:row.document_label || window.v22CurrentComposer?.documentLabel || 'Document',
      source_type:row.source_type || window.v22CurrentComposer?.documentType || 'general_notice',
      source_id:row.source_id || null, channel:'email', status:'sent',
      email_to:rowEmail(row), subject, body, sent_at:new Date().toISOString(), prepared_at:new Date().toISOString(),
      provider:'google', provider_message_id:result.messageId || null, provider_status:'sent',
      sent_by:appUser()?.id || null, created_by:appUser()?.id || null,
      metadata:{ gmail_thread_id:result.threadId || null }
    };
    const { error } = await supabaseClient.from('compta_delivery_logs').insert(payload);
    if (error) console.warn('Journal Gmail', error.message);
  }
  async function sendComposerWithGmail() {
    if (mailState.busy) return;
    const composer = window.v22CurrentComposer;
    if (!composer) return;
    const rows = (composer.rows || []).filter(row => row.channel === 'email');
    if (!rows.length) return alert('Aucun destinataire e-mail dans la sélection.');
    await loadSettings();
    if (!mailState.settings?.mailbox_email) return openMailSettings();
    if (!confirm(`${rows.length} message(s) vont être envoyés via Gmail.\n\nContinuer ?`)) return;
    mailState.busy = true; notify('Préparation des e-mails Gmail…');
    try {
      const manual = await selectedFiles();
      const subjectTemplate = $('v22ComposerSubject')?.value || '';
      const bodyTemplate = $('v22ComposerBody')?.value || '';
      let done = 0;
      for (const row of rows) {
        const email = rowEmail(row); if (!email) continue;
        const subject = template(subjectTemplate,row);
        const bodyText = template(bodyTemplate,row);
        const auto = accountStatementAttachment(row);
        const attachments = [...manual, ...(auto ? [auto] : [])];
        const signature = mailState.settings.signature_html || '';
        const result = await invokeGmail({
          to:email,
          subject,
          text:`${bodyText}${signature ? `\n\n${signature}` : ''}`,
          html:`${textToHtml(bodyText)}${signature ? `<br><br>${textToHtml(signature)}` : ''}`,
          attachments
        });
        await logDelivery(row, subject, bodyText, result);
        done++; notify(`${done}/${rows.length} e-mail(s) envoyé(s)…`);
      }
      closeAppModal();
      if (typeof loadAll === 'function') await loadAll();
      alert(`${done} e-mail(s) envoyé(s) via Gmail.`);
    } catch (error) { alert(error.message || 'Envoi Gmail impossible.'); }
    finally { mailState.busy = false; }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('button');
    if (!target) return;
    if (target.id === 'w332FutureMail') {
      event.preventDefault(); event.stopImmediatePropagation();
      document.querySelector('.w332-user-wrap')?.classList.remove('open');
      openMailSettings();
    }
    if (target.id === 'v35SaveSettings') saveMailSettings();
    if (target.id === 'v35TestMail') sendTestMail();
    if (target.id === 'v22ConfirmSendBtn') {
      event.preventDefault(); event.stopImmediatePropagation();
      sendComposerWithGmail();
    }
  }, true);

  window.WapiMailV35 = { openSettings:openMailSettings, sendComposer:sendComposerWithGmail, sendTest:sendTestMail };
  setTimeout(loadSettings,1000);
})();
