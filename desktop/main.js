// AngryBirdGodAI desktop app entry point.
// Boots the local server (server.js) inside the app, then shows it in a
// normal desktop window — like Steam: Start Menu icon, taskbar, real window.
const { app, BrowserWindow, shell, Menu } = require('electron');
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
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) };
  serverProcess = spawn(process.execPath, [serverPath], {
    env,
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code && code !== 0 && mainWindow) {
      // Server crashed — close the window so the user notices.
      mainWindow.close();
    }
  });
}

function waitForServer(retries = 40) {
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

function createWindow() {
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
  mainWindow.loadURL(BASE_URL);
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
  try {
    await waitForServer();
  } catch (error) {
    // Show the window anyway; the page displays a readable error.
  }
  createWindow();
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
