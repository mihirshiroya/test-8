import { useEffect, useMemo, useRef, useState } from 'react'

import { AchievementsSection, ProfileHeader, ProfileProjects, getAchievements } from './profile/profile-section'

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UserRound,
} from 'lucide-react'
import {
  AppDialog,
  AppDialogButton,
  AppDialogSection,
  appDialogInputClass,
} from '../components/Ui/app-dialog'

import {
  formatMinutes,
  localDayKey,
} from '../components/Ui/analytics-data'

import { ActivityHeatmap } from '../components/Ui/activity-heatmap'
import { GRAIN_TEXTURE } from '../components/Ui/trend-chart'
import { HeatmapSkeleton } from '../components/Ui/skeletons'
import { PixelShape } from '../components/Ui/pixel-shape'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/Ui/empty'
import { ThemedSvg } from '../lib/svg-theme'
import checklistRaw from '../assets/02-checklist.svg?raw'
import focusRaw from '../assets/03-focus.svg?raw'
import { getProductivityShape } from '../lib/productivity-shapes'
import { useAppDispatch, useAppSelector } from '../store'
import {
  type MonthlyFocus,
  type MonthlyProductivity,
  fetchFocusMonth,
  fetchProductivityMonth,
  fetchProfileAnalytics,
  selectFocusMonth,
  selectProductivityMonth,
  selectProfileAnalytics,
} from '../store/slices/analyticsSlice'
import { updateUser } from '../store/slices/authSlice'
import { authApi } from '../api/auth'
import type { User } from '../types'

/* -------------------------------------------------------------------------- */
/*  Design tokens (light, soft-card style)                                    */
/* -------------------------------------------------------------------------- */

/*  page bg     #f4f4fb      card        #ffffff     border   #e8e8f3          */
/*  ink         #14142b      muted       #6b6b84     faint    #9a9ab0          */
/*  accent      #6d4aff      accent-soft #efeaff     chip bg  #f0f0f7          */

/* --------------------------------- utils ---------------------------------- */

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const parseDay = (key: string) => new Date(`${key}T00:00:00`)
const fmtDay = (key: string) =>
  parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtSeconds = (seconds: number) => formatMinutes(Math.round(seconds / 60))

const shiftMonth = (month: string, dir: 1 | -1) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + dir, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

const NAME_PATTERN = /^[a-zA-Z\s]{2,50}$/

/* ----------------------------- shared month UI ----------------------------- */

const monthDayKeys = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const totalDays = new Date(year, monthNumber, 0).getDate()
  return Array.from(
    { length: totalDays },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  )
}

function MonthToggle({
  month,
  loading,
  onMonthChange,
}: {
  month: string
  loading: boolean
  onMonthChange: (month: string) => void
}) {
  const currentMonth = localDayKey().slice(0, 7)
  return (
    <div className="flex items-center overflow-hidden border border-soft">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onMonthChange(shiftMonth(month, -1))}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>

      <span className="flex h-8 min-w-[120px] items-center justify-center border-x border-soft px-3 font-inter! text-xs font-medium text-foreground">
        {monthLabel(month)}
      </span>

      <button
        type="button"
        aria-label="Next month"
        onClick={() => onMonthChange(shiftMonth(month, 1))}
        disabled={loading || month >= currentMonth}
        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

function ChartTooltip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="whitespace-nowrap border border-color bg-canvas px-3 py-2 text-caption shadow-[var(--shadow-card)]">
      <div className="text-caption-bold text-primary">{title}</div>
      <div className="mt-1 flex items-center gap-1.5 text-secondary">
        <span className="inline-block h-2 w-2 rounded-full bg-primary" />
        {children}
      </div>
    </div>
  )
}

function MonthAxis({ month }: { month: string }) {
  const keys = monthDayKeys(month)
  return (
    <div className="mt-2 flex justify-between text-[11px] text-[#9a9ab0]">
      <span>{fmtDay(keys[0])}</span>
      <span>{fmtDay(keys[keys.length - 1])}</span>
    </div>
  )
}

/* --------------------------- productivity chart --------------------------- */

