import { Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Image from '@tiptap/extension-image'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Blockquote from '@tiptap/extension-blockquote'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { fencedCode } from './note-markdown'
import { noteLowlight } from './note-highlighting'
import { NoteCodeEditor } from '../components/Ui/note-code-editor'


const ColoredText = TextStyle.extend({
  renderMarkdown(node, helpers) {
    const children = helpers.renderChildren(node)
    const color = node.attrs?.color as string | undefined
    return color && /^#[\da-f]{6}$/i.test(color) ? `<span style="color: ${color}">${children}</span>` : children
  },
})

const MathBlock = Node.create({
  name: 'mathBlock', group: 'block', content: 'text*', marks: '', code: true, defining: true,
  parseHTML: () => [{ tag: 'div[data-math-block]' }],
  renderHTML: () => ['div', { 'data-math-block': '', class: 'note-editor-math' }, 0],
  markdownTokenizer: {
    name: 'mathBlock', level: 'block', start: source => source.search(/^\$\$[ \t]*\n/m),
    tokenize: source => {
      const match = /^\$\$[ \t]*\n([\s\S]*?)\n\$\$(?:[ \t]*\n|[ \t]*$)/.exec(source)
      return match ? { type: 'mathBlock', raw: match[0], text: match[1].trim() } : undefined
    },
  },
  parseMarkdown: token => ({ type: 'mathBlock', content: token.text ? [{ type: 'text', text: token.text }] : [] }),
  renderMarkdown: node => `$$\n${node.content?.map(child => child.text ?? '').join('') ?? ''}\n$$`,
})

const MathInline = Node.create({
  name: 'mathInline', group: 'inline', inline: true, content: 'text*', marks: '', code: true,
  parseHTML: () => [{ tag: 'span[data-math-inline]' }],
  renderHTML: () => ['span', { 'data-math-inline': '', class: 'note-editor-inline-math' }, 0],
  markdownTokenizer: {
    name: 'mathInline', level: 'inline', start: source => source.indexOf('$$'),
    tokenize: source => {
      const match = /^\$\$([^\n]+?)\$\$/.exec(source)
      return match ? { type: 'mathInline', raw: match[0], text: match[1] } : undefined
    },
  },
  parseMarkdown: token => ({ type: 'mathInline', content: token.text ? [{ type: 'text', text: token.text }] : [] }),
  renderMarkdown: node => `$$${node.content?.map(child => child.text ?? '').join('') ?? ''}$$`,
})

export function noteEditorExtensions() {
  return [
    StarterKit.configure({ codeBlock: false, blockquote: false, link: { openOnClick: false, protocols: ['http', 'https'], HTMLAttributes: { rel: 'noopener noreferrer' } } }),
    Blockquote.extend({
      renderMarkdown(node, helpers) {
        const result = node.content?.map((child, index) => {
          const value = helpers.renderChild?.(child, index) ?? helpers.renderChildren([child])
          return value.split('\n').map(line => line.trim() ? `> ${line}` : '>').join('\n')
        }).join('\n>\n') ?? ''
        return result.replace(/^> \\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\\]/i, '> [!$1]')
      },
    }),
    Markdown.configure({ markedOptions: { gfm: true } }),
    TableKit.configure({ table: { resizable: false } }), TaskList, TaskItem.configure({ nested: true }),
    Image.configure({ allowBase64: false }), ColoredText, Color,
    CodeBlockLowlight.extend({
      renderMarkdown: node => fencedCode(node.content?.map(child => child.text ?? '').join('') ?? '', node.attrs?.language ?? 'text'),
      addNodeView: () => ReactNodeViewRenderer(NoteCodeEditor),
    }).configure({ lowlight: noteLowlight, defaultLanguage: 'text' }),
    MathBlock, MathInline,
  ]
}
