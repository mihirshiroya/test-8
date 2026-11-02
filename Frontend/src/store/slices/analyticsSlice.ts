import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { analyticsApi } from "../../api/analytics"
import {
  type AnalyticsData,
  type ProfileAnalytics,
  type SessionDay,
  localDayKey,
} from "../../components/Ui/analytics-data"

type Status = "idle" | "loading" | "succeeded" | "failed"

interface Resource<T> {
  data: T | null
  status: Status
  error: string | null
}

export type MonthlyProductivity = ProfileAnalytics["monthly"]
export type MonthlyFocus = NonNullable<ProfileAnalytics["focusMonth"]>

type MonthResource<T> = Resource<T> & { month: string }

export interface AnalyticsState {
  overview: Resource<AnalyticsData>
  sessions: Resource<SessionDay> & { selectedDate: string }
  profile: Resource<ProfileAnalytics> & { month: string | null }
  productivityMonth: MonthResource<MonthlyProductivity>
  focusMonth: MonthResource<MonthlyFocus>
}

const currentMonthKey = () => localDayKey().slice(0, 7)

// Older backends don't send `focusMonth`; rebuild it from the monthly series.
const toFocusMonth = (p: ProfileAnalytics): MonthlyFocus => {
  if (p.focusMonth) return p.focusMonth
  const days = p.monthly.days.map((d) => ({ date: d.date, minutes: d.focusMinutes }))
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  return {
    month: p.monthly.month,
    days,
    totalMinutes,
    avgMinutesPerDay: days.length ? Math.round(totalMinutes / days.length) : 0,
    prevTotalMinutes: 0,
    delta: 0,
  }
}

const emptyResource = <T>(): Resource<T> => ({
  data: null,
  status: "idle",
  error: null,
})

const initialState: AnalyticsState = {
  overview: emptyResource<AnalyticsData>(),
  sessions: { ...emptyResource<SessionDay>(), selectedDate: localDayKey() },
  profile: { ...emptyResource<ProfileAnalytics>(), month: null },
  productivityMonth: { ...emptyResource<MonthlyProductivity>(), month: currentMonthKey() },
  focusMonth: { ...emptyResource<MonthlyFocus>(), month: currentMonthKey() },
}

const errMsg = (e: unknown): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Failed to load analytics"
}

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchOverview = createAsyncThunk<AnalyticsData, void, { rejectValue: string }>(
  "analytics/fetchOverview",
  async (_, { rejectWithValue }) => {
    try {
      return await analyticsApi.getOverview()
    } catch (e) {
      return rejectWithValue(errMsg(e))
    }
  },
)

export const fetchSessions = createAsyncThunk<SessionDay, string, { rejectValue: string }>(
  "analytics/fetchSessions",
  async (date, { rejectWithValue }) => {
    try {
      return await analyticsApi.getSessions(date)
    } catch (e) {
      return rejectWithValue(errMsg(e))
    }
  },
)

export const fetchProfileAnalytics = createAsyncThunk<
  ProfileAnalytics,
  string | undefined,
  { rejectValue: string }
>("analytics/fetchProfile", async (month, { rejectWithValue }) => {
  try {
    return await analyticsApi.getProfile(month)
  } catch (e) {
    return rejectWithValue(errMsg(e))
  }
})

export const fetchProductivityMonth = createAsyncThunk<
  MonthlyProductivity,
  string,
  { rejectValue: string }
>("analytics/fetchProductivityMonth", async (month, { rejectWithValue }) => {
  try {
    return (await analyticsApi.getProfile(month)).monthly
  } catch (e) {
    return rejectWithValue(errMsg(e))
  }
})

