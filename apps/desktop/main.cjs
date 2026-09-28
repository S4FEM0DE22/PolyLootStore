const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('node:path');
const { validateAppUrl, isAdminUrl, canOpenInBrowser } = require('./policy.cjs');
let window;
let origin;

async function openInBrowser(url) {
  if (!canOpenInBrowser(url, origin) || !window || window.isDestroyed()) return;
  const result = await dialog.showMessageBox(window, {
    type: 'question', message: 'เปิดลิงก์นี้ในเบราว์เซอร์?',
    detail: new URL(url).origin, buttons: ['ยกเลิก', 'เปิด'], defaultId: 0, cancelId: 0,
  });
  if (result.response === 1) await shell.openExternal(url);
}
function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1000, minHeight: 700,
    title: 'PolyLoot Admin', icon: path.join(__dirname, 'icons/admin.png'), backgroundColor: '#f7f8fb', show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
      partition: 'persist:polyloot-admin',
    },
  });
  // A display marker only; no Node/native bridge is exposed to remote content.
  window.webContents.setUserAgent(`${window.webContents.getUserAgent()} PolyLootAdminDesktop/1.0`);
  const session = window.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAdminUrl(url, origin)) { event.preventDefault(); void openInBrowser(url); }
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (!isAdminUrl(url, origin)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAdminUrl(url, origin)) void window.loadURL(url).catch(() => {});
    else void openInBrowser(url);
    return { action: 'deny' };
  });
  window.webContents.on('did-fail-load', async (_event, code, _description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !window) return;
    window.show();
    const result = await dialog.showMessageBox(window, {
      type: 'error', message: 'เชื่อมต่อร้านไม่ได้ กรุณาตรวจอินเทอร์เน็ต',
      buttons: ['ลองอีกครั้ง', 'ปิดแอป'], defaultId: 0, cancelId: 1,
    });
    if (!window || window.isDestroyed()) return;
    if (result.response === 0) void window.loadURL(`${origin}/admin/`).catch(() => {});
    else window.close();
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = undefined; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'PolyLoot Admin', submenu: [
      { label: 'โหลดใหม่', accelerator: 'CmdOrCtrl+R', click: () => window?.webContents.reload() },
      { label: 'เปิดแอดมินในเบราว์เซอร์', click: () => void openInBrowser(`${origin}/admin/`) },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' }, { label: 'มุมมอง', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
  ]));
  void window.loadURL(`${origin}/admin/`).catch(() => {});
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    try {
      const config = require('./runtime-config.json');
      origin = validateAppUrl(config.appUrl);
      createWindow();
    } catch {
      dialog.showErrorBox('PolyLoot configuration', 'ตั้ง URL เว็บแล้วรัน npm run desktop:dev หรือ npm run desktop:build จากโฟลเดอร์โปรเจกต์หลัก');
      app.quit();
    }
  });
  app.on('window-all-closed', () => app.quit());
}
