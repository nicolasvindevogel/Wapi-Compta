(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const money=v=>new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const date=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('fr-BE')};
  const activeCopro=()=>state?.activeCoproId||$('activeCoproSelect')?.value||'';
  const activeYear=()=>state?.activeFiscalYearId||$('activeFiscalYearSelect')?.value||'';
  const year=()=> (state?.fiscalYears||[]).find(y=>String(y.id)===String(activeYear()));
  const itemCopro=item=>item?.copro_id||item?.compta_copros?.id||(item?.bank_account_id?(state?.bankAccounts||[]).find(a=>String(a.id)===String(item.bank_account_id))?.copro_id:'')||(item?.statement_id?(state?.bankStatements||[]).find(s=>String(s.id)===String(item.statement_id))?.copro_id:'')||'';
  const inContext=item=>{
    const cid=activeCopro(); const itemCid=itemCopro(item); if(cid&&String(itemCid)!==String(cid))return false;
    if(activeYear()&&item?.fiscal_year_id&&String(item.fiscal_year_id)!==String(activeYear()))return false;
    const fy=year(); const raw=item?.transaction_date||item?.statement_date||item?.invoice_date||item?.date||item?.created_at;
    if(fy&&raw){const d=String(raw).slice(0,10);if(fy.starts_on&&d<fy.starts_on)return false;if(fy.ends_on&&d>fy.ends_on)return false;}
    return true;
  };
  function coproName(){const cid=activeCopro();const c=(state?.copros||[]).find(x=>String(x.id)===String(cid));return c?[c.code||c.copro_code,c.name].filter(Boolean).join(' — '):'Mode global';}
  function yearName(){const y=year();return y?(y.year_code||y.code||y.label||'Exercice'):'Tous les exercices';}
  function bankBalance(){
    const accounts=(state?.bankAccounts||[]).filter(inContext);let total=0;
    accounts.forEach(a=>{const latest=(state?.bankStatements||[]).filter(s=>String(s.bank_account_id)===String(a.id)&&inContext(s)&&['validated','confirmed','posted'].includes(String(s.status||'').toLowerCase())).sort((x,y)=>String(y.statement_date||y.created_at||'').localeCompare(String(x.statement_date||x.created_at||'')))[0];
      total+=latest&&latest.closing_balance!=null?Number(latest.closing_balance): (state?.bankTransactions||[]).filter(t=>String(t.bank_account_id)===String(a.id)&&inContext(t)).reduce((s,t)=>s+Number(t.amount||0),0);
    }); return total;
  }
  function taskRows(){
    const rows=[];
    (state?.validationQueue||[]).filter(q=>inContext(q)&&!['validated','rejected'].includes(String(q.status||''))).slice(0,4).forEach(q=>rows.push({icon:'✓',title:q.title||q.file_name||'Élément à contrôler',sub:'Centre de traitement',d:q.created_at,status:q.status==='to_verify'?'urgent':'todo',label:q.status==='to_verify'?'À vérifier':'À faire',view:'processing'}));
    (state?.invoices||[]).filter(i=>inContext(i)&&['to_validate','draft'].includes(String(i.status||''))).slice(0,3).forEach(i=>rows.push({icon:'€',title:`Valider la facture ${i.invoice_number||''}`.trim(),sub:i.compta_suppliers?.name||'Facture fournisseur',d:i.invoice_date||i.created_at,status:'urgent',label:'Urgent',view:'invoices'}));
    (state?.bankStatements||[]).filter(s=>inContext(s)&&!['validated','confirmed','posted'].includes(String(s.status||'').toLowerCase())).slice(0,2).forEach(s=>rows.push({icon:'B',title:`Contrôler l’extrait ${s.statement_number||''}`.trim(),sub:s.compta_copros?.name||'Encodage bancaire',d:s.statement_date||s.created_at,status:'todo',label:'À faire',view:'codaPilot'}));
    return rows.slice(0,5);
  }
  function renderTasks(){const host=$('w368TodayList');if(!host)return;const rows=taskRows();host.innerHTML=rows.length?rows.map(r=>`<div class="w368-today-row" data-view="${r.view}"><span class="w368-task-icon">${r.icon}</span><span class="w368-task-main"><strong>${r.title}</strong><small>${r.sub}</small></span><time class="w368-task-date">${date(r.d)}</time><span class="w368-status ${r.status}">${r.label}</span></div>`).join(''):'<div class="w368-empty">Rien d’urgent dans le contexte actuel.</div>';}
  function transactions(){return (state?.bankTransactions||[]).filter(inContext).slice().sort((a,b)=>String(b.transaction_date||b.created_at||'').localeCompare(String(a.transaction_date||a.created_at||'')));}
  function renderChart(){const host=$('w368BankChart');if(!host)return;const tx=transactions();const vals=Array(12).fill(0);tx.forEach(t=>{const d=new Date(t.transaction_date||t.created_at);if(!Number.isNaN(d.getTime()))vals[d.getMonth()]+=Number(t.amount||0)});let cumulative=0;const totals=vals.map(v=>(cumulative+=v));const min=Math.min(0,...totals),max=Math.max(1,...totals),range=Math.max(1,max-min);const months=['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];host.innerHTML=totals.map((v,i)=>`<div class="w368-bar-wrap" title="${months[i]} : ${money(v)}"><div class="w368-bar" style="height:${Math.max(3,((v-min)/range)*205)}px"></div><small>${months[i]}</small></div>`).join('');}
  function renderMovements(){const host=$('w368RecentMovements');if(!host)return;const tx=transactions().slice(0,5);host.innerHTML=tx.length?tx.map(t=>{const amount=Number(t.amount||0);return `<div class="w368-movement"><time>${date(t.transaction_date||t.created_at)}</time><span>${t.communication||t.description||t.counterparty_name||'Mouvement bancaire'}</span><strong class="${amount>=0?'positive':'negative'}">${amount>=0?'+ ':''}${money(amount)}</strong></div>`}).join(''):'<div class="w368-empty">Aucun mouvement dans ce contexte.</div>';}
  function render(){
    if(!$('dashboardView'))return;const cid=activeCopro();const lots=(state?.lots||[]).filter(l=>!cid||String(l.copro_id)===String(cid));const ownerIds=new Set(lots.map(l=>l.owner_id).filter(Boolean));const invoices=(state?.invoices||[]).filter(i=>inContext(i)&&!['paid','rejected','cancelled'].includes(String(i.payment_status||i.status||'').toLowerCase()));
    if($('statLots'))$('statLots').textContent=lots.length;if($('w368OwnersCount'))$('w368OwnersCount').textContent=ownerIds.size||((state?.owners||[]).filter(o=>!cid||String(o.copro_id)===String(cid)).length);if($('statInvoices'))$('statInvoices').textContent=invoices.length;if($('w368BankBalance'))$('w368BankBalance').textContent=money(bankBalance());if($('w368DashboardContext'))$('w368DashboardContext').textContent=`${coproName()} · ${yearName()}`;if($('w368FinanceSubtitle'))$('w368FinanceSubtitle').textContent=`${coproName()} · ${yearName()}`;renderTasks();renderChart();renderMovements();
    document.querySelectorAll('.app-version-badge,.wapi-version-badge').forEach(e=>e.textContent='WAPI One — V36.8.1');document.title='WAPI One — V36.8.1';
  }
  try{if(typeof renderAll==='function'&&!renderAll.__v368){const old=renderAll;renderAll=function(){const value=old.apply(this,arguments);render();return value};renderAll.__v368=true}}catch(_){ }
  document.addEventListener('click',e=>{if(e.target.closest('[data-view="dashboard"],[data-w332-module="home"]'))setTimeout(render,0)});
  document.addEventListener('change',e=>{if(['activeCoproSelect','activeFiscalYearSelect'].includes(e.target?.id))setTimeout(render,0)});
  window.w368RenderDashboard=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,500),{once:true});else setTimeout(render,0);
})();
