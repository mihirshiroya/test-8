import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { WorkspaceAppearance } from './WorkspaceAppearance'

function appearanceAt(pathname: string) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [pathname] }, createElement(WorkspaceAppearance)),
  )
}

describe('workspace appearance boundary', () => {
  it.each([
    '/overview', '/notes', '/Notes', '/notes/folder-1', '/notes/folder-1/edit',
    '/Calender', '/session', '/kanban', '/projects/workspace-1', '/profile',
    '/settings/desktop', '/account/profile', '/account/security', '/admin',
    '/admin/users', '/admin/users/user-1',
  ])('applies the internal theme on %s', (pathname) => {
    expect(appearanceAt(pathname)).toContain('data-workspace-ui="cloud"')
  })

  it.each([
    '/', '/login', '/register', '/forgot-password', '/reset-password',
    '/verify-email', '/auth/success', '/overview-public', '/unknown',
  ])('leaves the public/auth appearance untouched on %s', (pathname) => {
    expect(appearanceAt(pathname)).toBe('')
  })
})
