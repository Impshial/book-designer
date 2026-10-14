import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const p=JSON.parse(readFileSync('package.json','utf8'));
let text='BOOK DESIGNER — THIRD-PARTY NOTICES\n\n';
const seen=new Set();
for(const directory of readdirSync('node_modules/.pnpm')){
  const nested=join('node_modules/.pnpm',directory,'node_modules');if(!existsSync(nested))continue;
  const candidates=readdirSync(nested).flatMap(name=>name.startsWith('@')?readdirSync(join(nested,name)).map(child=>join(nested,name,child)):[join(nested,name)]);
  for(const dir of candidates){try{const meta=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));const key=`${meta.name}@${meta.version}`;if(seen.has(key))continue;seen.add(key);const files=readdirSync(dir).filter(x=>/^(license|licence|copying)(\.|$)/i.test(x));text+=`\n${'='.repeat(70)}\n${key}\nLicense: ${meta.license??'See upstream license'}\n`;for(const file of files)try{text+=readFileSync(join(dir,file),'utf8')+'\n';}catch{}}catch{}}
}
text+='\nBUNDLED NOTO FONTS\n'+readFileSync('public/fonts/OFL.txt','utf8');
writeFileSync('public/THIRD-PARTY-NOTICES.txt',text);console.log(`Wrote notices for ${seen.size} installed package versions.`);
