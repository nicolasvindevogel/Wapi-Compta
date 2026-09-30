const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..','js');
const files=fs.readdirSync(root).filter(f=>f.endsWith('.js')).sort();
let failed=0;
for(const file of files){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  try{new vm.Script(source,{filename:file});console.log(`OK ${file}`);}
  catch(error){failed++;console.error(`ERREUR ${file}: ${error.message}`);}
}
if(failed){console.error(`${failed} fichier(s) invalide(s).`);process.exit(1);}
console.log(`${files.length} fichier(s) JavaScript valides.`);
