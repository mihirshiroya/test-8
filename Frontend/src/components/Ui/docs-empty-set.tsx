import type { ReactNode } from 'react'
import { cn } from 'cn'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  type EmptySize,
} from './empty'
import { ThemedSvg } from '../../lib/svg-theme'
import journalRaw from '../../assets/10-journal.svg?raw'
import noResultsRaw from '../../assets/31-no-results.svg?raw'
import readingRaw from '../../assets/22-reading.svg?raw'
import ideaRaw from '../../assets/14-idea-capture.svg?raw'
import plantingRaw from '../../assets/35-planting-seeds.svg?raw'

const ILLUSTRATIONS = {
  content: journalRaw,
  search: readingRaw,
  noResults: noResultsRaw,
  sections: ideaRaw,
  topics: plantingRaw,
} as const

export type DocsEmptyVariant = keyof typeof ILLUSTRATIONS

type DocsEmptyStateProps = {
  variant: DocsEmptyVariant
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  size?: EmptySize
  className?: string
}

export function DocsEmptyState({
  variant,
  title,
  description,
  action,
  size = 'lg',
  className,
}: DocsEmptyStateProps) {
  return (
    <Empty size={size} className={cn('border-0', className)}>
      <EmptyHeader>
        <EmptyMedia variant="illustration">
          <ThemedSvg raw={ILLUSTRATIONS[variant]} ariaLabel="" />
        </EmptyMedia>

        <EmptyTitle className="font-inter! text-docs-ink">{title}</EmptyTitle>

        {description && <EmptyDescription className="text-docs-muted">{description}</EmptyDescription>}
      </EmptyHeader>

      {action && <EmptyContent className="mt-2">{action}</EmptyContent>}
    </Empty>
  )
}
