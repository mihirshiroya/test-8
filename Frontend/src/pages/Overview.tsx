import { useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"

import type { ComparisonMode } from "../components/Ui/analytics-data"
import { useAppDispatch, useAppSelector } from "../store"
import { fetchOverview, selectOverview } from "../store/slices/analyticsSlice"
import { selectTasks } from "../store/slices/taskSlice"

import { CustomSelect, type SelectOption } from "../components/Ui/custom-select"

import { StatCard } from "../components/Ui/stat-card"
import { TrendChart } from "../components/Ui/trend-chart"
import { WeeklyHeatmap } from "../components/Ui/weekly-heatmap"
import { DailyHeatmap } from "../components/Ui/daily-heatmap"
import { TodaysTasks } from "../components/Ui/todays-tasks"
import { RecentActivity } from "../components/Ui/recent-activity"
import { PixelDivider } from "../components/Ui/pixel-divider"

import {
  ChartSkeleton,
  HeatmapSkeleton,
  ListSkeleton,
  StatCardSkeleton,
} from "../components/Ui/skeletons"

const POLL_MS = 60_000
const TASK_CHANGE_DEBOUNCE_MS = 800

const MODE_OPTIONS: SelectOption<ComparisonMode>[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
]

function getGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  if (hour < 21) return `Good evening, ${name}`
  return `Good night, ${name}`
}

export default function Overview() {
  const dispatch = useAppDispatch()
  const { data, status, error } = useAppSelector(selectOverview)
  const user = useAppSelector((s) => s.auth.user)
  const tasks = useSelector(selectTasks)

  const [mode, setMode] = useState<ComparisonMode>("today")

  // Re-fetch whenever a task is created, moved, started, held or completed.
  const tasksSignature = useMemo(
    () => tasks.map((t) => `${t.id}:${t.status}:${t.completedAt ?? ""}:${t.actualDurationSeconds}`).join("|"),
    [tasks],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch(fetchOverview())
    }, data ? TASK_CHANGE_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, tasksSignature])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchOverview())
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [dispatch])

  const loading = !data

  return (
    <div className="workspace-overview">
      <div className="flex w-full flex-col gap-[clamp(1rem,3vw,1.75rem)]">
        <header className="workspace-overview-header flex w-full flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="workspace-eyebrow">Your workspace at a glance</p>
            <h1 className="text-heading-3 text-primary text-balance !font-inter">
              {getGreeting(user?.firstName || "there")}
            </h1>
            <p className="workspace-subtitle">A clear view of your focus, tasks, and progress.</p>
          </div>

          <div className="flex items-center gap-2">
          

            <span id="overview-range-label" className="sr-only">
              Time range
            </span>
            <div className="w-[140px]">
              <CustomSelect
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
                labelId="overview-range-label"
                className="bg-canvas font-medium text-primary"
              />
            </div>
          </div>
        </header>
        <PixelDivider />

        {status === "failed" && !data && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border border-soft p-4 text-sm text-primary"
          >
            <span>{error ?? "Could not load your dashboard."}</span>
            <button
              type="button"
              onClick={() => dispatch(fetchOverview())}
              className="border border-soft px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}

        <section
          aria-label="Key metrics"
          className="dashboard-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : data.metrics.map((metric, index) => (
                <StatCard key={metric.key} metric={metric} mode={mode} index={index} />
              ))}
        </section>
        <PixelDivider />

        <section className="dashboard-row grid grid-cols-1 items-stretch lg:grid-cols-3">
          <div className="dashboard-divided-block flex min-h-0 lg:col-span-2">
            <PixelDivider orientation="vertical" />
            <div className="h-full w-full">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <TrendChart mode={mode} weekSeries={data.weekSeries} daySeries={data.daySeries} />
              )}
            </div>
          </div>

          <div className="flex min-h-0 lg:col-span-1">
            <div className="h-full w-full">
              <TodaysTasks />
            </div>
          </div>
        </section>
        <PixelDivider />

        <section className="dashboard-row grid grid-cols-1 lg:grid-cols-3">
          <div className="dashboard-divided-block lg:col-span-1">
            <PixelDivider orientation="vertical" />
            {loading ? <ListSkeleton rows={6} /> : <RecentActivity items={data.activity} />}
          </div>

          <div className="lg:col-span-2">
            {loading ? (
              <HeatmapSkeleton />
            ) : mode === "today" ? (
              <DailyHeatmap cells={data.hourlyHeatmap} generatedAt={data.generatedAt} />
            ) : (
              <WeeklyHeatmap cells={data.heatmap} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
