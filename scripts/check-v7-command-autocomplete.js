// V7 inline ghost autocomplete - baseline preflight, keyboard and safety regression tests.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const oldHashes = {'src/renderer/index.html': '178c9f990186044b11536f0462a7d7330e906ef109a3f0b3620a9ccf773bc8b7', 'src/renderer/v7-command-autocomplete.css': '57aded7734dac007950ea71c3864338c04cfb88072648bbe76a6385b9914fdae', 'src/renderer/js/v7-command-autocomplete.js': '79a81f41c78d4f05e7a551bc1d6693c3e869189d1ae17b974c83c3398b4b6195', 'scripts/check-v7-command-composer.js': '59e9bf41369ccb5f218cdbf8589ff0b9e8b3beba15a7ad7d7db1129e348d2409', 'scripts/check-v7-frameless-titlebar.js': '95d495c32b14c85f78031d71fce6423e7bb5bded4e7918fd81020d2905b468cc', 'scripts/check-v7-menu-settings-polish.js': '4d3b312ff2d3bae70f424e294c7f52d8065792d68fb58334781ebe82b79fd7a5'};
const newHashes = {'src/renderer/index.html': '8ba53a9b491422585c382c215da115c1a80fb35ed1bcf8afc02fbb03a55f023c', 'src/renderer/v7-command-autocomplete.css': '839ba5132c0db069f078ed711c60ed1685ec50041c887d4574309ba8fa39fc83', 'src/renderer/js/v7-command-autocomplete.js': '635f7e69a8e2d5b3d2fcc03978440c8043cc9b3ef1f5b7f28d98e27fca9defd5', 'scripts/check-v7-command-composer.js': '09ad28f5891df662365b5139e7c6e200b3e11946e258a34dd7bf62533b8d72c2', 'scripts/check-v7-frameless-titlebar.js': '9e5bcde25593c6e90d558854e3c1da5c64a859712d1df06b1a5e45e89acacb4c', 'scripts/check-v7-menu-settings-polish.js': 'fafa473b2d2e0a47def9a7adf7b4f5d3bbaaff438fa1849e0e1cb79fc30f73cd'};
function hash(rel) {
 const p=path.join(root,rel);
 return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null;
}
const before=process.argv.includes('--before');
for (const [rel,digest] of Object.entries(before ? oldHashes : newHashes)) {
 assert.equal(hash(rel), digest, `STOP: ${rel} has changed from the inspected ${before?'pre-patch':'patched'} source; do not overwrite unexpectedly`);
}
if (before) { console.log('PASS: Installed V7 command autocomplete matches inspected baseline. Back up affected files before applying.'); process.exit(0); }
const html=fs.readFileSync(path.join(root,'src/renderer/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/renderer/v7-command-autocomplete.css'),'utf8');
const js=fs.readFileSync(path.join(root,'src/renderer/js/v7-command-autocomplete.js'),'utf8');
assert(html.includes('id="v7-composer-ghost"') && html.includes('aria-autocomplete="inline"'));
assert(!html.includes('id="v7-command-suggestions"'), 'Large popup should be removed');
assert(html.includes('id="v7-composer-input" rows="1" wrap="off"'), 'Keep one-line composer');
assert(css.includes('.v7-composer-ghost-suffix') && css.includes('pointer-events: none;'));
assert(/\.v7-composer-ghost\s*\{[^}]*white-space:\s*normal\s*;/.test(css), 'Ghost overlay must not preserve HTML indentation whitespace');
assert(/\.v7-composer-ghost-line\s*\{[^}]*white-space:\s*pre\s*;/.test(css), 'Actual completion text must preserve spaces');
assert(!/(?:eval\s*\(|new\s+Function\s*\(|fetch\s*\(|setInterval\s*\()/i.test(js),'No code eval/network/polling');
assert(!js.includes('writeTerminal(') && !js.includes('sendV7ComposerCommand('),'Autocomplete must never send commands');

class FakeElement {
 constructor(id) { this.id=id;this.events={};this.value='';this.hidden=true;this.style={};this.textContent='';this.selectionStart=0;this.selectionEnd=0;this.scrollLeft=0;this.focused=false; }
 addEventListener(name,handler,opt) { (this.events[name] ||= []).push({handler,capture:opt===true}); }
 dispatchEvent(event) { for(const listener of this.events[event.type]||[]) listener.handler(event); return true; }
 setSelectionRange(start,end) {this.selectionStart=start;this.selectionEnd=end;}
 focus() {this.focused=true;}
}
const ids=['v7-composer-input','v7-composer-ghost','v7-composer-ghost-line','v7-composer-ghost-typed','v7-composer-ghost-suffix','v7-composer-send'];
const els=Object.fromEntries(ids.map(id=>[id,new FakeElement(id)]));
const input=els['v7-composer-input'];
const ghost=els['v7-composer-ghost'];
const suffix=els['v7-composer-ghost-suffix'];
const typed=els['v7-composer-ghost-typed'];
let draftEvents=0, sentEvents=0;
input.addEventListener('input',()=>{draftEvents++;});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.defaultPrevented)sentEvents++;});
const document={getElementById(id){return els[id] || null;}};
vm.runInNewContext(js,{window:{},document,Event:class Event{constructor(type,opts){this.type=type;this.bubbles=!!opts?.bubbles;}}},{filename:'v7-command-autocomplete.js'});
function dispatch(type,props={}) {
 let cancelled=false,stopped=false;
 const event={type,key:'',shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,isComposing:false,keyCode:0,...props,
 preventDefault(){cancelled=true;this.defaultPrevented=true;},stopImmediatePropagation(){stopped=true;},defaultPrevented:false};
 const items=(input.events[type]||[]).sort((a,b)=>Number(b.capture)-Number(a.capture));
 for(const listener of items) {listener.handler(event);if(stopped) break;}
 return {cancelled,stopped};
}
function type(value,cursor=value.length) { input.value=value;input.setSelectionRange(cursor,cursor);dispatch('input'); }
// Verify the existing complete catalog remains available via its source code.
assert(js.includes('php artisan route:list') && js.includes('flutter analyze') && js.includes('git status'));
type('git sta');
assert.equal(ghost.hidden,false);
assert.equal(typed.textContent,'git sta');
assert.equal(suffix.textContent,'tus');
let e=dispatch('keydown',{key:'Tab'});
assert(e.cancelled && e.stopped);
assert.equal(input.value,'git status');
assert.equal(ghost.hidden,true);
assert.equal(draftEvents,2);
dispatch('focus');
assert.equal(ghost.hidden,true,'No chained completion after accepting Tab');
type('php arti');
assert.equal(ghost.hidden,false);
assert(typed.textContent+suffix.textContent.startsWith('php arti'));
e=dispatch('keydown',{key:'Enter'});
assert(!e.cancelled && !e.stopped,'Enter must send the literal typed command');
assert.equal(sentEvents,1);
type('git sta');
e=dispatch('keydown',{key:'Escape'});
assert(e.cancelled && ghost.hidden);
dispatch('focus');
assert.equal(ghost.hidden,true,'Escape dismissal persists for unchanged value');
type('git stat');
assert.equal(ghost.hidden,false,'Typing more reopens suggestion');
type('git sta',3);
assert.equal(ghost.hidden,true,'No suggestions when caret is in the middle');
type('echo foo\necho bar');
assert.equal(ghost.hidden,true,'Never complete multiline paste');
type('git sta');
dispatch('compositionstart');
assert.equal(ghost.hidden,true);
dispatch('compositionend');
assert.equal(ghost.hidden,false);
input.scrollLeft=42;
dispatch('scroll');
assert.equal(els['v7-composer-ghost-line'].style.transform,'translateX(-42px)');
input.value='git sta';dispatch('paste');
assert.equal(ghost.hidden,true);
type('git sta');
dispatch('blur');
assert.equal(ghost.hidden,true);
assert.equal(sentEvents,1,'Only explicitly entered commands may flow to existing send handler');
console.log('PASS: V7 inline ghost autocomplete, Tab accepts, Enter sends original, typing/escape/IME/caret/paste/scroll, no popup or backend execution');
