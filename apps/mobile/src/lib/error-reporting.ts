import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from './api';

// Sends crashes and errors to Stride's server so they can be fixed. Only what went wrong and
// where (message, stack, screen, app version, iPhone/Android): no account, location or content.

const MAX_PER_SESSION = 20;
let sent = 0;

export function reportError(error: unknown, extra: { screen?: string; fatal?: boolean } = {}) {
  if (__DEV__ || sent >= MAX_PER_SESSION) return;
  sent++;
  const e = error instanceof Error ? error : new Error(String(error));
  api
    .reportError({
      message: `${e.name}: ${e.message}`.slice(0, 2000),
      stack: e.stack?.slice(0, 8000),
      context: {
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? undefined,
        ...extra,
      },
    })
    .catch(() => {});
}

// Catches errors that escape everything else (the app would otherwise just close).
type GlobalHandler = (error: Error, isFatal?: boolean) => void;
declare const ErrorUtils: { getGlobalHandler(): GlobalHandler; setGlobalHandler(h: GlobalHandler): void } | undefined;

let installed = false;
export function installErrorReporting() {
  if (installed || typeof ErrorUtils === 'undefined') return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: !!isFatal });
    previous(error, isFatal);
  });
}