function ProductivityCard({
  month,
  monthly: loadedMonthly,
  loading,
  onMonthChange,
}: {
  month: string
  monthly: MonthlyProductivity | null
  loading: boolean
  onMonthChange: (month: string) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  const monthly = loadedMonthly?.month === month ? loadedMonthly : null
  const days = useMemo(() => monthly?.days ?? [], [monthly])

  const allDays = useMemo(() => {
    const daysMap = new Map(days.map((day) => [day.date.slice(0, 10), day]))
    return monthDayKeys(month).map(
      (date) => daysMap.get(date) ?? { date, completed: 0, focusMinutes: 0 },
    )
  }, [days, month])

  const max = Math.max(1, ...allDays.map((day) => day.completed))

  return (
    <section className="border border-soft p-5 sm:p-6" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading-5 text-primary">Daily productivity</h3>
          <p className="mt-1 text-body-sm text-steel !font-semibold !font-inter">
            {monthly ? `${monthly.avgTasksPerDay} tasks/day` : '—'}
          </p>
        </div>
        <MonthToggle month={month} loading={loading} onMonthChange={onMonthChange} />
      </div>

      {!loading && monthly && monthly.totalCompleted === 0 ? (
        <Empty size="md" className="mt-6 min-h-52 sm:min-h-64 lg:min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="illustration">
              <ThemedSvg raw={checklistRaw} ariaLabel="No completed tasks" />
            </EmptyMedia>
            <EmptyTitle>No tasks completed in {monthLabel(month)}</EmptyTitle>
            <EmptyDescription className="text-steel">
              Finish a task and your daily progress will start stacking up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
      <div
        className={`relative mt-6 flex h-52 items-end gap-[3px] transition-opacity sm:h-64 lg:h-72 ${
          loading ? 'opacity-40' : ''
        }`}
        role="img"
        aria-label={`${monthly?.totalCompleted ?? 0} tasks completed in ${monthLabel(month)}`}
      >
        {loading && days.length === 0 ? (
          <p className="m-auto text-sm text-[#6b6b84]">Loading…</p>
        ) : (
          allDays.map((d, i) => {
            const active = hover === i
            return (
              <div
                key={d.date}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {d.completed > 0 ? (
                  <div
                    className={`relative w-full max-w-8 overflow-hidden rounded-t-[5px] bg-primary transition-all duration-500 ${
                      active ? 'opacity-100 brightness-110 shadow-md' : 'opacity-95'
                    }`}
                    style={{ height: `${Math.max(4, (d.completed / max) * 100)}%` }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-60 contrast-125"
                      style={{ backgroundImage: GRAIN_TEXTURE }}
                    />
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-white/40" />
                  </div>
                ) : (
                  <div className="h-1 w-full max-w-8 rounded-t-[5px] bg-surface" />
                )}

                {active && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2">
                    <ChartTooltip title={fmtDay(d.date)}>
                      {d.completed} {d.completed === 1 ? 'task' : 'tasks'} ·{' '}
                      {formatMinutes(d.focusMinutes)}
                    </ChartTooltip>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      )}

      <MonthAxis month={month} />
    </section>
  )
}

/* ------------------------------- focus chart ------------------------------- */

function FocusTimeCard({
  month,
  focus: loadedFocus,
  loading,
  failed,
  onMonthChange,
}: {
  month: string
  focus: MonthlyFocus | null
  loading: boolean
  failed: boolean
  onMonthChange: (month: string) => void
}) {
  const W = 700
  const H = 220
  const PT = 18
  const PB = 30
  const PX = 10
  const ref = useRef<SVGSVGElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const focus = loadedFocus?.month === month ? loadedFocus : null
  const today = localDayKey()
  const allKeys = monthDayKeys(month)
  const minutesByDay = new Map((focus?.days ?? []).map((d) => [d.date.slice(0, 10), d.minutes]))
  const data = allKeys
    .filter((date) => date <= today)
    .map((date) => ({ date, minutes: minutesByDay.get(date) ?? 0 }))

  const max = Math.max(1, ...data.map((d) => d.minutes)) * 1.15
  const stepX = allKeys.length > 1 ? (W - PX * 2) / (allKeys.length - 1) : 0
  const pts = data.map((d, i) => ({
    ...d,
    x: PX + i * stepX,
    y: PT + (1 - d.minutes / max) * (H - PT - PB),
  }))
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const area =
    pts.length > 1
      ? `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - PB} L${pts[0].x.toFixed(1)} ${H - PB} Z`
      : ''

  return (
    <section className="border border-soft p-5 sm:p-6" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading-5 text-primary">Focus time</h3>
          <p className="mt-1 text-body-sm text-steel !font-semibold !font-inter">
            {focus
              ? `${formatMinutes(focus.avgMinutesPerDay)}/day · ${formatMinutes(focus.totalMinutes)} total`
              : '—'}
          </p>
        </div>
        <MonthToggle month={month} loading={loading} onMonthChange={onMonthChange} />
      </div>

      <div className={`relative mt-4 transition-opacity ${loading ? 'opacity-40' : ''}`}>
        {!loading && !failed && (!focus || focus.totalMinutes === 0) ? (
          <Empty size="md">
            <EmptyHeader>
              <EmptyMedia variant="illustration">
                <ThemedSvg raw={focusRaw} ariaLabel="No focus time" />
              </EmptyMedia>
              <EmptyTitle>No focus time in {monthLabel(month)}</EmptyTitle>
              <EmptyDescription className="text-steel">
                Start a focus session and your daily focus trend will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : focus && pts.length > 0 ? (
          <svg
            ref={ref}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Focus time in ${monthLabel(month)}: ${formatMinutes(focus.totalMinutes)} total`}
            onMouseMove={(e) => {
              const rect = ref.current?.getBoundingClientRect()
              if (!rect || stepX === 0) return
              const x = ((e.clientX - rect.left) / rect.width) * W
              const idx = Math.round((x - PX) / stepX)
              setHover(Math.max(0, Math.min(pts.length - 1, idx)))
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d4aff" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#6d4aff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PX}
                x2={W - PX}
                y1={PT + f * (H - PT - PB)}
                y2={PT + f * (H - PT - PB)}
                stroke="rgba(20,20,43,0.08)"
                strokeDasharray="3 5"
              />
            ))}
            {area && <path d={area} fill="url(#focusFill)" />}
            <path
              d={line}
              fill="none"
              stroke="#6d4aff"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.length === 1 && hover === null && (
              <circle cx={pts[0].x} cy={pts[0].y} r="4" fill="#6d4aff" />
            )}
            {hover !== null && pts[hover] && (
              <g>
                <line
                  x1={pts[hover].x}
                  x2={pts[hover].x}
                  y1={PT}
                  y2={H - PB}
                  stroke="rgba(20,20,43,0.15)"
                />
                <circle
                  cx={pts[hover].x}
                  cy={pts[hover].y}
                  r="5"
                  fill="#6d4aff"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>
        ) : (
          <div className="grid h-40 place-items-center text-sm text-[#6b6b84]">
            {failed ? (
              <button
                type="button"
                onClick={() => onMonthChange(month)}
                className="border border-soft px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Couldn&apos;t load focus time. Try again
              </button>
            ) : (
              'Loading…'
            )}
          </div>
        )}

        {hover !== null && pts[hover] && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(pts[hover].x / W) * 100}%`,
              top: `${(pts[hover].y / H) * 100 - 2}%`,
            }}
          >
            <ChartTooltip title={fmtDay(pts[hover].date)}>
              {formatMinutes(pts[hover].minutes)} focused
            </ChartTooltip>
          </div>
        )}
      </div>

      <MonthAxis month={month} />
    </section>
  )
}

/* ------------------------------- edit modal (unchanged) ------------------------------- */

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: User
  onClose: () => void
  onSaved: (user: User) => void
}) {
  const [draft, setDraft] = useState({ firstName: user.firstName, lastName: user.lastName })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  const valid = NAME_PATTERN.test(firstName) && NAME_PATTERN.test(lastName)
  const unchanged = firstName === user.firstName && lastName === user.lastName

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    if (unchanged) return onClose()
    setSaving(true)
    setError(null)
    try {
      const res = await authApi.updateProfile({ firstName, lastName })
      onSaved(res.data?.user ?? { ...user, firstName, lastName })
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: { msg: string }[] } } }
      setError(e.response?.data?.errors?.[0]?.msg ?? e.response?.data?.message ?? 'Could not save profile')
      setSaving(false)
    }
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      onSubmit={save}
      dismissible={!saving}
      title="Edit profile"
      footer={
        <>
          <AppDialogButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </AppDialogButton>
          <AppDialogButton type="submit" disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </AppDialogButton>
        </>
      }
    >
      <AppDialogSection
        icon={<UserRound />}
        title="Your name"
        description="This is how you appear across the app."
        htmlFor="profile-first-name"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            id="profile-first-name"
            aria-label="First name"
            autoFocus
            autoComplete="given-name"
            value={draft.firstName}
            maxLength={50}
            onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            placeholder="First name"
            className={appDialogInputClass}
          />
          <input
            aria-label="Last name"
            autoComplete="family-name"
            value={draft.lastName}
            maxLength={50}
            onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
            placeholder="Last name"
            className={appDialogInputClass}
          />
        </div>

        <p className="mt-3 text-xs text-steel">
          {error ? (
            <span role="alert" className="text-rose-600">
              {error}
            </span>
          ) : (
            '2–50 characters, letters and spaces only.'
          )}
        </p>
      </AppDialogSection>
    </AppDialog>
  )
}

/* --------------------------------- main page ------------------------------- */

export default function ProductivityProfile() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const { data, status, error } = useAppSelector(selectProfileAnalytics)
  const productivity = useAppSelector(selectProductivityMonth)
  const focus = useAppSelector(selectFocusMonth)
  const [editOpen, setEditOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    dispatch(fetchProfileAnalytics(undefined))
  }, [dispatch])

  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 2200)
    return () => window.clearTimeout(t)
  }, [saved])

  const { current } = getAchievements(data)

  const stats = useMemo(() => {
    const s = data?.stats
    return [
      {
        label: 'Tasks completed',
        value: s ? fmt(s.totalCompleted) : '—',
        hint: undefined as string | undefined,
        shape: 'tasks',
      },
      {
        label: 'Best productivity day',
        value: s ? `${s.bestDay?.count ?? 0} tasks` : '—',
        hint: s?.bestDay ? fmtDay(s.bestDay.date) : undefined,
        shape: 'goals',
      },
      {
        label: 'Longest focus session',
        value: s ? fmtSeconds(s.longestSessionSeconds) : '—',
        shape: 'focus',
      },
      {
        label: 'Completion streak',
        value: s
          ? `${s.currentStreak} ${s.currentStreak === 1 ? 'day' : 'days'}`
          : '—',
        hint:
          s && s.longestStreak > 0
            ? `Best: ${s.longestStreak} days`
            : undefined,
        shape: 'streaks',
      },
    ]
  }, [data])

  const loading = status === 'loading'

  return (
    <main className="min-h-screen bg-background pb-12">
      <div className="mx-auto">
        

        <ProfileHeader user={user} current={current} onEdit={() => setEditOpen(true)} />

        {status === 'failed' && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <span>{error ?? 'Could not load your profile analytics.'}</span>
            <button
              type="button"
              onClick={() => dispatch(fetchProfileAnalytics(undefined))}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-rose-100"
            >
              Try again
            </button>
          </div>
        )}

        <section
  aria-label="Productivity statistics"
  className="my-5 grid grid-cols-1 gap-y-5 border border-soft py-[18px] sm:grid-cols-2 lg:grid-cols-4"
