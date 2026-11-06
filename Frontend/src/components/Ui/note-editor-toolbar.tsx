import { useState, type FormEvent, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { AlertCircle, Bold, Code2, ImagePlus, Italic, Link2, List, ListOrdered, ListTodo, Minus, Quote, Redo2, Sigma, Strikethrough, Table2, Undo2, Video, Workflow, X } from 'lucide-react'
import { safeHttpUrl, videoSource } from '../../lib/note-markdown'

type InsertKind = 'link' | 'image' | 'video' | 'math'
function Tool({ label, children, active, disabled, onClick }: { label: string; children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="note-tool" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onClick}>{children}</button>
}

export function NoteEditorToolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const [insert, setInsert] = useState<InsertKind | null>(null)
  const [value, setValue] = useState('')
  const [alt, setAlt] = useState('')
  const [error, setError] = useState('')
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({ bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'), quote: e.isActive('blockquote'), heading: [1, 2, 3, 4, 5, 6].find(level => e.isActive('heading', { level })) ?? 0, color: e.getAttributes('textStyle').color as string | undefined, table: e.isActive('table'), code: e.isActive('codeBlock'), undo: e.can().undo(), redo: e.can().redo() }) })
  const open = (kind: InsertKind) => { setInsert(kind); setValue(kind === 'math' ? 'E = mc^2' : kind === 'link' ? String(editor.getAttributes('link').href ?? '') : ''); setAlt(''); setError('') }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (disabled) return
    if (insert === 'math') {
      if (!value.trim()) return setError('Enter a LaTeX equation.')
      editor.chain().focus().insertContent([{ type: 'mathBlock', content: [{ type: 'text', text: value.trim() }] }, { type: 'paragraph' }]).run()
    } else {
      const url = safeHttpUrl(value)
      if (!url) return setError('Enter a valid HTTP or HTTPS URL.')
      if (insert === 'link') {
        if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: alt.trim() || url, marks: [{ type: 'link', attrs: { href: url } }] }).run()
        else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }
      if (insert === 'image') {
        if (!alt.trim()) return setError('Describe the image for screen readers.')
        editor.chain().focus().setImage({ src: url, alt: alt.trim() }).run()
      }
      if (insert === 'video') {
        if (!videoSource(url)) return setError('Use an HTTPS YouTube, Vimeo, MP4, WebM, or OGG URL.')
        editor.chain().focus().insertContent([{ type: 'codeBlock', attrs: { language: 'video' }, content: [{ type: 'text', text: url }] }, { type: 'paragraph' }]).run()
      }
    }
    setInsert(null)
  }
  return <div className="note-toolbar-shell">
    <fieldset className="note-toolbar" aria-label="Formatting" disabled={disabled}>
      <select className="note-heading-select" aria-label="Heading level" value={state.heading} onChange={event => { const level = Number(event.target.value); if (!level) editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run() }}><option value={0}>Paragraph</option>{[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>Heading {level}</option>)}</select>
      <span className="note-toolbar-separator" />
      <Tool label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></Tool><Tool label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></Tool><Tool label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></Tool>
      <label className="note-tool note-color-tool" title="Text color"><span aria-hidden="true" style={{ borderColor: state.color || 'currentColor' }}>A</span><input type="color" aria-label="Text color" value={/^#[\da-f]{6}$/i.test(state.color ?? '') ? state.color : '#6950a8'} onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label>
      <Tool label="Reset text color" onClick={() => editor.chain().focus().unsetColor().run()}><span className="text-xs">A×</span></Tool>
      <span className="note-toolbar-separator" />
      <Tool label="Insert link" onClick={() => open('link')}><Link2 size={15} /></Tool><Tool label="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}><span className="text-xs">Unlink</span></Tool><Tool label="Insert image" onClick={() => open('image')}><ImagePlus size={15} /></Tool>
      <Tool label="Unordered list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></Tool><Tool label="Ordered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></Tool><Tool label="Checklist" active={state.task} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListTodo size={15} /></Tool>
      <span className="note-toolbar-separator" />
      <Tool label="Insert table" active={state.table} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={15} /></Tool><Tool label="Code block" active={state.code} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={15} /></Tool><Tool label="Blockquote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></Tool>
      <select aria-label="Insert callout" className="note-callout-select" value="" onChange={event => { if (event.target.value) editor.chain().focus().insertContent({ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: `[!${event.target.value}]` }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Add your message here.' }] }] }).run() }}><option value="">Callout</option>{['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'].map(kind => <option key={kind}>{kind}</option>)}</select>
      <Tool label="Horizontal divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></Tool><Tool label="Mermaid diagram" onClick={() => editor.chain().focus().insertContent([{ type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: 'flowchart LR\n  Idea --> Draft\n  Draft --> Published' }] }, { type: 'paragraph' }]).run()}><Workflow size={15} /></Tool><Tool label="Mathematical equation" onClick={() => open('math')}><Sigma size={15} /></Tool><Tool label="Video embed" onClick={() => open('video')}><Video size={15} /></Tool>
      <span className="note-toolbar-separator" /><Tool label="Undo" disabled={!state.undo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Tool><Tool label="Redo" disabled={!state.redo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Tool>
    </fieldset>
    {state.table && <div className="note-table-tools">{[{ label: 'Add row', action: () => editor.chain().focus().addRowAfter().run() }, { label: 'Add column', action: () => editor.chain().focus().addColumnAfter().run() }, { label: 'Delete row', action: () => editor.chain().focus().deleteRow().run() }, { label: 'Delete column', action: () => editor.chain().focus().deleteColumn().run() }, { label: 'Delete table', action: () => editor.chain().focus().deleteTable().run() }].map(item => <button type="button" key={item.label} className="note-tool" disabled={disabled} onClick={item.action}>{item.label}</button>)}</div>}
    {insert && <form className="note-insert-panel" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3"><strong>{insert === 'math' ? 'Insert equation' : `Insert ${insert}`}</strong><button type="button" className="note-tool" aria-label="Close insertion panel" onClick={() => setInsert(null)}><X size={15} /></button></div>
      <label className="work-field">{insert === 'math' ? 'LaTeX equation' : 'URL'}<input autoFocus className="work-input" value={value} maxLength={insert === 'math' ? 10000 : 2048} disabled={disabled} required onChange={event => setValue(event.target.value)} placeholder={insert === 'math' ? 'E = mc^2' : 'https://…'} /></label>
      {(insert === 'image' || insert === 'link') && <label className="work-field">{insert === 'image' ? 'Image description (required)' : 'Link text (optional)'}<input className="work-input" value={alt} disabled={disabled} required={insert === 'image'} onChange={event => setAlt(event.target.value)} /></label>}
      {insert === 'video' && <p>YouTube, Vimeo, or direct video URLs. Only approved video hosts can be embedded.</p>}
      {error && <p className="note-block-error" role="alert"><AlertCircle size={14} />{error}</p>}
      <button type="submit" className="work-button work-button--primary" disabled={disabled}>Insert {insert}</button>
    </form>}
  </div>
}
