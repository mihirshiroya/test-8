// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DocsSearchDialog } from './docs-search-dialog'
import { DocsWorkspaceHeader } from './docs-screen'
import { NotificationsPanel } from './notificaion-panel'
import { THEMES, transformSvg } from '../../lib/svg-theme'
import type { Doc } from '../../lib/docs-data'

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

describe('sage SVG theme', () => {
  it('uses forest ink and sage accents in static illustrations', () => {
    const svg = transformSvg('<svg xmlns="http://www.w3.org/2000/svg"><path fill="#111111"/><path fill="#5dda99"/><path fill="#ffffff"/></svg>', 'light')
    expect(svg).toContain(THEMES.light.ink)
    expect(svg).toContain(THEMES.light.accent)
    expect(svg).toContain(THEMES.light.bg)
  })
})
