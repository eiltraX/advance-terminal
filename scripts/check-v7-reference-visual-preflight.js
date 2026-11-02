// Read-only hash gate: prevent overwriting updated or otherwise modified sources.
'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const expected={
  "src/renderer/styles.css": "3298a80db713a3309b483b2af49e18ce3c7d9edbe6617adc0bc41bf40a71fc6b",
  "src/renderer/index.html": "05e17465bbb2e70ec64d976891d94fc1fb90f269ec6d4a6f1d7821fe91abe29e",
  "src/renderer/renderer.js": "1a24e88e24ac1d26f0d28ceefab57ba9c1f78e0b78d361046627cd9484f07103"
};
for(const [file,wanted] of Object.entries(expected)){
  const p=path.join(root,file);
  if(!fs.existsSync(p)){console.error('STOP: Missing '+file);process.exitCode=1;continue;}
  const found=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if(found!==wanted){console.error('STOP: '+file+' differs from the inspected V7 source; expected '+wanted+', found '+found);process.exitCode=1;}
}
if(!process.exitCode) console.log('PASS: V7 source matches inspected snapshot; safe to back up before applying styling patch.');
