// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DocsSearchDialog } from './docs-search-dialog'
import { DocsWorkspaceHeader } from './docs-screen'
import { NotificationsPanel } from './notificaion-panel'
import { THEMES, transformSvg } from '../../lib/svg-theme'
import type { Doc } from '../../lib/docs-data'
import { DocsEmptyState } from './docs-empty-set'
import { ActivityHeatmap } from './activity-heatmap'
import { DailyHeatmap } from './daily-heatmap'
import { WeeklyHeatmap } from './weekly-heatmap'

const { dispatch, overview } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  overview: {
    status: 'succeeded',
    data: { activity: [
      { id: 'task-1', kind: 'created', type: 'TASK_CREATED', text: 'Create project outline', meta: 'Design', ago: '2h ago' },
      { id: 'session-1', kind: 'focus', type: 'SESSION_COMPLETED', text: 'Focus session completed', meta: 'Engineering', ago: '3h ago' },
    ] },
  },
}))

vi.mock('../../store', () => ({ useAppDispatch: () => dispatch, useAppSelector: () => overview }))
vi.mock('../../store/slices/analyticsSlice', () => ({ selectOverview: vi.fn(), fetchOverview: () => ({ type: 'test/refresh' }) }))

afterEach(() => { cleanup(); vi.clearAllMocks() })
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

const doc: Doc = {
  id: 'handbook', title: 'Team handbook', description: '', topics: [
    { id: 'first', title: 'Getting started', subtopics: [
      { id: 'setup', title: 'Workspace setup', description: 'Configure your workspace', content: [] },
      { id: 'search', title: 'Workspace search', description: 'Find workspace documentation', content: [] },
    ] },
    { id: 'second', title: 'Daily work', subtopics: [
      { id: 'focus', title: 'Workspace focus', description: 'Track your focus sessions', content: [] },
    ] },
  ],
}

function renderSearch() {
  const onNavigate = vi.fn()
  const onClose = vi.fn()
  render(<DocsSearchDialog doc={doc} name="Team handbook" onNavigate={onNavigate} onClose={onClose} />)
  return { input: screen.getByRole('combobox'), onNavigate, onClose }
}

describe('connected documentation surfaces', () => {
  it('groups matching pages and navigates the selected keyboard result', async () => {
    const { input, onNavigate } = renderSearch()
    fireEvent.change(input, { target: { value: 'workspace' } })
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(3))
    expect(screen.getByText('Getting started')).toBeTruthy()
    expect(screen.getByText('Daily work')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const selectedId = input.getAttribute('aria-activedescendant')
    expect(document.getElementById(selectedId!)?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(selectedId).toBe('docs-result-1')
    expect(document.getElementById(selectedId!)?.textContent).toContain(onNavigate.mock.calls[0][0].title)
  })

  it('does not submit Enter while an IME is composing', async () => {
    const { input, onNavigate } = renderSearch()
    fireEvent.change(input, { target: { value: 'workspace' } })
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(3))
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(onNavigate).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('exposes readable empty results and a dismiss control', async () => {
    const { input, onClose } = renderSearch()
    fireEvent.change(input, { target: { value: 'zzzzqqqqvvvv' } })
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))
    expect(screen.getByText(/No matching sections/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('connects the notes list, reader and editor without losing the folder', () => {
    const onSearch = vi.fn()
    render(<MemoryRouter><DocsWorkspaceHeader title="Handbook" folderId="folder-1" editable open={false} onOpen={vi.fn()} onSearch={onSearch} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Read documentation' }).getAttribute('href')).toBe('/notes/folder-1')
    expect(screen.getByRole('link', { name: 'Edit documentation' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Back to all notes' }).getAttribute('href')).toBe('/notes')
    fireEvent.click(screen.getByRole('button', { name: 'Search documentation' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
  })
})

describe('activity-backed notifications', () => {
  it('filters live tasks, sessions and workspaces and refreshes activity', () => {
    render(<NotificationsPanel open onClose={vi.fn()} workspaces={[{ id: 'design', name: 'Design' }, { id: 'engineering', name: 'Engineering' }]} />)
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy()
    expect(screen.getByText('Create project outline')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Sessions/ }))
    expect(screen.queryByText('Create project outline')).toBeNull()
    expect(screen.getByText('Focus session completed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter notifications by workspace' }), { target: { value: 'design' } })
    expect(screen.getByText('Create project outline')).toBeTruthy()
    expect(screen.queryByText('Focus session completed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh notifications' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'test/refresh' })
  })

  it('closes through the button and native Escape cancellation', () => {
    const onClose = vi.fn()
    render(<NotificationsPanel open onClose={onClose} workspaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps a closed panel and its controls out of the accessibility tree', () => {
    render(<NotificationsPanel open={false} onClose={vi.fn()} workspaces={[]} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refresh notifications' })).toBeNull()
  })
})

describe('compact sidebar states and focus calendars', () => {
  it('keeps small documentation empties text-only while preserving large descriptions', () => {
    const { rerender, container } = render(<DocsEmptyState variant="sections" size="sm" title="No sections yet" description="Sections will appear here once content is added." />)
    expect(screen.getByText('No sections yet')).toBeTruthy()
    expect(screen.queryByText(/Sections will appear/)).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
    rerender(<DocsEmptyState variant="content" title="No content yet" description="Add your first page." />)
    expect(screen.getByText('Add your first page.')).toBeTruthy()
  })

  it('renders a complete leap year, year-scoped totals and keyboard focus feedback', () => {
    render(<ActivityHeatmap year={2024} cells={[{ date: '2024-02-29', value: 3, minutes: 45 }, { date: '2023-12-31', value: 4, minutes: 90 }]} />)
    expect(screen.getAllByRole('button')).toHaveLength(366)
    expect(screen.getByText('1 active days · 45m focused in 2024')).toBeTruthy()
    fireEvent.focus(screen.getByRole('button', { name: '2024-02-29: 45m focused' }))
    expect(screen.getByText('2024-02-29 · 45m focused')).toBeTruthy()
  })

  it('labels midnight and the final hour correctly and excludes future hourly focus', () => {
    render(<DailyHeatmap generatedAt={new Date(2026, 10, 9, 23, 59).getTime()} cells={[
      { date: '2026-11-09', hour: 0, minutes: 20 },
      { date: '2026-11-09', hour: 23, minutes: 10 },
      { date: '2026-11-10', hour: 1, minutes: 60 },
    ]} />)
    expect(screen.getByText('2 active hours · 30m this week')).toBeTruthy()
    expect(screen.getByRole('button', { name: /00:00–01:00: 20m/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /23:00–24:00: 10m/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tue.*01:00/ })).toBeNull()
  })

  it('uses semantic weekly rows and shows a useful zero-activity calendar', () => {
    render(<WeeklyHeatmap cells={[]} weeks={12} />)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getAllByRole('rowheader')).toHaveLength(7)
    expect(screen.getByText('0 active days · 0m focused in the last 12 weeks')).toBeTruthy()
  })
})

describe('sage SVG theme', () => {
  it('uses forest ink and sage accents in static illustrations', () => {
    const svg = transformSvg('<svg xmlns="http://www.w3.org/2000/svg"><path fill="#111111"/><path fill="#5dda99"/><path fill="#ffffff"/></svg>', 'light')
    expect(svg).toContain(THEMES.light.ink)
    expect(svg).toContain(THEMES.light.accent)
    expect(svg).toContain(THEMES.light.bg)
  })
})
