// Fetches the bundled whisper.cpp binary + tiny model used for offline speech-to-text.
// Usage: `npm run fetch:whisper` (run from desktop/).
// Idempotent: skips anything already present, verifies whisper-cli.exe launches.
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WHISPER_VERSION = 'b4938';
const BASE = 'https://github.com/ggml-org/whisper.cpp/releases/download';
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin';
const MODEL_NAME = 'ggml-tiny-q5_1.bin';

const WHISPER_DIR = path.join(__dirname, 'whisper');
const RELEASE_DIR = path.join(WHISPER_DIR, 'Release');

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
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const zipPath = path.join(WHISPER_DIR, 'whisper-bin-x64.zip');
  const cliExe = path.join(RELEASE_DIR, 'whisper-cli.exe');
  const modelPath = path.join(RELEASE_DIR, MODEL_NAME);

  // 1) whisper-cli.exe + its DLLs
  if (!fs.existsSync(cliExe)) {
    console.log('Downloading whisper.cpp binaries for Windows x64…');
    await download(`${BASE}/${WHISPER_VERSION}/whisper-bin-x64.zip`, zipPath);
    const result = spawnSync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${WHISPER_DIR.replace(/'/g, "''")}' -Force`,
    ], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Failed to extract whisper binaries');
    fs.unlinkSync(zipPath);
    // Keep only what whisper-cli.exe needs (drop example tools to keep the bundle slim).
    for (const file of fs.readdirSync(RELEASE_DIR)) {
      const isCli = /^whisper-cli\.exe$/i.test(file);
      const isDll = /\.dll$/i.test(file);
      const isModel = /^ggml-.*\.bin$/i.test(file);
      if (!isCli && !isDll && !isModel) {
        try { fs.unlinkSync(path.join(RELEASE_DIR, file)); } catch (e) { /* ignore */ }
      }
    }
  }

  // 2) tiny q5_1 model
  if (!fs.existsSync(modelPath)) {
    console.log('Downloading whisper model (ggml-tiny-q5_1.bin, ~31 MB)…');
    await download(MODEL_URL, modelPath);
  }

  // 3) verify the binary launches
  const check = spawnSync(cliExe, ['--help'], { timeout: 30000, encoding: 'utf8' });
  if (!fs.existsSync(cliExe) || !fs.existsSync(modelPath) || check.status === null) {
    throw new Error('whisper bundle incomplete or whisper-cli.exe failed to launch');
  }
  console.log('✅ whisper.cpp ready:', cliExe, '+', MODEL_NAME);
}

main().catch((error) => {
  console.error('❌', error.message);
  process.exit(1);
});