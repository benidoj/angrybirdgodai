// AngryBirdGodAI desktop app entry point.
// Boots the local server (server.js) inside the app, then shows it in a
// normal desktop window — like Steam: Start Menu icon, taskbar, real window.
const { app, BrowserWindow, shell, Menu } = require('electron');

// Some Windows GPU drivers render Electron windows as pure black.
// Software rendering avoids that at a small performance cost.
app.disableHardwareAcceleration();

// Log server output so problems on other machines can be diagnosed.
const LOG_DIR = (() => {
  try { return require('electron').app.getPath('userData'); }
  catch { return require('os').tmpdir(); }
})();
const LOG_FILE = require('path').join(LOG_DIR, 'server.log');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const http = require('http');

// Find a free port so the app still boots when something else (another dev
// server, another app) already owns the default port.
function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function pickPort() {
  if (Number(process.env.PORT) > 0) return Number(process.env.PORT);
  const preferred = [4173, 4174, 4175, 4176, 4177, 4178];
  for (const port of preferred) {
    if (await isPortFree(port)) return port;
  }
  // Last resort: try random high ports (server.js treats 0 as "unset").
  for (let i = 0; i < 20; i += 1) {
    const port = 20000 + Math.floor(Math.random() * 40000);
    if (await isPortFree(port)) return port;
  }
  return 4173; // give up and let server.js surface the bind error
}

// Resolve the directory containing server.js and web assets.
// Dev mode: files are copied into desktop/.
// Packaged: extraResources copies them to <resourcesPath>/app/.
const isPackaged = !/[\\/]electron(\.exe)?$/i.test(process.execPath) && !process.defaultApp;
const PROJECT_ROOT = isPackaged
  ? path.join(process.resourcesPath, 'app')
  : __dirname;

let serverProcess = null;
let logFd = null;
let mainWindow = null;

// Single instance: clicking the icon again focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function startServer() {
  // In packaged builds, server.js and its static assets live in extraResources
  // (outside the asar archive, so Node can actually require/serve them).
  // In dev mode they sit next to main.js.
  const serverPath = path.join(PROJECT_ROOT, 'server.js');
  try { logFd = require('fs').openSync(LOG_FILE, 'a'); } catch { logFd = null; }
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) };
  serverProcess = spawn(process.execPath, [serverPath], {
    env,
    cwd: PROJECT_ROOT,
    stdio: logFd ? ['ignore', logFd, logFd] : 'ignore',
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code && code !== 0 && mainWindow) {
      // Server crashed — close the window so the user notices.
      mainWindow.close();
    }
  });
}

function waitForServer(retries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = http.get(`${BASE_URL}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (left <= 0) reject(new Error('Server did not start'));
        else setTimeout(() => attempt(left - 1), 250);
      });
    };
    attempt(retries);
  });
}

function errorPageHtml() {
  return `<html><body style="font-family:Segoe UI,sans-serif;background:#16130f;color:#f0e6d2;padding:40px;line-height:1.6">
    <h2>Server nicht erreichbar / Server not reachable</h2>
    <p>Die lokale Server-Komponente konnte nicht gestartet werden.</p>
    <p>Log-Datei: <code>${LOG_FILE}</code></p>
    <p>Mögliche Ursachen: Antivirus blockiert die App, oder ein anderes Programm belegt den Port.</p>
    <button onclick="location.reload()" style="padding:8px 16px;margin-top:12px">Erneut versuchen / Retry</button>
    </body></html>`;
}

function createWindow(serverUp = true) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'AngryBirdGodAI',
    backgroundColor: '#16130f',
    icon: isPackaged
      ? path.join(process.resourcesPath, 'app', 'icon.png')
      : path.join(PROJECT_ROOT, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links (websites the AI opens) in the system browser,
  // not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(BASE_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  Menu.setApplicationMenu(null);
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (url !== BASE_URL) return; // sub-resources can fail harmlessly
    const html = `<html><body style="font-family:sans-serif;background:#16130f;color:#f0e6d2;padding:40px">
      <h2>Server not reachable</h2>
      <p>The app could not start its local server.</p>
      <p>Error ${code}: ${desc}</p>
      <p>Check the log file: <code>${LOG_FILE}</code></p>
      <button onclick="location.reload()" style="padding:8px 16px;margin-top:12px">Retry</button>
      </body></html>`;
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });
  if (serverUp) {
    mainWindow.loadURL(BASE_URL);
  } else {
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorPageHtml()));
  }
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 4173;
let BASE_URL = `http://127.0.0.1:${PORT}`;

app.whenReady().then(async () => {
  PORT = await pickPort();
  BASE_URL = `http://127.0.0.1:${PORT}`;
  startServer();
  let serverUp = false;
  try {
    await waitForServer();
    serverUp = true;
  } catch (error) {
    // Show the window anyway — createWindow renders a readable error page.
  }
  createWindow(serverUp);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (error) {
      // Already gone.
    }
  }
});
