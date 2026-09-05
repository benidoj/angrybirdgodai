// fetch-vosk-runtime.js
// Provisions the portable Python embed + the `vosk` package into ./vosk-runtime so
// every desktop user gets the Vosk speech backend automatically (no Python needed).
// The folder is gitignored and shipped inside the EXE via electron-builder
// extraResources; run this once on the build machine (or after a fresh clone).
//
// Idempotent: if a working vosk-transcriber already exists it does nothing.
//
// Steps mirror what was verified manually on Windows:
//   1. Download the python.org "embeddable" zip (python-3.14.6-embed-amd64.zip).
//   2. Unzip into vosk-runtime/ and enable site-packages in the ._pth file.
//   3. Bootstrap pip (get-pip.py) and `pip install vosk`.
//   4. Self-check that vosk-transcriber.exe runs.

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Runner written next to python.exe. Same CLI as vosk-transcriber but decodes
// WAV with the stdlib and drives the vosk API directly — no ffmpeg needed, so it
// works on a clean Windows install. Keep in sync with vosk-runtime/vosk_transcribe.py.
const RUNNER_SOURCE = `#!/usr/bin/env python3
"""Standalone vosk transcription runner (no ffmpeg) — see vosk-runtime/vosk_transcribe.py."""
import argparse
import io
import json
import sys
import wave

try:
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

def parse_args():
    p = argparse.ArgumentParser(description="Transcribe a 16 kHz mono WAV with vosk")
    p.add_argument("--model", "-m", required=True, help="model directory")
    p.add_argument("--input", "-i", required=True, help="input WAV file")
    p.add_argument("--output", "-o", default="", help="output text file")
    p.add_argument("--log-level", default="INFO", help="accepted for vosk-transcriber compatibility")
    return p.parse_args()

def main():
    args = parse_args()
    import vosk  # lazily so --help works even if vosk is broken
    try:
        with wave.open(args.input, "rb") as wav:
            channels = wav.getnchannels()
            sampwidth = wav.getsampwidth()
            rate = wav.getframerate()
            if channels != 1 or sampwidth != 2:
                sys.stderr.write("Unsupported WAV: need mono 16-bit PCM (got %dch/%d-bit)\n" % (channels, sampwidth * 8))
                return 2
            frames = wav.readframes(wav.getnframes())
    except Exception as exc:
        sys.stderr.write("Failed to read WAV: %s\n" % exc)
        return 2
    if rate != 16000:
        sys.stderr.write("Unsupported sample rate %d — 16000 Hz expected\n" % rate)
        return 2
    model = vosk.Model(args.model)
    rec = vosk.KaldiRecognizer(model, rate)
    segments = []
    CHUNK = 4000
    for i in range(0, len(frames), CHUNK * 2):
        chunk = frames[i:i + CHUNK * 2]
        if rec.AcceptWaveform(chunk):
            try:
                text = json.loads(rec.Result()).get("text", "").strip()
            except Exception:
                text = ""
            if text:
                segments.append(text)
    try:
        text = json.loads(rec.FinalResult()).get("text", "").strip()
    except Exception:
        text = ""
    if text:
        segments.append(text)
    out = "\n".join(segments)
    out_path = args.output or (args.input.rsplit(".", 1)[0] + ".txt")
    with io.open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(out + ("\n" if out else ""))
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;

const PY_VERSION = '3.14.6';
const RUNTIME_DIR = path.join(__dirname, 'vosk-runtime');
const PYTHON_EXE = path.join(RUNTIME_DIR, 'python.exe');
const TRANSCRIBER_EXE = path.join(RUNTIME_DIR, 'Scripts', 'vosk-transcriber.exe');
const ZIP_URL = `https://www.python.org/ftp/python/${PY_VERSION}/python-${PY_VERSION}-embed-amd64.zip`;
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} exited with code ${result.status}`);
  return result;
}

function alreadyProvisioned() {
  if (!fs.existsSync(PYTHON_EXE)) return false;
  if (!fs.existsSync(path.join(RUNTIME_DIR, 'vosk_transcribe.py')) && !fs.existsSync(TRANSCRIBER_EXE)) return false;
  try {
    const check = spawnSync(PYTHON_EXE, [path.join(RUNTIME_DIR, 'vosk_transcribe.py'), '--help'], { stdio: 'ignore', timeout: 60000 });
    return check.status === 0;
  } catch (e) {
    return false;
  }
}

function enableSitePackages() {
  const pthName = fs.readdirSync(RUNTIME_DIR).find((f) => /^python\d+\._pth$/.test(f));
  if (!pthName) throw new Error('No python*. _pth found in embed zip');
  const pthPath = path.join(RUNTIME_DIR, pthName);
  let content = fs.readFileSync(pthPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n').filter((l) => l.trim() !== '');
  if (!content.includes('Lib\\site-packages')) {
    // Insert `Lib\site-packages` right after the stdlib zip line so pip's
    // installs are importable from the local folder (isolated from any
    // system Python that happens to be installed).
    const idx = lines.findIndex((l) => /^python\d+\.zip$/.test(l));
    if (idx !== -1) lines.splice(idx + 1, 0, 'Lib\\site-packages');
  }
  // The embed zip ships with `#import site` commented out — enable it.
  let body = lines.join('\n');
  body = body.replace(/^#import site$/m, 'import site');
  if (!/^import site$/m.test(body)) body += '\nimport site';
  fs.writeFileSync(pthPath, body.replace(/\n/g, '\r\n') + '\r\n');
  console.log(`Enabled site-packages in ${pthName}`);
}

