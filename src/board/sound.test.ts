import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { playStoneSound, resetStoneSoundForTests } from './sound';

// The mock hands out one shared fake player; read it from the import so we get the same instance.
const mockPlayer = (createAudioPlayer as jest.Mock)() as {
  volume: number;
  play: jest.Mock;
  seekTo: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.seekTo.mockImplementation(() => Promise.resolve());
  resetStoneSoundForTests();
});

describe('playStoneSound', () => {
  it('creates one player, sets silent-switch mode once, rewinds then plays at volume 0.6', async () => {
    await playStoneSound();
    await playStoneSound();
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false });
    expect(mockPlayer.volume).toBe(0.6);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('resolves silently when play() throws', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockPlayer.play.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(playStoneSound()).resolves.toBeUndefined();
    mockPlayer.seekTo.mockImplementationOnce(() => Promise.reject(new Error('nope')));
    await expect(playStoneSound()).resolves.toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    error.mockRestore();
    warn.mockRestore();
  });

  it('resolves silently when the player cannot be created', async () => {
    (createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no audio');
    });
    await expect(playStoneSound()).resolves.toBeUndefined();
    await expect(playStoneSound()).resolves.toBeUndefined();
  });
});
