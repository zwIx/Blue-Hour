const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

function createNotchPlayer(mainWindow, sendControl, sendDisplays) {
  const panels = new Map();
  let now;
  let enabled = false;
  let displayChoice = 'window';
  let hoverTimer;
  let pauseTimer;

  function position(panel, display) {
    const scale = Math.max(0.7, Math.min(1.25, display.bounds.width / 1684));
    const width = Math.round(460 * scale);
    panel.window.setBounds({
      x: Math.round(display.bounds.x + (display.bounds.width - width) / 2),
      y: display.bounds.y,
      width,
      height: Math.round(99 * scale),
    });
  }

  function publish(panel) {
    if (panel.ready) panel.window.webContents.send('notch-state', { ...now, expanded: panel.expanded });
  }

  function hit(panel, point, expanded = panel.expanded) {
    if (!panel.window.isVisible()) return false;
    const bounds = panel.window.getBounds();
    const x = (point.x - bounds.x) * 460 / bounds.width;
    const y = (point.y - bounds.y) * 99 / bounds.height;
    if (expanded) return x >= 12 && x < 448 && y >= 0 && y < 99;
    const paused = !now?.playing;
    return x >= (paused ? 207 : 134) && x < (paused ? 253 : 373) && y >= 0 && y < (paused ? 20 : 30);
  }

  function mouseEnabled(panel, enabled) {
    if (panel.interactive === enabled) return;
    panel.interactive = enabled;
    panel.window.setIgnoreMouseEvents(!enabled);
  }

  function watchHover() {
    const point = screen.getCursorScreenPoint();
    for (const panel of panels.values()) {
      if (panel.waitForExit && !hit(panel, point, true)) panel.waitForExit = false;
      const inside = !panel.waitForExit && hit(panel, point);
      mouseEnabled(panel, inside);
      if (panel.expanded === inside) continue;
      panel.expanded = inside;
      publish(panel);
    }
  }

  function createPanel(display) {
    const window = new BrowserWindow({
      show: false, frame: false, type: 'panel', enableLargerThanScreen: true,
      transparent: true, focusable: false, acceptFirstMouse: true, skipTaskbar: true,
      alwaysOnTop: true, resizable: false, movable: false, fullscreenable: false, hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload.cjs'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    const panel = { window, ready: false, expanded: false, interactive: false, waitForExit: false };
    panels.set(display.id, panel);
    window.setAlwaysOnTop(true, 'pop-up-menu');
    window.setIgnoreMouseEvents(true);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.once('did-finish-load', () => {
      panel.ready = true;
      refresh();
    });
    window.loadFile(path.join(__dirname, '../src/notch.html'));
    return panel;
  }

  function refresh() {
    const show = enabled && now?.id && !mainWindow.isDestroyed() && !mainWindow.isFocused();
    if (!show) {
      clearInterval(hoverTimer);
      hoverTimer = undefined;
      for (const panel of panels.values()) {
        panel.expanded = false;
        panel.waitForExit = false;
        panel.window.hide();
        mouseEnabled(panel, false);
      }
      return;
    }

    const displays = screen.getAllDisplays();
    const selected = displays.find(display => String(display.id) === displayChoice);
    const targets = displayChoice === 'all' ? displays : [selected || screen.getDisplayMatching(mainWindow.getBounds())];
    for (const [id, panel] of panels) {
      if (!targets.some(display => display.id === id)) {
        panels.delete(id);
        panel.window.destroy();
      }
    }
    for (const display of targets) {
      const panel = panels.get(display.id) || createPanel(display);
      if (!panel.ready) continue;
      position(panel, display);
      publish(panel);
      if (!panel.window.isVisible()) panel.window.showInactive();
    }
    hoverTimer ??= setInterval(watchHover, 55);
  }

  function control(event, action) {
    const panel = [...panels.values()].find(item => item.window.webContents === event.sender);
    if (panel?.window.isVisible() && ['prev', 'play', 'next'].includes(action)) sendControl(action);
  }

  const windowEvents = ['focus', 'blur', 'show', 'hide', 'minimize', 'restore', 'move'];
  const displayEvents = ['display-added', 'display-removed', 'display-metrics-changed'];
  const onWindowChange = () => setImmediate(refresh);
  const onDisplayChange = () => { sendDisplays(); refresh(); };
  for (const event of windowEvents) mainWindow.on(event, onWindowChange);
  for (const event of displayEvents) screen.on(event, onDisplayChange);
  ipcMain.on('notch-control', control);

  return {
    containsPointer() {
      const point = screen.getCursorScreenPoint();
      return [...panels.values()].some(panel => hit(panel, point));
    },
    update(track, visible, choice) {
      if (now?.playing && !track.playing) {
        // A brief stopped state during track changes must not collapse the controls.
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(() => {
          for (const panel of panels.values()) {
            panel.waitForExit = panel.expanded && hit(panel, screen.getCursorScreenPoint(), true);
            panel.expanded = false;
            mouseEnabled(panel, false);
            publish(panel);
          }
        }, 180);
      } else if (track.playing) clearTimeout(pauseTimer);
      now = track;
      enabled = visible;
      displayChoice = choice;
      refresh();
    },
    destroy() {
      enabled = false;
      clearInterval(hoverTimer);
      clearTimeout(pauseTimer);
      ipcMain.removeListener('notch-control', control);
      for (const event of windowEvents) mainWindow.removeListener(event, onWindowChange);
      for (const event of displayEvents) screen.removeListener(event, onDisplayChange);
      for (const panel of panels.values()) panel.window.destroy();
      panels.clear();
    },
  };
}

module.exports = { createNotchPlayer };
