import { useAppDispatch } from '../../store'
import type { Content } from '../../lib/docs-data'
import { contentToMarkdown } from '../../lib/note-markdown'
import { addContent, updateContent } from '../../store/slices/notesSlice'
import { NoteMarkdownEditor } from './note-markdown-editor'
import { toast } from '../../lib/toast'

export function NoteContentComposer({ folderId, topicId, subtopicId, initial, onClose, onDirtyChange, onBusyChange }: { folderId: string; topicId: string; subtopicId: string; initial?: Content; onClose: () => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void }) {
  const dispatch = useAppDispatch()
  return <NoteMarkdownEditor initialMarkdown={contentToMarkdown(initial)} editing={Boolean(initial)} onClose={onClose} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange} onSave={async markdown => {
    const content = { type: 'text' as const, language: 'markdown', title: '', content: markdown }
    if (initial) await dispatch(updateContent({ folderId, topicId, subtopicId, contentId: initial.id, changes: content })).unwrap()
    else await dispatch(addContent({ folderId, topicId, subtopicId, content })).unwrap()
    toast.success(initial ? 'Content updated' : 'Content saved')
    onClose()
  }} />
}
