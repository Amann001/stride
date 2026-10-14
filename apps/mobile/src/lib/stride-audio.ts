import { requireOptionalNativeModule } from 'expo';

// The app's own small native module (modules/stride-audio). It is missing in Expo Go, on the
// web and in app builds before 1.3.0, so every caller must cope with null.
export type StrideAudio = {
  duck(): boolean;
  unduck(): boolean;
  // Android only.
  openApp?(packageName: string): boolean;
  openMusicPicker?(): boolean;
};

export const strideAudio = requireOptionalNativeModule<StrideAudio>('StrideAudio');
