.v35-mail-status{display:flex;align-items:center;gap:9px;padding:11px 13px;border:1px solid #dbe3ec;border-radius:12px;background:#f8fafc}
.v35-mail-status i{width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 4px #fee2e2}
.v35-mail-status.connected i{background:#16a34a;box-shadow:0 0 0 4px #dcfce7}
.v35-mail-status strong,.v35-mail-status small{display:block}
.v35-mail-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.v35-mail-settings-grid .full{grid-column:1/-1}
.v35-mail-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.v35-mail-progress{position:fixed;right:24px;bottom:24px;z-index:100000;background:#172033;color:#fff;padding:13px 17px;border-radius:13px;box-shadow:0 15px 40px #17203344;font-weight:750}
.v35-mail-hint{margin-top:10px;color:#526071;font-size:12px;line-height:1.45}
@media(max-width:760px){.v35-mail-settings-grid{grid-template-columns:1fr}}
