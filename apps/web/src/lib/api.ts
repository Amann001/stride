import type { ActivityDetail, ActivitySummary, AuthResponse, User } from "@repo/shared";

// Same API calls as the mobile app, for the browser.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request<User>("/me"),
  listActivities: () => request<ActivitySummary[]>("/activities"),
  getActivity: (id: string) => request<ActivityDetail>(`/activities/${id}`),
  deleteActivity: (id: string) => request<void>(`/activities/${id}`, { method: "DELETE" }),
};
