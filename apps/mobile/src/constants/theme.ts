import { useColorScheme } from 'react-native';

// All app colors in one place, for light and dark mode.

// Stride brand: electric lime on black.
export const LIME = '#C8F31D';
export const INK = '#121212';

const light = {
  // Lime fills (buttons, chips). Always put `onBrand` text on top of them.
  brand: LIME,
  onBrand: INK,
  // Lime is too light for text on white, so text and links use a deep olive in light mode.
  accent: '#4D6B00',
  text: '#111111',
  textSecondary: '#60646C',
  background: '#F4F4F5',
  card: '#FFFFFF',
  border: '#E4E4E7',
  danger: '#DC2626',
};

const dark: typeof light = {
  brand: LIME,
  onBrand: INK,
  accent: LIME,
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
  background: '#0B0B0C',
  card: '#18181B',
  border: '#27272A',
  danger: '#F87171',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
