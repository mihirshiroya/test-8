import { API_ORIGIN } from "../lib/api-origin";

export interface RefreshResult {
  ok: boolean;
  /** HTTP status of the refresh call, or 0 for a network failure. */
  status: number;
}

let inFlight: Promise<RefreshResult> | null = null;

/**
 * Refreshes the access-token cookie.
 *
 * The backend rotates the refresh token on every call, so two parallel
 * refreshes (e.g. axios + the task store both hitting a 401) would make the
 * second one fail and log the user out. Every caller shares one in-flight
 * request instead.
 */
export function refreshSession(): Promise<RefreshResult> {
  if (!inFlight) {
    inFlight = fetch(`${API_ORIGIN}/api/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        return {
          ok: response.ok && payload?.success !== false,
          status: response.status,
        };
      })
      .catch(() => ({ ok: false, status: 0 }))
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

/** True when the refresh failed because the session is gone (not a network blip). */
export const isSessionRejected = (result: RefreshResult) =>
  !result.ok && result.status >= 400 && result.status < 500;
