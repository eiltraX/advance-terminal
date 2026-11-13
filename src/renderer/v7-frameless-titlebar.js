/* Advance Terminal V7: custom window chrome. Uses existing vetted windowAction bridge.
   No timers, terminal hooks, session requests, or settings mutations. */
(() => {
  'use strict';

  function initializeFramelessTitlebar() {
    const api = window.advanceTerminal;
    const minimizeButton = document.getElementById('v7-win-minimize');
    const maximizeButton = document.getElementById('v7-win-maximize');
    const closeButton = document.getElementById('v7-win-close');
    if (!api || typeof api.windowAction !== 'function' || !minimizeButton || !maximizeButton || !closeButton) return;

    let maximized = false;
    function applyWindowState(state) {
      if (!state || state.ok === false || typeof state.maximized !== 'boolean') return;
      maximized = state.maximized;
      maximizeButton.classList.toggle('is-maximized', maximized);
      const label = maximized ? 'Restore window' : 'Maximize window';
      maximizeButton.setAttribute('aria-label', label);
      maximizeButton.title = maximized ? 'Restore' : 'Maximize';
    }

    if (typeof api.onWindowStateChanged === 'function') {
      const unsubscribe = api.onWindowStateChanged(applyWindowState);
      if (typeof unsubscribe === 'function') {
        window.addEventListener('beforeunload', unsubscribe, { once: true });
      }
    }
    if (typeof api.getWindowState === 'function') {
      Promise.resolve(api.getWindowState()).then(applyWindowState).catch(() => {});
    }

    async function runAction(action) {
      try {
        const result = await api.windowAction(action);
        if (result && result.ok === false) return;
        if (action === 'maximize' && typeof api.getWindowState === 'function') {
          applyWindowState(await api.getWindowState());
        }
      } catch (error) {
        console.error('Window control action failed:', action, error);
      }
    }

    minimizeButton.addEventListener('click', () => { void runAction('minimize'); });
    maximizeButton.addEventListener('click', () => { void runAction('maximize'); });
    closeButton.addEventListener('click', () => { void runAction('close'); });
    if (typeof document.querySelector === 'function') initializeHeaderNavigation();
  }

  // Push-panel navigation. Reuse LIVE existing page and connection DOM; no
  // duplicate stores, no SSH connection side effects, no periodic rendering.
  function initializeHeaderNavigation() {
    const leading = document.querySelector('.v7-shell-menu-wrap');
    const tools = document.getElementById('v7-shell-menu-toggle');
    const settings = document.getElementById('v7-open-settings');
    const originalCollapse = document.getElementById('connections-panel-toggle');
    const workspace = document.querySelector('.workspace');
    const sidebar = document.getElementById('servers-panel');
    const terminalArea = workspace?.querySelector('.content-panel');
    if (!leading || !tools || !settings || !originalCollapse || !workspace || !sidebar || !terminalArea) return;
    if (document.getElementById('v7-sidebar-collapse')) return;

    const icon = {
      collapse: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
      tools: '<path d="M14.7 6.2a5.5 5.5 0 0 0-6.5 6.5L3 17.9 6.1 21l5.2-5.2a5.5 5.5 0 0 0 6.5-6.5l-3.6 3.6-3-3z"/>',
      sessions: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 10 3 2-3 2M12 15h5"/>',
      servers: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h6M12 17.5h6"/>',
      ssh: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
      settings: '<path d="M10.3 2h3.4l.5 2.5c.7.2 1.3.5 1.9.8l2.1-1.4 2.4 2.4-1.4 2.1c.3.6.6 1.2.8 1.9l2.5.5v3.4l-2.5.5c-.2.7-.5 1.3-.8 1.9l1.4 2.1-2.4 2.4-2.1-1.4c-.6.3-1.2.6-1.9.8l-.5 2.5h-3.4l-.5-2.5c-.7-.2-1.3-.5-1.9-.8l-2.1 1.4-2.4-2.4 1.4-2.1c-.3-.6-.6-1.2-.8-1.9L1.5 14v-3.4L4 10.1c.2-.7.5-1.3.8-1.9L3.4 6.1l2.4-2.4 2.1 1.4c.6-.3 1.2-.6 1.9-.8L10.3 2z"/><circle cx="12" cy="12" r="3.2"/>',
      report: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7"/>',
      help: '<circle cx="12" cy="12" r="10"/><path d="M9.8 9a2.4 2.4 0 1 1 4 1.9c-1 .8-1.8 1.3-1.8 2.5M12 17h.01"/>',
      commands: '<path d="m4 8 4 4-4 4M11 16h9"/>',
      appearance: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>',
      safety: '<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',
      sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="m19 17 .8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
      updates: '<path d="M4 12a8 8 0 1 1 2.8 6"/><path d="M4 17v-5h5"/>',
      logs: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      close: '<path d="M5 5l14 14M19 5 5 19"/>'
    };
    const svg = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon[name]+'</svg>';

    const sidebarCollapse = document.createElement('button');
    sidebarCollapse.id = 'v7-sidebar-collapse';
    sidebarCollapse.type = 'button';
    sidebarCollapse.className = 'v7-header-icon v7-sidebar-collapse-icon';
    sidebarCollapse.innerHTML = svg('collapse');
    leading.insertBefore(sidebarCollapse, tools);

    tools.setAttribute('aria-label', 'Tools');
    tools.title = 'Tools';
    tools.innerHTML = svg('tools');
    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = 'v7-settings-menu-wrap';
    settings.parentNode.insertBefore(settingsWrapper, settings);
    settingsWrapper.appendChild(settings);
    settings.setAttribute('aria-label', 'Settings menu');
    settings.title = 'Settings';
    settings.innerHTML = svg('settings');

    const panel = document.createElement('aside');
    panel.id = 'v7-workspace-flyout';
    panel.className = 'v7-workspace-flyout';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Advance Terminal side panel');
    panel.innerHTML = '<div class="v7-flyout-heading"><span id="v7-flyout-heading-text"></span><div class="v7-flyout-heading-actions"></div><button id="v7-flyout-close" class="v7-flyout-close" type="button" aria-label="Close side panel" title="Close side panel">'+svg('close')+'</button></div><div id="v7-flyout-content" class="v7-flyout-content"></div>';
    workspace.insertBefore(panel, terminalArea);
    const content = panel.querySelector('#v7-flyout-content');
    const title = panel.querySelector('#v7-flyout-heading-text');
    const actions = panel.querySelector('.v7-flyout-heading-actions');
    const connections = document.getElementById('left-tab-connections');
    const commands = document.getElementById('left-tab-commands');
    const pageNodes = {
      settings: document.getElementById('settings-view'),
      report: document.getElementById('report-view'),
      about: document.getElementById('about-view'),
      view: document.getElementById('view-view')
    };
    // Move, rather than copy, the existing elements: all listeners, IDs, data,
    // permission checks, and report handlers remain exactly the same.
    for (const node of [connections, commands, ...Object.values(pageNodes)]) {
      if (node) content.appendChild(node);
    }

    let active = '';
    let activeMenu = null;
    const currentItem = () => active;
    function refit() {
      // Refit only in response to a real panel toggle; avoid polling or timers.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    function closeMenus() {
      for (const m of [toolsMenu, settingsMenu]) m.hidden = true;
      tools.setAttribute('aria-expanded', 'false');
      settings.setAttribute('aria-expanded', 'false');
      activeMenu = null;
    }
    function setPanel(key, heading) {
      closeMenus();
      panel.hidden = false;
      workspace.classList.add('v7-flyout-open');
      panel.dataset.section = key;
      title.textContent = heading;
      panel.setAttribute('aria-label', heading);
      actions.replaceChildren();
      content.querySelectorAll('.left-tab-panel, .view').forEach((node) => {
        node.classList.toggle('v7-flyout-visible',
          (['servers', 'ssh', 'local'].includes(key)) ? node === connections
            : key === 'commands' ? node === commands
              : node === pageNodes[key]);
      });
      active = key;
      refit();
    }
    function closePanel() {
      if (panel.hidden) return;
      panel.hidden = true;
      workspace.classList.remove('v7-flyout-open');
      active = '';
      content.querySelectorAll('.v7-flyout-visible').forEach((node) => node.classList.remove('v7-flyout-visible'));
      refit();
    }
    function addAction(label, handler, iconName) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v7-flyout-action';
      button.innerHTML = iconName ? svg(iconName) : '';
      const span = document.createElement('span');
      span.textContent = label;
      button.appendChild(span);
      button.addEventListener('click', handler);
      actions.appendChild(button);
      return button;
    }
    function useExistingSideTab(tab) {
      // Existing browser globals are from renderer.js and do not execute code
      // in the SSH session. Filters are read-only UI operations.
      if (typeof window.setLeftTab === 'function') window.setLeftTab(tab);
      else document.querySelector('[data-left-tab="'+tab+'"]')?.click();
    }
    function openTool(key) {
      if (key === 'sessions') {
        closePanel();
        if (workspace.classList.contains('connections-collapsed')) originalCollapse.click();
        document.getElementById('v7-session-search')?.focus();
        return true;
      }
      if (!['servers','ssh','local','commands'].includes(key)) return false;
      setPanel(key, key === 'ssh' ? 'SSH Connections' : key === 'local' ? 'Local Connections' : key === 'commands' ? 'Saved Commands' : 'Saved Servers');
      if (key === 'commands') {
        useExistingSideTab('commands');
      } else {
        useExistingSideTab('connections');
        const type = key === 'ssh' ? 'remote' : key === 'local' ? 'local' : 'all';
        if (typeof window.setConnectionFilter === 'function') window.setConnectionFilter(type);
        else document.querySelector('[data-connection-filter="'+type+'"]')?.click();
        if (key === 'servers') addAction('Commands', () => openTool('commands'), 'commands');
      }
      return true;
    }
    function openPage(key) {
      if (!Object.hasOwn(pageNodes, key) || !pageNodes[key]) return false;
      const names = {settings:'Settings',report:'Reports',about:'Help',view:'Appearance'};
      setPanel(key, names[key]);
      if (key === 'settings') addAction('Appearance', () => {
        if (typeof window.setActiveView === 'function') window.setActiveView('view');
      }, 'settings');
      // The renderer's setActiveView method performs renderSettings/report/help
      // after this returns; terminal remains active and its state is untouched.
      return true;
    }
    window.v7PushFlyout = {openTool,openPage,close:closePanel,get active(){return currentItem();}};
    panel.querySelector('#v7-flyout-close').addEventListener('click', () => {
      closePanel();
      tools.focus();
    });

    // Top gear opens *only* features which already exist in V7.  Sections
    // route into the same scrollable Settings flyout, not duplicate pages.
    function openSettingsSection(section) {
      if (typeof window.setActiveView === 'function') window.setActiveView('settings');
      else openPage('settings');
      if (section && typeof window.setSettingsTab === 'function') window.setSettingsTab(section);
      const scrollToSection = () => {
        const scroller = document.querySelector('#settings-view .settings-content');
        if (!scroller) return;
        const sectionNode = section && document.getElementById('settings-tab-' + section);
        if (!sectionNode) { scroller.scrollTop = 0; return; }
        scroller.scrollTop += sectionNode.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      };
      requestAnimationFrame(scrollToSection);
    }
    function chooseMenuOption(item) {
      if (item.settingsSection) { openSettingsSection(item.settingsSection === 'all' ? null : item.settingsSection); return; }
      if (item.tool) { openTool(item.tool); return; }
      const view = item.view;
      if (typeof window.setActiveView === 'function') window.setActiveView(view);
      else openPage(view);
      if (item.reportTab && typeof window.setReportTab === 'function') window.setReportTab(item.reportTab);
      if (item.helpTab && typeof window.setHelpTab === 'function') window.setHelpTab(item.helpTab);
    }
    function makeMenu(id,label,items) {
      const menu = document.createElement('div');
      menu.id = id;
      menu.className = 'v7-header-popup';
      menu.setAttribute('role','menu');
      menu.setAttribute('aria-label',label);
      menu.hidden = true;
      for (const item of items) {
        if (item.divider) {
          const line = document.createElement('div');
          line.className = 'v7-header-popup-divider';
          line.setAttribute('role','separator');
          menu.appendChild(line);
          continue;
        }
        if (item.heading) {
          const caption = document.createElement('div');
          caption.className = 'v7-header-popup-heading';
          caption.textContent = item.heading;
          caption.setAttribute('role','presentation');
          menu.appendChild(caption);
          continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'v7-header-popup-item';
        button.setAttribute('role','menuitem');
        button.innerHTML = svg(item.icon);
        const label = document.createElement('span');
        label.textContent = item.label;
        button.appendChild(label);
        button.addEventListener('click', () => {
          closeMenus();
          chooseMenuOption(item);
        });
        menu.appendChild(button);
      }
      menu.addEventListener('keydown',(event)=>{
        if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(menu.querySelectorAll('[role="menuitem"]'));
        const index = buttons.indexOf(document.activeElement);
        const next = event.key==='Home'?0:event.key==='End'?buttons.length-1:
          event.key==='ArrowDown'?(index+1)%buttons.length:
          (index<0?buttons.length-1:(index-1+buttons.length)%buttons.length);
        buttons[next]?.focus();
      });
      return menu;
    }
    const toolsMenu = makeMenu('v7-tools-menu','Tools',[
      {label:'Servers',tool:'servers',icon:'servers'},
      {label:'SSH',tool:'ssh',icon:'ssh'},
      {label:'Local',tool:'local',icon:'sessions'},
      {label:'Commands',tool:'commands',icon:'commands'}
    ]);
    const settingsMenu = makeMenu('v7-settings-menu','Settings and support',[
      {heading:'PREFERENCES'},
      {label:'All Settings',settingsSection:'all',icon:'settings'},
      {label:'Appearance',view:'view',icon:'appearance'},
      {label:'Terminal Actions',settingsSection:'terminal-actions',icon:'commands'},
      {label:'Terminal Safety',settingsSection:'safety',icon:'safety'},
      {label:'SSH Keys',settingsSection:'keys',icon:'ssh'},
      {label:'AI Settings',settingsSection:'ai',icon:'sparkles'},
      {label:'Updates',settingsSection:'updates',icon:'updates'},
      {divider:true},
      {heading:'WORK & SUPPORT'},
      {label:'Reports',view:'report',reportTab:'options',icon:'report'},
      {label:'Audit Log',view:'report',reportTab:'audit',icon:'logs'},
      {label:'Help',view:'about',helpTab:'about',icon:'help'},
      {label:'Quick Start',view:'about',helpTab:'quick-start',icon:'sessions'}
    ]);
    leading.appendChild(toolsMenu);
    settingsWrapper.appendChild(settingsMenu);
    tools.setAttribute('aria-controls', toolsMenu.id);
    settings.setAttribute('aria-controls', settingsMenu.id);
    for (const trigger of [tools,settings]) {
      trigger.setAttribute('aria-haspopup','menu');
      trigger.setAttribute('aria-expanded','false');
    }
    function toggleMenu(menu,trigger) {
      const opening = menu.hidden;
      closeMenus();
      if (opening) {
        menu.hidden = false;
        activeMenu = menu;
        trigger.setAttribute('aria-expanded','true');
        menu.querySelector('[role="menuitem"]')?.focus();
      }
    }
    // Capture phase blocks the original 'open Settings page'/'old hamburger'
    // listeners without disturbing application shortcuts and other actions.
    tools.addEventListener('click',(e)=>{ e.preventDefault();e.stopImmediatePropagation();toggleMenu(toolsMenu,tools); },true);
    settings.addEventListener('click',(e)=>{ e.preventDefault();e.stopImmediatePropagation();toggleMenu(settingsMenu,settings); },true);
    document.addEventListener('pointerdown',(e)=>{
      if (!leading.contains(e.target)&&!settingsWrapper.contains(e.target)) closeMenus();
    });
    document.addEventListener('keydown',(e)=>{
      if (e.key !== 'Escape') return;
      if (activeMenu) {
        const trigger = activeMenu === toolsMenu ? tools : settings;
        closeMenus();
        e.preventDefault();
        trigger.focus();
      } else if (!panel.hidden && !e.target.closest('input,textarea,select,[contenteditable="true"]')) {
        closePanel();
      }
    });
    function syncSidebarControl() {
      const collapsed = workspace.classList.contains('connections-collapsed');
      sidebarCollapse.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
      sidebarCollapse.setAttribute('aria-expanded',String(!collapsed));
      sidebarCollapse.title = collapsed?'Expand sidebar':'Collapse sidebar';
    }
    sidebarCollapse.addEventListener('click',()=>{
      closeMenus();
      originalCollapse.click();
      syncSidebarControl();
      refit();
    });
    syncSidebarControl();
    const observer = new MutationObserver(syncSidebarControl);
    observer.observe(workspace,{attributes:true,attributeFilter:['class']});
    window.addEventListener('beforeunload',()=>observer.disconnect(),{once:true});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFramelessTitlebar, { once: true });
  } else {
    initializeFramelessTitlebar();
  }
})();
