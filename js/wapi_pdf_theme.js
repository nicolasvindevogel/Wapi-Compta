(function(){
  'use strict';
  const LOGO='data:image/png;base64,';
  const COLORS={green:'#0B6B3B',lime:'#9BD318',ink:'#111318',muted:'#5E6874',pale:'#F1F8F3',line:'#D7E4DA',white:'#FFFFFF'};
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function htmlCss(){return `
    @page{size:A4;margin:14mm 14mm 15mm}
    *{box-sizing:border-box}body{font-family:Inter,"Segoe UI",Arial,sans-serif!important;color:${COLORS.ink}!important;font-size:11px;line-height:1.45;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .brandbar{height:4px!important;background:linear-gradient(90deg,${COLORS.green} 0 78%,${COLORS.lime} 78%)!important;border-radius:0!important;margin:0 0 13px!important}
    .head,.wapi-pdf-brand{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:18px!important;border-bottom:1px solid ${COLORS.line}!important;padding:0 0 12px!important;margin:0 0 18px!important;background:#fff!important}
    .logo{font-size:0!important;line-height:0!important;min-width:36mm!important}.logo img,.wapi-pdf-logo{display:block!important;width:auto!important;height:27mm!important;max-width:38mm!important;object-fit:contain!important;object-position:left top!important}
    .agency{font-size:8.5px!important;color:${COLORS.muted}!important;line-height:1.4!important;margin-top:5px!important}.doc-title{text-align:right!important;max-width:112mm!important}.doc-title h1,.wapi-pdf-title{margin:2px 0 5px!important;color:${COLORS.green}!important;font-size:22px!important;line-height:1.12!important;font-weight:800!important;letter-spacing:-.025em!important}.doc-title strong,.wapi-pdf-subtitle{display:block;color:${COLORS.ink}!important;font-size:11px!important;font-weight:700!important}
    h1,h2,h3{font-family:Inter,"Segoe UI",Arial,sans-serif!important}h2{color:${COLORS.green}!important;font-size:15px!important;margin:18px 0 8px!important}h3{color:${COLORS.ink}!important;font-size:12px!important}
    .box,.meta,.pill,.proxy-box{border:1px solid ${COLORS.line}!important;border-radius:8px!important;background:#fff!important;box-shadow:none!important}.meta-grid{gap:8px!important}.meta{padding:10px!important}.meta span,.pill span{color:${COLORS.muted}!important;font-size:8.5px!important}.meta strong{font-size:11px!important}.intro{font-size:11px!important;line-height:1.58!important}
    table{width:100%;border-collapse:collapse!important;font-size:9px!important}th{background:${COLORS.green}!important;color:#fff!important;font-weight:700!important;text-transform:none!important;letter-spacing:0!important}td,th{padding:5px 6px!important;border-bottom:1px solid ${COLORS.line}!important;vertical-align:top!important}tbody tr:nth-child(even){background:#F8FBF8!important}.amount,td:last-child,th:last-child{font-variant-numeric:tabular-nums}
    .total,.v29-total-bottom,.v30-bilan-total,.budget-total-bar{background:${COLORS.green}!important;color:#fff!important;border-radius:6px!important}.settlement-big-result{border:2px solid ${COLORS.green}!important;background:${COLORS.pale}!important;border-radius:10px!important}.settlement-big-result strong{color:${COLORS.green}!important}
    .agenda-list li:before{background:${COLORS.pale}!important;color:${COLORS.green}!important}.proxy-box{border:2px solid ${COLORS.green}!important}.result.ok{background:#E8F6EC!important;color:${COLORS.green}!important}
    .footer,.wapi-pdf-footer{position:absolute!important;left:0!important;right:0!important;bottom:0!important;border-top:1px solid ${COLORS.line}!important;padding-top:6px!important;color:${COLORS.muted}!important;font-size:8px!important;display:flex!important;justify-content:space-between!important;gap:12px!important}
    .page{position:relative!important;min-height:267mm!important;padding-bottom:12mm!important;break-after:page!important}.page:last-child{break-after:auto!important}
    .wapi-pdf-brand-left{display:flex;align-items:flex-start;gap:9px}.wapi-pdf-brand-copy{font-size:8.5px;color:${COLORS.muted};padding-top:4px}.wapi-pdf-accent{height:3px;background:linear-gradient(90deg,${COLORS.green} 0 82%,${COLORS.lime} 82%);margin-bottom:12px}
    @media print{button,.btn,.actions-inline,input,select,textarea{display:none!important}}
  `;}
  function headerHtml(title,subtitle=''){return `<div class="wapi-pdf-accent"></div><div class="wapi-pdf-brand"><div class="wapi-pdf-brand-left"><img class="wapi-pdf-logo" src="${LOGO}" alt="WAPI SYNDIK"><div class="wapi-pdf-brand-copy">Syndic de copropriétés<br>WAPI SYNDIK - DL GROUPE</div></div><div class="doc-title"><h1 class="wapi-pdf-title">${esc(title)}</h1><strong class="wapi-pdf-subtitle">${esc(subtitle)}</strong></div></div>`;}
  function footerHtml(label='Document'){return `<div class="wapi-pdf-footer"><span>${esc(label)}</span><span>WAPI SYNDIK - document généré le ${new Date().toLocaleDateString('fr-BE')}</span></div>`;}
  function applyHtml(doc,title='Document'){
    if(!doc||!doc.head||!doc.body)return;
    if(!doc.getElementById('wapiPdfThemeStyle')){const style=doc.createElement('style');style.id='wapiPdfThemeStyle';style.textContent=htmlCss();doc.head.appendChild(style);}
    doc.querySelectorAll('.logo').forEach((el)=>{if(!el.querySelector('img'))el.innerHTML=`<img src="${LOGO}" alt="WAPI SYNDIK">`;});
    const pages=[...doc.querySelectorAll('.page')];const targets=pages.length?pages:[doc.body];
    targets.forEach((page,index)=>{if(!page.querySelector('.head,.wapi-pdf-brand'))page.insertAdjacentHTML('afterbegin',headerHtml(title,index?'Suite du document':''));if(page!==doc.body&&!page.querySelector('.footer,.wapi-pdf-footer'))page.insertAdjacentHTML('beforeend',footerHtml(title));});
  }
  function rgb(hex){const clean=String(hex||COLORS.green).replace('#','');return [parseInt(clean.slice(0,2),16),parseInt(clean.slice(2,4),16),parseInt(clean.slice(4,6),16)];}
  function jspdfHeader(doc,title,subtitle=''){
    const [r,g,b]=rgb(COLORS.green),[lr,lg,lb]=rgb(COLORS.lime);doc.setFillColor(r,g,b);doc.rect(0,0,174,4,'F');doc.setFillColor(lr,lg,lb);doc.rect(174,0,36,4,'F');
    try{doc.addImage(LOGO,'PNG',15,9,24,27,undefined,'FAST');}catch(e){}
    doc.setTextColor(r,g,b);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(String(title||'Document'),195,17,{align:'right',maxWidth:140});doc.setTextColor(17,19,24);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(String(subtitle||''),195,24,{align:'right',maxWidth:140});doc.setDrawColor(215,228,218);doc.line(15,39,195,39);doc.setTextColor(17,19,24);return 47;
  }
  function jspdfFooter(doc,label='Document'){const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(215,228,218);doc.line(15,286,195,286);doc.setTextColor(94,104,116);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('WAPI SYNDIK - DL GROUPE',15,291);doc.text(`${label} - page ${i}/${pages}`,195,291,{align:'right'});}return doc;}
  const nativeOpen=window.open.bind(window);
  window.open=function(...args){const popup=nativeOpen(...args);if(!popup||popup.__wapiPdfPrintWrapped)return popup;popup.__wapiPdfPrintWrapped=true;try{const nativePrint=popup.print.bind(popup);popup.print=function(){try{applyHtml(popup.document,popup.document.title||'Document');}catch(e){}setTimeout(()=>nativePrint(),120);};}catch(e){}return popup;};
  window.WapiPdfTheme={logoDataUrl:LOGO,colors:COLORS,htmlCss,headerHtml,footerHtml,applyHtml,jspdfHeader,jspdfFooter};
})();
