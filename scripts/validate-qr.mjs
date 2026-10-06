import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url));
const manifest=JSON.parse(read('assets/qr/manifest.json'));
const url='https://serhii0304.github.io/Rozklad-Romanivka/';
assert.equal(manifest.schemaVersion,1);assert.equal(manifest.url,url);
assert.equal(manifest.quietZoneModules,4);assert.equal(manifest.errorCorrection,'Q');
assert.ok(manifest.decodedExactly.includes('SVG raster'));
assert.ok(manifest.decodedExactly.includes('phone PNG'));
assert.deepEqual(manifest.files.map(file=>file.path),['assets/qr/site.png','assets/qr/site.svg','assets/qr/poster.png']);
for(const file of manifest.files){
 const bytes=read(file.path);
 const content=file.path.endsWith('.svg')?bytes.toString('utf8').replace(/\r\n?/g,'\n'):bytes;
 assert.equal(crypto.createHash('sha256').update(content).digest('hex'),file.sha256,'QR asset changed: '+file.path);
}
const html=read('qr.html').toString('utf8');
assert.ok(html.includes('src="assets/qr/site.svg"'));assert.ok(html.includes('href="'+url+'"'));
console.log('Verified QR assets for the canonical schedule URL; PNG and SVG scan checks recorded.');
