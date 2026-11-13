/* UI03 — Resize Settings by dragging its divider. No IPC, settings writes,
   changes to terminal sessions or persistence of UI-only width. */
(() => {
  'use strict';
  function initialize() {
    const workspace = document.querySelector('.workspace');
    const panel = document.getElementById('v7-workspace-flyout');
    if (!workspace || !panel || panel.dataset.settingsResizerInitialized) return;
    panel.dataset.settingsResizerInitialized = 'true';

    const handle = document.createElement('div');
    handle.id = 'v7-settings-resize-handle';
    handle.className = 'v7-settings-resize-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-label', 'Resize Settings panel');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-controls', 'settings-view');
    handle.setAttribute('tabindex', '0');
    handle.title = 'Drag to resize Settings. Arrow keys resize; double-click to reset.';
    panel.appendChild(handle);

    const DEFAULT_SETTINGS_WIDTH = 680;
    let savedWidth = null;
    let drag = null;
    let requestedWidth = null;
    let animationFrame = 0;
    const isSettingsOpen = () => !panel.hidden && panel.dataset.section === 'settings';

    function limits() {
      const panelRect = panel.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const available = Math.max(0, workspaceRect.right - panelRect.left);
      // Keep a useful terminal column and enough Settings space for controls.
      const terminalReserve = Math.min(280, Math.max(140, Math.round(available * .29)));
      const max = Math.max(100, Math.floor(available - terminalReserve));
      const min = Math.min(240, max);
      return {min, max};
    }
    function setAria(width, {min, max}) {
      handle.setAttribute('aria-valuemin', String(min));
      handle.setAttribute('aria-valuemax', String(max));
      handle.setAttribute('aria-valuenow', String(Math.round(width)));
      handle.setAttribute('aria-valuetext', `${Math.round(width)} pixels`);
    }
    function applyWidth(requested, remember = true) {
      if (!isSettingsOpen()) return;
      const bounds = limits();
      const width = Math.max(bounds.min, Math.min(bounds.max, Math.round(requested)));
      if (!Number.isFinite(width)) return;
      if (remember) savedWidth = width;
      workspace.style.setProperty('--v7-settings-panel-width', `${width}px`);
      workspace.classList.toggle('v7-settings-wide', width >= 550 && window.innerWidth > 850);
      setAria(width, bounds);
    }
    function scheduleWidth(width) {
      requestedWidth = width;
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        if (requestedWidth != null) applyWidth(requestedWidth);
        requestedWidth = null;
      });
    }
    function flushWidth() {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (requestedWidth != null) applyWidth(requestedWidth);
      requestedWidth = null;
    }
    function endDrag(event) {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      flushWidth();
      if (handle.hasPointerCapture?.(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
      drag = null;
      workspace.classList.remove('v7-settings-dragging');
      // Let the existing M06 terminal-fit path settle exactly once.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    function sync() {
      const visible = isSettingsOpen();
      handle.hidden = !visible;
      workspace.classList.toggle('v7-settings-resizable', visible);
      if (!visible) {
        if (drag) endDrag();
        workspace.classList.remove('v7-settings-wide');
        workspace.style.removeProperty('--v7-settings-panel-width');
        return;
      }
      if (savedWidth != null) applyWidth(savedWidth, false);
      else applyWidth(DEFAULT_SETTINGS_WIDTH, false);
    }
    handle.addEventListener('pointerdown', event => {
      if (!isSettingsOpen() || event.button !== 0 || drag) return;
      const panelWidth = panel.getBoundingClientRect().width;
      drag = {pointerId: event.pointerId, x: event.clientX, width: panelWidth};
      handle.setPointerCapture(event.pointerId);
      workspace.classList.add('v7-settings-dragging');
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      scheduleWidth(drag.width + event.clientX - drag.x);
    });
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', () => {
      if (drag) endDrag();
    });
    handle.addEventListener('keydown', event => {
      if (!isSettingsOpen()) return;
      let next = null;
      const width = panel.getBoundingClientRect().width;
      const step = event.shiftKey ? 50 : 20;
      if (event.key === 'ArrowLeft') next = width - step;
      if (event.key === 'ArrowRight') next = width + step;
      if (event.key === 'Home') next = limits().min;
      if (event.key === 'End') next = limits().max;
      if (next === null) return;
      event.preventDefault();
      applyWidth(next);
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
    handle.addEventListener('dblclick', () => {
      if (!isSettingsOpen()) return;
      savedWidth = null;
      applyWidth(DEFAULT_SETTINGS_WIDTH, false);
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
    const observer = new MutationObserver(sync);
    observer.observe(panel, {attributes: true, attributeFilter: ['hidden', 'data-section']});
    function onWindowResize() {
      if (isSettingsOpen()) {
        if (savedWidth != null) applyWidth(savedWidth, false);
        else applyWidth(DEFAULT_SETTINGS_WIDTH, false);
      }
    }
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      window.removeEventListener('resize', onWindowResize);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    }, {once:true});
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
