import { Children, isValidElement, memo, useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import type { Element, Root } from 'hast'
import { safeHttpUrl } from '../../lib/note-markdown'
import { NoteCodePreview } from './note-code-preview'
import { MermaidPreview, VideoPreview } from './note-rich-blocks'
import 'katex/dist/katex.min.css'

const schema = { ...defaultSchema, attributes: { ...defaultSchema.attributes, span: [...(defaultSchema.attributes?.span ?? []), ['style', /^color:\s*#[0-9a-fA-F]{6};?$/]], code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-[\w+-]+$/, 'math-inline', 'math-display']] } }

function annotateCallouts() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      if (node.type === 'element' && node.tagName === 'blockquote') {
        const first = node.children.find(child => child.type === 'element' && child.tagName === 'p') as Element | undefined
        const text = first?.children[0]
        if (text?.type === 'text') {
          const match = text.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i)
          if (match) {
            node.properties.className = ['note-callout']
            node.properties['data-kind'] = match[1].toLowerCase()
            text.value = text.value.slice(match[0].length)
            first?.children.unshift({ type: 'element', tagName: 'strong', properties: { className: ['note-callout-label'] }, children: [{ type: 'text', value: match[1] }] })
          }
        }
      }
      for (const child of node.children) if (child.type === 'element') visit(child)
    }
    visit(tree)
  }
}

function BlockCode({ children }: { children?: ReactNode }) {
  const code = Children.toArray(children).find(isValidElement)
  if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) return <pre>{children}</pre>
  const language = /language-([\w+-]+)/.exec(code.props.className ?? '')?.[1] ?? 'text'
  const source = String(code.props.children ?? '').replace(/\n$/, '')
  if (language === 'mermaid') return <MermaidPreview source={source} />
  if (language === 'video') return <VideoPreview source={source} />
  return <NoteCodePreview content={source} language={language} />
}

export const NoteMarkdownPreview = memo(function NoteMarkdownPreview({ markdown }: { markdown: string }) {
  const plugins = useMemo(() => [rehypeRaw, [rehypeSanitize, schema], [rehypeKatex, { trust: false, strict: 'warn', throwOnError: false, maxExpand: 200, maxSize: 20 }], annotateCallouts] as import('unified').PluggableList, [])
  return <div className="note-prose note-preview">
    <ReactMarkdown remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]} rehypePlugins={plugins} components={{
      pre: ({ children }) => <BlockCode>{children}</BlockCode>,
      a: ({ href, children }) => <a href={href && (safeHttpUrl(href) || (href.startsWith('#') ? href : undefined)) || undefined} target={href?.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{children}</a>,
      img: ({ src, alt }) => src && safeHttpUrl(src) ? <img src={src} alt={alt || 'Note image'} loading="lazy" referrerPolicy="no-referrer" /> : <span className="note-block-error">Image requires an HTTP or HTTPS URL.</span>,
      table: ({ children }) => <div className="note-table-scroll"><table>{children}</table></div>,
    }}>{markdown || '*Your preview will appear here.*'}</ReactMarkdown>
  </div>
})
