// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { noteEditorExtensions } from './note-editor-extensions'
import { contentToMarkdown, fencedCode, markdownTitle, safeHttpUrl, videoSource } from './note-markdown'
import { NoteMarkdownEditor } from '../components/Ui/note-markdown-editor'
import { NoteMarkdownPreview } from '../components/Ui/note-markdown-preview'

afterEach(cleanup)
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Element.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const sample = '# Rich note\n\n## Section\n\n**Bold** *italic* ~~deleted~~ [link](https://example.com)\n\n![Useful diagram](https://example.com/image.png)\n\n- Item\n\n1. Ordered\n\n- [x] Done\n- [ ] Pending\n\n| Name | Status |\n| --- | --- |\n| Notes | Ready |\n\n> [!WARNING]\n> Check carefully.\n\n---\n\n```typescript\nconst answer: number = 42\n```\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n$$\nE = mc^2\n$$\n\nInline $$x^2$$ math.\n\n```video\nhttps://youtu.be/dQw4w9WgXcQ\n```'

describe('Markdown content rules', () => {
  it('extracts headings outside code fences and keeps C# and Unicode', () => {
    expect(markdownTitle('```md\n# Not the title\n```\n## Real C# ##')).toBe('Real C#')
    expect(markdownTitle('# 你好')).toBe('你好')
    expect(markdownTitle('No heading')).toBe('Untitled note')
  })
  it('merges legacy heading and code without breaking embedded fences', () => {
    expect(contentToMarkdown({ id: 'x', title: 'Sample', type: 'code', language: 'md', content: '```js\nx\n```' })).toContain('````md')
    expect(fencedCode('hello', 'go')).toBe('```go\nhello\n```')
    expect(contentToMarkdown({ id: 'x', title: 'Metadata', type: 'text', language: 'markdown', content: '# Only once' })).toBe('# Only once')
  })
  it('blocks unsafe URLs and arbitrary video embed hosts', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('https://user:pass@example.com')).toBeNull()
    expect(videoSource('https://evil.com/embed/123')).toBeNull()
    expect(videoSource('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(videoSource('https://youtu.be/dQw4w9WgXcQ')?.url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })
  it('round-trips all supported blocks through Tiptap', () => {
    const editor = new Editor({ extensions: noteEditorExtensions(), content: sample, contentType: 'markdown' })
    const result = editor.getMarkdown()
    for (const expected of ['# Rich note', '## Section', '**Bold**', '*italic*', '~~deleted~~', 'https://example.com', 'Useful diagram', '- [x] Done', '- [ ] Pending', '| Name', '[!WARNING]', '---', '```typescript', 'const answer: number = 42', '```mermaid', 'A --> B', 'E = mc^2', 'Inline $$x^2$$ math.', '```video', 'https://youtu.be/dQw4w9WgXcQ']) expect(result).toContain(expected)
    const json = editor.getJSON()
    editor.commands.setContent(result, { contentType: 'markdown' })
    const normalize = (doc: ReturnType<Editor['getJSON']>) => {
      const nodes = [...(doc.content ?? [])]
      while (nodes.at(-1)?.type === 'paragraph' && !nodes.at(-1)?.content?.length) nodes.pop()
      return { ...doc, content: nodes }
    }
    expect(normalize(editor.getJSON())).toEqual(normalize(json))
    editor.destroy()
  })
  it('preserves text color through a Markdown HTML span', () => {
    const editor = new Editor({ extensions: noteEditorExtensions(), content: '<span style="color: #6950a8">Colored</span>', contentType: 'markdown' })
    expect(editor.getMarkdown()).toMatch(/<span style="color: #6950a8">Colored<\/span>/)
    editor.destroy()
  })
})

describe('safe Markdown preview', () => {
  it('renders tables, checklists, callouts, math, colors and code', () => {
    const { container } = render(<NoteMarkdownPreview markdown={'# Preview\n\n| A | B |\n| --- | --- |\n| x | y |\n\n- [x] Done\n\n> [!NOTE]\n> Remember\n\n$$\nx^2\n$$\n\n<span style="color: #6950a8">Purple</span>\n\n```js\nconst x = 1\n```'} />)
    expect(screen.getByRole('heading', { name: 'Preview' })).toBeTruthy()
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('input[type="checkbox"]:checked')).toBeTruthy()
    expect(container.querySelector('.note-callout')).toBeTruthy()
    expect(container.querySelector('.katex')).toBeTruthy()
    expect(screen.getByText('Purple').getAttribute('style')).toContain('105, 80, 168')
    expect(container.querySelector('.hljs-keyword')).toBeTruthy()
  })
  it('removes scripts, unsafe HTML, event handlers and unsafe URLs', () => {
    const { container } = render(<NoteMarkdownPreview markdown={'<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)" />\n\n<iframe src="https://evil.com"></iframe>\n\n[bad](javascript:alert%281%29)\n\n<span style="position:fixed;inset:0">bad style</span>'} />)
    expect(container.querySelector('script, iframe, [onerror]')).toBeNull()
    expect(container.querySelector('[style]')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull()
  })
  it('embeds only approved videos using a sandboxed iframe', () => {
    const { container } = render(<NoteMarkdownPreview markdown={'```video\nhttps://youtu.be/dQw4w9WgXcQ\n```'} />)
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/')
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toContain('allow-scripts')
  })
})

describe('inline note editor', () => {
  it('exposes the requested toolbar actions without a content dialog', () => {
    render(<NoteMarkdownEditor onSave={vi.fn()} onClose={vi.fn()} />)
    for (const label of ['Heading level', 'Bold', 'Italic', 'Strikethrough', 'Text color', 'Insert link', 'Insert image', 'Ordered list', 'Unordered list', 'Checklist', 'Insert table', 'Code block', 'Blockquote', 'Insert callout', 'Horizontal divider', 'Mermaid diagram', 'Mathematical equation', 'Video embed']) expect(screen.getByLabelText(label)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('keeps raw Markdown unchanged and saves heading plus body together', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<NoteMarkdownEditor onSave={save} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    const raw = '# Unified heading\n\n**Body**\n\n```python\nprint(42)\n```\n'
    fireEvent.change(screen.getByLabelText('Raw Markdown'), { target: { value: raw } })
    fireEvent.click(screen.getByRole('button', { name: 'Split' }))
    expect(screen.getByRole('heading', { name: 'Unified heading' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save content' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(raw))
  })
  it('does not rewrite raw Markdown when switching between views', async () => {
    const raw = '# Original\n\n**Body**  \n\n```go\nfmt.Println(42)\n```\n'
    const save = vi.fn().mockResolvedValue(undefined)
    render(<NoteMarkdownEditor initialMarkdown={raw} onSave={save} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save content' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(raw))
  })
  it('retains a failed draft and displays the backend error', async () => {
    render(<NoteMarkdownEditor initialMarkdown="# Keep my draft" onSave={vi.fn().mockRejectedValue('Backend unavailable')} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save content' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Backend unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    expect((screen.getByLabelText('Raw Markdown') as HTMLTextAreaElement).value).toBe('# Keep my draft')
  })
  it('imports a raw Markdown file without changing its source', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<NoteMarkdownEditor onSave={save} onClose={vi.fn()} />)
    const raw = '# Imported\n\n> [!TIP]\n> Keep raw bytes.\n\n$$\nx^2\n$$\n'
    const bytes = new TextEncoder().encode(raw)
    const file = { name: 'notes.md', size: bytes.length, arrayBuffer: async () => bytes.buffer }
    fireEvent.change(screen.getByLabelText('Import Markdown file'), { target: { files: [file] } })
    await waitFor(() => expect((screen.getByLabelText('Raw Markdown') as HTMLTextAreaElement).value).toBe(raw))
    expect(await screen.findByRole('heading', { name: 'Imported' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save content' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(raw))
  })
  it('inserts tables through the toolbar and shows table controls', async () => {
    const { container } = render(<NoteMarkdownEditor onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Insert table'))
    await waitFor(() => expect(container.querySelector('table')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Add row' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
    expect(container.querySelectorAll('tr').length).toBe(4)
  })
  it('prevents duplicate saves and ignores composition keyboard shortcuts', async () => {
    let resolveSave: () => void = () => undefined
    const save = vi.fn(() => new Promise<void>(resolve => { resolveSave = resolve }))
    render(<NoteMarkdownEditor initialMarkdown="# Draft" onSave={save} onClose={vi.fn()} />)
    const region = screen.getByRole('region', { name: 'Create note content' })
    fireEvent.keyDown(region, { key: 's', ctrlKey: true, isComposing: true })
    fireEvent.keyDown(region, { key: 's', ctrlKey: true, keyCode: 229 })
    expect(save).not.toHaveBeenCalled()
    fireEvent.keyDown(region, { key: 's', ctrlKey: true })
    fireEvent.keyDown(region, { key: 's', ctrlKey: true })
    expect(save).toHaveBeenCalledTimes(1)
    resolveSave()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save content' }).hasAttribute('disabled')).toBe(false))
  })
  it('keeps a dirty draft after cancelling and closes only after confirmation', async () => {
    const close = vi.fn()
    render(<NoteMarkdownEditor initialMarkdown="# Original" onSave={vi.fn()} onClose={close} />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    fireEvent.change(screen.getByLabelText('Raw Markdown'), { target: { value: '# Unsaved draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(close).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Raw Markdown') as HTMLTextAreaElement).value).toBe('# Unsaved draft')
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
  })
  it('retains the current source when a template replacement is cancelled', async () => {
    render(<NoteMarkdownEditor initialMarkdown="# Original" onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    fireEvent.change(screen.getByLabelText('Raw Markdown'), { target: { value: '# Keep this draft' } })
    fireEvent.change(screen.getByLabelText('New content template'), { target: { value: 'code' } })
    expect(screen.getByRole('alertdialog', { name: 'Replace unsaved draft?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect((screen.getByLabelText('Raw Markdown') as HTMLTextAreaElement).value).toBe('# Keep this draft')
  })
  it('supports document and code templates with a language selector', async () => {
    render(<NoteMarkdownEditor onSave={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('New content template'), { target: { value: 'code' } })
    await waitFor(() => expect(screen.getByLabelText('Code block language')).toBeTruthy())
    expect((screen.getByLabelText('Code block language') as HTMLSelectElement).value).toBe('typescript')
  })
})
