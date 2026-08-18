// DeepSeek Harness Desktop - Electron shell
// Boots the local dsh web server, opens it in a native window, keeps it in tray.
const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron');
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
let tray = null;
let serverProc = null;
let isQuitting = false;

// Read DEEPSEEK_API_KEY the user may have filled into dsh-start.bat
function readApiKeyFromBat() {
  try {
    const bat = fs.readFileSync(path.join(DSH_APP, 'dsh-start.bat'), 'utf8');
    const m = bat.match(/^\s*set\s+DEEPSEEK_API_KEY\s*=\s*([^\s\r\n]+)/m);
    return m ? m[1].trim() : '';
  } catch (_) {
    return '';
  }
}

// Boot the dsh web server as a child process
function startDshServer() {
  const env = { ...process.env };
  env.NODE_OPTIONS = '';
  env.DSH_HOME = DSH_HOME;
  if (NODE_DIR) env.PATH = `${NODE_DIR};${env.PATH}`;
  const key = readApiKeyFromBat();
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
    },
  });
  mainWindow.loadURL(URL);

  // Closing the window hides to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
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

// Bring the main window to front (used by tray and single-instance events)
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ---- Single instance: second launch focuses the existing window ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    // Reuse an already-running dsh service if port 3080 is up (e.g. started
    // from dsh-start.bat or another instance). Only boot our own otherwise.
    const alreadyUp = await probeServer();
    if (!alreadyUp) {
      startDshServer();
      try {
        await waitForServer();
      } catch (e) {
        dialog.showErrorBox('dsh 启动失败', e.message);
      }
    }
    createWindow();
    createTray();
  });
}

// Keep running in tray even when all windows are closed
app.on('window-all-closed', () => {});
app.on('before-quit', () => { isQuitting = true; });
