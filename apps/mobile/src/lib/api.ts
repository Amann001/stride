import type {
  ActivityDetail,
  ActivitySummary,
  ActivityType,
  AthleteProfile,
  AthleteRef,
  AthleteSummary,
  AuthResponse,
  Badges,
  ChallengesResponse,
  Club,
  ClubDetail,
  Comment,
  Conversation,
  CreateClubInput,
  Message,
  Notification,
  CreateActivityInput,
  HeatmapKind,
  ManualActivityInput,
  PlannedRoute,
  PlanRouteInput,
  RouteSummary,
  SaveRouteInput,
  SuggestRoutesInput,
  ErrorReportInput,
  ReportInput,
  UpdateActivityInput,
  User,
  UserStats,
} from '@repo/shared';

import Constants from 'expo-constants';

// Works out where the API lives.
// - Published app (EAS Update / store build): EXPO_PUBLIC_API_URL from .env.production,
//   i.e. the cloud server, so it works anywhere on Wi-Fi or mobile data.
// - Development (`npm run dev:mobile`): the phone loads the app from your computer, so we
//   reuse that computer's address and swap in the API port (4000).
function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000` : 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();

// Public pages served by the server: the privacy policy and terms of use.
export const privacyUrl = () => `${API_URL}/privacy`;
export const termsUrl = () => `${API_URL}/terms`;

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    // HTTP status, or 0 when the server couldn't be reached at all (no signal, timeout).
    public status: number,
  ) {
    super(message);
  }
}

// True when the request never reached the server (offline, timed out), as opposed to the
// server answering with an error. Safe to keep the data and try again later.
export function isConnectionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

// Render's free server sleeps after 15 idle minutes and takes up to a minute to wake, so a
// single attempt gets a generous limit, and reads (GET) quietly try again a couple of times.
const TIMEOUT_MS = 45_000;
const GET_RETRIES = 2;

async function attempt(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(
      timedOut
        ? 'Stride is taking longer than usual to respond. Please try again in a moment.'
        : "Can't reach Stride. Check your internet connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const init: RequestInit = {
    method,
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
  // Only reads are retried automatically: repeating a save could otherwise do it twice.
  const tries = method === 'GET' ? 1 + GET_RETRIES : 1;
  let res: Response | undefined;
  for (let i = 0; i < tries; i++) {
    try {
      res = await attempt(path, init);
      // 502/503/504 = the server is restarting or waking up; worth another go for reads.
      if (i < tries - 1 && res.status >= 502 && res.status <= 504) {
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      break;
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  if (res!.status === 204) return undefined as T;
  const data = await res!.json().catch(() => ({}));
  if (!res!.ok) throw new ApiError(data.error ?? `Something went wrong (${res!.status}). Please try again.`, res!.status);
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
  updateProfile: (input: { name: string; bio?: string; location?: string }) =>
    request<User>('/me', { method: 'PATCH', body: input }),
  getStats: () => request<UserStats>(`/stats?${TZ}`),
  setWeeklyGoal: (type: ActivityType, targetMeters: number) =>
    request<void>(`/goals/${type}`, { method: 'PUT', body: { targetMeters } }),
  getChallenges: () => request<ChallengesResponse>(`/challenges?${TZ}`),
  joinChallenge: (id: string) => request<void>(`/challenges/${encodeURIComponent(id)}/join?${TZ}`, { method: 'POST' }),
  leaveChallenge: (id: string) => request<void>(`/challenges/${encodeURIComponent(id)}/join`, { method: 'DELETE' }),
  updateActivity: (id: string, input: UpdateActivityInput) =>
    request<ActivitySummary>(`/activities/${id}`, { method: 'PATCH', body: input }),

  // Maps and routes
  suggestRoutes: (input: SuggestRoutesInput) => request<RouteSummary[]>('/routes/suggest', { method: 'POST', body: input }),
  planRoute: (input: PlanRouteInput) => request<PlannedRoute>('/routes/plan', { method: 'POST', body: input }),
  saveRoute: (input: SaveRouteInput) => request<RouteSummary>('/routes', { method: 'POST', body: input }),
  listRoutes: () => request<RouteSummary[]>('/routes'),
  getRoute: (id: string) => request<RouteSummary>(`/routes/${id}`),
  deleteRoute: (id: string) => request<void>(`/routes/${id}`, { method: 'DELETE' }),
  nearbyRoutes: (lat: number, lng: number, sport: ActivityType) =>
    request<RouteSummary[]>(`/routes/nearby?lat=${lat}&lng=${lng}&sport=${sport}`),
  heatmapToken: () => request<{ token: string }>('/heatmap/token'),

  // Friends
  feed: (before?: string) => request<ActivitySummary[]>(`/feed${before ? `?before=${encodeURIComponent(before)}` : ''}`),
  searchAthletes: (q: string) => request<AthleteSummary[]>(`/athletes/search?q=${encodeURIComponent(q)}`),
  suggestedAthletes: () => request<AthleteSummary[]>('/athletes/suggested'),
  athlete: (id: string) => request<AthleteProfile>(`/athletes/${id}`),
  athleteActivities: (id: string) => request<ActivitySummary[]>(`/athletes/${id}/activities`),
  connections: (id: string, list: 'followers' | 'following') => request<AthleteSummary[]>(`/athletes/${id}/${list}`),
  follow: (id: string) => request<void>(`/athletes/${id}/follow`, { method: 'POST' }),
  unfollow: (id: string) => request<void>(`/athletes/${id}/follow`, { method: 'DELETE' }),
  followAll: (ids: string[]) => request<void>('/athletes/follow-all', { method: 'POST', body: { ids } }),
  giveKudos: (activityId: string) => request<void>(`/activities/${activityId}/kudos`, { method: 'POST' }),
  removeKudos: (activityId: string) => request<void>(`/activities/${activityId}/kudos`, { method: 'DELETE' }),
  kudosList: (activityId: string) => request<AthleteSummary[]>(`/activities/${activityId}/kudos`),
  comments: (activityId: string) => request<Comment[]>(`/activities/${activityId}/comments`),
  addComment: (activityId: string, body: string) =>
    request<Comment>(`/activities/${activityId}/comments`, { method: 'POST', body: { body } }),
  deleteComment: (id: string) => request<void>(`/comments/${id}`, { method: 'DELETE' }),
  notifications: () => request<Notification[]>('/notifications'),
  markNotificationsRead: () => request<void>('/notifications/read', { method: 'POST' }),
  badges: () => request<Badges>('/badges'),
  conversations: () => request<Conversation[]>('/conversations'),
  startConversation: (athleteId: string) => request<Conversation>('/conversations', { method: 'POST', body: { athleteId } }),
  // Safety and your account.
  blockAthlete: (id: string) => request<void>(`/athletes/${id}/block`, { method: 'POST' }),
  unblockAthlete: (id: string) => request<void>(`/athletes/${id}/block`, { method: 'DELETE' }),
  blockedAthletes: () => request<AthleteRef[]>('/me/blocked'),
  report: (input: ReportInput) => request<{ ok: true }>('/reports', { method: 'POST', body: input }),
  deleteAccount: (password: string) => request<void>('/me', { method: 'DELETE', body: { password } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<AuthResponse>('/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
  startEmailChange: (newEmail: string, password: string) =>
    request<{ ok: true }>('/me/email', { method: 'POST', body: { newEmail, password } }),
  confirmEmailChange: (code: string) => request<AuthResponse>('/me/email/confirm', { method: 'POST', body: { code } }),
  forgotPassword: (email: string) => request<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<AuthResponse>('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } }),
  reportError: (input: ErrorReportInput) => request<void>('/diagnostics/errors', { method: 'POST', body: input }),
  messages: (conversationId: string, after?: string) =>
    request<Message[]>(`/conversations/${conversationId}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`),
  sendMessage: (conversationId: string, body: string) =>
    request<Message>(`/conversations/${conversationId}/messages`, { method: 'POST', body: { body } }),
  markConversationRead: (conversationId: string) => request<void>(`/conversations/${conversationId}/read`, { method: 'POST' }),
  clubs: (q = '', sport?: ActivityType) =>
    request<Club[]>(`/clubs?q=${encodeURIComponent(q)}${sport ? `&sport=${sport}` : ''}`),
  myClubs: () => request<Club[]>('/clubs/mine'),
  club: (id: string) => request<ClubDetail>(`/clubs/${id}`),
  createClub: (input: CreateClubInput) => request<Club>('/clubs', { method: 'POST', body: input }),
  joinClub: (id: string) => request<void>(`/clubs/${id}/join`, { method: 'POST' }),
  leaveClub: (id: string) => request<void>(`/clubs/${id}/join`, { method: 'DELETE' }),
};

// Web address of one heatmap tile layer, in the {z}/{x}/{y} form maps expect.
export function heatmapTileUrl(kind: HeatmapKind, sport: ActivityType | 'all', token: string): string {
  return `${API_URL}/heatmap/${kind}/${sport}/{z}/{x}/{y}.png?token=${encodeURIComponent(token)}`;
}
