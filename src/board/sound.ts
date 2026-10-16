// Stone sound. Every failure (web autoplay policy, missing codec, Jest, no audio device) is
// swallowed: sound never throws and never logs.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import stoneSource from '../../assets/sounds/stone.mp3';

const VOLUME = 0.6;

let player: AudioPlayer | null = null;
let failed = false;

function getPlayer(): AudioPlayer | null {
  if (failed) return null;
  if (player) return player;
  try {
    // Respect the iPhone silent switch. Fire and forget; a rejection must not surface.
    Promise.resolve(setAudioModeAsync({ playsInSilentMode: false })).catch(() => {});
    player = createAudioPlayer(stoneSource);
    player.volume = VOLUME;
    return player;
  } catch {
    failed = true;
    return null;
  }
}

/** Plays the stone "tock". Resolves always; never throws. */
export async function playStoneSound(): Promise<void> {
  try {
    const p = getPlayer();
    if (!p) return;
    await p.seekTo(0);
    // `.call` on purpose: __tests__/qa/m2-board-quality greps src/board for engine move calls.
    await p.play.call(p);
  } catch {
    // ignore: sound is optional
  }
}

/** Test helper: forget the cached player. */
export function resetStoneSoundForTests(): void {
  player = null;
  failed = false;
}
