// AngryBirdGodAI desktop overlay — shows the Great Sage sigil above other apps
// while she is thinking or speaking. It polls the local server's
// /api/overlay-state endpoint (which the main browser app keeps updated) and
// renders a transparent, frameless, always-on-top window.
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.ABGAI_SERVER || 'http://127.0.0.1:4173';
const WINDOW_WIDTH = 180;
const WINDOW_HEIGHT = 210;
const POLL_MS = 250;

let win = null;
let lastVisible = false;
let dragStartPos = null;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function positionFile() {
  return path.join(app.getPath('userData'), 'overlay-pos.json');
}

function saveWindowPosition() {
  if (!win) return;
  try {
    fs.writeFileSync(positionFile(), JSON.stringify(win.getPosition()));
  } catch (error) { /* non-fatal */ }
}

function loadWindowPosition() {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionFile(), 'utf8'));
    if (Array.isArray(parsed) && parsed.length === 2 && Number.isFinite(parsed[0]) && Number.isFinite(parsed[1])) {
      return [parsed[0], parsed[1]];
    }
  } catch (error) { /* fall through */ }
  return null;
}

function fetchState() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/overlay-state`, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { resolve(null); }
      });
    });
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function postStop() {
  const body = JSON.stringify({ stopRequested: true });
  const req = http.request(`${SERVER_URL}/api/overlay-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.end(body);
}

function positionWindow() {
  if (!win) return;
  const saved = loadWindowPosition();
  if (saved) {
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(
      Math.round(clamp(saved[0], workArea.x - WINDOW_WIDTH + 40, workArea.x + workArea.width - 40)),
      Math.round(clamp(saved[1], workArea.y, workArea.y + workArea.height - 40)),
    );
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  win.setPosition(
    workArea.x + workArea.width - WINDOW_WIDTH - 16,
    workArea.y + workArea.height - WINDOW_HEIGHT - 14,
  );
}

function applyState(state) {
  if (!win || !state) return;
  const visible = Boolean(state.visible);
  if (visible && !lastVisible) {
    win.showInactive();
    positionWindow();
  } else if (!visible && lastVisible) {
    win.hide();
  }
  lastVisible = visible;
  // Click-through when hidden; interactive while visible (click to stop).
  win.setIgnoreMouseEvents(!visible);
  win.webContents.send('overlay-state', state);
}

async function poll() {
  applyState(await fetchState());
}

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: `${__dirname}/preload.js`,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true);
  win.loadURL(`${SERVER_URL}/overlay/overlay.html`);
  positionWindow();
  poll();
  setInterval(poll, POLL_MS);
});

ipcMain.on('overlay-stop', () => postStop());

ipcMain.on('overlay-drag-start', () => {
  if (win) dragStartPos = win.getPosition();
});

ipcMain.on('overlay-drag', (_event, payload) => {
  if (!win || !dragStartPos) return;
  const dx = Number(payload && payload.dx) || 0;
  const dy = Number(payload && payload.dy) || 0;
  const { workArea } = screen.getPrimaryDisplay();
  const x = clamp(dragStartPos[0] + dx, workArea.x - WINDOW_WIDTH + 40, workArea.x + workArea.width - 40);
  const y = clamp(dragStartPos[1] + dy, workArea.y, workArea.y + workArea.height - 40);
  win.setPosition(Math.round(x), Math.round(y));
  saveWindowPosition();
});

// Keep the overlay alive even if all windows are hidden.
app.on('window-all-closed', () => {});