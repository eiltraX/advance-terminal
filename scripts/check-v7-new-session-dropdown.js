
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sources = ['src/renderer/renderer.js','src/renderer/v7-minimal-shell.css'];
const original = {'src/renderer/renderer.js': 'cbb5614ab2b923170021c50e2086eba08128df5decc743e5696a307f5236a5d7', 'src/renderer/v7-minimal-shell.css': 'ed9b5cf18f2e6ab7886d2a81b1dc54392f2d78854bbd768ff8818320e550738c'};
const updated = {'src/renderer/renderer.js': 'e6e2e1be4968d8fa29b239cb525e89b0ffc6162e971da2490b15eb78e55b9f59', 'src/renderer/v7-minimal-shell.css': '2aca0758d0763370dc351f607e606cbe1b07de9122890a5ecbf1e56d36b16971'};
const before = process.argv.includes('--before');
const js = fs.readFileSync(path.join(root, sources[0]), 'utf8');
for (const file of sources) {
  const body = fs.readFileSync(path.join(root,file));
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  assert.equal(hash, before ? original[file] : updated[file], `STOP: ${file} differs from expected ${before ? 'original' : 'updated'} source; preserve current files.`);
}
if (!before) {
  const css = fs.readFileSync(path.join(root,sources[1]),'utf8');
  assert(js.includes('function toggleV7NewSessionMenu(trigger)'));
  assert(js.includes('Saved SSH connections'));
  assert(js.includes("typeFilter: 'remote'"));
  assert(js.includes('closeV7NewSessionMenu({ restoreFocus: true })'));
  assert(js.includes("openAddConnectionModal('local', true)"));
  assert(!js.includes('openSavedTerminalPicker(event.currentTarget)'));
  assert(css.includes('.v7-new-session-menu'));
}
if (!before) {
// Isolated UI interaction test. This does not instantiate an SSH client,
// interact with real settings, or open a terminal process.
const vm = require('node:vm');
const begin = js.indexOf('// V7 quick-launch menu:');
const end = js.indexOf('function bindV7MinimalShell()', begin);
assert(begin >= 0 && end > begin);
const events = [];
class ElementStub {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.attributes = {}; this.handlers = {};
    this.style = {}; this.isConnected = true; this.className = ''; this.textContent = '';
  }
  setAttribute(name,value) { this.attributes[name] = String(value); }
  addEventListener(name,listener) { this.handlers[name] = listener; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  remove() { this.isConnected = false; events.push('removed'); }
  focus() { events.push('focused:' + (this.textContent || this.tag)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const output = [];
    const scan = (node) => {
      if (node.className === selector.slice(1)) output.push(node);
      for (const child of node.children) scan(child);
    };
    scan(this);
    return output;
  }
}
const documentStub = {
  body: new ElementStub('body'),
  createElement: (tag) => new ElementStub(tag)
};
const context = vm.createContext({
  document: documentStub,
  closeTerminalTabPicker: () => events.push('close-picker'),
  setV7MenuOpen: (state) => events.push('app-menu:' + state),
  positionTerminalTabPicker: () => events.push('positioned'),
  showTerminalTabPicker: (trigger,options) => events.push('picker:' + options.typeFilter),
  openAddConnectionModal: (kind,newEntry) => events.push('modal:' + kind + ':' + newEntry),
});
vm.runInContext(js.slice(begin,end), context, {timeout:3000});
const trigger = new ElementStub('button');
vm.runInContext('toggleV7NewSessionMenu',context)(trigger);
const menu = documentStub.body.children.at(-1);
assert.equal(menu.className,'v7-new-session-menu');
assert.equal(trigger.attributes['aria-expanded'],'true');
const items = menu.querySelectorAll('.v7-new-session-item');
assert.equal(items.length,4);
assert.deepEqual(items.map(x=>x.children[0].textContent),[
  'Saved local terminals','Saved SSH connections','New local project','New SSH connection'
]);
items[1].handlers.click();
assert(events.includes('picker:remote'));
assert.equal(trigger.attributes['aria-expanded'],'false');
assert.equal(menu.isConnected,false);
vm.runInContext('toggleV7NewSessionMenu',context)(trigger);
const menu2 = documentStub.body.children.at(-1);
menu2.querySelectorAll('.v7-new-session-item')[2].handlers.click();
assert(events.includes('modal:local:true'));
vm.runInContext('toggleV7NewSessionMenu',context)(trigger);
const menu3 = documentStub.body.children.at(-1);
let prevented = false;
menu3.handlers.keydown({key:'Escape', preventDefault:()=>{prevented=true;}});
assert(prevented);
assert.equal(trigger.attributes['aria-expanded'],'false');
assert.equal(menu3.isConnected,false);

}
console.log(`PASS: V7 New Session dropdown ${before?'preflight':'source verification'}; saved connections and SSH logic preserved`);
