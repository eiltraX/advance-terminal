// Run from the Advance Terminal project root.  Read-only preflight and unit checks.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const root = process.cwd();
const paths = {
  html: path.join(root,'src/renderer/index.html'),
  js: path.join(root,'src/renderer/renderer.js'),
  css: path.join(root,'src/renderer/v7-command-composer.css')
};
const hashes = {
  // Preflight against the currently installed two-row composer patch.
  before: { html:'f48abc368912716343550017af1e3ed0c865b57248aa33b62f1280efd4de898d', js:'e6e2e1be4968d8fa29b239cb525e89b0ffc6162e971da2490b15eb78e55b9f59', css:'9354f4aa043a8b0bdddd9e7880393e02fe075d5a9992dfa542486755ecc090dd' },
  after: { html:'8ba53a9b491422585c382c215da115c1a80fb35ed1bcf8afc02fbb03a55f023c', js:'e6e2e1be4968d8fa29b239cb525e89b0ffc6162e971da2490b15eb78e55b9f59', css:'4de87c5d6d61c2256303609d418ea1f73d59f375c666232410c0b55cf05882ba' }
};
function digest(p) { return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null; }
function verify(phase) {
  for (const [key,hash] of Object.entries(hashes[phase])) {
    const got = digest(paths[key]);
    if (got !== hash) {
      console.error('STOP: '+path.relative(root,paths[key])+' mismatch ('+(got || 'missing')+'); expected '+hash);
      process.exitCode = 1;
      return false;
    }
  }
  console.log('PASS: V7 composer '+phase+' file identity and integrity');
  return true;
}
if (process.argv.includes('--before')) {
  if (!verify('before')) process.exit(1);
  if (fs.existsSync(paths.css)) { console.error('STOP: V7 composer stylesheet already exists; inspect it before overwriting.'); process.exit(1); }
  process.exit();
}
if (!verify('after')) process.exit(1);
const html=fs.readFileSync(paths.html,'utf8'), js=fs.readFileSync(paths.js,'utf8'),css=fs.readFileSync(paths.css,'utf8');
assert.equal((html.match(/id="terminal-toolbar-actions"/g)||[]).length,1, 'toolbar actions must be in exactly one place');
assert.equal((html.match(/id="v7-command-composer"/g)||[]).length,1);
assert(html.indexOf('id="terminal-host"') < html.indexOf('id="v7-command-composer"'));
for (const id of ['v7-composer-project','v7-composer-auto-send','v7-composer-input','v7-composer-send']) {
  assert(html.includes(`id="${id}"`), `${id} absent`);
}
assert(html.includes('href="./v7-command-composer.css"'));
assert(/id="v7-composer-input"[^>]*rows="1"[^>]*wrap="off"/.test(html), 'composer must be one visual row');
assert(/height:\s*40px;[\s\S]*?min-height:\s*40px;[\s\S]*?max-height:\s*40px;/.test(css), 'composer must remain one row high');
assert(css.includes('resize: none;'), 'single-line composer must not be resizeable');
assert(css.includes('overflow-x: auto;'), 'long command text must remain scrollable');
assert(html.includes('placeholder="Type a command..."'), 'short one-line placeholder required');
assert(css.includes('.v7-composer-actions .dynamic-terminal-action'));
assert(js.includes('bindV7CommandComposer();'));
assert(js.includes('syncV7CommandComposer();'));
assert(js.includes('v7ComposerDrafts.delete(id);'));

function snippet(start,end) {
  const a=js.indexOf(start);const b=js.indexOf(end,a);
  assert(a>=0 && b>a, 'Unable to find '+start);
  return js.slice(a,b);
}
function makeEl(){
  return {
    value:'',disabled:false,checked:false,title:'',selectionStart:0,selectionEnd:0,events:{},focused:false,
    addEventListener(name, callback){this.events[name]=callback;},
    setAttribute(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},
    focus(){this.focused=true;}
  };
}
async function flush(){for(let i=0;i<5;i++) await Promise.resolve();}
async function testComposer() {
  const els=Object.fromEntries(['#v7-composer-input','#v7-composer-send','#v7-composer-auto-send','#v7-composer-project'].map(k=>[k,makeEl()]));
  const state={activeTerminalId:'a', terminals:new Map([['a',{terminalId:'a',closed:false}],['b',{terminalId:'b',closed:false}]])};
  const writes=[],toast=[],picked=[];let local={};
  const ctx={state,Map,Set,console,localStorage:{getItem:(k)=>local[k]||null,setItem:(k,v)=>{local[k]=v}},
    $:(s)=>els[s],showToast:(...args)=>toast.push(args),toggleV7NewSessionMenu:(b)=>picked.push(b),
    writeClipboardTextToTerminal:async (s,text,label,options)=>{ writes.push({s,text,label,options});return true; }};
  vm.createContext(ctx);
  vm.runInContext(snippet('// V7 command composer:', 'function bindEvents() {'), ctx);
  vm.runInContext('bindV7CommandComposer()',ctx);
  assert.equal(els['#v7-composer-auto-send'].checked,false,'auto paste must be off by default');
  els['#v7-composer-input'].value='echo hello';els['#v7-composer-input'].events.input();
  let prevented=false;
  els['#v7-composer-input'].events.keydown({key:'Enter',shiftKey:false,isComposing:false,keyCode:13, preventDefault(){ prevented=true; }});
  await flush();
  assert(prevented,'Enter must be captured');assert.equal(writes.length,1);
  assert.equal(writes[0].text,'echo hello');assert.equal(writes[0].options.autoEnter,true);
  assert.equal(els['#v7-composer-input'].value,'');
  prevented=false;
  els['#v7-composer-input'].events.keydown({key:'Enter',shiftKey:true,isComposing:false,keyCode:13, preventDefault(){prevented=true;}});
  assert.equal(prevented,false,'Shift Enter must insert new line');assert.equal(writes.length,1);
  els['#v7-composer-input'].value='draft A';els['#v7-composer-input'].events.input();
  state.activeTerminalId='b';vm.runInContext('syncV7CommandComposer()',ctx);
  assert.equal(els['#v7-composer-input'].value,'');
  els['#v7-composer-input'].value='draft B';els['#v7-composer-input'].events.input();
  state.activeTerminalId='a';vm.runInContext('syncV7CommandComposer()',ctx);
  assert.equal(els['#v7-composer-input'].value,'draft A','restore per-tab draft');
  els['#v7-composer-auto-send'].checked=true;els['#v7-composer-auto-send'].events.change();
  assert.equal(local['advance-terminal-v7-composer-auto-send'],'true');
  els['#v7-composer-input'].value='';els['#v7-composer-input'].selectionStart=0;els['#v7-composer-input'].selectionEnd=0;
  prevented=false;
  els['#v7-composer-input'].events.paste({clipboardData:{getData:()=> 'echo first\necho second'}, preventDefault(){prevented=true;}});
  await flush();
  assert(prevented);assert.equal(writes.length,2);assert.equal(writes[1].options.requireMultilineConfirm,true);
  assert.equal(writes[1].text,'echo first\necho second');
  state.terminals.get('a').closed=true;
  els['#v7-composer-input'].value='echo safe';els['#v7-composer-input'].events.input();
  assert(els['#v7-composer-send'].disabled,'disconnected session cannot send');
  await vm.runInContext('sendV7ComposerCommand()',ctx);
  assert.equal(writes.length,2,'do not send to disconnected session');
  els['#v7-composer-project'].events.click();assert.equal(picked.length,1);
}

