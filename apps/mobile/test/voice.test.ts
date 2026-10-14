import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({ speak: vi.fn() }));
vi.mock('@/lib/stride-audio', () => ({ strideAudio: null }));

import { LONGEST_ANNOUNCEMENT_MS, createDucker } from '@/lib/voice';

describe('turning music down while the voice speaks', () => {
  const native = { duck: vi.fn(() => true), unduck: vi.fn(() => true) };
  beforeEach(() => {
    vi.useFakeTimers();
    native.duck.mockClear();
    native.unduck.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('lowers the music for an announcement and brings it back after', () => {
    const d = createDucker(native);
    d.begin();
    expect(native.duck).toHaveBeenCalledTimes(1);
    expect(native.unduck).not.toHaveBeenCalled();
    d.end();
    expect(native.unduck).toHaveBeenCalledTimes(1);
  });

  it('keeps it down until the last of several queued announcements ends', () => {
    const d = createDucker(native);
    d.begin();
    d.begin();
    expect(native.duck).toHaveBeenCalledTimes(1);
    d.end();
    expect(native.unduck).not.toHaveBeenCalled();
    d.end();
    expect(native.unduck).toHaveBeenCalledTimes(1);
  });

  it('brings the music back even if the phone never says the voice finished', () => {
    const d = createDucker(native);
    d.begin();
    vi.advanceTimersByTime(LONGEST_ANNOUNCEMENT_MS);
    expect(native.unduck).toHaveBeenCalledTimes(1);
    d.end(); // a late "finished" changes nothing
    expect(native.unduck).toHaveBeenCalledTimes(1);
  });

  it('still speaks when the phone has no ducking (web, Expo Go) or refuses it', () => {
    expect(() => {
      const none = createDucker(null);
      none.begin();
      none.end();
      const broken = createDucker({ duck: () => { throw new Error('no'); }, unduck: () => { throw new Error('no'); } });
      broken.begin();
      broken.end();
    }).not.toThrow();
  });
});
