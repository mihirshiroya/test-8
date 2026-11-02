/**
 * Desktop builds (`vite build --mode desktop`) are served by the local Go
 * backend, so API calls use relative URLs on the same origin and the existing
 * cookie-based auth keeps working without CORS. Web builds keep talking to
 * VITE_API_URL or the default local API on port 5000.
 */
export const IS_DESKTOP = import.meta.env.VITE_DESKTOP === "true"

export const API_ORIGIN: string =
  import.meta.env.VITE_API_URL ?? (IS_DESKTOP ? "" : "http://localhost:5000")

export const API_BASE_URL = `${API_ORIGIN}/api`
