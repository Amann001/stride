import type {
  ActivityDetail,
  ActivitySummary,
  ActivityType,
  AthleteProfile,
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
  UpdateActivityInput,
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
