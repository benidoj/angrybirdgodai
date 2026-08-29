const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec, spawnSync } = require('child_process');
const { URL } = require('url');

const ROOT = __dirname;
const configuredPort = Number(process.env.PORT);
const PORT = configuredPort > 0 ? configuredPort : 4173;
const HOST = process.env.HOST || '127.0.0.1';
const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const MAX_RESEARCH_QUERY_LENGTH = 800;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_PODCAST_BYTES = 100 * 1024 * 1024;
const PODCAST_DIR = path.join(ROOT, 'podcasts');
if (!fs.existsSync(PODCAST_DIR)) fs.mkdirSync(PODCAST_DIR, { recursive: true });
const MAX_DEEP_QUERIES = 5;
const MAX_DEEP_SOURCES = 16;
const MAX_DEEP_PAGE_FETCHES = 8;
const MAX_ANALYSIS_QUERIES = 24;
const ANALYSIS_MIN_SOURCES = 100;
const MAX_ANALYSIS_SOURCES = 120;
const MAX_ANALYSIS_PAGE_FETCHES = 40;
const MAX_ANALYSIS_PAGE_CONTENT_CHARS = 4500;
const MAX_PAGE_CONTENT_CHARS = 6000;
const DEEP_CONCURRENCY = 3;
const ANALYSIS_CONCURRENCY = 6;

const APP_DEFS = Object.freeze({
  spotify: {
    label: 'Spotify',
    tryScheme: 'spotify:',
    tryPaths: ['%APPDATA%\\Spotify\\Spotify.exe', '%LOCALAPPDATA%\\Spotify\\Spotify.exe'],
  },
  vscode: {
    label: 'VS Code',
    tryNames: ['code'],
    tryPaths: ['%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe', '%ProgramFiles%\\Microsoft VS Code\\Code.exe'],
  },
  'visual studio code': { alias: 'vscode' },
  chrome: {
    label: 'Chrome',
    tryNames: ['chrome'],
    tryPaths: ['%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe', '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe', '%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe'],
  },
  'google chrome': { alias: 'chrome' },
  firefox: {
    label: 'Firefox',
    tryNames: ['firefox'],
    tryPaths: ['%ProgramFiles%\\Mozilla Firefox\\firefox.exe', '%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe'],
  },
  edge: {
    label: 'Edge',
    tryScheme: 'microsoft-edge:',
    tryPaths: ['%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe', '%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe'],
  },
  'microsoft edge': { alias: 'edge' },
  'file explorer': {
    label: 'File Explorer',
    tryPaths: ['%SystemRoot%\\explorer.exe'],
    tryNames: ['explorer'],
  },
  explorer: { alias: 'file explorer' },
  notepad: {
    label: 'Notepad',
    tryPaths: ['%SystemRoot%\\System32\\notepad.exe'],
    tryNames: ['notepad'],
  },
  calculator: {
    label: 'Calculator',
    tryScheme: 'ms-calculator:',
    tryPaths: ['%SystemRoot%\\System32\\calc.exe'],
    tryNames: ['calc'],
  },
  calc: { alias: 'calculator' },
  'command prompt': {
    label: 'Command Prompt',
    tryPaths: ['%SystemRoot%\\System32\\cmd.exe'],
    tryNames: ['cmd'],
  },
  cmd: { alias: 'command prompt' },
  powershell: {
    label: 'PowerShell',
    tryPaths: ['%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'],
    tryNames: ['powershell', 'pwsh'],
  },
  'task manager': {
    label: 'Task Manager',
    tryPaths: ['%SystemRoot%\\System32\\Taskmgr.exe'],
    tryNames: ['taskmgr'],
  },
  taskmgr: { alias: 'task manager' },
  settings: { label: 'Settings', tryScheme: 'ms-settings:' },
  store: { label: 'Microsoft Store', tryScheme: 'ms-windows-store:' },
  'microsoft store': { alias: 'store' },
  'control panel': {
    label: 'Control Panel',
    tryPaths: ['%SystemRoot%\\System32\\control.exe'],
    tryNames: ['control'],
  },
  discord: {
    label: 'Discord',
    tryScheme: 'discord:',
    tryPaths: ['%LOCALAPPDATA%\\Discord\\app-*\\Discord.exe'],
  },
  slack: {
    label: 'Slack',
    tryScheme: 'slack:',
    tryPaths: ['%LOCALAPPDATA%\\slack\\slack.exe'],
  },
  telegram: {
    label: 'Telegram',
    tryScheme: 'tg:',
    tryPaths: ['%APPDATA%\\Telegram Desktop\\Telegram.exe', '%LOCALAPPDATA%\\Telegram Desktop\\Telegram.exe'],
  },
  whatsapp: {
    label: 'WhatsApp',
    tryScheme: 'whatsapp:',
    tryPaths: ['%LOCALAPPDATA%\\WhatsApp\\WhatsApp.exe'],
  },
  obsidian: {
    label: 'Obsidian',
    tryScheme: 'obsidian:',
    tryPaths: ['%LOCALAPPDATA%\\Obsidian\\Obsidian.exe'],
  },
  terminal: { label: 'Terminal', tryNames: ['wt'] },
  wordpad: {
    label: 'WordPad',
    tryPaths: ['%SystemRoot%\\System32\\write.exe'],
    tryNames: ['write'],
  },
  paint: {
    label: 'Paint',
    tryPaths: ['%SystemRoot%\\System32\\mspaint.exe'],
    tryNames: ['mspaint'],
  },
  'snipping tool': { label: 'Snipping Tool', tryNames: ['SnippingTool'] },
});

function expandEnv(value) {
  return String(value).replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
}

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function whereIs(name) {
  try {
    const result = spawnSync('where.exe', [name], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
    if (result.status !== 0) return '';
    return String(result.stdout || '').split(/\r?\n/)[0].trim();
  } catch (error) {
    return '';
  }
}

function findGlobPath(pattern) {
  const separatorIndex = pattern.lastIndexOf('\\');
  if (separatorIndex < 0) return '';
  const dir = pattern.slice(0, separatorIndex);
  const filePattern = pattern.slice(separatorIndex + 1).toLowerCase();
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    return '';
  }
  const base = filePattern.replace(/[.*]/g, '');
  const match = entries.find((entry) => {
    const lower = entry.toLowerCase();
    return filePattern.includes('*') ? lower.startsWith(base) : lower === filePattern;
  });
  return match ? path.join(dir, match) : '';
}

function schemeRegistered(scheme) {
  const clean = String(scheme).replace(/[^a-zA-Z0-9+.-]/g, '');
  if (!clean) return false;
  const check = (root) => {
    try {
      return spawnSync('reg', ['query', `${root}\\Software\\Classes\\${clean}`], { encoding: 'utf8', windowsHide: true, timeout: 4000 }).status === 0;
    } catch (error) {
      return false;
    }
  };
  return check('HKCU') || check('HKLM');
}

