// src/api/config.ts
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { toast, getErrorMessage } from "../lib/toast";
import { store } from "../store";
import { clearAuth } from "../store/slices/authSlice";
import { refreshSession, isSessionRejected } from "./session";
import { API_BASE_URL } from "../lib/api-origin";

const AUTH_ENDPOINTS =
  /\/auth\/(login|register|google|forgot-password|reset-password|refresh-token)/;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Ends the local session after the server rejected the refresh token.
 * Clearing auth lets <ProtectedRoute>/<AdminRoute> redirect to /login through
 * the router, so there is no full page reload (which re-ran every request)
 * and no /login <-> /overview loop from a stale persisted `isAuthenticated`.
 */
const endSession = () => {
  const wasAuthenticated = store.getState().auth.isAuthenticated;
  store.dispatch(clearAuth());

  if (wasAuthenticated) {
    toast.warning("Session expired", {
      description: "Please sign in again to continue.",
    });
  }
};

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const isAuthEndpoint = AUTH_ENDPOINTS.test(originalRequest.url || "");

    // Only try to refresh when we believe there is a session to refresh.
    // Signed-out visitors (e.g. on /login) get the 401 straight away.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      store.getState().auth.isAuthenticated
    ) {
      originalRequest._retry = true;

      const result = await refreshSession();
      if (result.ok) {
        return api(originalRequest);
      }

      if (isSessionRejected(result)) {
        endSession();
      }
      return Promise.reject(error);
    }

    // Normalise the message so every caller (thunks, hooks, pages) reads a
    // friendly, specific string from error.response.data.message.
    const friendly = getErrorMessage(error);
    if (!error.response) {
      error.response = { data: { message: friendly } };
    } else if (typeof error.response.data !== "object" || error.response.data === null) {
      error.response.data = { message: friendly };
    } else if (!error.response.data.message) {
      error.response.data.message = friendly;
    }

    // Auth form errors are shown by the form itself with a clearer title;
    // 401s elsewhere are handled by the refresh flow above.
    const isSilent = error.response?.status === 401 || isAuthEndpoint;
    if (!isSilent) {
      toast.error(error.response?.status ? "Request failed" : "Connection problem", {
        description: friendly,
      });
    }

    return Promise.reject(error);
  }
);

export default api;
