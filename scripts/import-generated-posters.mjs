import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const args=process.argv.slice(2);
assert.ok(args.length===2&&args[0]==='--source-dir','Usage: node scripts/import-generated-posters.mjs --source-dir <reviewed full ImageGen PNGs>');
const source=path.resolve(args[1]);
let sharp;
try{sharp=(await import('sharp')).default;}catch(error){
 if(!process.env.CODEX_NODE_MODULES)throw new Error('Install sharp to make web previews.',{cause:error});
 sharp=createRequire(pathToFileURL(path.join(process.env.CODEX_NODE_MODULES,'package.json')))('sharp');
}
const box={window:{}};
vm.runInNewContext(await fs.readFile(path.join(root,'schedule-config.js'),'utf8'),box,{timeout:1000});
const config=JSON.parse(JSON.stringify(box.window.SchoolScheduleConfig));
const accepted=[];
// Validate every reviewed source first. The full PNG is copied byte for byte.
for(let index=0;index<config.classes.length;index++){
 const grade=Number(config.classes[index].match(/\d+/)[0]);
 const review=JSON.parse(await fs.readFile(path.join(source,`class-${grade}-review.json`),'utf8'));
 assert.equal(review.grade,grade);assert.equal(review.method,'builtin-imagegen-full');
 assert.equal(review.accepted,true);assert.equal(review.cellsChecked,35);
 for(const field of ['titlesCentered','spellingChecked','timesChecked'])assert.equal(review[field],true,'Review incomplete: '+grade+' '+field);
 assert.deepEqual(review.remainingIssues,[],'Resolve reported image errors before importing.');
 const png=await fs.readFile(path.join(source,`class-${grade}.png`));
 const generated=await fs.readFile(review.sourceGeneratedPath);
 assert.equal(hash(png),hash(generated),'Full poster must be the untouched ImageGen result.');
 const info=await sharp(png).metadata();
 assert.equal(info.format,'png');assert.ok(info.width>=1400&&info.height>=980);
 assert.ok(info.width/info.height>1.35&&info.width/info.height<1.5);
 const promptPath=`assets/print-generation/class-${grade}-prompt.txt`;
 const prompt=await fs.readFile(path.join(root,promptPath),'utf8');
 const cells=[];
 for(const day of config.dayOrder)for(const bell of config.bellSchedule){
  const value=config.scheduleRows.find(row=>row.day===day.label&&row.lesson===bell.lesson).classes[index];
  cells.push({day:day.label,dayId:day.id,lesson:bell.lesson,start:bell.start,end:bell.end,value});
 }
 accepted.push({grade,index,review,png,info,promptPath,prompt,cells});
}
await fs.mkdir(path.join(root,'assets/print'),{recursive:true});
const posters=[];
for(const item of accepted){
 const {grade,review,png,info,promptPath,prompt,cells}=item;
 const imagePath=`assets/print/class-${grade}-week.png`,previewPath=`assets/print/class-${grade}-preview.webp`;
 const preview=await sharp(png).resize({width:1400,withoutEnlargement:true}).webp({quality:93,effort:6}).toBuffer();
 await fs.writeFile(path.join(root,imagePath),png);
 await fs.writeFile(path.join(root,previewPath),preview);
 const reviewPath=`assets/print-generation/class-${grade}-review.json`;
 const publishedReview={...review,sourceGeneratedPath:path.basename(review.sourceGeneratedPath),promptPath,imageSha256:hash(png)};
 await fs.writeFile(path.join(root,reviewPath),JSON.stringify(publishedReview,null,2)+'\n','utf8');
 posters.push({grade,className:config.classes[item.index],path:imagePath,previewPath,width:info.width,height:info.height,sha256:hash(png),previewSha256:hash(preview),promptPath,promptSha256:hash(prompt.replace(/\r\n?/g,'\n')),reviewPath,cellCount:35,filledCount:cells.filter(cell=>cell.value).length,cells});
 console.log(`${grade} клас: untouched ImageGen PNG ${info.width}×${info.height}, visually reviewed35 cells.`);
}
const manifest={schemaVersion:2,format:'A4 landscape',generationMethod:'builtin-imagegen-full',originalsUnmodified:true,configHashMethod:'sha256(JSON.stringify(parsed SchoolScheduleConfig))',configSha256:hash(JSON.stringify(config)),reviewMethod:'Visual review of the actual generated text, lesson times and all35 cells per image; file checksums protect the accepted images.',complete:posters.length===7,posters};
await fs.writeFile(path.join(root,'assets/print/manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
