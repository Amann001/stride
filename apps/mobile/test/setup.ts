import { vi } from 'vitest';

// The phone's settings module can't load outside a phone; tests pretend it's an Indian phone.
vi.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Asia/Kolkata' }] }));
