import type { Badges } from '@repo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';

const POLL_MS = 30_000;

// Unread notifications and messages, for the red dots on the Home header. Checks when
// the screen comes into view, then every 30 seconds while it stays open.
export function useBadges(): Badges {
  const [badges, setBadges] = useState<Badges>({ notifications: 0, messages: 0 });
  useFocusEffect(
    useCallback(() => {
      const check = () => api.badges().then(setBadges, () => {});
      check();
      const id = setInterval(check, POLL_MS);
      return () => clearInterval(id);
    }, []),
  );
  return badges;
}
