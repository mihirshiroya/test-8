
import {
  FolderClosed,
  FileText,
  Image,
  Star,
  Briefcase,
  Heart,
  Code2,
  Music,
  Rocket,
  Camera,
} from 'lucide-react'

export type TintKey =
  | 'blue'
  | 'violet'
  | 'pink'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'cyan'
  | 'lime'

export type IconKey =
  | 'folder'
  | 'doc'
  | 'image'
  | 'star'
  | 'work'
  | 'heart'
  | 'code'
  | 'music'
  | 'rocket'
  | 'camera'

export type Folder = {
  id: string
  title: string
  tint: TintKey
  icon: IconKey
  items: number
  updatedAt: number
}


/* =========================================================
   TASK / FOLDER COLORS
   =========================================================

   Colors are designed to work in both light and dark mode.

   Background = subtle tinted background
   Foreground = readable accent color
   ========================================================= */

export const FOLDER_TINTS: Record<
  TintKey,
  {
    bg: string
    fg: string
  }
> = {
  blue: {
    bg: 'var(--task-blue-bg)',
    fg: 'var(--task-blue)',
  },

  violet: {
    bg: 'var(--task-violet-bg)',
    fg: 'var(--task-violet)',
  },

  pink: {
    bg: 'var(--task-pink-bg)',
    fg: 'var(--task-pink)',
  },

  amber: {
    bg: 'var(--task-amber-bg)',
    fg: 'var(--task-amber)',
  },

  emerald: {
    bg: 'var(--task-emerald-bg)',
    fg: 'var(--task-emerald)',
  },

  rose: {
    bg: 'var(--task-rose-bg)',
    fg: 'var(--task-rose)',
  },

  cyan: {
    bg: 'var(--task-cyan-bg)',
    fg: 'var(--task-cyan)',
  },

  lime: {
    bg: 'var(--task-lime-bg)',
    fg: 'var(--task-lime)',
  },
}


/* =========================================================
   FOLDER ICONS
   ========================================================= */

export const FOLDER_ICONS: Record<
  IconKey,
  React.ComponentType<{ className?: string }>
> = {
  folder: FolderClosed,
  doc: FileText,
  image: Image,
  star: Star,
  work: Briefcase,
  heart: Heart,
  code: Code2,
  music: Music,
  rocket: Rocket,
  camera: Camera,
}


/* =========================================================
   INITIAL FOLDERS
   ========================================================= */




/* =========================================================
   RELATIVE TIME
   ========================================================= */

export function relativeTime(
  ts: number
): string {
  const diff = Date.now() - ts

  const min = Math.round(
    diff / 60000
  )

  if (min < 1) {
    return 'just now'
  }

  if (min < 60) {
    return `${min}m ago`
  }

  const hrs = Math.round(
    min / 60
  )

  if (hrs < 24) {
    return `${hrs}h ago`
  }

  const days = Math.round(
    hrs / 24
  )

  if (days < 7) {
    return `${days}d ago`
  }

  const weeks = Math.round(
    days / 7
  )

  return `${weeks}w ago`
}



