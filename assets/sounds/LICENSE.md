# Sound licenses

## stone.mp3

- What: one soft wooden "tock" (a stone placed on a bamboo board), mono, 120 ms of audio, peak
  about -6 dBFS.
- Source: **our own work**, synthesized (no third-party recording). Released under
  **CC0 1.0** (public domain dedication, https://creativecommons.org/publicdomain/zero/1.0/).
- Method: `assets/sounds/generate-stone.cjs` (plain Node, no dependencies) sums four damped
  sine partials (260, 910, 1650, 2400 Hz) with a 4 ms low-passed noise click, fades out, and writes a
  44.1 kHz 16-bit mono WAV. The WAV was encoded with
  `ffmpeg -i stone.wav -codec:a libmp3lame -b:a 64k -ac 1 stone.mp3` (about 1.5 KB).
- No free CC0 sample was downloaded: the build environment has no vetted source reachable.