// ---- Generic app discovery (full access) ----
// When the AI requests an app that is not in the built-in whitelist, we try to
// find it on the machine: Start Menu shortcuts (.lnk), the registry "App Paths"
// keys, and the PATH. The user is always asked to confirm before anything runs.

function startMenuRoots() {
  return [
    `${process.env.APPDATA || ''}\\Microsoft\\Windows\\Start Menu\\Programs`,
    `${process.env.ProgramData || ''}\\Microsoft\\Windows\\Start Menu\\Programs`,
  ].filter(Boolean);
}

function walkStartMenu(root, depth = 0) {
  if (depth > 4) return [];
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    return [];
  }
  const links = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    const isDir = entry.isDirectory() || entry.isSymbolicLink();
    if (isDir) {
      links.push(...walkStartMenu(full, depth + 1));
    } else if (entry.isFile() && /^\.lnk$/i.test(path.extname(entry.name))) {
      links.push(full);
    }
  }
  return links;
}

// Resolves the target of a Windows .lnk shortcut using WScript.Shell (reliable
// on Windows; the binary .lnk format is not worth parsing by hand).
function resolveLnkTarget(linkPath) {
  try {
    const escaped = String(linkPath).replace(/'/g, "''");
    const script = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${escaped}'); $s.TargetPath`;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 6000,
    });
    if (result.status !== 0) return '';
    const target = String(result.stdout || '').trim();
    if (target && /^[a-z]:\\.*/i.test(target) && pathExists(target)) return target;
  } catch (error) {
    return '';
  }
  return '';
}

// True if the shortcut's target exists (even if it is not a plain .exe path).
function linkTargetExists(linkPath) {
  try {
    const escaped = String(linkPath).replace(/'/g, "''");
    const script = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${escaped}'); $s.TargetPath`;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 6000,
    });
    if (result.status !== 0) return true; // cannot verify — assume it works
    const target = String(result.stdout || '').trim();
    if (!target) return true; // e.g. UWP app shortcuts — let Windows resolve them
    return pathExists(target);
  } catch (error) {
    return true;
  }
}

function findStartMenuLink(target) {
  const normalized = String(target).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const tokens = normalized.split(' ').filter((token) => token.length > 1);
  for (const root of startMenuRoots()) {
    for (const link of walkStartMenu(root)) {
      const name = path.basename(link, '.lnk').toLowerCase();
      // Exact name match, or all significant tokens appear in the shortcut name.
      const linkNormalized = name.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (name === normalized || (tokens.length && tokens.every((token) => linkNormalized.includes(token)))) {
        // Prefer the resolved .exe target if it exists; otherwise fall back to the
        // shortcut itself (some apps only register a .lnk).
        const resolvedExe = resolveLnkTarget(link);
        if (resolvedExe) return resolvedExe;
        // Skip dead shortcuts (target no longer exists) — starting them hangs.
        if (!linkTargetExists(link)) continue;
        return link;
      }
    }
  }
  return '';
}

function findRegistryAppPath(target) {
  const candidates = [
    `${target}.exe`,
    target,
    `${target} (x86).exe`,
  ];
  for (const candidate of candidates) {
    const result = spawnSync('reg', ['query', `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${candidate}`, '/ve'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000,
    });
    if (result.status !== 0) continue;
    const match = /REG_SZ\s+([^\r\n]+)/i.exec(String(result.stdout || ''));
    if (match) {
      const exePath = expandEnv(match[1].trim());
      if (pathExists(exePath)) return exePath;
    }
  }
  return '';
}

// Well-known websites the AI can open in the default browser.
const WEBSITES = Object.freeze({
  youtube: 'https://www.youtube.com',
  google: 'https://www.google.com',
  github: 'https://github.com',
  reddit: 'https://www.reddit.com',
  twitter: 'https://twitter.com',
  x: 'https://twitter.com',
  wikipedia: 'https://www.wikipedia.org',
  twitch: 'https://www.twitch.tv',
  amazon: 'https://www.amazon.com',
  netflix: 'https://www.netflix.com',
  roblox: 'https://www.roblox.com',
  gmail: 'https://mail.google.com',
  maps: 'https://maps.google.com',
  'google maps': 'https://maps.google.com',
});

const DOMAIN_RE = /^(?:[a-z0-9-]+\.)*[a-z0-9-]+\.(?:com|org|net|io|dev|gg|tv|ai|co|us|uk|de)$/i;

// Opens a website in the default browser: known site names ("youtube") or any
// domain-like target ("example.com", "www.example.com").
function resolveWebsite(target) {
  const clean = String(target).trim().toLowerCase();
  const known = WEBSITES[clean];
  if (known) {
    const label = clean.charAt(0).toUpperCase() + clean.slice(1);
    return { command: `start "" "${known}"`, label, foundVia: 'website' };
  }
  if (DOMAIN_RE.test(clean)) {
    const url = clean.startsWith('www.') ? `https://${clean}` : `https://www.${clean}`;
    return { command: `start "" "${url}"`, label: clean, foundVia: 'website' };
  }
  return null;
}

// UWP / Microsoft Store apps have no Start Menu .lnk — Windows exposes them
// through Get-StartApps. Launch via shell:AppsFolder using the returned AppID
// (only AUMID-form ids containing "!" are accepted; .lnk entries are handled
// by findStartMenuLink earlier).
function findUwpApp(target) {
  const normalized = String(target).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const tokens = normalized.split(' ').filter((token) => token.length > 1);
  let result;
  try {
    result = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-StartApps | ForEach-Object { "$($_.Name)|$($_.AppID)" }'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 6000,
    });
  } catch (error) {
    return '';
  }
  if (result.status !== 0) return '';
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    const parts = line.split('|');
    if (parts.length < 2) continue;
    const appId = parts.pop().trim();
    const name = parts.join('|').trim();
    if (!appId.includes('!')) continue; // desktop .lnk entries — handled elsewhere
    const nameNormalized = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const matched = name === normalized || (tokens.length && tokens.every((token) => nameNormalized.includes(token)));
    if (!matched) continue;
    const cleanId = appId.replace(/[^a-zA-Z0-9!._-]/g, '');
    if (cleanId === appId) return cleanId;
  }
  return '';
}

function resolveGenericApp(target) {
  const label = String(target)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // 1. Start Menu shortcut
  const link = findStartMenuLink(target);
  if (link) return { command: `start "" "${link}"`, label, foundVia: 'Start Menu' };

  // 2. UWP / Microsoft Store app (no .lnk on disk)
  const uwpId = findUwpApp(target);
  if (uwpId) return { command: `start "" "shell:AppsFolder\\${uwpId}"`, label, foundVia: 'Store app' };

  // 3. Registry App Paths
  const regExe = findRegistryAppPath(target);
  if (regExe) return { command: `start "" "${regExe}"`, label, foundVia: 'registry' };

  // 4. Executable on PATH
  const pathExe = whereIs(`${target}.exe`) || whereIs(target);
  if (pathExe) return { command: `start "" "${pathExe}"`, label, foundVia: 'PATH' };

  // 5. Website (known sites or domain-like names) — opens in the browser
  const website = resolveWebsite(target);
  if (website) return website;

  return { error: `Could not find "${target}" on this PC.` };
}

