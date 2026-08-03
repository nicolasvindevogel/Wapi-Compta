/* WAPI One V35.0 — Gmail Workspace via Supabase Edge Function. */
(() => {
  'use strict';
  window.WAPI_ONE_VERSION = 'V35.0 — Gmail';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mailState = { settings:null, busy:false };
  window.WAPI_ONE_VERSION = 'V35.1 - Gmail metier';

  function appUser() {
    try { return typeof currentUser !== 'undefined' ? currentUser : null; } catch (_) { return null; }
  }
  function appState() { try { return typeof state !== 'undefined' ? state : {}; } catch (_) { return {}; } }
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
    let y=window.WapiPdfTheme?.jspdfHeader?.(doc,'Situation de compte',copro.name||'')||40;
    doc.setTextColor(31,41,55); doc.setFontSize(10);doc.setFont('helvetica','bold');
    doc.text(`Copropriétaire : ${tier.name || ''}`,15,y); y+=12;
    doc.setFillColor(11,107,59);doc.rect(15,y-5,180,8,'F');doc.setTextColor(255);doc.setFontSize(8.5);
    doc.text('Date',15,y); doc.text('Libellé',42,y); doc.text('Débit',150,y,{align:'right'}); doc.text('Crédit',190,y,{align:'right'}); y+=5;
    for (const detail of tier.details || []) {
      if (y>275) { doc.addPage(); y=window.WapiPdfTheme?.jspdfHeader?.(doc,'Situation de compte',copro.name||'')||40; }
      doc.text(String(detail.date || ''),15,y); doc.text(String(detail.label || '').slice(0,70),42,y);
      if (detail.debit) doc.text(Number(detail.debit).toFixed(2),150,y,{align:'right'});
      if (detail.credit) doc.text(Number(detail.credit).toFixed(2),190,y,{align:'right'}); y+=5;
    }
    doc.setTextColor(31,41,55);doc.setFont('helvetica','bold');doc.setFontSize(11); doc.text(`Solde : ${Number(tier.balance || 0).toFixed(2)} EUR`,190,y+7,{align:'right'});
    window.WapiPdfTheme?.jspdfFooter?.(doc,'Situation de compte');
    return {
      filename:`Situation_de_compte_${String(tier.name || 'tiers').replace(/[^a-z0-9]+/gi,'_')}.pdf`,
      mimeType:'application/pdf',
      contentBase64:doc.output('datauristring').split(',')[1]
    };
  }
  function safeName(value) { return String(value || 'document').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,''); }
  function euro(value) { return new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(Number(value || 0)); }
  function pdfBase(title, subtitle='') {
    if (!window.jspdf?.jsPDF) throw new Error('Le generateur PDF n est pas charge. Recharge la page.');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'mm',format:'a4'}); const margin=15,width=180;
    const header=()=>window.WapiPdfTheme?.jspdfHeader?.(doc,title,subtitle)||38;
    let y=header();doc.__wapiPdfLabel=title; const page=()=>{doc.addPage();y=header();}; const ensure=(need=8)=>{if(y+need>278)page();};
    const line=(label,value,opts={})=>{ensure(opts.height||8);doc.setFontSize(opts.size||10);doc.setFont('helvetica',opts.bold?'bold':'normal');if(label){doc.setFont('helvetica','bold');doc.text(String(label),margin,y);doc.setFont('helvetica','normal');doc.text(String(value??''),opts.valueX||55,y);}else doc.text(String(value??''),margin,y);y+=opts.height||7;};
    const paragraph=(value)=>{const lines=doc.splitTextToSize(String(value||''),width);ensure(lines.length*5+3);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(lines,margin,y);y+=lines.length*5+4;};
    const section=(label)=>{ensure(12);doc.setFillColor(235,245,247);doc.roundedRect(margin,y-5,width,9,2,2,'F');doc.setTextColor(25,88,106);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(String(label),margin+3,y+1);doc.setTextColor(31,41,55);y+=11;};
    const tableRow=(cells,widths,head=false)=>{const wrapped=cells.map((c,i)=>doc.splitTextToSize(String(c??''),widths[i]-3));const h=Math.max(7,...wrapped.map(x=>x.length*4+3));ensure(h);if(head){doc.setFillColor(25,88,106);doc.rect(margin,y-5,width,h,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');}else{doc.setDrawColor(220);doc.line(margin,y+h-6,margin+width,y+h-6);doc.setTextColor(31,41,55);doc.setFont('helvetica','normal');}doc.setFontSize(8.5);let x=margin;wrapped.forEach((v,i)=>{doc.text(v,x+1.5,y);x+=widths[i];});y+=h;if(head)doc.setTextColor(31,41,55);};
    return {doc,line,paragraph,section,tableRow};
  }
  function pdfAttachment(doc,filename){window.WapiPdfTheme?.jspdfFooter?.(doc,doc.__wapiPdfLabel||filename.replace(/\.pdf$/i,''));return {filename,mimeType:'application/pdf',contentBase64:doc.output('datauristring').split(',')[1]};}
  function callAttachment(row){const s=appState();const call=(s.ownerCalls||[]).find(c=>String(c.id)===String(row.source_id))||row;const p=pdfBase('Appel de fonds',row.copro?.name||'');p.line('Coproprietaire',row.owner?.display_name||'');p.line('Libelle',call.period_label||call.label||row.document_label||'Appel');p.line('Echeance',call.due_date||row.due_date||'');p.section('Montant a payer');p.line('',euro(call.amount_due||row.amount),{size:18,bold:true,height:14});const bank=(s.v28CoproBankAccounts||[]).find(b=>b.copro_id===row.copro_id&&b.active!==false)||(s.bankAccounts||[]).find(b=>b.copro_id===row.copro_id)||{};p.line('IBAN',bank.iban||'A completer');p.line('Communication',row.owner?.vcs||row.owner?.structured_communication||'A completer');return pdfAttachment(p.doc,`Appel_${safeName(row.copro?.name)}_${safeName(row.owner?.display_name)}.pdf`);}
  function settlementAttachment(row){const calc=window.WapiSettlementV345?.buildOwner?.(row.owner_id,row.copro_id,row.fiscal_year_id);if(!calc)return null;const p=pdfBase('Decompte individuel',row.copro?.name||'');p.line('Coproprietaire',calc.owner?.display_name||'');p.line('Exercice',calc.year?.label||row.period_label||'');p.line('Lots',(calc.lots||[]).map(l=>l.lot_number).join(', ')||'-');p.section('Synthese des charges');p.tableRow(['Nature','Montant'],[130,50],true);p.tableRow(['Charges communes',euro(Number(calc.common||0)+Number(calc.occupant||0))],[130,50]);p.tableRow(['Consommations et frais privatifs',euro(Number(calc.consumptionTotal||0)+Number(calc.privateCharges||0))],[130,50]);p.tableRow(['Total charges',euro(calc.totalCharges)],[130,50]);p.section('Situation de compte');p.tableRow(['Date','Libelle','Debit','Credit'],[28,92,30,30],true);(calc.balanceRow?.details||[]).forEach(d=>p.tableRow([d.date||'',d.label||'',d.debit?euro(d.debit):'',d.credit?euro(d.credit):''],[28,92,30,30]));p.section(calc.final>=0?'Montant a payer':'Montant a recevoir');p.line('',euro(Math.abs(calc.final||0)),{size:17,bold:true,height:14});return pdfAttachment(p.doc,`Decompte_${safeName(row.copro?.name)}_${safeName(row.owner?.display_name)}.pdf`);}
  function agAttachment(row){const s=appState();const meeting=(s.agMeetings||[]).find(m=>String(m.id)===String(row.metadata?.meeting_id||row.source_id));if(!meeting)return null;const points=(s.agPoints||[]).filter(x=>String(x.meeting_id)===String(meeting.id)).sort((a,b)=>Number(a.position||0)-Number(b.position||0));const isPv=window.v22CurrentComposer?.documentType==='ag_minutes';const p=pdfBase(isPv?'Proces-verbal assemblee generale':'Convocation assemblee generale',row.copro?.name||'');p.line('Destinataire',row.owner?.display_name||'');p.line('Date',meeting.meeting_date||'');p.line('Heure',meeting.meeting_time||'');p.line('Lieu',meeting.location||'A preciser');p.section(isPv?'Decisions et votes':'Ordre du jour');points.forEach((point,index)=>{p.line('',`${index+1}. ${point.title||'Point'}`,{bold:true});if(point.description)p.paragraph(point.description);if(isPv&&point.decision_text)p.paragraph(`Decision : ${point.decision_text}`);});if(!isPv){p.section('Procuration');p.paragraph(`Je soussigne(e) ${row.owner?.display_name||''}, donne procuration a ................................ afin de me representer a l assemblee generale du ${meeting.meeting_date||''}.`);}return pdfAttachment(p.doc,`${isPv?'PV_AG':'Convocation_AG'}_${safeName(row.copro?.name)}_${safeName(row.owner?.display_name)}.pdf`);}
  function automaticAttachments(row){const type=window.v22CurrentComposer?.documentType;if(type==='account_statement'){const a=accountStatementAttachment(row);return a?[a]:[];}if(type==='owner_call'){const a=callAttachment(row);return a?[a]:[];}if(type==='settlement'){const a=settlementAttachment(row);return a?[a]:[];}if(type==='ag_convocation'||type==='ag_minutes'){const a=agAttachment(row);return a?[a]:[];}return [];}
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

  // V35.1: envoi reel, PDF nominatif automatique et traitement independant des erreurs.
  sendComposerWithGmail = async function() {
    if (mailState.busy) return;
    const composer = window.v22CurrentComposer;
    if (!composer) return;
    const rows = (composer.rows || []).filter(row => row.channel === 'email');
    if (!rows.length) return alert('Aucun destinataire e-mail dans la selection.');
    await loadSettings();
    if (!mailState.settings?.mailbox_email) return openMailSettings();
    if (!confirm(`${rows.length} message(s) vont etre envoyes reellement via Gmail.\n\nContinuer ?`)) return;
    mailState.busy = true;
    notify('Preparation des e-mails Gmail...');
    try {
      const manual = await selectedFiles();
      const subjectTemplate = $('v22ComposerSubject')?.value || '';
      const bodyTemplate = $('v22ComposerBody')?.value || '';
      const sentRows = [], failures = [];
      for (const row of rows) {
        const email = rowEmail(row);
        if (!email) { failures.push(`${row.owner?.display_name || 'Destinataire'} : adresse manquante`); continue; }
        try {
          const subject = template(subjectTemplate,row);
          const bodyText = template(bodyTemplate,row);
          const attachments = [...manual, ...automaticAttachments(row)];
          const signature = mailState.settings.signature_html || '';
          const result = await invokeGmail({to:email,subject,text:`${bodyText}${signature ? `\n\n${signature}` : ''}`,html:`${textToHtml(bodyText)}${signature ? `<br><br>${textToHtml(signature)}` : ''}`,attachments});
          await logDelivery(row,subject,bodyText,result);
          sentRows.push(row);
          notify(`${sentRows.length}/${rows.length} e-mail(s) envoye(s)...`);
        } catch (error) { failures.push(`${email} : ${error.message || 'echec'}`); }
      }
      if (sentRows.length && typeof composer.onConfirm === 'function') await composer.onConfirm(sentRows);
      closeAppModal();
      if (typeof loadAll === 'function') await loadAll();
      alert(`${sentRows.length} e-mail(s) envoye(s) via Gmail.${failures.length ? `\n\n${failures.length} echec(s) :\n${failures.slice(0,8).join('\n')}` : ''}`);
    } catch (error) { alert(error.message || 'Envoi Gmail impossible.'); }
    finally { mailState.busy = false; }
  };

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
