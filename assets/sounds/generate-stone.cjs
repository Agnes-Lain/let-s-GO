// Generates assets/sounds/stone.wav: a soft wooden "tock" (stone on bamboo), our own work, CC0.
// Usage: node assets/sounds/generate-stone.cjs <out.wav>; then encode:
//   ffmpeg -i out.wav -codec:a libmp3lame -b:a 64k -ac 1 stone.mp3
const fs = require('node:fs');
const { Buffer } = require('node:buffer');

const RATE = 44100;
const DURATION = 0.12; // seconds
const n = Math.round(RATE * DURATION);
const out = new Float64Array(n);

// Damped sine partials of a small hollow wooden body: [frequency Hz, decay time constant s, gain].
const partials = [
  [260, 0.025, 0.6],
  [910, 0.012, 1.0],
  [1650, 0.008, 0.5],
  [2400, 0.005, 0.25],
];
for (let i = 0; i < n; i++) {
  const t = i / RATE;
  for (const [f, tau, gain] of partials) out[i] += gain * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau);
}

// Short low-passed noise burst for the contact click (deterministic pseudo-random).
let seed = 12345;
let lp = 0;
for (let i = 0; i < Math.round(RATE * 0.004); i++) {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const noise = seed / 2 ** 31 - 1;
  lp += 0.25 * (noise - lp);
  out[i] += 1.2 * lp * (1 - i / (RATE * 0.004));
}

// Fade the last 10 ms, normalise to a -6 dBFS peak.
const fade = Math.round(RATE * 0.01);
for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const scale = 0.5 / peak;

const data = Buffer.alloc(44 + n * 2);
data.write('RIFF', 0);
data.writeUInt32LE(36 + n * 2, 4);
data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(RATE, 24);
data.writeUInt32LE(RATE * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(out[i] * scale * 32767), 44 + i * 2);
fs.writeFileSync(process.argv[2], data);
