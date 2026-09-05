// Fetches the Vosk small English model used for offline speech-to-text.
// Usage: `npm run fetch:vosk` (run from desktop/).
// Idempotent: skips download when the model directory already exists.
//
// Note: Vosk itself is a Python package (`pip install vosk`). The server
// auto-detects the `vosk-transcriber` CLI at runtime and prefers it over the
// bundled whisper.cpp fallback. This script only grabs the model files.
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MODEL_NAME = 'vosk-model-small-en-us-0.15';
const MODEL_URL = `https://alphacephei.com/vosk/models/${MODEL_NAME}.zip`;

const VOSK_DIR = path.join(__dirname, 'vosk');
const MODEL_DIR = path.join(VOSK_DIR, MODEL_NAME);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(response.headers.location, dest).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    request.on('error', (error) => {
      file.close();
      try { fs.unlinkSync(dest); } catch (e) { /* ignore */ }
      reject(error);
    });
  });
}

async function main() {
  if (fs.existsSync(path.join(MODEL_DIR, 'am', 'final.mdl'))) {
    console.log(`✅ Vosk model already present: ${MODEL_NAME}`);
    return;
  }
  fs.mkdirSync(VOSK_DIR, { recursive: true });
  const zipPath = path.join(VOSK_DIR, `${MODEL_NAME}.zip`);
  console.log('Downloading Vosk model (vosk-model-small-en-us-0.15, ~40 MB)…');
  await download(MODEL_URL, zipPath);
  const result = spawnSync('powershell', [
    '-NoProfile', '-Command',
    `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${VOSK_DIR.replace(/'/g, "''")}' -Force`,
  ], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Failed to extract Vosk model');
  fs.unlinkSync(zipPath);
  if (!fs.existsSync(path.join(MODEL_DIR, 'am', 'final.mdl'))) {
    throw new Error('Extracted model is missing am/final.mdl — download may be incomplete');
  }
  console.log('✅ Vosk model ready:', MODEL_DIR);
}

main().catch((error) => {
  console.error('❌', error.message);
  process.exit(1);
});