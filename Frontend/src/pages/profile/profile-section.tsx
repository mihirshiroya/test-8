import { useMemo, useState } from 'react'

import { Link } from 'react-router-dom'
import david from '../../assets/goggins-banner.png'
import { PixelShape } from '../../components/Ui/pixel-shape'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/Ui/empty'
import { ThemedSvg } from '../../lib/svg-theme'
import checklistRaw from '../../assets/02-checklist.svg?raw'
import celebrationRaw from '../../assets/34-celebration.svg?raw'
import plantingSeedsRaw from '../../assets/35-planting-seeds.svg?raw'
import { ACTIVITY_GLYPHS, ARROW_DOWN, ARROW_UP, CHECK_GLYPH, MOON_GLYPH, OVERVIEW, PALETTE } from '../../lib/consistency'

import {

  Check,

  CheckCheck,

  ChevronDown,

  ChevronRight,

  Clock3,

  Diamond,

  FolderKanban,

  LockKeyhole,

  Pencil,

  Sparkles,

  Trophy,

} from 'lucide-react'

import type { User } from '../../types'

import type { Achievement, ProfileAnalytics, ProjectSummary } from '../../components/Ui/analytics-data'

import { FOLDER_ICONS, type IconKey } from '../../components/Ui/folder-data'
import { FOLDER_TINTS, normalizeTint } from '../../components/Ui/project-data'
import { FunnelChartCard } from '../../components/Ui/funnel-chart'
import { AchievementGem } from '../../components/Ui/achivement-gem'
import { useTaskStore } from '../../store/slices/taskSlice'



/* --------------------------------- shared -------------------------------- */



const eyebrow = 'flex items-center gap-1.5 text-[9px] font-medium tracking-[1.7px]'

const sectionTitle = 'mt-2.5 text-[26px] font-medium leading-[1.35] tracking-[-0.7px]'



