const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('every local script and stylesheet referenced by the entry page exists',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const refs=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
  for(const ref of refs.filter(ref=>!ref.startsWith('http')&&!ref.startsWith('//')&&!ref.startsWith('data:'))){
    assert(fs.existsSync(path.join(root,ref.split('?')[0])),`Missing deployed asset: ${ref}`);
  }
});
