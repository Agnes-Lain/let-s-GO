// Jest mock of expo-audio: a recording fake player, no native module needed.
export const mockPlayer = {
  volume: 1,
  play: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
};
export const createAudioPlayer = jest.fn(() => mockPlayer);
export const setAudioModeAsync = jest.fn(() => Promise.resolve());
export type AudioPlayer = typeof mockPlayer;
