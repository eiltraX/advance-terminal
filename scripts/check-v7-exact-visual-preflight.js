'use strict';
const fs=require('node:fs'); const path=require('node:path'); const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const expected={"src/renderer/index.html": "8cbba177911565d06e4409b5155e8353767446f033be57e2a097441f96209433", "src/renderer/styles.css": "8966a29d6d655b297f42c560cb7cc7dd3a5d73258eaa54da7faf74eb0bb82ec6", "src/renderer/renderer.js": "1a24e88e24ac1d26f0d28ceefab57ba9c1f78e0b78d361046627cd9484f07103"};
for (const [file,wanted] of Object.entries(expected)) { const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'); if(actual!==wanted){console.error('STOP: '+file+' differs from uploaded V7 source. Expected '+wanted+'; found '+actual);process.exitCode=1;} }
// Existing browser navigation regression check was shipped in the prior patch.
// Do not overwrite an independently edited regression test without inspection.
const checkPath=path.join(root,'scripts/check-v7-browser-nav.js');
if(fs.existsSync(checkPath)) {
  const hash=crypto.createHash('sha256').update(fs.readFileSync(checkPath)).digest('hex');
  if(hash!=='93bc01756acbcea382088f00f70041d8c611edeb0dc1e49ea44913c1b298c434') { console.error('STOP: Browser navigation regression test changed since inspected version.'); process.exitCode=1; }
}
if (!process.exitCode) console.log('PASS: Current frontend matches inspected snapshot; back up before copying patch.');
