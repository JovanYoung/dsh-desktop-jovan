// DeepSeek Harness Desktop - Electron shell
// Boots the local dsh web server, opens it in a native window, keeps it in tray.
// If the dsh runtime is missing, shows an in-app guided setup page
// (install steps + API key entry, stored encrypted via Windows DPAPI).
const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, safeStorage } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ---- Config: overridable via config.json (not committed) or env vars ----
// config.json is git-ignored so local paths never leak into the repo.
let userConfig = {};
try {
  userConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (_) {}

const DSH_APP = userConfig.dshApp || process.env.DSH_APP || 'D:\\dsh-app';
const DSH_HOME = userConfig.dshHome || process.env.DSH_HOME || 'D:\\dsh-data';
const NODE_DIR = userConfig.nodeDir || process.env.DSH_NODE_DIR || '';
const PORT = userConfig.port || 3080;
const URL = `http://127.0.0.1:${PORT}`;
const ICON = path.join(__dirname, 'icon.png');

let mainWindow = null;
let setupWindow = null;
let tray = null;
let serverProc = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Local settings: the API key is stored ENCRYPTED with Windows DPAPI
// (safeStorage) inside the per-user Electron data directory. It never leaves
// this machine — no network call, no cloud sync. See the setup page
// "Security / 安全" section for the exact code shown below.
// ---------------------------------------------------------------------------
function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    const data = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (data.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
      try {
        data.apiKey = safeStorage.decryptString(Buffer.from(data.apiKeyEnc, 'base64'));
      } catch (_) { /* corrupted payload -> ignore */ }
    }
    return data;
  } catch (_) {
    return {};
  }
}

function writeSettings(patch) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch (_) {}
  if (patch.apiKey !== undefined) {
    const key = String(patch.apiKey || '').trim();
    if (key) {
      if (safeStorage.isEncryptionAvailable()) {
        // Encrypted at rest with the Windows user account (DPAPI)
        data.apiKeyEnc = safeStorage.encryptString(key).toString('base64');
        delete data.apiKey;
      } else {
        data.apiKey = key; // fallback only when DPAPI is unavailable
      }
    } else {
      delete data.apiKeyEnc;
      delete data.apiKey;
    }
    delete patch.apiKey;
  }
  Object.assign(data, patch);
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(data, null, 2));
  return data;
}

// Read DEEPSEEK_API_KEY the user may have filled into dsh-start.bat (legacy)
function readApiKeyFromBat() {
  try {
    const bat = fs.readFileSync(path.join(DSH_APP, 'dsh-start.bat'), 'utf8');
    const m = bat.match(/^\s*set\s+DEEPSEEK_API_KEY\s*=\s*([^\s\r\n]+)/m);
    return m ? m[1].trim() : '';
  } catch (_) {
    return '';
  }
}

// Effective key: shell settings (encrypted) first, then legacy bat file
function resolveApiKey() {
  const settings = readSettings();
  if (settings.apiKey) return settings.apiKey;
  return readApiKeyFromBat();
}

// Is the dsh runtime present under DSH_APP?
function dshExists() {
  return fs.existsSync(path.join(DSH_APP, 'node_modules', '.bin', 'dsh')) ||
    fs.existsSync(path.join(DSH_APP, 'node_modules', '@deepseek-ai', 'dsh'));
}

// Boot the dsh web server as a child process
function startDshServer() {
  const env = { ...process.env };
  env.NODE_OPTIONS = '';
  env.DSH_HOME = DSH_HOME;
  if (NODE_DIR) env.PATH = `${NODE_DIR};${env.PATH}`;
  const key = resolveApiKey();
  if (key) env.DEEPSEEK_API_KEY = key;

  serverProc = spawn('node_modules\\.bin\\dsh', ['web'], {
    cwd: DSH_APP,
    env,
    shell: true,
    windowsHide: true,
    stdio: 'ignore',
  });

  serverProc.on('exit', (code) => {
    serverProc = null;
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'dsh 服务已停止',
        `本地服务意外退出（退出码 ${code}）。\n请重新打开 DeepSeek Harness。`
      );
    }
  });
  serverProc.on('error', (err) => {
    dialog.showErrorBox('启动失败', `无法启动 dsh 服务：${err.message}`);
  });
}

// One-shot probe: is something already serving 3080?
function probeServer(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
  });
}

// Wait until the web server responds 200
function waitForServer(timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.get(URL, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(3000, () => { req.destroy(); retry(); });
      function retry() {
        if (Date.now() - started > timeoutMs) reject(new Error('服务启动超时'));
        else setTimeout(tick, 1000);
      }
    };
    tick();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    autoHideMenuBar: true,
    icon: ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadURL(URL);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// Guided setup page shown when the dsh runtime is not installed
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    title: 'DeepSeek Harness - Setup',
    autoHideMenuBar: true,
    icon: ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  setupWindow.loadFile(path.join(__dirname, 'setup.html'));

  setupWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      setupWindow.hide();
    }
  });
}

function createTray() {
  let icon = nativeImage.createFromPath(ICON);
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('DeepSeek Harness');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '打开 DeepSeek Harness',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        if (serverProc) serverProc.kill();
        app.quit();
      },
    },
  ]));
  tray.on('click', () => showMainWindow());
}

// Bring the active window to front (used by tray and single-instance events)
function showMainWindow() {
  const win = mainWindow || setupWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---- IPC: minimal, whitelisted bridge for the setup page ----
ipcMain.handle('save-api-key', (_e, apiKey) => {
  writeSettings({ apiKey: String(apiKey || '') });
  return {
    ok: true,
    settingsPath: settingsFile(),
    encrypted: safeStorage.isEncryptionAvailable(),
  };
});

ipcMain.handle('get-setup-status', () => ({
  dshApp: DSH_APP,
  dshExists: dshExists(),
  hasApiKey: !!resolveApiKey(),
  settingsPath: settingsFile(),
  dshHome: DSH_HOME,
  encryptionAvailable: safeStorage.isEncryptionAvailable(),
}));

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// ---- Single instance: second launch focuses the existing window ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    const alreadyUp = await probeServer();
    if (!alreadyUp) {
      if (dshExists()) {
        startDshServer();
        try {
          await waitForServer();
        } catch (e) {
          dialog.showErrorBox('dsh 启动失败', e.message);
        }
        createWindow();
      } else {
        // dsh runtime missing -> in-app guided setup
        createSetupWindow();
      }
    } else {
      createWindow();
    }
    createTray();
  });
}

// Keep running in tray even when all windows are closed
app.on('window-all-closed', () => {});
app.on('before-quit', () => { isQuitting = true; });
