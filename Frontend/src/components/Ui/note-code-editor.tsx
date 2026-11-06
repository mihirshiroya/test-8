import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { CODE_LANGUAGES } from '../../lib/note-markdown'

export function NoteCodeEditor({ node, updateAttributes, editor }: NodeViewProps) {
  const language = String(node.attrs.language || 'text')
  return <NodeViewWrapper className="note-editor-code">
    <div className="note-editor-code-header" contentEditable={false}><span>{'</>'} CODE BLOCK</span><label>Language <select aria-label="Code block language" value={language} disabled={!editor.isEditable} onChange={event => updateAttributes({ language: event.target.value })}>{!CODE_LANGUAGES.includes(language) && <option value={language}>{language}</option>}{CODE_LANGUAGES.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <pre><NodeViewContent<'code'> as="code" style={{ whiteSpace: 'pre' }} /></pre>
  </NodeViewWrapper>
}
