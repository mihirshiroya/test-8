import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Subtopic, Topic } from '../../lib/docs-data'
import { DocsEmptyState } from './docs-empty-set'

const MUTED = 'text-docs-muted'
const LINE_BG = 'border-docs-line-strong'
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-docs-accent'

interface DocsNavTreeProps {
  topics: Topic[]
  activeSubtopicId?: string
  expanded: Record<string, boolean>
  onTopicClick: (topic: Topic) => void
  onSubtopicClick: (topic: Topic, subtopic: Subtopic) => void
  renderTopicActions?: (topic: Topic) => ReactNode
  renderSubtopicActions?: (topic: Topic, subtopic: Subtopic) => ReactNode
  emptyMessage?: string
}

export function DocsNavTree({
  topics,
  activeSubtopicId,
  expanded,
  onTopicClick,
  onSubtopicClick,
  renderTopicActions,
  renderSubtopicActions,
  emptyMessage,
}: DocsNavTreeProps) {
  if (topics.length === 0) {
    return emptyMessage ? (
      <DocsEmptyState variant="topics" size="sm" title="No topics yet" description={emptyMessage} />
    ) : null
  }

  return (
    <ul className="flex flex-col gap-3">
      {topics.map((topic) => {
        const isExpanded = Boolean(expanded[topic.id])
        const hasSubtopics = topic.subtopics.length > 0
        const groupId = `docs-nav-group-${topic.id}`

        return (
          <li key={topic.id} className="group/topic">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onTopicClick(topic)}
                aria-expanded={hasSubtopics ? isExpanded : undefined}
                aria-controls={hasSubtopics ? groupId : undefined}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1.5 text-left transition-colors hover:text-docs-ink ${MUTED} ${FOCUS}`}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold capitalize font-inter!">
                  {topic.title}
                </span>
              </button>

              {renderTopicActions && (
                <div className="flex shrink-0 items-center">
                  {renderTopicActions(topic)}
                </div>
              )}

              <button
                type="button"
                onClick={() => onTopicClick(topic)}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${topic.title}`}
                aria-expanded={hasSubtopics ? isExpanded : undefined}
                aria-controls={hasSubtopics ? groupId : undefined}
                tabIndex={hasSubtopics ? 0 : -1}
                className={`flex shrink-0 items-center justify-center p-1 ${MUTED} ${FOCUS} ${
                  hasSubtopics
                    ? 'cursor-pointer'
                    : 'pointer-events-none'
                }`}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={`size-3.5 shrink-0 transition-transform duration-200 ${
                    isExpanded && hasSubtopics ? 'rotate-90' : ''
                  } ${hasSubtopics ? '' : 'opacity-40'}`}
                />
              </button>
            </div>

            {isExpanded && hasSubtopics && (
              <ul id={groupId} className="ml-[13px] mt-1">
                {topic.subtopics.map((subtopic, index) => {
                  const isActive = subtopic.id === activeSubtopicId
                  const isLast = index === topic.subtopics.length - 1

                  return (
                    <li
                      key={subtopic.id}
                      className="group/item relative pl-[18px]"
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute left-0 top-0 h-1/2 w-3 rounded-bl-[7px] border-b border-l transition-colors ${
                          isActive
                            ? 'border-docs-accent'
                            : LINE_BG
                        }`}
                      />

                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute bottom-0 left-0 top-1/2 border-l ${LINE_BG}`}
                        />
                      )}

                      <div
                        className={`flex min-w-0 items-center transition-colors ${
                          isActive
                            ? 'bg-docs-soft text-docs-ink'
                            : 'text-docs-muted hover:bg-docs-soft hover:text-docs-ink'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onSubtopicClick(topic, subtopic)
                          }
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-[7px] text-left text-[13px] ${
                            isActive
                              ? 'font-medium'
                              : 'font-normal'
                          } ${FOCUS}`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {subtopic.title}
                          </span>
                        </button>

                        {renderSubtopicActions && (
                          <div className="flex shrink-0 items-center">
                            {renderSubtopicActions(topic, subtopic)}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
