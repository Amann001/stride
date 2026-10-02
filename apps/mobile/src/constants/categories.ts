import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ActivityType } from '@repo/shared';
import type { ComponentProps } from 'react';

// How each kind of activity looks in the app. What each one measures lives in
// CATEGORIES in @repo/shared, so the API and website agree on it.

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface CategoryLook {
  icon: IconName;
  // A fill color. Always put dark (INK) text or icons on top of it.
  color: string;
  // One line on the Record screen saying what this mode gives you.
  tagline: string;
}

// How sports are grouped in the sport picker.
export const SPORT_GROUPS: { title: string; types: ActivityType[] }[] = [
  { title: 'Foot Sports', types: ['run', 'walk', 'hike'] },
  { title: 'Cycle Sports', types: ['ride'] },
];

export const CATEGORY_LOOKS: Record<ActivityType, CategoryLook> = {
  run: { icon: 'run', color: '#C8F31D', tagline: 'Pace, km splits and PRs' },
  ride: { icon: 'bike', color: '#38BDF8', tagline: 'Live speed and top speed' },
  walk: { icon: 'walk', color: '#FBBF24', tagline: 'Steps and distance' },
  hike: { icon: 'hiking', color: '#FB923C', tagline: 'Climb and altitude' },
};
