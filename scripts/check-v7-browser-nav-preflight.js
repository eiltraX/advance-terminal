'use strict';
// Read-only verification: installed source must be the same snapshot as the uploaded v7-layout-refine-current.zip.
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const expected={
 'src/renderer/index.html':'c3cff7991af485ffabdb6b31381bc3d4df3d5ffa6aa90376d4de7862a453a857',
 'src/renderer/styles.css':'6a4dc2960c04015f93220c3077f7c4d148873633612218af70d9831cb57695b9',
 'src/renderer/renderer.js':'50260fc2784d4aaeaadc298f0d53125265a0833a08479f15b990166cf65b2f12'
};
for(const [name,hash] of Object.entries(expected)) {
 const file=path.join(root,name);
 if(!fs.existsSync(file)) {console.error('STOP: Missing '+name);process.exitCode=1;continue;}
 const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(actual!==hash) {console.error('STOP: Source changed: '+name+'; expected '+hash+'; found '+actual);process.exitCode=1;}
}
if(!process.exitCode) console.log('PASS: V7 source matches the uploaded layout-refine snapshot. Back up the files before applying.');
