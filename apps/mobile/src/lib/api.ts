import type {
  ActivityDetail,
  ActivitySummary,
  ActivityType,
  AuthResponse,
  ChallengesResponse,
  CreateActivityInput,
  ManualActivityInput,
  User,
  UserStats,
} from '@repo/shared';
import Constants from 'expo-constants';

// Works out where the API lives. In development the phone loads the app from your
// computer, so we reuse that computer's address and swap in the API port (4000).
function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000` : 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

// Sent with anything week- or month-based, so "this week" starts on your Monday, not the server's.
const TZ = `tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`;

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<User>('/me'),
  listActivities: () => request<ActivitySummary[]>('/activities'),
  getActivity: (id: string) => request<ActivityDetail>(`/activities/${id}`),
  createActivity: (input: CreateActivityInput) =>
    request<ActivitySummary>('/activities', { method: 'POST', body: input }),
  deleteActivity: (id: string) => request<void>(`/activities/${id}`, { method: 'DELETE' }),
  createManualActivity: (input: ManualActivityInput) =>
    request<ActivitySummary>('/activities/manual', { method: 'POST', body: input }),
  updateProfile: (name: string) => request<User>('/me', { method: 'PATCH', body: { name } }),
  getStats: () => request<UserStats>(`/stats?${TZ}`),
  setWeeklyGoal: (type: ActivityType, targetMeters: number) =>
    request<void>(`/goals/${type}`, { method: 'PUT', body: { targetMeters } }),
  getChallenges: () => request<ChallengesResponse>(`/challenges?${TZ}`),
  joinChallenge: (id: string) => request<void>(`/challenges/${encodeURIComponent(id)}/join?${TZ}`, { method: 'POST' }),
  leaveChallenge: (id: string) => request<void>(`/challenges/${encodeURIComponent(id)}/join`, { method: 'DELETE' }),
};
