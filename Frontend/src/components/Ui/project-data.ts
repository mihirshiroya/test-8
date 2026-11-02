import {
  Folder,
  Briefcase,
  Rocket,
  BookOpen,
  Sparkles,
  Target,
  Users,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import {
  FOLDER_TINTS as NOTE_FOLDER_TINTS,
  type TintKey as FolderTintKey,
} from './folder-data'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TintKey = FolderTintKey

export type IconKey =
  | 'folder'
  | 'briefcase'
  | 'rocket'
  | 'book'
  | 'sparkles'
  | 'target'
  | 'users'
  | 'idea'

/* -------------------------------------------------------------------------- */
/* Palettes                                                                   */
/* -------------------------------------------------------------------------- */

export const FOLDER_TINTS: Record<TintKey, { bg: string; fg: string }> =
  NOTE_FOLDER_TINTS

export const DEFAULT_TINT: TintKey = 'violet'

// Workspaces created before the palette was unified store these older keys.
const LEGACY_TINTS: Record<string, TintKey> = {
  lavender: 'violet',
  sky: 'blue',
  mint: 'emerald',
  slate: 'cyan',
}

export function normalizeTint(key: string | undefined | null): TintKey {
  if (!key) return DEFAULT_TINT
  if (key in NOTE_FOLDER_TINTS) return key as TintKey
  return LEGACY_TINTS[key] ?? DEFAULT_TINT
}

export const FOLDER_ICONS: Record<IconKey, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  rocket: Rocket,
  book: BookOpen,
  sparkles: Sparkles,
  target: Target,
  users: Users,
  idea: Lightbulb,
}