export const fetchFocusMonth = createAsyncThunk<MonthlyFocus, string, { rejectValue: string }>(
  "analytics/fetchFocusMonth",
  async (month, { rejectWithValue }) => {
    try {
      return toFocusMonth(await analyticsApi.getProfile(month))
    } catch (e) {
      return rejectWithValue(errMsg(e))
    }
  },
)

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {
    setSessionDate: (state, action: PayloadAction<string>) => {
      state.sessions.selectedDate = action.payload
    },
    setProfileMonth: (state, action: PayloadAction<string>) => {
      state.profile.month = action.payload
    },
    resetAnalytics: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // overview
      .addCase(fetchOverview.pending, (state) => {
        state.overview.status = "loading"
        state.overview.error = null
      })
      .addCase(fetchOverview.fulfilled, (state, action) => {
        state.overview.status = "succeeded"
        state.overview.data = action.payload
      })
      .addCase(fetchOverview.rejected, (state, action) => {
        state.overview.status = "failed"
        state.overview.error = action.payload ?? "Failed to load analytics"
      })

      // sessions
      .addCase(fetchSessions.pending, (state, action) => {
        state.sessions.status = "loading"
        state.sessions.error = null
        state.sessions.selectedDate = action.meta.arg
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        // Ignore stale responses when the user switched dates mid-request.
        if (action.payload.date !== state.sessions.selectedDate) return
        state.sessions.status = "succeeded"
        state.sessions.data = action.payload
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        if (action.meta.arg !== state.sessions.selectedDate) return
        state.sessions.status = "failed"
        state.sessions.error = action.payload ?? "Failed to load sessions"
      })

      // profile
      .addCase(fetchProfileAnalytics.pending, (state, action) => {
        state.profile.status = "loading"
        state.profile.error = null
        if (action.meta.arg) state.profile.month = action.meta.arg
      })
      .addCase(fetchProfileAnalytics.fulfilled, (state, action) => {
        state.profile.status = "succeeded"
        state.profile.data = action.payload
        state.profile.month = action.payload.monthly.month
        // Seed each chart once from the page load; afterwards they fetch on their own.
        if (state.productivityMonth.status === "idle") {
          state.productivityMonth = {
            data: action.payload.monthly,
            status: "succeeded",
            error: null,
            month: action.payload.monthly.month,
          }
        }
        if (state.focusMonth.status === "idle") {
          const focus = toFocusMonth(action.payload)
          state.focusMonth = { data: focus, status: "succeeded", error: null, month: focus.month }
        }
      })
      .addCase(fetchProfileAnalytics.rejected, (state, action) => {
        state.profile.status = "failed"
        state.profile.error = action.payload ?? "Failed to load profile analytics"
      })

      // productivity chart month
      .addCase(fetchProductivityMonth.pending, (state, action) => {
        state.productivityMonth.status = "loading"
        state.productivityMonth.error = null
        state.productivityMonth.month = action.meta.arg
      })
      .addCase(fetchProductivityMonth.fulfilled, (state, action) => {
        if (action.meta.arg !== state.productivityMonth.month) return
        state.productivityMonth.status = "succeeded"
        state.productivityMonth.data = action.payload
      })
      .addCase(fetchProductivityMonth.rejected, (state, action) => {
        if (action.meta.arg !== state.productivityMonth.month) return
        state.productivityMonth.status = "failed"
        state.productivityMonth.error = action.payload ?? "Failed to load productivity"
      })

      // focus chart month
      .addCase(fetchFocusMonth.pending, (state, action) => {
        state.focusMonth.status = "loading"
        state.focusMonth.error = null
        state.focusMonth.month = action.meta.arg
      })
      .addCase(fetchFocusMonth.fulfilled, (state, action) => {
        if (action.meta.arg !== state.focusMonth.month) return
        state.focusMonth.status = "succeeded"
        state.focusMonth.data = action.payload
      })
      .addCase(fetchFocusMonth.rejected, (state, action) => {
        if (action.meta.arg !== state.focusMonth.month) return
        state.focusMonth.status = "failed"
        state.focusMonth.error = action.payload ?? "Failed to load focus time"
      })
  },
})

export const { setSessionDate, setProfileMonth, resetAnalytics } = analyticsSlice.actions
export default analyticsSlice.reducer

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

type WithAnalytics = { analytics: AnalyticsState }

export const selectOverview = (s: WithAnalytics) => s.analytics.overview
export const selectSessions = (s: WithAnalytics) => s.analytics.sessions
export const selectProfileAnalytics = (s: WithAnalytics) => s.analytics.profile
export const selectProductivityMonth = (s: WithAnalytics) => s.analytics.productivityMonth
export const selectFocusMonth = (s: WithAnalytics) => s.analytics.focusMonth