function resolveAppLaunch(target) {
  let def = APP_DEFS[target];
  if (!def) return resolveGenericApp(target);
  if (def.alias) def = APP_DEFS[def.alias];
  if (!def) return resolveGenericApp(target);

  // 1. Known install paths (most reliable, avoids PATH pollution like Git Bash shims)
  if (Array.isArray(def.tryPaths)) {
    for (const raw of def.tryPaths) {
      const expanded = expandEnv(raw);
      const candidate = expanded.includes('*') ? findGlobPath(expanded) : (pathExists(expanded) ? expanded : '');
      if (candidate) return { command: `start "" "${candidate}"`, label: def.label };
    }
  }

  // 2. Executable found via PATH
  if (Array.isArray(def.tryNames)) {
    for (const name of def.tryNames) {
      const found = whereIs(name);
      if (found) return { command: `start "" "${found}"`, label: def.label };
    }
  }

  // 3. URI scheme registered by the app
  if (def.tryScheme && schemeRegistered(def.tryScheme)) {
    return { command: `start "" ${def.tryScheme}`, label: def.label };
  }

  // 4. Generic discovery as a last resort (in case the app moved or is aliased)
  return resolveGenericApp(target);
}

const FOLDERS = Object.freeze({
  downloads: 'start "" "%USERPROFILE%\\Downloads"',
  documents: 'start "" "%USERPROFILE%\\Documents"',
  'my documents': 'start "" "%USERPROFILE%\\Documents"',
  desktop: 'start "" "%USERPROFILE%\\Desktop"',
  music: 'start "" "%USERPROFILE%\\Music"',
  pictures: 'start "" "%USERPROFILE%\\Pictures"',
  videos: 'start "" "%USERPROFILE%\\Videos"',
  home: 'start "" "%USERPROFILE%"',
  'user folder': 'start "" "%USERPROFILE%"',
  onedrive: 'start "" "%USERPROFILE%\\OneDrive"',
  appdata: 'start "" "%APPDATA%"',
  'program files': 'start "" "%ProgramFiles%"',
  temp: 'start "" "%TEMP%"',
});

