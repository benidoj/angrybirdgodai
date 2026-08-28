const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`not found: ${name}`);
  let i = src.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced: ${name}`);
}

const sandbox = {};
for (const name of ['parsePodcastScript', 'encodeWav', 'concatenatePodcastBuffers', 'formatDuration']) {
  const body = extract(name);
  if (!body) throw new Error(`extract failed: ${name}`);
  console.log(`[extract] ${name} len=${body.length} head=${JSON.stringify(body.slice(0, 50))}`);
  sandbox[name] = new Function(`return (${body})`)();
}
const { parsePodcastScript, encodeWav, concatenatePodcastBuffers, formatDuration } = sandbox;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// 1) parser: German + sloppy labels + stage directions to skip
const script = [
  'HOST1: Hallo und herzlich willkommen!',
  'HOST2: Heute reden wir über Schlaf.',
  '',
  'HOST 1: Warum schlafen wir eigentlich?',
  'Host B: Das ist eine gute Frage.',
  'MODERATOR: Laut einer Studie schlafen Erwachsene zu wenig.',
  'GAST: Genau, sieben bis neun Stunden sind ideal.',
  '(Lacht) Das ist aber viel.',
  'HOST2: Danke fürs Zuhören!',
].join('\n');
const segs = parsePodcastScript(script);
check('parser segment count', segs.length, 7);
check('parser host of HOST1', segs[0].host, 0);
check('parser host of HOST2', segs[1].host, 1);
check('parser host of HOST 1', segs[2].host, 0);
check('parser host of Host B', segs[3].host, 1);
check('parser host of MODERATOR', segs[4].host, 0);
check('parser host of GAST', segs[5].host, 1);
check('parser skips stage directions', segs.some((s) => s.text.includes('Lacht')), false);
check('parser strips label text', segs[0].text, 'Hallo und herzlich willkommen!');

// 2) ascii detection used by maybeSynthesizeWav
const asciiRe = /^[\x00-\x7F]*$/;
check('ascii en', asciiRe.test('Hello world!'), true);
check('ascii de (umlaut)', asciiRe.test('Heute reden wir über Schlaf.'), false);

// 3) wav encoder with a fake buffer
async function testWav() {
  const fakeBuffer = { sampleRate: 16000, getChannelData: () => new Float32Array([0, 0.5, -0.5, 1, -1]) };
  const wav = encodeWav(fakeBuffer);
  check('wav blob size', wav.size, 44 + 5 * 2);
  const bytes = new Uint8Array(await wav.arrayBuffer());
  check('wav RIFF header', String.fromCharCode(...bytes.slice(0, 4)), 'RIFF');
  check('wav WAVE tag', String.fromCharCode(...bytes.slice(8, 12)), 'WAVE');
  check('wav data tag', String.fromCharCode(...bytes.slice(36, 40)), 'data');
  check('wav byte length', bytes.length, 44 + 5 * 2);
  check('wav sample rate', new DataView(bytes.buffer).getUint32(24, true), 16000);
  check('wav mono', new DataView(bytes.buffer).getUint16(22, true), 1);
  check('wav first sample', new DataView(bytes.buffer).getInt16(44, true), 0);
  check('wav sample 0.5 -> 16383 (truncated)', new DataView(bytes.buffer).getInt16(46, true), 16383);
  check('wav sample -0.5 -> -16384', new DataView(bytes.buffer).getInt16(48, true), -16384);
  check('wav sample 1 -> 32767', new DataView(bytes.buffer).getInt16(50, true), 32767);
  check('wav sample -1 -> -32768', new DataView(bytes.buffer).getInt16(52, true), -32768);
}

// 4) concatenation with a fake context
const fakeCtx = {
  createBuffer: (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: () => new Float32Array(len) }),
};
const b1 = { length: 10, sampleRate: 8000, getChannelData: () => new Float32Array(10).fill(0.5) };
const b2 = { length: 5, sampleRate: 8000, getChannelData: () => new Float32Array(5).fill(-0.5) };
const merged = concatenatePodcastBuffers(fakeCtx, [b1, b2], 0.45);
check('concat total length', merged.length, 10 + Math.round(0.45 * 8000) + 5);
check('concat sample rate', merged.sampleRate, 8000);

// 5) duration formatting
check('duration 3:04', formatDuration(183.7), '3:04');
check('duration 0:00', formatDuration(0), '0:00');

(async () => {
  await testWav();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})();
