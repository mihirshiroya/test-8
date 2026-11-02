import { useState, type FormEvent } from 'react'
import { toast } from '../../lib/toast'
import { useAppDispatch } from '../../store'
import { addTopic, addSubtopic, addContent, updateContent, updateTopic, updateSubtopic, deleteTopic, deleteSubtopic, deleteContent } from '../../store/slices/notesSlice'
import type { Content } from '../../lib/docs-data'
import { WorkDialog } from './work-dialog'

export type DocEditTarget = { kind: 'topic' | 'subtopic' | 'content'; action: 'add' | 'edit' | 'delete'; topicId?: string; subtopicId?: string; content?: Content; title?: string; description?: string }
export function DocsEditDialog({ folderId, target, onClose, onSelect }: { folderId: string; target: DocEditTarget; onClose: () => void; onSelect: (id: string) => void }) {
  const dispatch = useAppDispatch()
  const [title, setTitle] = useState(target.content?.title ?? target.title ?? '')
  const [description, setDescription] = useState(target.description ?? '')
  const [content, setContent] = useState(target.content?.content ?? '')
  const [type, setType] = useState<'text' | 'code'>(target.content?.type ?? 'text')
  const [language, setLanguage] = useState(target.content?.language ?? 'text')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const deleting = target.action === 'delete'
  const noun = target.kind === 'subtopic' ? 'section' : target.kind === 'content' ? 'content block' : 'topic'
  const heading = `${deleting ? 'Delete' : target.action === 'edit' ? 'Edit' : 'Add'} ${noun}`
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || (!deleting && (!title.trim() || (target.kind === 'content' && !content.trim())))) return
    setSaving(true)
    setError('')
    const topicId = target.topicId ?? ''
    const subtopicId = target.subtopicId ?? ''
    try {
      if (deleting) {
        if (target.kind === 'topic') await dispatch(deleteTopic({ folderId, topicId })).unwrap()
        if (target.kind === 'subtopic') await dispatch(deleteSubtopic({ folderId, topicId, subtopicId })).unwrap()
        if (target.kind === 'content' && target.content) await dispatch(deleteContent({ folderId, topicId, subtopicId, contentId: target.content.id })).unwrap()
      } else if (target.kind === 'topic') {
        if (target.action === 'edit') await dispatch(updateTopic({ folderId, topicId, title: title.trim() })).unwrap()
        else { const result = await dispatch(addTopic({ folderId, title: title.trim() })).unwrap(); onSelect(result.topic.id) }
      } else if (target.kind === 'subtopic') {
        if (target.action === 'edit') await dispatch(updateSubtopic({ folderId, topicId, subtopicId, title: title.trim(), description: description.trim() })).unwrap()
        else { const result = await dispatch(addSubtopic({ folderId, topicId, title: title.trim(), description: description.trim() })).unwrap(); onSelect(result.subtopic.id) }
      } else {
        const block = { title: title.trim(), content: type === 'code' ? content : content.trim(), type, ...(type === 'code' ? { language: language.trim() || 'text' } : {}) }
        if (target.action === 'edit' && target.content) await dispatch(updateContent({ folderId, topicId, subtopicId, contentId: target.content.id, changes: block })).unwrap()
        else { const result = await dispatch(addContent({ folderId, topicId, subtopicId, content: block })).unwrap(); onSelect(`content-${result.content.id}`) }
      }
      toast.success(deleting ? 'Deleted successfully' : 'Changes saved')
      onClose()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Unable to save changes. Please try again.')
      setSaving(false)
    }
  }
  return <WorkDialog title={heading} busy={saving} onClose={onClose}>
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {deleting ? <p className="text-sm leading-relaxed text-secondary">Delete <strong className="text-primary">{target.content?.title ?? target.title}</strong>? {target.kind !== 'content' && 'All content inside will also be deleted. '}This cannot be undone.</p> : <>
        <label className="work-field">Title<input autoFocus className="work-input" required maxLength={200} value={title} disabled={saving} onChange={e => setTitle(e.target.value)} placeholder={`Name this ${noun}`} /></label>
        {target.kind === 'subtopic' && <label className="work-field">Description <span className="text-xs text-secondary">Optional</span><textarea className="work-input" rows={3} value={description} disabled={saving} onChange={e => setDescription(e.target.value)} /></label>}
        {target.kind === 'content' && <>
          <div className="grid gap-4 sm:grid-cols-2"><label className="work-field">Content type<select className="work-input" value={type} disabled={saving} onChange={e => setType(e.target.value as 'text' | 'code')}><option value="text">Text</option><option value="code">Code</option></select></label>{type === 'code' && <label className="work-field">Language<input className="work-input" maxLength={50} value={language} disabled={saving} onChange={e => setLanguage(e.target.value)} placeholder="e.g. typescript" /></label>}</div>
          <label className="work-field">Content<textarea className={`work-input ${type === 'code' ? 'font-mono' : ''}`} rows={9} required value={content} disabled={saving} spellCheck={type !== 'code'} onChange={e => setContent(e.target.value)} placeholder={type === 'code' ? 'Paste your code here' : 'Write your content here'} /></label>
        </>}
      </>}
      {error && <p className="work-error" role="alert">{error}</p>}
      <div className="mt-2 flex justify-end gap-2"><button type="button" className="work-button" onClick={onClose} disabled={saving} autoFocus={deleting}>Cancel</button><button type="submit" className={`work-button ${deleting ? 'text-[var(--color-error)]' : 'work-button--primary'}`} disabled={saving || (!deleting && (!title.trim() || (target.kind === 'content' && !content.trim())))}>{saving ? 'Saving…' : deleting ? 'Delete permanently' : 'Save changes'}</button></div>
    </form>
  </WorkDialog>
}