const SYSTEM_COMMANDS = Object.freeze({
  cpu: {
    label: 'CPU info',
    command: 'powershell -NoProfile -EncodedCommand RwBlAHQALQBDAGkAbQBJAG4AcwB0AGEAbgBjAGUAIABXAGkAbgAzADIAXwBQAHIAbwBjAGUAcwBzAG8AcgAgAHwAIABGAG8AcgBFAGEAYwBoAC0ATwBiAGoAZQBjAHQAIAB7ACAAVwByAGkAdABlAC0ATwB1AHQAcAB1AHQAIAAiACQAKAAkAF8ALgBOAGEAbQBlACkAOgAgACQAKAAkAF8ALgBOAHUAbQBiAGUAcgBPAGYAQwBvAHIAZQBzACkAIABjAG8AcgBlAHMALAAgACQAKAAkAF8ALgBOAHUAbQBiAGUAcgBPAGYATABvAGcAaQBjAGEAbABQAHIAbwBjAGUAcwBzAG8AcgBzACkAIAB0AGgAcgBlAGEAZABzACwAIAAkACgAJABfAC4ATQBhAHgAQwBsAG8AYwBrAFMAcABlAGUAZAApAE0ASAB6ACwAIABMAG8AYQBkACAAJAAoACQAXwAuAEwAbwBhAGQAUABlAHIAYwBlAG4AdABhAGcAZQApACUAIgAgAH0A',
  },
  memory: {
    label: 'Memory info',
    command: 'powershell -NoProfile -EncodedCommand JABvAHMAIAA9ACAARwBlAHQALQBDAGkAbQBJAG4AcwB0AGEAbgBjAGUAIABXAGkAbgAzADIAXwBPAHAAZQByAGEAdABpAG4AZwBTAHkAcwB0AGUAbQA7ACAAJAB0AG8AdABhAGwAIAA9ACAAWwBtAGEAdABoAF0AOgA6AFIAbwB1AG4AZAAoACQAbwBzAC4AVABvAHQAYQBsAFYAaQBzAGkAYgBsAGUATQBlAG0AbwByAHkAUwBpAHoAZQAgAC8AIAAxAE0AQgAsACAAMQApADsAIAAkAGYAcgBlAGUAIAA9ACAAWwBtAGEAdABoAF0AOgA6AFIAbwB1AG4AZAAoACQAbwBzAC4ARgByAGUAZQBQAGgAeQBzAGkAYwBhAGwATQBlAG0AbwByAHkAIAAvACAAMQBNAEIALAAgADEAKQA7ACAAJAB1AHMAZQBkACAAPQAgAFsAbQBhAHQAaABdADoAOgBSAG8AdQBuAGQAKAAkAHQAbwB0AGEAbAAgAC0AIAAkAGYAcgBlAGUALAAgADEAKQA7ACAAJABwAGMAdAAgAD0AIABbAG0AYQB0AGgAXQA6ADoAUgBvAHUAbgBkACgAKAAkAHQAbwB0AGEAbAAgAC0AIAAkAGYAcgBlAGUAKQAgAC8AIAAkAHQAbwB0AGEAbAAgACoAIAAxADAAMAAsACAAMQApADsAIABXAHIAaQB0AGUALQBPAHUAdABwAHUAdAAgACIAVABvAHQAYQBsADoAIAAkAHQAbwB0AGEAbAAgAEcAQgAgAHwAIABVAHMAZQBkADoAIAAkAHUAcwBlAGQAIABHAEIAIAAoACQAcABjAHQAJQApACAAfAAgAEYAcgBlAGUAOgAgACQAZgByAGUAZQAgAEcAQgAiAA==',
  },
  disk: {
    label: 'Disk space',
    command: 'powershell -NoProfile -EncodedCommand RwBlAHQALQBQAFMARAByAGkAdgBlACAALQBQAFMAUAByAG8AdgBpAGQAZQByACAARgBpAGwAZQBTAHkAcwB0AGUAbQAgAHwAIABXAGgAZQByAGUALQBPAGIAagBlAGMAdAAgAHsAIAAkAF8ALgBVAHMAZQBkACAALQBnAHQAIAAwACAAfQAgAHwAIABGAG8AcgBFAGEAYwBoAC0ATwBiAGoAZQBjAHQAIAB7ACAAJAB0ACAAPQAgAFsAbQBhAHQAaABdADoAOgBSAG8AdQBuAGQAKAAoACQAXwAuAFUAcwBlAGQAKwAkAF8ALgBGAHIAZQBlACkALwAxAEcAQgAsADEAKQA7ACAAJAB1ACAAPQAgAFsAbQBhAHQAaABdADoAOgBSAG8AdQBuAGQAKAAkAF8ALgBVAHMAZQBkAC8AMQBHAEIALAAxACkAOwAgACQAZgAgAD0AIABbAG0AYQB0AGgAXQA6ADoAUgBvAHUAbgBkACgAJABfAC4ARgByAGUAZQAvADEARwBCACwAMQApADsAIAAkAHAAIAA9ACAAWwBtAGEAdABoAF0AOgA6AFIAbwB1AG4AZAAoACQAXwAuAFUAcwBlAGQALwAoACQAXwAuAFUAcwBlAGQAKwAkAF8ALgBGAHIAZQBlACkAKgAxADAAMAAsADEAKQA7ACAAVwByAGkAdABlAC0ATwB1AHQAcAB1AHQAIAAiACQAKAAkAF8ALgBOAGEAbQBlACkAOgAgACQAdQAgAEcAQgAgAHUAcwBlAGQAIABvAGYAIAAkAHQAIABHAEIAIAAoACQAcAAlACkAOwAgACQAZgAgAEcAQgAgAGYAcgBlAGUAIgAgAH0A',
  },
  processes: {
    label: 'Running processes',
    command: 'powershell -NoProfile -EncodedCommand RwBlAHQALQBQAHIAbwBjAGUAcwBzACAAfAAgAFMAbwByAHQALQBPAGIAagBlAGMAdAAgAEMAUABVACAALQBEAGUAcwBjAGUAbgBkAGkAbgBnACAAfAAgAFMAZQBsAGUAYwB0AC0ATwBiAGoAZQBjAHQAIAAtAEYAaQByAHMAdAAgADEAMAAgAHwAIABGAG8AcgBFAGEAYwBoAC0ATwBiAGoAZQBjAHQAIAB7ACAAJABjACAAPQAgAFsAbQBhAHQAaABdADoAOgBSAG8AdQBuAGQAKAAkAF8ALgBDAFAAVQAsADEAKQA7ACAAJABtACAAPQAgAFsAbQBhAHQAaABdADoAOgBSAG8AdQBuAGQAKAAkAF8ALgBXAG8AcgBrAGkAbgBnAFMAZQB0ADYANAAvADEATQBCACwAMQApADsAIABXAHIAaQB0AGUALQBPAHUAdABwAHUAdAAgACIAJAAoACQAXwAuAE4AYQBtAGUAKQAgACgAUABJAEQAIAAkACgAJABfAC4ASQBkACkAKQA6ACAAQwBQAFUAPQAkAGMAIABzACAATQBlAG0APQAkAG0AIABNAEIAIgAgAH0A',
  },
  network: {
    label: 'Network info',
    command: 'powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object InterfaceAlias -notmatch Loopback | Select-Object InterfaceAlias, IPAddress | Format-Table -AutoSize"',
  },
  uptime: {
    label: 'System uptime',
    command: 'powershell -NoProfile -Command "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime | Select-Object Days, Hours, Minutes"',
  },
});
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
};

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handlePodcastSave(req, res, requestUrl) {
  try {
    const buffer = await readRawBody(req, MAX_PODCAST_BYTES);
    if (!buffer.length) {
      sendJson(res, 400, { error: 'Empty body.' });
      return;
    }
    const topic = String(requestUrl.searchParams.get('topic') || 'episode')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'episode';
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `podcast-${stamp}-${topic}.wav`;
    fs.writeFileSync(path.join(PODCAST_DIR, filename), buffer);
    sendJson(res, 200, { url: `/podcasts/${filename}`, bytes: buffer.length });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: String((error && error.message) || error) });
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let settled = false;

    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (settled) return;
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        settled = true;
        const error = new Error('Request body is too large.');
        error.statusCode = 413;
        reject(error);
        req.resume();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      try {
        settled = true;
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function proxyToOllama(req, res, requestUrl) {
  const targetPath = requestUrl.pathname.slice('/api/ollama'.length) || '/';
  const target = http.request(
    {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: `${targetPath}${requestUrl.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${OLLAMA_HOST}:${OLLAMA_PORT}`,
      },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, {
        'Content-Type': upstream.headers['content-type'] || 'application/json',
        ...(upstream.headers['transfer-encoding'] ? { 'Transfer-Encoding': upstream.headers['transfer-encoding'] } : {}),
      });
      upstream.pipe(res);
    },
  );

  target.on('error', (error) => {
    if (!res.headersSent) {
      sendJson(res, 502, {
        error: `Unable to reach Ollama at ${OLLAMA_HOST}:${OLLAMA_PORT}. ${error.code || 'Connection failed'}.`,
      });
    } else {
      res.end();
    }
  });

  req.pipe(target);
}

function fetchSearchPage(url, userAgent = 'AngryBirdGodAI/1.0 (local research assistant)', acceptLanguage = '') {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Encoding': 'identity',
      'User-Agent': userAgent,
    };
    if (acceptLanguage) headers['Accept-Language'] = acceptLanguage;
    const request = https.get(url, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
          reject(new Error(`Search provider returned HTTP ${response.statusCode || 500}.`));
          return;
        }
        resolve(body);
      });
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error('The web research request timed out.'));
    });
    request.on('error', reject);
  });
}

