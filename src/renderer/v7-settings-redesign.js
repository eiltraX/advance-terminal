/* Settings navigation enhancement. No settings values, terminal data or secrets leave the renderer. */
(() => {
  'use strict';
  const CATEGORIES = [
    ['appearance', 'Appearance', 'theme light dark color notifications toast position'],
    ['safety', 'Terminal safety', 'paste confirmation right click auto enter ssh folder lock'],
    ['terminal-actions', 'Terminal actions', 'toolbar buttons shortcut copy paste clear command icon'],
    ['keys', 'SSH keys', 'public private key generate fingerprint passphrase archive'],
    ['ai', 'AI', 'lm studio openai model API key inspector privacy'],
    ['recovery', 'Data & recovery', 'export import repair backup settings'],
    ['updates', 'Updates', 'version check install restart']
  ];

  function init() {
    const root = document.getElementById('settings-view');
    const input = root?.querySelector('#at-settings-search');
    const results = root?.querySelector('#at-settings-search-results');
    const picker = root?.querySelector('#at-settings-picker');
    if (!root || !input || !results || !picker || root.dataset.settingsNavigationInitialized) return;
    root.dataset.settingsNavigationInitialized = 'true';
    const buttons = Array.from(root.querySelectorAll('.at-settings-nav-list .settings-tab'));
    const sections = Array.from(root.querySelectorAll('.settings-section'));
    const byKey = new Map(buttons.map(button => [button.dataset.settingsTab, button]));
    function currentKey() {
      const active = sections.find(section => section.classList.contains('active'));
      return active?.id.replace('settings-tab-', '') || 'safety';
    }
    function sync() {
      const key = currentKey();
      if (picker.value !== key) picker.value = key;
      buttons.forEach(button => {
        if (button.dataset.settingsTab === key) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    }
    function navigate(key) {
      const button = byKey.get(key);
      if (!button) return;
      button.click(); // Invoke the existing Settings handler; never duplicate its logic.
      input.value = '';
      renderSearch();
      sync();
      const scroller = root.querySelector('.settings-content');
      if (scroller) scroller.scrollTop = 0;
    }
    function renderSearch() {
      const query = input.value.trim().toLocaleLowerCase();
      results.replaceChildren();
      root.classList.toggle('at-settings-is-searching', Boolean(query));
      results.hidden = !query;
      if (!query) return;
      const words = query.split(/\s+/).filter(Boolean).slice(0, 8);
      const matches = CATEGORIES.filter(([key, label, aliases]) => {
        const section = root.querySelector('#settings-tab-' + key);
        const text = (label + ' ' + aliases + ' ' + (section?.textContent || '')).toLocaleLowerCase();
        return words.every(word => text.includes(word));
      });
      if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'at-settings-search-empty';
        empty.textContent = 'No settings found. Try another keyword.';
        results.appendChild(empty);
        return;
      }
      matches.forEach(([key, label]) => {
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.className = 'at-settings-result';
        entry.textContent = label;
        entry.addEventListener('click', () => navigate(key));
        results.appendChild(entry);
      });
    }
    input.addEventListener('input', renderSearch);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && input.value) {
        event.stopPropagation();
        input.value = '';
        renderSearch();
      }
    });
    picker.addEventListener('change', () => navigate(picker.value));
    buttons.forEach(button => button.addEventListener('click', () => {
      // The renderer's existing click listener owns section activation.
      if (input.value) { input.value = ''; renderSearch(); }
      queueMicrotask(sync);
    }));
    const observer = new MutationObserver(sync);
    sections.forEach(section => observer.observe(section, {attributes: true, attributeFilter: ['class']}));
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