async function testGuardedWriter() {
  const writer=snippet('async function writeClipboardTextToTerminal(', 'async function pasteClipboardToTerminal()');
  const sent=[],alerts=[],state={activeTerminalId:'a',terminals:new Map([['a',{terminalId:'a',closed:false}]])};
  const session=state.terminals.get('a');
  let result='execute',modalCalls=0,sshBlocked=false;
  const ctx={state,console, window:{advanceTerminal:{writeTerminal:(p)=>sent.push(p)}},
    showToast:(...x)=>alerts.push(x),guardTerminalAction:()=>true,
    choosePasteAction:async()=>result,
    isMultilinePasteText:(t)=>/\n|\r/.test(t),
    openSafePasteDialog:async()=>{modalCalls++;return result;},
    collapsePasteToOneLine:(t)=>t.replace(/\s*\n\s*/g,' '),
    appendTerminalEnterIfMissing:(t)=>/[\r\n]$/.test(t)?t:t+'\r',
    inspectSshLockedTerminalData:()=>({blocked:sshBlocked,trailing:''}),
    applySshLockedLocationResult:()=>{},showSshPathLockBlocked:()=>{},
    recordTerminalInput:()=>{},recordSessionEvent:()=>{},appendLiveConsole:()=>{},focusTerminal:()=>{},
    getPasteProtectionSettings:()=>({confirmMultiline:false})};
  vm.createContext(ctx);vm.runInContext(writer,ctx);
  let ret=await vm.runInContext(`writeClipboardTextToTerminal(state.terminals.get('a'),'echo ok','Composer',{autoEnter:true,normalizeLineEndings:true,quiet:true})`,ctx);
  assert(ret);assert.equal(sent[0].data,'echo ok\r');
  result=null;
  ctx.multilineText='one\ntwo';
  ret=await vm.runInContext(`writeClipboardTextToTerminal(state.terminals.get('a'),multilineText,'Composer',{autoEnter:true,normalizeLineEndings:true,requireMultilineConfirm:true,quiet:true})`,ctx);
  assert.equal(ret,false);assert.equal(sent.length,1);assert.equal(modalCalls,1,'multiline auto-send confirmed independently of settings');
  result='execute';
  ret=await vm.runInContext(`writeClipboardTextToTerminal(state.terminals.get('a'),multilineText,'Composer',{autoEnter:true,normalizeLineEndings:true,requireMultilineConfirm:true,quiet:true})`,ctx);
  assert(ret);assert.equal(sent[1].data,'one\rtwo\r');
  sshBlocked=true;
  ret=await vm.runInContext(`writeClipboardTextToTerminal(state.terminals.get('a'),'cd /','Composer',{autoEnter:true,normalizeLineEndings:true,quiet:true})`,ctx);
  assert.equal(ret,false);assert.equal(sent.length,2,'SSH lock cannot be bypassed');
  sshBlocked=false;state.activeTerminalId='b';
  ret=await vm.runInContext(`writeClipboardTextToTerminal(state.terminals.get('a'),'echo delayed','Composer',{autoEnter:true,requireActiveSession:true,quiet:true})`,ctx);
  assert.equal(ret,false);assert.equal(sent.length,2,'cannot send to formerly active tab');
}
(async()=>{
 await testComposer();await testGuardedWriter();
 console.log('PASS: V7 single-line flat composer, Enter/Shift+Enter, drafts, auto-paste safety, session checks, SSH guards, single action mount');
})().catch(err=>{ console.error('FAIL: V7 composer test:',err.stack);process.exitCode=1;});