const BING_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function searchDuckDuckGo(query, limit = 6) {
  const pages = Math.max(1, Math.ceil(limit / 6));
  const results = [];
  for (let page = 0; page < pages; page += 1) {
    const offset = page * 6;
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&s=${offset}`;
    const html = await fetchSearchPage(searchUrl);
    results.push(...parseSearchResults(html, limit));
  }
  return [...new Map(results.map((item) => [dedupeKey(item.url), item])).values()].slice(0, limit);
}

function normalizeBingUrl(rawHref) {
  if (!rawHref) return '';
  let href = decodeHtmlEntities(rawHref.trim());
  const redirectMatch = href.match(/[?&]u=a1([^&]+)/);
  if (redirectMatch) {
    try {
      href = Buffer.from(redirectMatch[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    } catch (error) {
      // Fall through to the raw href below.
    }
  }
  try {
    const parsed = new URL(href, 'https://www.bing.com');
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.hostname.endsWith('bing.com') || parsed.hostname.endsWith('microsoft.com')) return '';
    return parsed.toString();
  } catch (error) {
    return '';
  }
}

function parseBingResults(html, limit = 6) {
  const sources = [];
  const seenUrls = new Set();
  const blocks = [...String(html).matchAll(/<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi)];

  blocks.forEach((block) => {
    const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(block[1]);
    const anchor = heading && /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(heading[1]);
    if (!anchor) return;
    const url = normalizeBingUrl(anchor[1]);
    if (!url || seenUrls.has(url)) return;

    const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block[1]);
    const title = cleanHtmlText(anchor[2]);
    const snippet = cleanHtmlText(snippetMatch?.[1] || '');
    if (!title) return;

    seenUrls.add(url);
    try {
      const parsed = new URL(url);
      sources.push({
        title: title.slice(0, 240),
        url,
        domain: parsed.hostname.replace(/^www\./i, ''),
        snippet: snippet.slice(0, 500),
      });
    } catch (error) {
      // Skip malformed URLs.
    }
  });

  return sources.slice(0, limit);
}

async function searchBing(query) {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setmkt=en-US&setlang=en&cc=US&count=50`;
  const html = await fetchSearchPage(searchUrl, BING_USER_AGENT, 'en-US,en;q=0.9');
  return parseBingResults(html, 50);
}

function parseBraveResults(html) {
  const text = String(html);
  const titleAnchors = [...text.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: match[1],
      title: cleanHtmlText((/<div class="title"[^>]*>([\s\S]*?)<\/div>/i.exec(match[2]) || [])[1] || match[2]),
    }))
    .filter((item) => item.title);
  const snippets = [...text.matchAll(/<p class="snippet-description"[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => cleanHtmlText(match[1]));
  const sources = [];
  const seenUrls = new Set();
  titleAnchors.forEach((item, index) => {
    if (seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    try {
      const parsed = new URL(item.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      sources.push({
        title: item.title.slice(0, 240),
        url: parsed.toString(),
        domain: parsed.hostname.replace(/^www\./i, ''),
        snippet: (snippets[index] || '').slice(0, 500),
      });
    } catch (error) {
      // Skip malformed URLs.
    }
  });
  return sources.slice(0, 50);
}

async function searchBrave(query) {
  const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const html = await fetchSearchPage(searchUrl, BING_USER_AGENT, 'en-US,en;q=0.9');
  return parseBraveResults(html);
}

function wikipediaPageUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
}

async function searchWikipedia(query) {
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=50&srprop=snippet`;
  const html = await fetchSearchPage(apiUrl);
  let payload = {};
  try {
    payload = JSON.parse(html);
  } catch (error) {
    return [];
  }
  const searchResults = payload.query?.search;
  if (!Array.isArray(searchResults)) return [];
  const sources = [];
  const seenUrls = new Set();
  searchResults.forEach((result) => {
    const title = String(result.title || '').trim();
    if (!title) return;
    if (/^(Wikipedia|File|Category|Template|Help|Portal|Talk|User|Draft|Module):/i.test(title)) return;
    const url = wikipediaPageUrl(title);
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    sources.push({
      title: title.slice(0, 240),
      url,
      domain: 'en.wikipedia.org',
      snippet: cleanHtmlText(String(result.snippet || '')).slice(0, 500),
    });
  });
  return sources.slice(0, 50);
}

async function searchWeb(query, resultLimit = 6) {
  const duckDuckGoResults = await searchDuckDuckGo(query, resultLimit).catch(() => []);
  if (duckDuckGoResults.length) return { provider: 'DuckDuckGo', results: duckDuckGoResults };
  const bingResults = await searchBing(query).then((results) => results.slice(0, resultLimit)).catch(() => []);
  if (bingResults.length) return { provider: 'Bing', results: bingResults };
  const braveResults = await searchBrave(query).then((results) => results.slice(0, resultLimit)).catch(() => []);
  if (braveResults.length) return { provider: 'Brave', results: braveResults };
  const wikipediaResults = await searchWikipedia(query).then((results) => results.slice(0, resultLimit)).catch(() => []);
  if (wikipediaResults.length) return { provider: 'Wikipedia', results: wikipediaResults };
  return { provider: 'DuckDuckGo', results: [] };
}

function parseSearchResults(html, limit = Infinity) {
  const resultLinkPattern = /<a\b([^>]*\bclass=["'][^"']*\b(?:result__a|result-link)\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const matches = [...String(html).matchAll(resultLinkPattern)];
  const sources = [];
  const seenUrls = new Set();

  matches.forEach((match, index) => {
    const attributes = match[1] || '';
    const rawHref = /\bhref=["']([^"']+)["']/i.exec(attributes)?.[1];
    const url = normalizeSearchUrl(rawHref);
    if (!url || seenUrls.has(url)) return;

    const nextIndex = matches[index + 1]?.index ?? html.length;
    const resultSection = html.slice(match.index, nextIndex);
    const snippetMatch = /class=["'][^"']*\b(?:result__snippet|result-snippet)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|td)>/i.exec(resultSection);
    const title = cleanHtmlText(match[2]);
    const snippet = cleanHtmlText(snippetMatch?.[1] || '');
    if (!title) return;

    try {
      const parsed = new URL(url);
      seenUrls.add(url);
      sources.push({
        title: title.slice(0, 240),
        url,
        domain: parsed.hostname.replace(/^www\./i, ''),
        snippet: snippet.slice(0, 500),
      });
    } catch (error) {
      // Ignore malformed provider output.
    }
  });

  return sources.slice(0, limit);
}

function normalizeSearchUrl(rawHref) {
  if (!rawHref) return '';
  let href = decodeHtmlEntities(rawHref.trim());
  if (href.startsWith('//')) href = `https:${href}`;

  try {
    const providerUrl = new URL(href, 'https://duckduckgo.com');
    if (providerUrl.hostname.endsWith('duckduckgo.com') && providerUrl.pathname.includes('/l/')) {
      href = providerUrl.searchParams.get('uddg') || '';
    }
  } catch (error) {
    return '';
  }

  try {
    const parsed = new URL(decodeHtmlEntities(href));
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch (error) {
    return '';
  }
}

function cleanHtmlText(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function runNext() {
    if (index >= items.length) return;
    const current = index;
    index += 1;
    try {
      results[current] = await worker(items[current]);
    } catch (error) {
      results[current] = undefined;
    }
    await runNext();
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(runners);
  return results;
}

function fetchPageContent(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'User-Agent': 'AngryBirdGodAI/1.0 (local research assistant)',
      },
    }, (response) => {
      const status = response.statusCode || 500;
      if (status >= 300 && status < 400 && response.headers.location && redirects < 4) {
        response.resume();
        let next;
        try {
          next = new URL(response.headers.location, url).toString();
          const parsed = new URL(next);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Bad redirect protocol.');
        } catch (error) {
          reject(error);
          return;
        }
        fetchPageContent(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Page returned HTTP ${status}.`));
        return;
      }
      let body = '';
      let size = 0;
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 1500000) {
          response.destroy();
          reject(new Error('Page too large.'));
          return;
        }
        body += chunk;
      });
      response.on('end', () => resolve(body));
      response.on('error', reject);
    });

    request.setTimeout(12000, () => {
      request.destroy(new Error('Page fetch timed out.'));
    });
    request.on('error', reject);
  });
}

