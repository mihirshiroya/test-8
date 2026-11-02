/**
 * Single source of truth for every animated pixel icon in the app.
 * Each glyph is a grid of rows where `#` is a lit pixel and `.` is empty.
 * Other modules (pixel-shapes, productivity-shapes, consistency) derive from this file.
 */

export type PixelIconDef = {
  rows: string[]
  color: string
  label?: [string, string]
  group: PixelIconGroup
}

export type PixelIconGroup = 'platform' | 'productivity' | 'section' | 'ui'

export const PIXEL_PALETTE = {
  orange: '#ff5a1f',
  cyan: '#38c6ff',
  yellow: '#ffd21f',
  magenta: '#ff6bf0',
  lime: '#9dff4a',
  coral: '#ff4d6d',
} as const

export const SECTION_PALETTE = {
  overview: '#ff5a1f',
  notes: '#ffd21f',
  calendar: '#2ec5ff',
  session: '#a3ff3c',
  kanban: '#ff6bf0',
} as const

const P = PIXEL_PALETTE
const S = SECTION_PALETTE

function defineIcons<T extends Record<string, PixelIconDef>>(icons: T) {
  return icons
}

export const PIXEL_ICONS = defineIcons({
  // Platform
  capabilities: { group: 'platform', label: ['Key', 'Capabilities'], color: P.orange, rows: ['##.#', '.#..', '..#.'] },
  lgtm: { group: 'platform', label: ['LGTM+', 'Stack'], color: P.cyan, rows: ['.#.#..', '#.#.#.', '.....#'] },
  observability: { group: 'platform', label: ['Observability', 'Tools'], color: P.yellow, rows: ['...#.', '#.#.#', '.#...'] },
  testing: { group: 'platform', label: ['Platform', 'Testing'], color: P.magenta, rows: ['#..#', '.##.', '.#..'] },
  pipelines: { group: 'platform', label: ['Data', 'Pipelines'], color: P.lime, rows: ['#...#', '.#.#.', '..#..', '.#.#.'] },
  security: { group: 'platform', label: ['Zero Trust', 'Security'], color: P.coral, rows: ['.##.', '#..#', '#..#', '.##.'] },
  deploy: { group: 'platform', label: ['Edge', 'Deploys'], color: P.cyan, rows: ['..#..', '.###.', '#.#.#', '..#..'] },
  scale: { group: 'platform', label: ['Auto', 'Scaling'], color: P.yellow, rows: ['...#', '..##', '.#.#', '####'] },

  // Productivity
  tasks: { group: 'productivity', label: ['Task', 'Manager'], color: P.lime, rows: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'] },
  calendar: { group: 'productivity', label: ['Smart', 'Calendar'], color: P.cyan, rows: ['.#...#.', '#######', '#.....#', '#.#.#.#', '#.....#', '#######'] },
  time: { group: 'productivity', label: ['Time', 'Tracking'], color: P.yellow, rows: ['..###..', '.#...#.', '#..#..#', '#..##.#', '#.....#', '.#...#.', '..###..'] },
  pomodoro: { group: 'productivity', label: ['Pomodoro', 'Timer'], color: P.coral, rows: ['#####', '#...#', '.#.#.', '..#..', '.#.#.', '#.#.#', '#####'] },
  kanban: { group: 'productivity', label: ['Kanban', 'Boards'], color: P.magenta, rows: ['##.##.##', '##.##.##', '##.##.##', '##.##...', '##......'] },
  inbox: { group: 'productivity', label: ['Unified', 'Inbox'], color: P.orange, rows: ['#.....#', '#.....#', '###.###', '#.###.#', '#######'] },
  goals: { group: 'productivity', label: ['Goal', 'Tracking'], color: P.lime, rows: ['#####.', '######', '#####.', '#.....', '#.....', '#.....'] },
  streaks: { group: 'productivity', label: ['Daily', 'Streaks'], color: P.orange, rows: ['...#...', '...##..', '..####.', '.#####.', '###.###', '##...##', '.#####.'] },
  focus: { group: 'productivity', label: ['Deep', 'Focus'], color: P.coral, rows: ['...#...', '.#####.', '.#...#.', '###.###', '.#...#.', '.#####.', '...#...'] },
  reminders: { group: 'productivity', label: ['Smart', 'Reminders'], color: P.yellow, rows: ['..#..', '.###.', '.###.', '.###.', '#####', '.....', '..#..'] },
  analytics: { group: 'productivity', label: ['Weekly', 'Insights'], color: P.cyan, rows: ['......#', '....#.#', '..#.#.#', '#.#.#.#', '#######'] },
  capture: { group: 'productivity', label: ['Quick', 'Capture'], color: P.magenta, rows: ['...##', '..##.', '.##..', '#####', '..##.', '.##..', '##...'] },

  // Workspace sections (full + mini variants)
  'section-overview': { group: 'section', label: ['Section', 'Overview'], color: S.overview, rows: ['###.###', '###.###', '###.###', '.......', '###.###', '###.###', '###.###'] },
  'section-overview-mini': { group: 'section', color: S.overview, rows: ['##.##', '##.##', '.....', '##.##', '##.##'] },
  'section-notes': { group: 'section', label: ['Section', 'Notes'], color: S.notes, rows: ['#####..', '#...##.', '#.##.##', '#.....#', '#.###.#', '#.....#', '#######'] },
  'section-notes-mini': { group: 'section', color: S.notes, rows: ['###..', '#..#.', '#.#.#', '#...#', '#####'] },
  'section-calendar': { group: 'section', label: ['Section', 'Calendar'], color: S.calendar, rows: ['.#...#.', '#######', '#.....#', '#.#.#.#', '#.....#', '#.#.#.#', '#######'] },
  'section-calendar-mini': { group: 'section', color: S.calendar, rows: ['.#.#.', '#####', '#...#', '#.#.#', '#####'] },
  'section-session': { group: 'section', label: ['Section', 'Session'], color: S.session, rows: ['..###..', '...#...', '.#####.', '#..#..#', '#..##.#', '#.....#', '.#####.'] },
  'section-session-mini': { group: 'section', color: S.session, rows: ['.###.', '#.#.#', '#.###', '#...#', '.###.'] },
  'section-kanban': { group: 'section', label: ['Section', 'Kanban'], color: S.kanban, rows: ['##.##.##', '##.##.##', '##.##.##', '##....##', '##......'] },
  'section-kanban-mini': { group: 'section', color: S.kanban, rows: ['#.#.#', '#.#.#', '#.#..', '#....', '#....'] },

  // UI glyphs
  moon: { group: 'ui', label: ['UI', 'Moon'], color: S.overview, rows: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'] },
  'arrow-up': { group: 'ui', label: ['UI', 'Arrow Up'], color: P.lime, rows: ['..#..', '.###.', '#.#.#', '..#..', '..#..'] },
  'arrow-down': { group: 'ui', label: ['UI', 'Arrow Down'], color: S.overview, rows: ['..#..', '..#..', '#.#.#', '.###.', '..#..'] },
  'activity-move': { group: 'ui', label: ['Activity', 'Move'], color: S.overview, rows: ['..#..', '...#.', '#####', '...#.', '..#..'] },
  'activity-focus': { group: 'ui', label: ['Activity', 'Focus'], color: S.overview, rows: ['.###.', '#.#.#', '#.##.', '#...#', '.###.'] },
  'activity-start': { group: 'ui', label: ['Activity', 'Start'], color: S.overview, rows: ['#....', '###..', '#####', '###..', '#....'] },
  cup: { group: 'ui', label: ['UI', 'Cup'], color: S.notes, rows: ['.#.#..', '#.#...', '......', '#####.', '#...##', '#...#.', '.###..'] },
  page: { group: 'ui', label: ['UI', 'Page'], color: S.notes, rows: ['####.', '#..##', '#...#', '#...#', '#####'] },
  pause: { group: 'ui', label: ['UI', 'Pause'], color: S.kanban, rows: ['##.##', '##.##', '##.##', '##.##', '##.##'] },
  check: { group: 'ui', label: ['UI', 'Check'], color: S.kanban, rows: ['....#', '...#.', '#.#..', '.#...'] },
  box: { group: 'ui', label: ['UI', 'Box'], color: S.kanban, rows: ['#####', '#...#', '#...#', '#...#', '#####'] },
})

export type PixelIconName = keyof typeof PIXEL_ICONS

export const PIXEL_ICON_NAMES = Object.keys(PIXEL_ICONS) as PixelIconName[]

export function getPixelIcon(name: PixelIconName): PixelIconDef {
  return PIXEL_ICONS[name]
}

export type MorphFrame = { rows: string[]; color: string; label: string }

function frame(rows: string[], color: string, label: string): MorphFrame {
  return { rows, color, label }
}

export const MORPH_SETS = {
  shapes: [
    frame(['#.#.#', '.#.#.', '#.#.#', '.#.#.', '#.#.#'], P.orange, 'Checker'),
    frame(['..#..', '.###.', '#####', '.###.', '..#..'], P.cyan, 'Diamond'),
    frame(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], P.magenta, 'Cross'),
    frame(['#....', '##...', '###..', '####.', '#####'], P.yellow, 'Stair'),
    frame(['#####', '#...#', '#.#.#', '#...#', '#####'], P.lime, 'Target'),
  ],
  productivity: [
    frame(['....#', '...##', '#.##.', '###..', '.#...'], P.lime, 'Done'),
    frame(['.#.#.', '#####', '#...#', '#.#.#', '#####'], P.cyan, 'Plan'),
    frame(['.###.', '#.#.#', '#.###', '#...#', '.###.'], P.yellow, 'Track'),
    frame(['..##.', '.##..', '#####', '..##.', '.##..'], P.magenta, 'Capture'),
    frame(['..#..', '.##..', '.###.', '##.##', '.###.'], P.orange, 'Streak'),
    frame(['####.', '#####', '####.', '#....', '#....'], P.coral, 'Achieve'),
  ],
  sections: (['overview', 'notes', 'calendar', 'session', 'kanban'] as const).map((key) =>
    frame(PIXEL_ICONS[`section-${key}-mini`].rows, SECTION_PALETTE[key], key[0].toUpperCase() + key.slice(1)),
  ),
} satisfies Record<string, MorphFrame[]>
