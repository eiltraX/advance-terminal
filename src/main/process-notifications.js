'use strict';

// Windows notification guardrails are separate from the renderer so
// minimized/background checks cannot be spoofed by UI focus guesses.
function createProcessCompletionNotifier({ Notification, getWindowFromEvent, getMainWindow, terminalManager, platform }) {
  const lastRunByTerminal = new Map();
  const MAX_TERMINALS = 256;

  return function notifyProcessCompletion(event, payload) {
    if (platform !== 'win32' || !payload || typeof payload !== 'object') return false;

    const win = getWindowFromEvent(event);
    if (!win || win !== getMainWindow() || win.isDestroyed() || event.sender !== win.webContents) return false;
    if (!win.isMinimized() && win.isFocused()) return false;

    const terminalId = payload.terminalId;
    const runId = payload.runId;
    const source = payload.source;
    if (typeof terminalId !== 'string' || !terminalId || terminalId.length > 180) return false;
    if (!Number.isSafeInteger(runId) || runId < 1) return false;
    if (source !== 'shell-marker' && source !== 'prompt-quiet') return false;

    // A closed or unrelated session cannot create a Windows notification.
    const terminal = terminalManager.sessions.get(terminalId);
    if (!terminal || terminal.sender !== event.sender || terminal.status === 'closed') return false;
    if (lastRunByTerminal.get(terminalId) >= runId) return false;
    if (!Notification || typeof Notification.isSupported !== 'function' || !Notification.isSupported()) return false;

    const name = String(terminal.serverName || (terminal.type === 'local' ? 'Local terminal' : 'SSH session'))
      .replace(/[\r\n\x00-\x1f\x7f]/g, ' ').trim().slice(0, 72);
    const description = terminal.type === 'local' ? 'Local terminal' : 'SSH session';
    const title = source === 'shell-marker' ? 'Command finished' : 'Command appears finished';
    const body = `${description}: ${name || description}`;

    try {
      const toast = new Notification({ title, body, silent: true });
      toast.on('click', () => {
        const target = getMainWindow();
        if (!target || target.isDestroyed()) return;
        if (target.isMinimized()) target.restore();
        if (!target.isVisible()) target.show();
        target.focus();
        if (!target.webContents.isDestroyed()) {
          target.webContents.send('terminal:notification-open', { terminalId });
        }
      });
      toast.show();
      lastRunByTerminal.set(terminalId, runId);
      if (lastRunByTerminal.size > MAX_TERMINALS) {
        lastRunByTerminal.delete(lastRunByTerminal.keys().next().value);
      }
      return true;
    } catch (_) {
      // Desktop notifications are an optional OS feature. Terminal work must
      // continue uninterrupted if Windows notification delivery fails.
      return false;
    }
  };
}

module.exports = { createProcessCompletionNotifier };
