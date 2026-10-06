import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {wholeWeekPosters} from '../week-posters.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const args=process.argv.slice(2);
assert.ok(args.length===0||(args.length===2&&args[0]==='--source-dir'),
  'Usage: node scripts/import-week-posters.mjs [--source-dir <reviewed full ImageGen PNGs>]');
const source=args.length?path.resolve(args[1]):path.resolve(root,'../.romanivka-site-work/generated');
const resolveSource=name=>path.isAbsolute(name)?name:path.resolve(source,name);
let sharp;
try{sharp=(await import('sharp')).default;}catch(error){
  if(!process.env.CODEX_NODE_MODULES)throw new Error('Install sharp or set CODEX_NODE_MODULES to create WebP previews.',{cause:error});
  sharp=createRequire(pathToFileURL(path.join(process.env.CODEX_NODE_MODULES,'package.json')))('sharp');
}

const box={window:{}};
vm.runInNewContext(await fs.readFile(path.join(root,'schedule-config.js'),'utf8'),box,{timeout:1000});
const config=JSON.parse(JSON.stringify(box.window.SchoolScheduleConfig));
const pages=wholeWeekPosters(config);
assert.deepEqual(pages.map(page=>page.dayId),['monday','tuesday','wednesday','thursday','friday']);
assert.equal(config.classes.length,7,'The general timetable requires seven class columns.');
assert.equal(new Set(config.classes).size,7);
assert.equal(config.bellSchedule.length,7,'The general timetable requires seven lesson rows.');
assert.equal(new Set(config.bellSchedule.map(bell=>bell.lesson)).size,7);
const accepted=[];

// Finish every source check and preview conversion before changing public assets.
for(const page of pages){
  const {dayId,label}=page;
  const review=JSON.parse(await fs.readFile(path.join(source,`${dayId}-review.json`),'utf8'));
  assert.equal(review.dayId,dayId);
  assert.equal(review.method,'builtin-imagegen-full');
  assert.equal(review.accepted,true,`Unaccepted review: ${dayId}`);
  assert.equal(review.cellsChecked,49);
  for(const field of ['titlesCentered','spellingChecked','timesChecked','iconsApproved','styleMatched','gridFillsPage'])
    assert.equal(review[field],true,`Review incomplete: ${dayId} ${field}`);
  assert.deepEqual(review.remainingIssues,[],'Resolve reported image errors before importing.');
  for(const field of ['sourceGeneratedPath','promptPath'])
    assert.ok(typeof review[field]==='string'&&review[field].trim(),`Missing ${field}: ${dayId}`);
  const png=await fs.readFile(path.join(source,`${dayId}.png`));
  const generated=await fs.readFile(resolveSource(review.sourceGeneratedPath));
  assert.equal(hash(png),hash(generated),`The ${dayId} PNG must be the untouched ImageGen result.`);
  const info=await sharp(png).metadata();
  assert.equal(info.format,'png');
  assert.ok(info.width>=1400&&info.height>=980,`Native image is too small: ${dayId}`);
  assert.ok(info.width/info.height>1.35&&info.width/info.height<1.5,`Expected A4 landscape proportions: ${dayId}`);
  assert.equal(review.nativeWidth,info.width);
  assert.equal(review.nativeHeight,info.height);
  const prompt=await fs.readFile(resolveSource(review.promptPath),'utf8');
  assert.ok(prompt.trim(),`Missing generation prompt: ${dayId}`);
  const cells=[];
  for(const bell of config.bellSchedule){
    const rows=config.scheduleRows.filter(row=>row.day===label&&row.lesson===bell.lesson);
    assert.equal(rows.length,1,`Expected one source row: ${dayId}, lesson ${bell.lesson}`);
    assert.equal(rows[0].classes.length,7);
    for(const [index,className] of config.classes.entries()){
      const value=rows[0].classes[index];
      assert.equal(typeof value,'string');
      cells.push({className,lesson:bell.lesson,start:bell.start,end:bell.end,value});
    }
  }
  const preview=await sharp(png).resize({width:1400,withoutEnlargement:true}).webp({quality:93,effort:6}).toBuffer();
  accepted.push({page,review,png,preview,info,prompt,cells});
}

await fs.mkdir(path.join(root,'assets/print-week'),{recursive:true});
await fs.mkdir(path.join(root,'assets/print-week-generation'),{recursive:true});
const posters=[];
for(const {page,review,png,preview,info,prompt,cells} of accepted){
  const {dayId,label,imagePath,previewPath}=page;
  const promptPath=`assets/print-week-generation/${dayId}-prompt.txt`;
  const reviewPath=`assets/print-week-generation/${dayId}-review.json`;
  const publishedReview={...review,sourceGeneratedPath:path.basename(review.sourceGeneratedPath),promptPath,imageSha256:hash(png)};
  const reviewText=JSON.stringify(publishedReview,null,2)+'\n';
  // Only the preview is a derivative. Never resample, redraw, or rewrite PNG metadata.
  await fs.writeFile(path.join(root,imagePath),png);
  await fs.writeFile(path.join(root,previewPath),preview);
  await fs.writeFile(path.join(root,promptPath),prompt,'utf8');
  await fs.writeFile(path.join(root,reviewPath),reviewText,'utf8');
  posters.push({dayId,label,path:imagePath,previewPath,width:info.width,height:info.height,
    sha256:hash(png),previewSha256:hash(preview),promptPath,promptSha256:hash(prompt.replace(/\r\n?/g,'\n')),
    reviewPath,reviewSha256:hash(reviewText.replace(/\r\n?/g,'\n')),cellCount:49,filledCount:cells.filter(cell=>cell.value).length,cells});
  console.log(`${label}: untouched ImageGen PNG ${info.width}×${info.height}; accepted visual review of 49 cells.`);
}
const manifest={schemaVersion:2,format:'A4 landscape',generationMethod:'builtin-imagegen-full',
  style:'academic-navy-ivory-gold-v1',originalsUnmodified:true,
  configHashMethod:'sha256(JSON.stringify(parsed SchoolScheduleConfig))',configSha256:hash(JSON.stringify(config)),
  reviewMethod:'Recorded visual review of generated titles, spelling, lesson times and all 49 cells per image. Checksums link those records to accepted PNGs; validation does not perform OCR.',
  complete:posters.length===5,posters};
await fs.writeFile(path.join(root,'assets/print-week/manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