function main() {
  if (alreadyProvisioned()) {
    console.log('vosk-runtime already provisioned and working — nothing to do.');
    return;
  }
  if (fs.existsSync(RUNTIME_DIR)) fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abg-vosk-rt-'));
  const zipPath = path.join(tmp, 'python-embed.zip');
  const pipScript = path.join(tmp, 'get-pip.py');

  try {
    console.log(`Downloading embeddable Python ${PY_VERSION} …`);
    const dl = spawnSync('curl', ['-s', '-L', '-o', zipPath, ZIP_URL], { stdio: 'inherit' });
    if (dl.error) throw dl.error;
    if (dl.status !== 0) throw new Error('Failed to download embeddable Python');

    console.log('Extracting …');
    if (process.platform === 'win32') {
      run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${RUNTIME_DIR}' -Force`]);
    } else {
      run('unzip', ['-q', zipPath, '-d', RUNTIME_DIR]);
    }
    fs.rmSync(zipPath, { force: true });

    enableSitePackages();

    console.log('Bootstrapping pip …');
    const dlPip = spawnSync('curl', ['-s', '-L', '-o', pipScript, GET_PIP_URL], { stdio: 'inherit' });
    if (dlPip.error) throw dlPip.error;
    if (dlPip.status !== 0) throw new Error('Failed to download get-pip.py');
    run(PYTHON_EXE, [pipScript, '--no-warn-script-location']);

    console.log('Installing vosk …');
    run(PYTHON_EXE, ['-m', 'pip', 'install', '--no-warn-script-location', 'vosk']);

    console.log('Writing vosk_transcribe.py runner …');
    fs.writeFileSync(path.join(RUNTIME_DIR, 'vosk_transcribe.py'), RUNNER_SOURCE, 'utf8');

    // Self-check.
    console.log('Self-check: python vosk_transcribe.py --help …');
    const check = spawnSync(PYTHON_EXE, [path.join(RUNTIME_DIR, 'vosk_transcribe.py'), '--help'], { stdio: 'inherit', timeout: 120000 });
    if (check.status !== 0) throw new Error('Self-check failed — vosk runner does not run');
    console.log('Self-check passed.');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

main();
