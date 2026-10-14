import * as Speech from 'expo-speech';

import { strideAudio, type StrideAudio } from '@/lib/stride-audio';

// The longest an announcement can take. If the phone never says it finished, the music
// comes back up after this anyway.
export const LONGEST_ANNOUNCEMENT_MS = 20_000;

// Keeps other apps' music lowered while any announcement is playing, and brings it back up
// once the last one ends. Announcements can queue up (e.g. a split right after "Resumed").
export function createDucker(native: Pick<StrideAudio, 'duck' | 'unduck'> | null) {
  let speaking = 0;
  let safety: ReturnType<typeof setTimeout> | undefined;
  const call = (fn: 'duck' | 'unduck') => {
    try {
      native?.[fn]();
    } catch {
      // Ducking is a nicety: if the phone refuses, the voice still speaks.
    }
  };
  const release = () => {
    clearTimeout(safety);
    speaking = 0;
    call('unduck');
  };
  return {
    begin() {
      if (speaking === 0) call('duck');
      speaking += 1;
      clearTimeout(safety);
      safety = setTimeout(release, LONGEST_ANNOUNCEMENT_MS);
    },
    end() {
      if (speaking === 0) return;
      speaking -= 1;
      if (speaking === 0) release();
    },
  };
}

const ducker = createDucker(strideAudio);

// Says something out loud, turning the runner's music down while it speaks.
export function speak(text: string) {
  ducker.begin();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    ducker.end();
  };
  Speech.speak(text, { onDone: finish, onStopped: finish, onError: finish });
}
