import { useColorScheme } from 'react-native';

// All app colors in one place, for light and dark mode.
//
// The layout follows Strava's: flat, full-width sections on the page colour, divided by
// thin bands (`separator`). Only small things inside a section, like the achievement
// banner, a challenge card or a text box, sit on a slightly lighter `raised` colour.

// Stride brand: electric lime on black.
export const LIME = '#C8F31D';
export const INK = '#121212';

const light = {
  // Lime fills (buttons, chips). Always put `onBrand` text on top of them.
  brand: LIME,
  onBrand: INK,
  // Lime is too light for text on white, so text and links use a deep olive in light mode.
  accent: '#4D6B00',
  text: '#121212',
  textSecondary: '#6E6E73',
  // The page, and full-width sections on it.
  background: '#FFFFFF',
  card: '#FFFFFF',
  // Small cards and text boxes inside a section.
  raised: '#F2F2F4',
  // The bands between sections.
  separator: '#EDEDF0',
  border: '#E4E4E7',
  danger: '#DC2626',
};

// Measured from Strava's dark theme.
const dark: typeof light = {
  brand: LIME,
  onBrand: INK,
  accent: LIME,
  text: '#FFFFFF',
  textSecondary: '#9E9EA3',
  background: '#121212',
  card: '#121212',
  raised: '#262626',
  separator: '#000000',
  border: '#2C2C2E',
  danger: '#F87171',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
