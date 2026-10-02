import type { RouteSummary } from '@repo/shared';
import { useSyncExternalStore } from 'react';

import { api } from '@/lib/api';

// Routes the app is holding in memory:
// - suggested routes (made up on the server, not saved anywhere), so the route screen can
//   show one by id;
// - the "active" route you chose to follow on the Record screen.

const known = new Map<string, RouteSummary>();
let active: RouteSummary | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberRoutes(routes: RouteSummary[]) {
  for (const r of routes) known.set(r.id, r);
}

export function findRoute(id: string): RouteSummary | undefined {
  return known.get(id);
}

// Suggested route id -> the saved copy's id, so bookmarks stay filled in everywhere.
let savedCopies: Record<string, string> = {};

export function markSaved(routeId: string, savedId: string | null) {
  const next = { ...savedCopies };
  if (savedId) next[routeId] = savedId;
  else delete next[routeId];
  savedCopies = next;
  emit();
}

export function useSavedCopies(): Record<string, string> {
  return useSyncExternalStore(subscribe, () => savedCopies);
}

// Saves a route (or removes the saved copy). Returns the saved copy's id, or null.
export async function toggleSaved(route: RouteSummary, savedId: string | undefined): Promise<string | null> {
  if (savedId || route.source === 'saved') {
    await api.deleteRoute(savedId ?? route.id);
    markSaved(route.id, null);
    return null;
  }
  const saved = await api.saveRoute({ name: route.name, sport: route.sport, polyline: route.polyline });
  rememberRoutes([saved]);
  markSaved(route.id, saved.id);
  return saved.id;
}

export function setActiveRoute(route: RouteSummary | null) {
  active = route;
  emit();
}

// The route to follow while recording, or null.
export function useActiveRoute(): RouteSummary | null {
  return useSyncExternalStore(subscribe, () => active);
}
