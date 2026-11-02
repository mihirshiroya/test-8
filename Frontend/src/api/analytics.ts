import api from "./config"
import type {
  AnalyticsData,
  ProfileAnalytics,
  SessionDay,
} from "../components/Ui/analytics-data"

const tz = () => new Date().getTimezoneOffset()

export const analyticsApi = {
  async getOverview(): Promise<AnalyticsData> {
    const { data } = await api.get("/analytics/overview", {
      params: { tz: tz() },
    })
    return data.data
  },

  async getSessions(date: string): Promise<SessionDay> {
    const { data } = await api.get("/analytics/sessions", {
      params: { date, tz: tz() },
    })
    return data.data
  },

  async getProfile(month?: string): Promise<ProfileAnalytics> {
    const { data } = await api.get("/analytics/profile", {
      params: { tz: tz(), ...(month ? { month } : {}) },
    })
    return data.data
  },
}
