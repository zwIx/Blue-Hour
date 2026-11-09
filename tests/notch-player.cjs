const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bluehour-notch-'));
  const music = path.join(temporary, 'music');
  fs.mkdirSync(music);
  for (const title of ['First track', 'Second track']) {
    execFileSync(path.resolve('runtime/bin/ffmpeg'), [
      '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', '20', '-metadata', 'title=' + title, '-metadata', 'artist=Fixture Artist',
      '-metadata', 'album=Fixture Album', path.join(music, title + '.mp3'),
    ]);
  }
  const app = await _electron.launch({
    ...(process.env.BLUE_HOUR_PACKAGED
      ? { executablePath: path.resolve('dist/mac-arm64/Blue Hour.app/Contents/MacOS/Blue Hour') }
      : { args: ['.'] }),
    env: { ...process.env, BLUE_HOUR_TEST: '1', BLUE_HOUR_DATA: path.join(temporary, 'data'), BLUE_HOUR_MUSIC: music },
  });
  try {
    const main = await app.firstWindow();
    await main.waitForFunction(() => document.querySelector('#zf-track-title')?.textContent === 'First track');
    await app.evaluate(({ BrowserWindow, screen }) => {
      const mainWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html'));
      globalThis.notchTestCursor = { x: -1000, y: -1000 };
      screen.getCursorScreenPoint = () => globalThis.notchTestCursor;
      mainWindow.show();
      mainWindow.focus();
    });
    await main.getByRole('button', { name: 'Play', exact: true }).first().click();
    await main.waitForFunction(() => document.querySelector('[data-player=play]')?.getAttribute('aria-label') === 'Pause');
    await main.getByRole('button', { name: 'Minimize', exact: true }).click();
    const findPanel = () => app.windows().find(page => page.url().endsWith('/notch.html'));
    const deadline = Date.now() + 8000;
    while (!findPanel() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    const panel = findPanel();
    assert.ok(panel, 'Background player opened');
    await panel.waitForFunction(() => document.querySelector('.metadata strong')?.textContent === 'First track');
    assert.equal(await panel.locator('.meter').isVisible(), true);
    const geometry = () => app.evaluate(({ BrowserWindow, screen }) => {
      const overlay = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/notch.html'));
      return { bounds: overlay.getBounds(), top: screen.getDisplayMatching(overlay.getBounds()).bounds.y };
    });
    const collapsed = await geometry();
    assert.equal(collapsed.bounds.y, collapsed.top, 'Collapsed player touches the top edge');
    await panel.waitForFunction(() => document.querySelector('.shell').getBBox().height === 30);

    await panel.screenshot({ path: 'tests/notch-collapsed.png' });
    await app.evaluate(({ BrowserWindow }) => {
      const overlay = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/notch.html'));
      const bounds = overlay.getBounds();
      globalThis.notchTestCursor = { x: bounds.x + bounds.width / 2, y: bounds.y + 10 };
    });
    await panel.waitForFunction(() => {
      const height = document.querySelector('.shell').getBBox().height;
      return height > 30 && height < 99;
    });
    await panel.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    await panel.waitForFunction(() => document.querySelector('.shell').getBBox().height === 99);
    assert.equal(await panel.locator('.metadata small').textContent(), 'Fixture Album');
    const expanded = await geometry();
    assert.equal(expanded.bounds.y, expanded.top, 'Expanded player touches the top edge');
    assert.deepEqual(expanded.bounds, collapsed.bounds);
    assert.equal(await panel.locator('[data-control=open]').count(), 0);
    await panel.locator('.track').click();
    await app.evaluate(({ app }) => app.emit('activate'));

    await panel.waitForTimeout(180);
    await panel.screenshot({ path: 'tests/notch-expanded.png' });
    await panel.getByRole('button', { name: 'Next track' }).click();
    await panel.waitForFunction(() => document.querySelector('.metadata strong')?.textContent === 'Second track');
    await panel.getByRole('button', { name: 'Pause', exact: true }).click();
    await panel.waitForFunction(() => document.querySelector('.shell').getBBox().height === 20);
    const pausedShape = await panel.locator('.shell').evaluate(el => {
      const { x, width } = el.getBBox();
      return x + width / 2;
    });
    assert.equal(pausedShape, 230);
    const pausedBars = await panel.locator('.meter i').evaluateAll(bars => bars.map(el => el.getBoundingClientRect().height));
    assert.ok(pausedBars.every(height => height > 0 && height < 6));
    assert.ok(await panel.locator('.meter i').first().evaluate(el => el.getBoundingClientRect().width < 2));
    await app.evaluate(() => { globalThis.notchTestCursor = { x: -1000, y: -1000 }; });
    await panel.waitForTimeout(120);
    await app.evaluate(({ BrowserWindow }) => {
      const bounds = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/notch.html')).getBounds();
      globalThis.notchTestCursor = { x: bounds.x + bounds.width / 2, y: bounds.y + 8 };
    });
    await panel.getByRole('button', { name: 'Play', exact: true }).click();
    await panel.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(w => w.webContents.getURL().endsWith('/index.html')).isMinimized()), true);
    await app.evaluate(({ screen }) => {
      const displays = screen.getAllDisplays();
      screen.getAllDisplays = () => [...displays, { ...displays[0], id: 123456789, label: 'Test second display' }];
      screen.emit('display-added');
    });
    await main.waitForFunction(() => [...document.querySelector('#zf-notch-display').options]
      .some(option => option.text === 'Test second display'));
    await main.evaluate(() => window.blueHour.call('settings', { notchDisplay: 'all' }));
    const countPanels = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .filter(w => w.webContents.getURL().endsWith('/notch.html')).length);
    await panel.waitForTimeout(350);
    assert.ok(await countPanels() >= 2);
    await main.evaluate(() => window.blueHour.call('settings', { notchDisplay: '123456789' }));
    await main.waitForTimeout(350);
    assert.equal(await countPanels(), 1);
    assert.equal((await main.evaluate(() => window.blueHour.call('init'))).settings.notchDisplay, '123456789');
    await main.evaluate(() => window.blueHour.call('settings', { menubar: false }));
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(w => w.webContents.getURL().endsWith('/notch.html')).isVisible()), false);
    console.log('PASS: minimize, hover expansion, live track metadata, next and pause, compact pause, resume, display routing, and settings toggle.');
  } finally {
    await app.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