function extractExampleImages(html, baseUrl, maxImages = 3) {
  const images = [];
  const seen = new Set();
  const pushImage = (rawUrl) => {
    if (!rawUrl || images.length >= maxImages) return;
    const url = normalizeAbsoluteUrl(rawUrl, baseUrl);
    if (!url || seen.has(url) || /(?:logo|avatar|spacer|pixel|icon|banner|favicon)/i.test(url) || /\.svg(?:$|[?#])/i.test(url)) return;
    seen.add(url);
    images.push(url);
  };
  const openGraph = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(String(html))
    || /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(String(html));
  if (openGraph) pushImage(openGraph[1]);
  const imgPattern = /<img\b[^>]*>/gi;
  const items = [...String(html).matchAll(imgPattern)];
  items.forEach((match) => {
    if (images.length >= maxImages) return;
    const tag = match[0];
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(tag) || /\bsrc=([^\s>"']+)/i.exec(tag);
    if (!srcMatch) return;
    const widthMatch = /\bwidth=["']?(\d+)/i.exec(tag);
    const heightMatch = /\bheight=["']?(\d+)/i.exec(tag);
    if (widthMatch && heightMatch && Number(widthMatch[1]) < 60 && Number(heightMatch[1]) < 60) return;
    pushImage(srcMatch[1]);
  });
  return images;
}

function normalizeAbsoluteUrl(rawUrl, baseUrl) {
  try {
    const url = new URL(String(rawUrl).trim(), baseUrl || 'https://example.com');
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch (error) {
    return '';
  }
}

function extractReadableText(html) {
  let text = String(html || '');
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(?:p|div|h[1-6]|li|section|article|tr|blockquote|table|header|footer|nav)\b[^>]*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|section|article|tr|blockquote|table|header|footer|nav)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return cleanHtmlText(text).slice(0, MAX_PAGE_CONTENT_CHARS);
}

function dedupeKey(url) {
  try {
    const parsed = new URL(url);
    [...parsed.searchParams.keys()].forEach((key) => {
      if (key.toLowerCase().startsWith('utm_')) parsed.searchParams.delete(key);
    });
    return parsed.toString().replace(/\/+$/, '');
  } catch (error) {
    return String(url);
  }
}

async function handleAnalysisResearch(query, rawQueries) {
  const fallbackQueries = [
    query,
    `${query} overview history evidence`,
    `${query} latest research studies data`,
    `${query} benefits risks criticism`,
    `${query} expert analysis statistics`,
    `${query} primary sources official report`,
    `${query} international comparison`,
    `${query} practical examples case studies`,
  ];
  const queries = [...new Set([
    ...fallbackQueries,
    ...(Array.isArray(rawQueries) ? rawQueries.map((item) => String(item).trim()).filter(Boolean) : []),
  ])].slice(0, MAX_ANALYSIS_QUERIES);
  const perQuery = await runWithConcurrency(queries, ANALYSIS_CONCURRENCY, (item) => searchWeb(item, 50).catch(() => ({ provider: 'DuckDuckGo', results: [] })));
  const searchedResultCount = perQuery.reduce((total, entry) => total + entry.results.length, 0);
  const providerCounts = new Map();
  const occurrenceCount = new Map();
  const ordered = [];
  const seen = new Set();
  perQuery.forEach((entry) => {
    if (entry.results.length) providerCounts.set(entry.provider, (providerCounts.get(entry.provider) || 0) + 1);
    entry.results.forEach((source) => {
      const key = dedupeKey(source.url);
      occurrenceCount.set(key, (occurrenceCount.get(key) || 0) + 1);
      if (!seen.has(key)) { seen.add(key); ordered.push(source); }
    });
  });
  const ranked = ordered
    .map((source) => ({ source, count: occurrenceCount.get(dedupeKey(source.url)) || 0 }))
    .sort((a, b) => b.count - a.count)
    .map(({ source }) => source)
    .slice(0, MAX_ANALYSIS_SOURCES);
  const pageTargets = ranked.slice(0, MAX_ANALYSIS_PAGE_FETCHES);
  const pageContents = await runWithConcurrency(pageTargets, ANALYSIS_CONCURRENCY, async (source) => {
    try {
      const page = await fetchPageContent(source.url);
      return { url: source.url, content: extractReadableText(page).slice(0, MAX_ANALYSIS_PAGE_CONTENT_CHARS), images: extractExampleImages(page, source.url) };
    } catch (error) { return { url: source.url, content: '', images: [] }; }
  });
  const contentByUrl = new Map(pageContents.map((entry) => [entry.url, entry.content]));
  const imagesByUrl = new Map(pageContents.map((entry) => [entry.url, entry.images || []]));
  const provider = [...providerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'DuckDuckGo';
  return {
    provider,
    providers: [...providerCounts.keys()],
    queriesRun: queries,
    searchedResultCount,
    checkedSourceCount: ranked.length,
    checkedPageCount: pageContents.filter((entry) => entry.content).length,
    results: ranked.map((source) => ({ ...source, content: contentByUrl.get(source.url) || '', images: imagesByUrl.get(source.url) || [] })),
  };
}

async function handleDeepResearch(query, rawQueries) {
  const queries = [...new Set([query, ...(Array.isArray(rawQueries) ? rawQueries.map((item) => String(item).trim()).filter(Boolean) : [])])].slice(0, MAX_DEEP_QUERIES);
  const perQuery = await runWithConcurrency(queries, DEEP_CONCURRENCY, (item) => searchWeb(item).catch(() => ({ provider: 'DuckDuckGo', results: [] })));

  const providerCounts = new Map();
  perQuery.forEach((entry) => {
    if (entry.results.length) providerCounts.set(entry.provider, (providerCounts.get(entry.provider) || 0) + 1);
  });

  const occurrenceCount = new Map();
  const ordered = [];
  const seen = new Set();
  perQuery.flatMap((entry) => entry.results).forEach((source) => {
    const key = dedupeKey(source.url);
    occurrenceCount.set(key, (occurrenceCount.get(key) || 0) + 1);
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(source);
    }
  });

  const ranked = ordered
    .map((source) => ({ source, count: occurrenceCount.get(dedupeKey(source.url)) || 0 }))
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.source)
    .slice(0, MAX_DEEP_SOURCES);

  const pageTargets = ranked.slice(0, MAX_DEEP_PAGE_FETCHES);
  const pageContents = await runWithConcurrency(pageTargets, DEEP_CONCURRENCY, async (source) => {
    try {
      const page = await fetchPageContent(source.url);
      return { url: source.url, content: extractReadableText(page), images: extractExampleImages(page, source.url) };
    } catch (error) {
      return { url: source.url, content: '', images: [] };
    }
  });
  const contentByUrl = new Map(pageContents.map((entry) => [entry.url, entry.content]));
  const imagesByUrl = new Map(pageContents.map((entry) => [entry.url, entry.images || []]));

  const provider = [...providerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'DuckDuckGo';
  return {
    provider,
    providers: [...providerCounts.keys()],
    queriesRun: queries,
    results: ranked.map((source) => ({ ...source, content: contentByUrl.get(source.url) || '', images: imagesByUrl.get(source.url) || [] })),
  };
}

async function handleResearch(req, res) {
  try {
    const payload = await readJsonBody(req, 64 * 1024);
    const query = String(payload.query || '').replace(/\s+/g, ' ').trim().slice(0, MAX_RESEARCH_QUERY_LENGTH);
    if (!query) {
      sendJson(res, 400, { error: 'A research query is required.', code: 'invalid_research_query' });
      return;
    }

    if (payload.mode === 'analysis') {
      const analysis = await handleAnalysisResearch(query, payload.queries);
      sendJson(res, 200, {
        provider: analysis.provider,
        providers: analysis.providers,
        mode: 'analysis',
        query,
        queriesRun: analysis.queriesRun,
        searchedAt: new Date().toISOString(),
        searchedResultCount: analysis.searchedResultCount,
        checkedSourceCount: analysis.checkedSourceCount,
        checkedPageCount: analysis.checkedPageCount,
        results: analysis.results,
      });
      return;
    }

    if (payload.mode === 'deep') {
      const deep = await handleDeepResearch(query, payload.queries);
      sendJson(res, 200, {
        provider: deep.provider,
        providers: deep.providers,
        mode: 'deep',
        query,
        queriesRun: deep.queriesRun,
        searchedAt: new Date().toISOString(),
        results: deep.results,
      });
      return;
    }

    const { provider, results } = await searchWeb(query);
    sendJson(res, 200, {
      provider,
      mode: 'quick',
      query,
      searchedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 502;
    sendJson(res, statusCode, {
      error: error.message || 'Web research failed.',
      code: 'research_unavailable',
    });
  }
}

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const FISH_AUDIO_API = 'https://api.fish.audio';
const FISH_MAX_TEXT = 2000;

async function handleFishTts(req, res) {
  try {
    const payload = await readJsonBody(req, 256 * 1024);
    const text = String(payload.text || '').trim();
    if (!text) {
      sendJson(res, 400, { error: 'Text is required.' });
      return;
    }
    if (text.length > FISH_MAX_TEXT) {
      sendJson(res, 400, { error: `Text too long (${text.length} chars, max ${FISH_MAX_TEXT}).` });
      return;
    }
    const apiKey = String(payload.apiKey || '').trim();
    if (!apiKey) {
      sendJson(res, 400, { error: 'Fish Audio API key is required.' });
      return;
    }
    const referenceId = String(payload.referenceId || '').trim();
    if (!referenceId) {
      sendJson(res, 400, { error: 'Fish Audio reference_id (voice model ID) is required.' });
      return;
    }
    const fishPayload = JSON.stringify({
      text,
      reference_id: referenceId,
      temperature: 0.7,
      top_p: 0.7,
      format: 'mp3',
      chunk_length: 200,
      normalize: true,
      latency: 'normal',
    });
    const fishResponse = await new Promise((resolve, reject) => {
      const request = https.request(`${FISH_AUDIO_API}/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(fishPayload),
          Authorization: `Bearer ${apiKey}`,
          model: 's2.1-pro-free',
        },
      }, (response) => {
        const status = response.statusCode || 500;
        if (status !== 200) {
          let errBody = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => { errBody += chunk; });
          response.on('end', () => {
            reject(Object.assign(new Error(`Fish Audio returned HTTP ${status}.`), { statusCode: status, body: errBody.slice(0, 500) }));
          });
          return;
        }
        resolve(response);
      });
      request.setTimeout(30000, () => {
        request.destroy(new Error('Fish Audio request timed out.'));
      });
      request.on('error', reject);
      request.write(fishPayload);
      request.end();
    });
    res.writeHead(200, {
      'Content-Type': fishResponse.headers['content-type'] || 'audio/mpeg',
      'Cache-Control': 'no-store',
    });
    fishResponse.pipe(res);
  } catch (error) {
    if (error.statusCode && error.body) {
      sendJson(res, 502, { error: error.message, detail: error.body });
    } else {
      sendJson(res, 502, { error: String((error && error.message) || error) });
    }
  }
}

async function handleImageFetch(req, res, requestUrl) {
  try {
    const rawUrl = String(requestUrl.searchParams.get('url') || '').trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      sendJson(res, 400, { error: 'A valid http(s) image URL is required.' });
      return;
    }
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      sendJson(res, 400, { error: 'Unsupported protocol.' });
      return;
    }
    const buffer = await new Promise((resolve, reject) => {
      const request = https.get(parsed, {
        headers: {
          Accept: 'image/*',
          'User-Agent': BING_USER_AGENT,
          Referer: `${parsed.protocol}//${parsed.hostname}/`,
        },
      }, (response) => {
        const status = response.statusCode || 500;
        if (status >= 300 && status < 400 && response.headers.location && redirects < 4) {
          response.resume();
          try {
            const next = new URL(response.headers.location, parsed).toString();
            fetchImageUrl(next, redirects + 1).then(resolve, reject);
          } catch (error) { reject(error); }
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Image returned HTTP ${status}.`));
          return;
        }
        const chunks = [];
        let size = 0;
        let exceeded = false;
        response.on('data', (chunk) => {
          if (exceeded) return;
          size += chunk.length;
          if (size > IMAGE_MAX_BYTES) {
            exceeded = true;
            response.destroy();
            reject(new Error('Image is too large.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (exceeded) return;
          const buf = Buffer.concat(chunks);
          const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
          resolve({ buffer: buf, mime });
        });
        response.on('error', reject);
      });
      let redirects = 0;
      request.setTimeout(10000, () => {
        request.destroy(new Error('Image fetch timed out.'));
      });
      request.on('error', reject);
    }).catch((error) => ({ error: error.message }));

    if (buffer.error) {
      sendJson(res, 502, { error: buffer.error });
      return;
    }
    const mime = IMAGE_ALLOWED_TYPES.includes(buffer.mime) ? buffer.mime : 'image/png';
    const base64 = buffer.buffer.toString('base64');
    sendJson(res, 200, { base64, mimeType: mime, bytes: buffer.buffer.length });
  } catch (error) {
    sendJson(res, 502, { error: String((error && error.message) || error) });
  }
}

async function fetchImageUrl(url, redirects) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = https.get(parsed, {
      headers: {
        Accept: 'image/*',
        'User-Agent': BING_USER_AGENT,
        Referer: `${parsed.protocol}//${parsed.hostname}/`,
      },
    }, (response) => {
      const status = response.statusCode || 500;
      if (status >= 300 && status < 400 && response.headers.location && redirects < 4) {
        response.resume();
        try {
          const next = new URL(response.headers.location, parsed).toString();
          fetchImageUrl(next, redirects + 1).then(resolve, reject);
        } catch (error) { reject(error); }
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Image returned HTTP ${status}.`));
        return;
      }
      const chunks = [];
      let size = 0;
      let exceeded = false;
      response.on('data', (chunk) => {
        if (exceeded) return;
        size += chunk.length;
        if (size > IMAGE_MAX_BYTES) {
          exceeded = true;
          response.destroy();
          reject(new Error('Image is too large.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (exceeded) return;
        const buf = Buffer.concat(chunks);
        const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        resolve({ buffer: buf, mime });
      });
      response.on('error', reject);
    });
    request.setTimeout(10000, () => {
      request.destroy(new Error('Image fetch timed out.'));
    });
    request.on('error', reject);
  });
}

async function handleExec(req, res) {
  try {
    const payload = await readJsonBody(req, 16 * 1024);
    const action = String(payload.action || '').trim();
    const target = String(payload.target || '').trim().toLowerCase();

    if (action !== 'open' && action !== 'system') {
      sendJson(res, 400, { ok: false, error: 'Only "open" and "system" actions are supported.' });
      return;
    }

    if (action === 'system') {
      const entry = SYSTEM_COMMANDS[target];
      if (!entry) {
        const available = Object.keys(SYSTEM_COMMANDS).sort().join(', ');
        sendJson(res, 400, { ok: false, error: `Unknown system target "${target}". Available: ${available}.` });
        return;
      }

      const result = await new Promise((resolve) => {
        exec(entry.command, { timeout: 12000, windowsHide: true }, (error, stdout, stderr) => {
          if (error && error.killed) {
            resolve({ ok: false, error: 'The system check timed out.' });
          } else if (error) {
            resolve({ ok: false, error: error.message || 'The system check failed.' });
          } else {
            const output = (stdout || '').trim();
            resolve({ ok: true, output: output || '(no output)', label: entry.label });
          }
        });
      });

      if (result.ok) {
        sendJson(res, 200, result);
      } else {
        sendJson(res, 502, result);
      }
      return;
    }

    if (action === 'open') {
      if (target === 'folder') {
        const rawPath = String(payload.path || '').trim();
        if (!rawPath) {
          sendJson(res, 400, { ok: false, error: 'A folder path is required.' });
          return;
        }
        const normalized = path.resolve(rawPath);
        if (normalized.includes('..')) {
          sendJson(res, 400, { ok: false, error: 'Unsafe folder path.' });
          return;
        }
        try {
          if (!fs.existsSync(normalized)) {
            sendJson(res, 400, { ok: false, error: `Folder not found: ${normalized}` });
            return;
          }
          const stat = fs.statSync(normalized);
          if (!stat.isDirectory()) {
            sendJson(res, 400, { ok: false, error: `Not a folder: ${normalized}` });
            return;
          }
        } catch (error) {
          sendJson(res, 400, { ok: false, error: `Cannot access folder: ${error.message}` });
          return;
        }
        const folderResult = await new Promise((resolve) => {
          exec(`start "" "${normalized}"`, { timeout: 8000, windowsHide: false }, (error) => {
            if (error && error.killed) {
              resolve({ ok: false, error: 'The command timed out.' });
            } else if (error) {
              resolve({ ok: false, error: 'Could not open the folder.' });
            } else {
              resolve({ ok: true, message: `Opened ${normalized}.` });
            }
          });
        });
        if (folderResult.ok) {
          sendJson(res, 200, folderResult);
        } else {
          sendJson(res, 502, folderResult);
        }
        return;
      }

      const folderCommand = FOLDERS[target];
      if (!folderCommand) {
        const resolved = resolveAppLaunch(target);
        if (resolved.error) {
          sendJson(res, 400, { ok: false, error: resolved.error });
          return;
        }
        const result = await new Promise((resolve) => {
          exec(resolved.command, { timeout: 8000, windowsHide: false }, (error, stdout, stderr) => {
            if (error && error.killed) {
              resolve({ ok: false, error: 'The command timed out.' });
            } else if (error) {
              resolve({ ok: false, error: error.message || 'The command could not be started.' });
            } else if (stderr && stderr.trim()) {
              resolve({ ok: false, error: stderr.trim() });
            } else {
              resolve({ ok: true, message: `${resolved.label || target} opened.` });
            }
          });
        });
        if (result.ok) {
          sendJson(res, 200, result);
        } else {
          sendJson(res, 502, result);
        }
        return;
      }

      const displayName = target.charAt(0).toUpperCase() + target.slice(1);

      const result = await new Promise((resolve) => {
        exec(folderCommand, { timeout: 8000, windowsHide: false }, (error, stdout, stderr) => {
          if (error && error.killed) {
            resolve({ ok: false, error: 'The command timed out.' });
          } else if (error) {
            resolve({ ok: false, error: error.message || 'The command could not be started.' });
          } else if (stderr && stderr.trim()) {
            resolve({ ok: false, error: stderr.trim() });
          } else {
            resolve({ ok: true, message: `${displayName} opened.` });
          }
        });
      });

      if (result.ok) {
        sendJson(res, 200, result);
      } else {
        sendJson(res, 502, result);
      }
    }
  } catch (error) {
    sendJson(res, 502, { ok: false, error: error.message || 'Could not execute the PC action.' });
  }
}

function serveStatic(res, requestUrl) {
  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Bridge between the main browser app and the Electron desktop overlay.
// The browser posts its Great Sage avatar state; the overlay polls it and
// posts a stop request when the user clicks the overlay.
let overlayState = { visible: false, mode: 'idle', bubble: '', stopRequested: false };

async function handleOverlayState(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, overlayState);
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const payload = await readJsonBody(req, 16 * 1024);
    if (payload.stopRequested === true) {
      overlayState.stopRequested = true;
    } else if (payload.stopRequested === false) {
      overlayState.stopRequested = false;
    } else {
      overlayState.visible = Boolean(payload.visible);
      overlayState.mode = ['idle', 'thinking', 'speaking'].includes(payload.mode) ? payload.mode : 'idle';
      overlayState.bubble = String(payload.bubble || '').slice(0, 400);
    }
    sendJson(res, 200, overlayState);
  } catch (error) {
    sendJson(res, 400, { error: String((error && error.message) || error) });
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (requestUrl.pathname === '/api/overlay-state') {
    handleOverlayState(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/research') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    handleResearch(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/podcast-save') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    handlePodcastSave(req, res, requestUrl);
    return;
  }

  if (requestUrl.pathname === '/api/fish-tts') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    handleFishTts(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/image-fetch') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    handleImageFetch(req, res, requestUrl);
    return;
  }

  if (requestUrl.pathname === '/api/exec') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    handleExec(req, res);
    return;
  }

  if (requestUrl.pathname.startsWith('/api/ollama')) {
    proxyToOllama(req, res, requestUrl);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  serveStatic(res, requestUrl);
});

if (require.main === module || process.env.ELECTRON_RUN_AS_NODE) {
  server.listen(PORT, HOST, () => {
    console.log(`AngryBirdGodAI is running at http://${HOST}:${PORT}`);
    console.log(`Ollama proxy: http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
    console.log('Web research: DuckDuckGo → Bing → Brave → Wikipedia before each answer');
  });
}

module.exports = {
  searchWeb,
  searchDuckDuckGo,
  searchBing,
  searchBrave,
  searchWikipedia,
  handleAnalysisResearch,
  extractExampleImages,
};