function Bar({

  value,

  className = '',

  trackClass,

  fillClass,

  label,

  fillColor,

}: {

  fillColor?: string

  value: number

  className?: string

  trackClass: string

  fillClass: string

  label: string

}) {

  return (

    <div

      role="progressbar"

      aria-label={label}

      aria-valuenow={Math.round(value)}

      aria-valuemin={0}

      aria-valuemax={100}

      className={`h-1 overflow-hidden ${trackClass} ${className} border border-soft`}

    >

      <div className={`h-full transition-[width] duration-500 motion-reduce:transition-none ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: fillColor }} />

    </div>

  )

}



/* ------------------------------ achievements ------------------------------ */



export function getAchievements(data: ProfileAnalytics | null) {

  const heatmapHours = (data?.heatmap.reduce((sum, day) => sum + day.minutes, 0) ?? 0) / 60

  const hours = Math.max(data?.totalFocusHours ?? 0, heatmapHours)

  const achievements = (data?.achievements ?? []).map((tier) => {

    const unlocked = tier.unlocked || hours >= tier.requiredHours

    return {

      ...tier,

      unlocked,

      progress: unlocked ? 100 : Math.max(tier.progress, Math.min(100, Math.round((hours / tier.requiredHours) * 100))),

    }

  })

  const current =

    [...achievements].filter((tier) => tier.unlocked).sort((a, b) => b.requiredHours - a.requiredHours)[0] ??

    null

  return { hours, achievements, current }

}



function Gem({ tier, locked = false }: { tier: Achievement; locked?: boolean }) {

  return (

    <span className="relative isolate mx-auto mt-0.5 mb-1 grid h-[135px] w-full place-items-center" aria-hidden="true">

      <AchievementGem

        color={tier.color}

        icon={tier.icon}

        requiredHours={tier.requiredHours}

        locked={locked}

        size={118}

        className={`transition-transform duration-300 group-hover:-translate-y-[3px] ${

          locked ? '' : 'group-hover:scale-105'

        }`}

      />

      {locked && (

        <span className="absolute z-[2] grid size-8 place-items-center rounded-full border border-soft bg-background/80 backdrop-blur-sm">

          <LockKeyhole size={15} strokeWidth={1.6} className="text-primary" />

        </span>

      )}

    </span>

  )

}



export function ProfileHeader({

  user,

  current,

  onEdit,

}: {

  user: User | null

  current: Achievement | null

  onEdit: () => void

}) {

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  const joined = user?.createdAt

    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    : '—'



  return (

    <header className="overflow-hidden border border-soft bg-background">

      <div className="relative h-[150px] overflow-hidden bg-[#131316] sm:h-[170px]">

        <img
          src={david}
          alt="Illustration of David Goggins running through the rain"
          className="absolute inset-0 size-full object-cover object-[85%_center]"
        />

        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#131316]/95 via-[#131316]/55 to-transparent" />

        <figure className="relative flex h-full max-w-[65%] flex-col justify-center gap-2 px-[26px] pb-8 sm:max-w-[55%]">

          <blockquote className="text-pretty text-[15px] font-bold capitalize leading-[1.15] tracking-tight text-white sm:text-xl">
            {"Don't stop when you're tired. Stop when you're done."}
          </blockquote>

          <figcaption className="flex items-center gap-2 text-[10px] font-semibold capitalize text-[#b9a6ff]">
            <span aria-hidden="true" className="h-px w-5 bg-[#6d4aff]" />
            David Goggins
          </figcaption>

        </figure>

      </div>



      <div className="px-[26px]">

        <div className="relative -mt-[37px] size-[82px] rounded-3xl border-[5px] border-[var(--color-background)] shadow-[var(--color-primary)]">

          {user?.avatar ? (

            <img

              src={user.avatar}

              alt={`${user.firstName} ${user.lastName}`}

              referrerPolicy="no-referrer"

              className="size-full rounded-[19px] object-cover"

            />

          ) : (

            <span className="grid size-full place-items-center rounded-[19px] bg-[#e7ddee] text-[25px] font-semibold text-[#705379]">

              {initials}

            </span>

          )}

          {current && (

            <span

              title={`Current earned badge: ${current.title}`}

              aria-label={`Current earned badge: ${current.title}`}

              className="absolute -right-[9px] -bottom-[3px] grid size-[31px] place-items-center rounded-full border-[3px] border-[var(--color-background)] bg-[#131316]"

              style={{ boxShadow: `0 2px 8px ${current.color}55` }}

            >

              <AchievementGem color={current.color} icon={current.icon} requiredHours={current.requiredHours} size={24} />

            </span>

          )}

        </div>



        <div className="mt-[15px] flex items-center justify-between gap-4 mb-[15px]">

          <div>

            <div className="flex flex-wrap items-center gap-[11px]">

              <h1 className="text-[25px] font-semibold tracking-[-1px] font-inter!">

                {user ? `${user.firstName} ${user.lastName}` : 'Your profile'}

              </h1>

              {current && (

                <span className="inline-flex items-center gap-[5px] rounded-[5px] border border-[#f0dfb9] bg-[#fff6e2] px-[7px] py-1 text-[9px] font-semibold text-[#926817]">

                  <Diamond size={12} /> {current.title}

                </span>

              )}

            </div>

            <p className="mt-[7px] text-[12px] text-steel font-semibold">

              {user?.email ?? 'Your own little corner of progress.'}

              <span className="text-[#9a93a6]"> · Joined {joined}</span>

            </p>

          </div>

          <button

            type="button"

            onClick={onEdit}

            disabled={!user}

            className="flex items-center gap-[7px] border border-soft px-[11px] py-2 text-[11px] font-medium whitespace-nowrap text-primary transition-colors disabled:opacity-55"

          >

            <Pencil size={13} /> Edit profile

          </button>

        </div>



     

      </div>

    </header>

  )

}



const TIER_NAMES = ['Initiate', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Legendary']

const formatHours = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })

export function AchievementsSection({ data }: { data: ProfileAnalytics | null }) {
  const [filter, setFilter] = useState<'All badges' | 'Unlocked' | 'Locked'>('All badges')
  const { hours, achievements, current } = getAchievements(data)
  const unlocked = achievements.filter((tier) => tier.unlocked).length
  const next = achievements.find((tier) => !tier.unlocked)
  const visible = achievements.filter(
    (tier) => filter === 'All badges' || (filter === 'Unlocked' ? tier.unlocked : !tier.unlocked),
  )
  const collectionPct = achievements.length ? Math.round((unlocked / achievements.length) * 100) : 0
  const nextColor = next?.color ?? current?.color ?? 'var(--color-primary)'

  return (
    <section
      aria-labelledby="profile-achievements-title"
      aria-busy={!data}
      className="overflow-hidden border border-soft bg-background px-5 pt-6 pb-5 text-charcoal sm:px-[25px] sm:pt-[27px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="profile-achievements-title" className="text-heading-5 text-charcoal">
            Your focus, crystallized.
          </h3>
          <p className="mt-1 text-body-sm text-steel !font-semibold !font-inter">
            Every hour is a step forward. Every gem tells your story.
          </p>
        </div>

        <div className="flex items-center gap-3 border border-soft px-3 py-2">
          <div
            role="progressbar"
            aria-label="Collection progress"
            aria-valuenow={collectionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative grid size-9 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-primary) ${collectionPct * 3.6}deg, var(--color-border-soft) 0deg)`,
            }}
          >
            <span className="grid size-7 place-items-center rounded-full bg-canvas">
              <Trophy size={13} className="text-primary" aria-hidden="true" />
            </span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tabular-nums text-charcoal font-inter!">
              {data ? unlocked : '—'}
              <span className="text-steel font-normal"> / {achievements.length}</span>
            </p>
            <p className="text-[12px] tracking-wide text-steel">badges unlocked</p>
          </div>
        </div>
      </div>

      <div
        className="relative mt-6 flex flex-col gap-4 overflow-hidden border border-soft bg-canvas p-4 sm:flex-row sm:items-center sm:p-[18px]"
        style={{ backgroundImage: `radial-gradient(120% 140% at 0% 50%, ${mix(nextColor, 12)}, transparent 55%)` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center" aria-hidden="true">
            {next || current ? (
              <AchievementGem
                color={(next ?? current)!.color}
                requiredHours={(next ?? current)!.requiredHours}
                size={56}
              />
            ) : (
              <Sparkles size={22} className="text-primary" />
            )}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold tracking-[1.4px] text-steel">
              {next ? 'YOUR NEXT MILESTONE' : 'COLLECTION COMPLETE'}
            </span>
            <h4 className="truncate text-lg font-bold text-charcoal font-inter!">
              {next ? next.title : 'Legendary focus. Well earned.'}
            </h4>
            <p className="mt-0.5 text-xs text-steel">
              {!data ? (
                'Loading your focus journey…'
              ) : next ? (
                <>
                  <strong className="font-semibold text-charcoal">
                    {formatHours(Math.max(0, next.requiredHours - hours))} more hours
                  </strong>{' '}
                  to unlock your next badge.
                </>
              ) : (
                'You have unlocked every focus milestone.'
              )}
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 sm:w-[210px]">
          <div className="mb-2 flex items-baseline justify-between text-xs tabular-nums text-charcoal">
            <span className="font-semibold">
              {formatHours(Math.floor(hours))}
              <small className="ml-1 text-[10px] font-normal text-steel">
                / {next?.requiredHours ?? Math.floor(hours)} hrs
              </small>
            </span>
            <span className="font-semibold">{Math.min(100, Math.floor(next?.progress ?? 100))}%</span>
          </div>
          <Bar
            value={next?.progress ?? 100}
            label="Next achievement progress"
            className="h-1.5"
            trackClass="bg-background"
            fillClass=""
            fillColor={nextColor}
          />
          <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-steel">
            <Clock3 size={11} aria-hidden="true" /> Total focus time
          </p>
        </div>
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 border border-soft bg-canvas p-1" role="group" aria-label="Filter achievements">
          {(['All badges', 'Unlocked', 'Locked'] as const).map((tab) => {
            const count = tab === 'Unlocked' ? unlocked : tab === 'Locked' ? achievements.length - unlocked : achievements.length
            const active = filter === tab
            return (
              <button
                type="button"
                key={tab}
                aria-pressed={active}
                onClick={() => setFilter(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors font-inter! ${
                  active ? 'bg-primary text-charcoal shadow-sm' : 'text-steel hover:text-charcoal'
                }`}
              >
                {tab}
                <span className={`tabular-nums text-[10px] ${active ? 'text-primary' : 'text-stone'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        <span className="flex items-center gap-2 text-[10px] tracking-[1.6px] text-steel">
          THE COLLECTION <span aria-hidden="true" className="h-px w-6 bg-[var(--color-border-soft)]" />
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((tier) => {
          const index = achievements.indexOf(tier)
          const isCurrent = current?.id === tier.id
          const accent = tier.color

          return (
            <li
              key={tier.id}
              className="group relative flex min-w-0 flex-col overflow-hidden border border-soft px-4 pt-3.5 pb-4 text-center transition-[border-color,transform] duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{
                borderColor: isCurrent ? accent : undefined,
                backgroundImage: tier.unlocked
                  ? `radial-gradient(90% 60% at 50% 38%, ${mix(accent, isCurrent ? 20 : 11)}, transparent 70%)`
                  : '',
              }}
            >
              {tier.unlocked && (
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
              )}

              <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide">
                {isCurrent ? (
                  <span
                    className="px-1.5 py-0.5 text-[9px] tracking-[.7px]"
                    style={{ background: mix(accent, 18), color: accent }}
                  >
                    CURRENT
                  </span>
                ) : (
                  <span className="text-stone tabular-nums">TIER {String(index + 1).padStart(2, '0')}</span>
                )}
                {tier.unlocked ? (
                  <span
                    className="grid size-5 place-items-center rounded-full"
                    style={{ background: mix(accent, 18), color: accent }}
                  >
                    <Check size={11} strokeWidth={3} aria-hidden="true" />
                    <span className="sr-only">Unlocked</span>
                  </span>
                ) : (
                  <span className="grid size-5 place-items-center rounded-full border border-soft text-steel">
                    <LockKeyhole size={10} aria-hidden="true" />
                    <span className="sr-only">Locked</span>
                  </span>
                )}
              </div>

              <Gem tier={tier} locked={!tier.unlocked} />

              <p
                className="text-[10px] font-semibold tracking-[1.2px] uppercase"
                style={{ color: tier.unlocked ? accent : 'var(--color-stone)' }}
              >
                {TIER_NAMES[index] ?? 'Tier'}
              </p>
              <h4 className="mt-0.5 truncate text-sm font-semibold text-charcoal font-inter!">{tier.title}</h4>
              <p className="mt-1 text-[11px] text-steel">{tier.requiredHours.toLocaleString()} hrs of focus</p>

              <div className="mt-auto flex h-5 items-center justify-center gap-2 pt-3.5">
                {tier.unlocked ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: accent }}>
                    <CheckCheck size={13} aria-hidden="true" /> Earned
                  </span>
                ) : (
                  <>
                    <Bar
                      value={tier.progress}
                      label={`${tier.title} progress`}
                      className="h-1 w-[65%]"
                      trackClass="bg-background"
                      fillClass=""
                      fillColor={desaturatedFill(accent)}
                    />
                    <span className="text-[10px] tabular-nums text-steel">{Math.floor(tier.progress)}%</span>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {data && visible.length === 0 && (
        <Empty size="sm" className="mt-4 border border-soft">
          <EmptyHeader>
            <EmptyMedia variant="illustration">
              <ThemedSvg
                raw={filter === 'Unlocked' ? plantingSeedsRaw : celebrationRaw}
                ariaLabel={filter === 'Unlocked' ? 'No badges unlocked yet' : 'All badges unlocked'}
              />
            </EmptyMedia>
            <EmptyTitle>{filter === 'Unlocked' ? 'No badges unlocked yet' : 'Every badge earned'}</EmptyTitle>
            <EmptyDescription className="text-steel">
              {filter === 'Unlocked'
                ? 'Your first spark is waiting. Complete a focus session to get started.'
                : 'Nothing left to unlock. What a journey.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}

const desaturatedFill = (color: string) => `color-mix(in srgb, ${color} 70%, var(--color-steel))`



/* -------------------------------- projects -------------------------------- */

/* Redesigned: one list of rows instead of a grid of cards + progress rings.   */






type ProjectFilter = 'All' | ProjectSummary['status']



const STATUS_META: Record<ProjectSummary['status'], { label: string; dot: string }> = {

  'In progress': { label: 'In progress', dot: '#8b6fd6' },

  Done: { label: 'Completed', dot: '#3f9a70' },

  Planning: { label: 'Planning', dot: '#c4892b' },

}



const PREVIEW_COUNT = 5



const percent = (done: number, total: number) => (total ? Math.min(100, Math.round((done / total) * 100)) : 0)



/** Tints a colour so it works on light and dark surfaces. */

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`



const projectFocusRing =

  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'



function ProjectBar({

  value,

  label,

  color,

  className = 'h-1.5',

}: {

  value: number

  label: string

  color?: string

  className?: string

}) {

  const v = Math.min(100, Math.max(0, value))

  return (

    <div

      role="progressbar"

      aria-label={label}

      aria-valuenow={Math.round(v)}

      aria-valuemin={0}

      aria-valuemax={100}

      className={`overflow-hidden rounded-full bg-primary/10 ${className}`}

    >

      <div

        className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${

          color ? '' : 'bg-primary'

        }`}

        style={{ width: `${v}%`, background: color }}

      />

    </div>

  )

}



function ProjectRow({ project }: { project: ProjectSummary }) {

    const tint = FOLDER_TINTS[normalizeTint(project.tint)].fg

  const Icon = FOLDER_ICONS[project.icon as IconKey] ?? FolderKanban

  const meta = STATUS_META[project.status]

  const pct = percent(project.done, project.total)

  const barColor = project.status === 'Done' ? STATUS_META.Done.dot : tint



  return (

    <li className="border-t border-soft first:border-t-0">

      <Link

        to={`/projects/${project.id}`}

        className={`group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary/[0.04] sm:gap-4 sm:px-5 focus-visible:-outline-offset-2 ${projectFocusRing}`}

      >

        <span

          aria-hidden="true"

          className="grid size-10 shrink-0 place-items-center rounded-xl"

          style={{ background: mix(tint, 14), color: tint }}

        >

          <Icon className="size-5" />

        </span>



        <div className="min-w-0 flex-1">

          <h3 className="truncate text-sm font-medium">{project.name}</h3>

          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-primary/60">

            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: meta.dot }} />

            {meta.label}

          </p>

          {project.total > 0 && (

            <ProjectBar

              value={pct}

              label={`${project.name}: ${pct}% complete`}

              color={barColor}

              className="mt-2.5 h-1 sm:hidden"

            />

          )}

        </div>



        {/* Desktop progress */}

        <div className="hidden w-48 shrink-0 sm:block">

          {project.total === 0 ? (

            <p className="text-right text-xs text-primary/50">No tasks yet</p>

          ) : (

            <>

              <div className="mb-1.5 flex justify-between text-xs text-primary/60 tabular-nums">

                <span>

                  {project.done} of {project.total} tasks

                </span>

                <span>{pct}%</span>

              </div>

              <ProjectBar value={pct} label={`${project.name}: ${pct}% complete`} color={barColor} />

            </>

          )}

        </div>



        {/* Mobile percentage */}

        <span className="text-xs text-primary/60 tabular-nums sm:hidden">{project.total ? `${pct}%` : '—'}</span>



        <ChevronRight

          aria-hidden="true"

          className="size-4 shrink-0 text-primary/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary/60 motion-reduce:transition-none"

        />

      </Link>

    </li>

  )

}



export function ProfileProjects({ projects }: { projects: ProjectSummary[] | null }) {

  const [filter, setFilter] = useState<ProjectFilter>('All')

  const [showAll, setShowAll] = useState(false)

  const list = useMemo(() => projects ?? [], [projects])
  console.log('list', list)



  const summary = useMemo(() => {

    const counts = { 'In progress': 0, Done: 0, Planning: 0 } as Record<ProjectSummary['status'], number>

    let done = 0

    let total = 0

    for (const project of list) {

      counts[project.status] += 1

      done += project.done

      total += project.total

    }

    return { counts, done, total, pct: percent(done, total) }

  }, [list])



  
  const { tasks, status: tasksStatus } = useTaskStore()

  const taskCounts = useMemo(() => {
    let notStarted = 0
    let started = 0
    let completed = 0
    for (const task of tasks) {
      if (task.status === 'TODO') notStarted += 1
      else if (task.status === 'COMPLETED') completed += 1
      else started += 1
    }
    return { total: tasks.length, notStarted, started, completed }
  }, [tasks])

  const stages = useMemo(
    () => [
      { name: 'Total Tasks', value: taskCounts.total },
      { name: 'Not Started', value: taskCounts.notStarted },
      { name: 'Started', value: taskCounts.started },
      { name: 'Completed', value: taskCounts.completed },
    ],
    [taskCounts],
  )

  const tasksReady = tasksStatus === 'succeeded' || tasksStatus === 'failed'


  const filtered = filter === 'All' ? list : list.filter((project) => project.status === filter)

  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT)



  const filters: { key: ProjectFilter; label: string; count: number }[] = [

    { key: 'All', label: 'All', count: list.length },

    { key: 'In progress', label: 'In progress', count: summary.counts['In progress'] },

    { key: 'Done', label: 'Completed', count: summary.counts.Done },

    { key: 'Planning', label: 'Planning', count: summary.counts.Planning },

  ]



  return (

   <section
  className="mt-9"
  aria-labelledby="profile-projects-title"
  aria-busy={!projects}
>


  {/* Task completion summary */}
  {tasksReady && taskCounts.total === 0 ? (
    <Empty size="md" className="mt-6 border border-soft rounded-none">
      <EmptyHeader>
        <EmptyMedia variant="illustration">
          <ThemedSvg raw={checklistRaw} ariaLabel="No tasks yet" />
        </EmptyMedia>
        <EmptyTitle>No tasks yet</EmptyTitle>
        <EmptyDescription className="text-steel">
          Create your first task and your progress from start to finish will show up here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : tasksReady ? (
    <div className="mt-1">

      <div className="mt-5">
        <FunnelChartCard
          title=""
          stages={stages}
          subtitle=""
        />
      </div>
    </div>
  ) : (
    <div
      className="mt-5 rounded-2xl border border-soft p-5 text-sm text-primary/60"
      role="status"
    >
      Loading task progress…
    </div>
  )}

  {/* Loading skeleton */}
  {!projects && (
    <ul
      className="mt-4 overflow-hidden rounded-2xl border border-soft"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-4 border-t border-soft px-5 py-4 first:border-t-0"
        >
          <span className="size-10 animate-pulse rounded-xl bg-primary/10 motion-reduce:animate-none" />
          <span className="h-4 w-40 animate-pulse rounded bg-primary/10 motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  )}
</section>

  )

}
