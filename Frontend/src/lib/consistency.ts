import { PIXEL_ICONS, SECTION_PALETTE } from './pixel-icons'

export const PALETTE = SECTION_PALETTE

export type SectionKey = keyof typeof PALETTE

export const SECTION_ORDER: SectionKey[] = ['overview', 'notes', 'calendar', 'session', 'kanban']

export const SECTION_GLYPHS = Object.fromEntries(
  SECTION_ORDER.map((key) => [
    key,
    {
      label: key[0].toUpperCase() + key.slice(1),
      rows: PIXEL_ICONS[`section-${key}`].rows,
      mini: PIXEL_ICONS[`section-${key}-mini`].rows,
    },
  ]),
) as Record<SectionKey, { label: string; rows: string[]; mini: string[] }>

export const MOON_GLYPH = PIXEL_ICONS.moon.rows
export const ARROW_UP = PIXEL_ICONS['arrow-up'].rows
export const ARROW_DOWN = PIXEL_ICONS['arrow-down'].rows
export const ACTIVITY_GLYPHS = {
  move: PIXEL_ICONS['activity-move'].rows,
  focus: PIXEL_ICONS['activity-focus'].rows,
  start: PIXEL_ICONS['activity-start'].rows,
}
export const CUP_GLYPH = PIXEL_ICONS.cup.rows
export const PAGE_GLYPH = PIXEL_ICONS.page.rows
export const PAUSE_GLYPH = PIXEL_ICONS.pause.rows
export const CHECK_GLYPH = PIXEL_ICONS.check.rows
export const BOX_GLYPH = PIXEL_ICONS.box.rows

export const OVERVIEW = {
  greeting: 'Good night, Mr',
  stats: [
    { label: 'Focus time', value: '2m', delta: '-33%', compare: 'vs 3m yesterday', today: 2, yesterday: 3 },
    { label: 'Tasks completed', value: '0', delta: '-100%', compare: 'vs 1 yesterday', today: 0, yesterday: 1 },
    { label: 'Completion rate', value: '0%', delta: '-100%', compare: 'vs 50% yesterday', today: 0, yesterday: 5 },
    { label: 'Focus sessions', value: '3', delta: '+200%', compare: 'vs 1 yesterday', today: 3, yesterday: 1 },
  ],
  trendToday: { 21: 4 } as Record<number, number>,
  trendYesterday: { 20: 6 } as Record<number, number>,
  tasks: [
    { title: 'wass', note: '9 days overdue', done: false },
    { title: 'jkuyygu', done: true },
    { title: 'hhyhy', note: '1 day overdue', done: false },
    { title: 'kkbyu', done: true },
    { title: 'klmiugyt', done: true },
    { title: 'test', done: true },
    { title: 'jhhgh', done: true },
    { title: 'introduction', done: true },
    { title: 'hbty', done: true },
  ],
  activity: [
    { kind: 'move', text: 'Moved "hbty" to To do', time: '25m ago' },
    { kind: 'focus', text: 'Logged a 0 min focus session on "hbty"', time: '25m ago' },
    { kind: 'start', text: 'Started working on "hbty"', time: '25m ago' },
    { kind: 'move', text: 'Moved "hbty" to To do', time: '25m ago' },
    { kind: 'focus', text: 'Logged a 0 min focus session on "hbty"', time: '25m ago' },
    { kind: 'start', text: 'Started working on "hbty"', time: '25m ago' },
    { kind: 'move', text: 'Moved "introduction" to On hold', time: '35m ago' },
    { kind: 'focus', text: 'Logged a 2 min focus session on "introduction"', time: '35m ago' },
  ] as { kind: keyof typeof ACTIVITY_GLYPHS; text: string; time: string }[],
  activeDays: {
    '2026-09-30': 12,
    '2026-10-05': 8,
    '2026-10-12': 6,
    '2026-10-13': 9,
    '2026-10-14': 6,
    '2026-10-21': 3,
    '2026-10-22': 2,
  } as Record<string, number>,
}

export const NOTES = [
  { title: 'my', sections: 0, updated: '2d ago' },
  { title: 'Java', sections: 2, updated: '2d ago' },
]

export const SESSION = {
  day: 'Thursday, October 22',
  date: '22-10-2026',
  total: '00:02:13',
  sessions: 3,
  tasks: 2,
  goal: 1,
  goalLabel: '00:02:13 / 04:00:00',
  timelineStart: { label: '8:30 PM', minutes: 20 * 60 + 30 },
  timelineTicks: ['8:30 PM', '9:30 PM', '10:30 PM'],
  timelineSpan: 120,
  log: [
    { task: 'introduction', start: '9:22 PM', end: '9:25 PM', startMin: 21 * 60 + 22, endMin: 21 * 60 + 25, duration: '00:02:08' },
    { task: 'hbty', start: '9:34 PM', end: '9:35 PM', startMin: 21 * 60 + 34, endMin: 21 * 60 + 35, duration: '00:00:03' },
    { task: 'hbty', start: '9:35 PM', end: '9:35 PM', startMin: 21 * 60 + 35, endMin: 21 * 60 + 35, duration: '00:00:01' },
  ],
  byTask: [
    { task: 'introduction', time: '2m 8s', detail: '1 session · 96% of total', share: 96 },
    { task: 'hbty', time: '4s', detail: '2 sessions · 4% of total', share: 4 },
  ],
}

export type KanbanCard = {
  title: string
  project: string
  priority: string
  description: string
  available?: string
  tracked: string
  deadline: string
}

export const KANBAN: { column: string; glyph: 'box' | 'progress' | 'pause' | 'check'; cards: KanbanCard[] }[] = [
  {
    column: 'To Do',
    glyph: 'box',
    cards: [
      {
        title: 'hbty',
        project: 'java',
        priority: 'Medium',
        description: 'kjnhuyg',
        available: 'Available Oct 23, 9:20 PM',
        tracked: '0h 0m',
        deadline: 'No deadline',
      },
    ],
  },
  { column: 'In Progress', glyph: 'progress', cards: [] },
  {
    column: 'On Hold',
    glyph: 'pause',
    cards: [
      {
        title: 'introduction',
        project: 'java',
        priority: 'Medium',
        description: 'wrapping up quick intro',
        tracked: '0h 2m',
        deadline: 'No deadline',
      },
    ],
  },
  { column: 'Completed', glyph: 'check', cards: [] },
]
