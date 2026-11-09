// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { AppDialog, AppDialogButton, AppDialogSection } from './app-dialog'
import { WorkDialog } from './work-dialog'
import { useConfirmDialog } from './confirm-dialog'
import { CheckinCard } from './checkin-card'

vi.mock('../../store/slices/taskSlice', () => ({
  RESPONSE_WINDOW_MS: 60000,
  formatDuration: (seconds: number) => `${seconds}s`,
}))
vi.mock('./robot-head', () => ({ RobotHead: () => <span aria-hidden="true" /> }))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('shared layered dialogs', () => {
  it('keeps closed panels out of the document', () => {
    render(<AppDialog open={false} title="New workspace" onClose={vi.fn()}><input aria-label="Name" /></AppDialog>)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByLabelText('Name')).toBeNull()
  })

  it('groups sections, description and submit actions in the supplied inner card', () => {
    const submit = vi.fn(event => event.preventDefault())
    render(<AppDialog open title="New workspace" description="Create a place for your tasks." onClose={vi.fn()} onSubmit={submit} footer={<AppDialogButton type="submit">Create workspace</AppDialogButton>}>
      <AppDialogSection title="Workspace name" htmlFor="name"><input id="name" /></AppDialogSection>
    </AppDialog>)
    const dialog = screen.getByRole('dialog', { name: 'New workspace' })
    expect(dialog.classList.contains('kumo-dialog')).toBe(true)
    expect(dialog.querySelector('.kumo-dialog-card .kumo-dialog-body')).toBeTruthy()
    expect(dialog.querySelector('.kumo-dialog-card .kumo-dialog-footer')).toBeTruthy()
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Create a place for your tasks.')
    expect(screen.getByLabelText('Workspace name')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('blocks all dismissal routes while a dialog is busy', () => {
    const close = vi.fn()
    render(<AppDialog open title="Delete folder" role="alertdialog" onClose={close} dismissible={false} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }))
    expect(close).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog').getAttribute('aria-busy')).toBe('true')
  })

  it('contains Tab and restores focus and scrolling after closing', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'scroll'
    const { unmount } = render(<AppDialog open title="Edit folder" onClose={vi.fn()} footer={<AppDialogButton>Save changes</AppDialogButton>}><input aria-label="Folder name" /></AppDialog>)
    const close = screen.getByRole('button', { name: 'Close', exact: true })
    const save = screen.getByRole('button', { name: 'Save changes' })
    save.focus()
    fireEvent.keyDown(save, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('scroll')
    trigger.remove()
    document.body.style.overflow = previousOverflow
  })

  it('includes portalled date controls in the focus boundary', () => {
    render(<AppDialog open title="Create task" onClose={vi.fn()}><input aria-label="Task title" /></AppDialog>)
    const popover = document.createElement('div')
    popover.dataset.placement = 'top'
    const control = document.createElement('button')
    control.textContent = 'Confirm date'
    popover.append(control)
    document.body.append(popover)
    control.focus()
    fireEvent.keyDown(control, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close', exact: true }))
    popover.remove()
  })

  it('dismisses only the topmost dialog with Escape', () => {
    const closeOuter = vi.fn()
    function NestedDialogs() {
      const [nested, setNested] = useState(false)
      return <AppDialog open title="Edit folder" onClose={closeOuter}>
        <button onClick={() => setNested(true)}>Open confirmation</button>
        <AppDialog open={nested} title="Delete folder" role="alertdialog" onClose={() => setNested(false)} />
      </AppDialog>
    }
    render(<NestedDialogs />)
    fireEvent.click(screen.getByRole('button', { name: 'Open confirmation' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(closeOuter).not.toHaveBeenCalled()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closeOuter).toHaveBeenCalledTimes(1)
  })

  it('keeps native docs dialogs cancellable unless saving', () => {
    const close = vi.fn()
    const { rerender } = render(<WorkDialog title="Edit topic" busy onClose={close}><input aria-label="Title" /></WorkDialog>)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(close).not.toHaveBeenCalled()
    rerender(<WorkDialog title="Edit topic" onClose={close}><input aria-label="Title" /></WorkDialog>)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog').querySelector('.kumo-dialog-card')).toBeTruthy()
  })
})

describe('styled destructive confirmations', () => {
  it('does not perform deletion until explicitly confirmed', async () => {
    const remove = vi.fn()
    function DeleteButton() {
      const { confirm, dialog } = useConfirmDialog()
      return <>{dialog}<button onClick={async () => {
        if (await confirm('This cannot be undone.', { title: 'Delete user?', confirmLabel: 'Delete user' })) remove()
      }}>Request deletion</button></>
    }
    render(<DeleteButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Request deletion' }))
    const confirmation = screen.getByRole('alertdialog', { name: 'Delete user?' })
    expect(confirmation.classList.contains('kumo-dialog')).toBe(true)
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Request deletion' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete user', exact: true }))
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1))
  })
})

describe('activity check-in presentation', () => {
  it('uses a layered card and preserves pause and continue actions', () => {
    const pause = vi.fn()
    const resume = vi.fn()
    render(<CheckinCard workspaceLabel="Design" taskTitle="Review layouts" spentSeconds={120} secondsLeft={30} onPause={pause} onContinue={resume} draggable />)
    const dialog = screen.getByRole('dialog', { name: 'Still focusing?' })
    expect(dialog.classList.contains('kumo-dialog')).toBe(true)
    expect(dialog.querySelector('.kumo-dialog-header')?.hasAttribute('data-tauri-drag-region')).toBe(true)
    expect(dialog.querySelector('.kumo-dialog-card .kumo-dialog-footer')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toContain('00:30')
    fireEvent.click(screen.getByRole('button', { name: 'Pause it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    expect(pause).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('does not nest dialog roles or duplicate actions when embedded', () => {
    render(<AppDialog open title="Still focusing?" onClose={vi.fn()} footer={<AppDialogButton>Yes, continue</AppDialogButton>}>
      <CheckinCard embedded workspaceLabel="Design" taskTitle="Review layouts" spentSeconds={120} secondsLeft={30} onPause={vi.fn()} onContinue={vi.fn()} />
    </AppDialog>)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Yes, continue' })).toHaveLength(1)
    expect(screen.getByText('Review layouts')).toBeTruthy()
  })
})
