import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Download, FileCode2, FileText, Save, Upload, X } from 'lucide-react'
import { MAX_MARKDOWN_BYTES, markdownTitle } from '../../lib/note-markdown'
import { noteEditorExtensions } from '../../lib/note-editor-extensions'
import { NoteEditorToolbar } from './note-editor-toolbar'
import { NoteMarkdownPreview } from './note-markdown-preview'

type Mode = 'write' | 'source' | 'split' | 'preview'
const templates: Record<string, string> = {
  document: '# Untitled note\n\nStart writing here.\n',
  code: '# Code example\n\n```typescript\nexport function hello(name: string) {\n  return `Hello, ${name}`\n}\n```\n',
  checklist: '# Checklist\n\n- [ ] First task\n- [ ] Second task\n- [x] Completed task\n',
  guide: '# Quick guide\n\n> [!NOTE]\n> A useful detail worth remembering.\n\n## Steps\n\n1. Start here\n2. Make it happen\n\n| Item | Status |\n| --- | --- |\n| Draft | In progress |\n\n---\n',
}

export function NoteMarkdownEditor({ initialMarkdown = '', editing = false, onSave, onClose, onDirtyChange, onBusyChange }: { initialMarkdown?: string; editing?: boolean; onSave: (markdown: string) => Promise<void>; onClose: () => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void }) {
  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [mode, setMode] = useState<Mode>('write')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const deferredMarkdown = useDeferredValue(markdown)
  const dirty = markdown !== initialMarkdown
  const editor = useEditor({
    extensions: noteEditorExtensions(),
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'note-prose note-tiptap', 'aria-label': 'Note content', role: 'textbox', 'aria-multiline': 'true', 'data-placeholder': 'Start with a heading. Write, paste Markdown, or import a .md file…' } },
    onUpdate: ({ editor: current }) => setMarkdown(current.getMarkdown()),
  })
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [dirty])
  const changeMode = (next: Mode) => {
    if (next === 'write' && mode !== 'write') editor?.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false })
    setMode(next)
  }
  const replace = (next: string) => {
    if (dirty && !window.confirm('Replace your unsaved draft?')) return false
    setMarkdown(next)
    editor?.commands.setContent(next, { contentType: 'markdown', emitUpdate: false })
    setError('')
    return true
  }
  const save = async () => {
    if (savingRef.current || !markdown.trim()) return
    if (new TextEncoder().encode(markdown).length > MAX_MARKDOWN_BYTES) return setError('Content must be no larger than 1 MB.')
    savingRef.current = true
    setSaving(true)
    onBusyChange?.(true)
    setError('')
    editor?.setEditable(false)
    try { await onSave(markdown) }
    catch (err) { setError(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Unable to save. Your draft is still here.'); editor?.setEditable(true) }
    finally { savingRef.current = false; setSaving(false); onBusyChange?.(false) }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      if (!/\.(md|markdown|mdown)$/i.test(file.name)) throw new Error('Choose a .md, .markdown, or .mdown file.')
      if (file.size > MAX_MARKDOWN_BYTES) throw new Error('Markdown files must be no larger than 1 MB.')
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
      if (!raw.trim() || raw.includes('\0')) throw new Error('Choose a non-empty UTF-8 Markdown file.')
      if (replace(raw)) { setFileName(file.name); setMode('split') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to read this file.') }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${markdownTitle(markdown).replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 100) || 'note'}.md`; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const keyboardSave = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
  }
  return <section className="note-editor" aria-label={editing ? 'Edit note content' : 'Create note content'} onKeyDown={keyboardSave} aria-busy={saving}>
    <header className="note-editor-header"><div className="flex min-w-0 items-center gap-2"><FileText size={16} /><strong>{editing ? 'Edit content' : 'New content'}</strong><span className="note-draft-badge">{saving ? 'Saving…' : dirty ? 'Unsaved draft' : 'Markdown'}</span></div><button type="button" className="note-tool" aria-label="Close editor" disabled={saving} onClick={() => { if (!dirty || window.confirm('Discard your unsaved draft?')) onClose() }}><X size={16} /></button></header>
    <div className="note-editor-actions">
      <div className="note-mode-tabs" role="group" aria-label="Editor view">{([{ key: 'write', label: 'Write' }, { key: 'source', label: 'Markdown' }, { key: 'split', label: 'Split' }, { key: 'preview', label: 'Preview' }] as const).map(item => <button key={item.key} type="button" aria-pressed={mode === item.key} disabled={saving} onClick={() => changeMode(item.key)}>{item.label}</button>)}</div>
      <div className="flex flex-wrap items-center gap-1"><select aria-label="New content template" value="" disabled={saving} className="note-template-select" onChange={event => { if (event.target.value && replace(templates[event.target.value])) { setFileName(''); setMode('write') } }}><option value="">Templates</option><option value="document">Document</option><option value="code">Code example</option><option value="checklist">Checklist</option><option value="guide">Guide + table</option></select><button type="button" className="note-tool" disabled={saving} onClick={() => fileInput.current?.click()} title="Import Markdown file"><Upload size={14} /><span>Import .md</span></button><button type="button" className="note-tool" disabled={!markdown || saving} onClick={download} aria-label="Download Markdown" title="Download Markdown"><Download size={14} /></button><input ref={fileInput} type="file" accept=".md,.markdown,.mdown,text/markdown" aria-label="Import Markdown file" className="sr-only" disabled={saving} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></div>
    </div>
    {mode === 'write' && editor && <><NoteEditorToolbar editor={editor} disabled={saving} /><EditorContent editor={editor} /></>}
    {mode !== 'write' && <div className={mode === 'split' ? 'note-source-preview' : ''}>
      {(mode === 'source' || mode === 'split') && <div className="note-source-pane"><div className="note-pane-label"><FileCode2 size={13} />MARKDOWN SOURCE {fileName && <span className="truncate">· {fileName}</span>}</div><textarea aria-label="Raw Markdown" className="note-source" spellCheck={false} value={markdown} disabled={saving} onChange={event => setMarkdown(event.target.value)} placeholder="# Your heading\n\nPaste raw Markdown here…" /></div>}
      {(mode === 'preview' || mode === 'split') && <div className="note-preview-pane"><div className="note-pane-label">LIVE PREVIEW</div><NoteMarkdownPreview markdown={deferredMarkdown} /></div>}
    </div>}
    {error && <p className="note-editor-error" role="alert">{error}</p>}
    <footer className="note-editor-footer"><div><span>{markdown.trim() ? markdown.trim().split(/\s+/).length : 0} words</span><span>Heading and content saved together · Ctrl/⌘ S</span></div><button type="button" className="work-button work-button--primary" disabled={saving || !markdown.trim()} onClick={() => void save()}><Save size={14} />{saving ? 'Saving…' : editing ? 'Save changes' : 'Save content'}</button></footer>
    <details className="note-markdown-help"><summary>Markdown rules & supported blocks</summary><p>Headings H1–H6, bold, italic, strikethrough, links, images, lists, checklists, tables, quotes and dividers. Use fenced code with a language, <code>mermaid</code> for diagrams, <code>video</code> for approved video URLs, and double-dollar LaTeX for equations. GitHub-style <code>{'> [!NOTE]'}</code> (also TIP, IMPORTANT, WARNING and CAUTION) creates callouts. Hex text colors use <code>{'<span style="color: #6950a8">text</span>'}</code>. Source remains unchanged until you edit in Write mode; unsupported HTML is removed from preview. Imported files must be UTF-8 and at most 1 MB. Images use remote URLs, not embedded files.</p></details>
  </section>
}