>
  {stats.map((s, i) => (
    <div
  key={s.label}
  className={`relative px-5  space-y-4 ${
    i < stats.length - 1
      ? "lg:after:absolute  lg:after:right-0 lg:after:-top-[18px] lg:after:-bottom-[18px] lg:after:w-px lg:after:bg-[var(--color-border-soft)]"
      : ""
  }`}
>
      <div className="flex items-center justify-between gap-3 text-primary">
        <span className="text-lg font-semibold">{s.label}</span>
        {(() => {
          const glyph = getProductivityShape(s.shape)
          return (
            <span
              className="flex shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              <PixelShape
                rows={glyph.rows}
                color={glyph.color}
                cell={3}
                animation="flicker"
              />
            </span>
          )
        })()}
      </div>

      <p className="font-inter! text-xl font-semibold tracking-[-0.7px]">
        {s.value}
      </p>

      <p className=" min-h-3.5 font-inter! text-[9px] font-semibold text-steel -mt-2">
        {s.hint ??
          (s.label === 'Tasks completed'
            ? 'One task at a time'
            : 'Time well invested')}
      </p>
    </div>
  ))}
</section>

        <AchievementsSection data={data} />

        <ProfileProjects projects={data?.projects ?? null} />

        <section aria-label="Activity and focus insights" className="mt-8 flex flex-col gap-5">
          <div className="w-full min-w-0 overflow-x-auto">
            {data ? <ActivityHeatmap cells={data.heatmap} /> : <HeatmapSkeleton />}
          </div>
          <ProductivityCard
            month={productivity.month}
            monthly={productivity.data}
            loading={productivity.status === 'loading' || (loading && !productivity.data)}
            onMonthChange={(m) => dispatch(fetchProductivityMonth(m))}
          />
          <FocusTimeCard
            month={focus.month}
            focus={focus.data}
            loading={focus.status === 'loading' || (loading && !focus.data)}
            failed={focus.status === 'failed' || (status === 'failed' && !focus.data)}
            onMonthChange={(m) => dispatch(fetchFocusMonth(m))}
          />
        </section>


      </div>

      {editOpen && user && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            dispatch(updateUser(updated))
            setEditOpen(false)
            setSaved(true)
          }}
        />
      )}

      {saved && (
        <div
          role="status"
          className="fixed bottom-5 right-5 flex items-center gap-2 rounded-xl bg-[#14142b] px-4 py-3 text-sm text-white shadow-lg"
        >
          <Check className="size-4 text-emerald-400" />
          Profile saved
        </div>
      )}
    </main>
  )
}
