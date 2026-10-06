import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=process.cwd(),out=path.join(root,'build');
const files=['index.html','class.html','week-print.html','week-print-preview.mjs','week-print.css','week-posters.mjs','assets/print-pdfs.json','print.html','print-preview.css','print-preview.mjs','print-posters.mjs','print-files.mjs','Розклад дзвінків.html','site.css','enhancements.css','highlights.css','responsive.css','ukraine.css','print.css','print-layout.mjs','theme-init.js','effects.mjs','schedule-view.mjs','subject-icons.mjs','app.mjs','view-mode.mjs','live-state.mjs','weekday-style.css','lesson-content.mjs','table-navigation.mjs','romanivka.css','schedule-config.js','time-core.mjs','kyiv-clock.mjs','minute-of-silence.mjs','school-bell.mjs','favicon.svg','school-background-2026.png','THIRD_PARTY_NOTICES.md','Хвилина мовчання.mp3','Звук шкільного дзвінка.mp3'];
files.push('index Романівський ліцей ім. М.Т.Рильського.html','РОЗКЛАД УРОКІВ Початкові класи.html','qr.html','qr-page.css','qr-page.mjs','qr-nav.css','assets/qr/site.png','assets/qr/site.svg','assets/qr/poster.png','assets/qr/manifest.json','mobile-layout.css','bells-view.mjs','bells-style.css','bells-poster.mjs','bells-print.html','bells-print.mjs','bells-print.css');
files.push(...fs.readdirSync('assets/print-bells').filter(x=>/\.(png|webp|json|pdf|txt)$/.test(x)).map(x=>'assets/print-bells/'+x));
files.push(...fs.readdirSync('assets/subjects').filter(x=>x.endsWith('.svg')).map(x=>'assets/subjects/'+x),'assets/ui/school-building.png','assets/ui/school-bell-refined.png','assets/ui/ukraine-coat-of-arms.svg');
files.push(...fs.readdirSync('assets/print').filter(x=>/\.(png|webp|json|pdf)$/.test(x)).map(x=>'assets/print/'+x));
files.push(...fs.readdirSync('assets/print-generation').filter(x=>/\.(json|txt|md)$/.test(x)).map(x=>'assets/print-generation/'+x));
files.push(...fs.readdirSync('assets/print-week').filter(x=>/\.(png|webp|json|pdf)$/.test(x)).map(x=>'assets/print-week/'+x));
files.push(...fs.readdirSync('assets/print-ready').filter(x=>/\.(png|webp|json)$/.test(x)).map(x=>'assets/print-ready/'+x));
files.push(...fs.readdirSync('assets/print-week-generation').filter(x=>/\.(json|txt|md)$/.test(x)).map(x=>'assets/print-week-generation/'+x));
execFileSync(process.execPath,['scripts/validate-generated-posters.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/validate-week-posters.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/validate-print-pdfs.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/validate-print-images.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/validate-bells-print.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/validate-qr.mjs'],{stdio:'inherit'});
for(const name of files){if(!fs.existsSync(name))throw new Error('Missing '+name);if(/\.(mjs|js)$/.test(name))execFileSync(process.execPath,['--check',name]);}
for(const filename of files.filter(name=>name.endsWith('.html'))){const html=fs.readFileSync(filename,'utf8');for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(/^(?:https?:|#)/.test(ref))continue;if(!fs.existsSync(ref.split(/[?#]/)[0]))throw new Error('Broken reference in '+filename+': '+ref);}}
for(const name of files.filter(x=>x.endsWith('.mjs'))){for(const [,ref]of fs.readFileSync(name,'utf8').matchAll(/from ['"](\.\/[^'"]+)['"]/g))if(!fs.existsSync(path.resolve(root,ref.split(/[?#]/)[0])))throw new Error('Missing import '+ref);}
fs.mkdirSync(out,{recursive:true});for(const name of files){fs.mkdirSync(path.dirname(path.join(out,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(out,name));}
console.log('Static site built: '+files.length+' public files.');
