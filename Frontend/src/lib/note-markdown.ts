import type { Content } from './docs-data'

export const MAX_MARKDOWN_BYTES = 1024 * 1024
export const CODE_LANGUAGES = ['text', 'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'bash', 'sql', 'json', 'html', 'css', 'yaml', 'markdown', 'mermaid', 'math', 'video']

export function isMarkdownContent(content: Content) {
  return content.type === 'text' && content.language === 'markdown'
}

export function fencedCode(content: string, language = 'text') {
  const runs = content.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)))
  return `${fence}${language}\n${content}\n${fence}`
}

export function contentToMarkdown(content?: Content) {
  if (!content) return ''
  if (isMarkdownContent(content)) return content.content
  const heading = content.title ? `# ${content.title.replace(/\n/g, ' ')}\n\n` : ''
  return heading + (content.type === 'code' ? fencedCode(content.content, content.language) : content.content)
}

export function markdownTitle(markdown: string) {
  let fence = ''
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ''
      continue
    }
    if (fence) continue
    const heading = line.match(/^ {0,3}#{1,6}[ \t]+(.+?)\s*$/)
    if (heading) return [...heading[1].replace(/[ \t]+#+[ \t]*$/, '').trim()].slice(0, 200).join('')
  }
  return 'Untitled note'
}

export function safeHttpUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function videoSource(value: string): { kind: 'embed' | 'video'; url: string } | null {
  const safe = safeHttpUrl(value)
  if (!safe || !safe.startsWith('https:')) return null
  const url = new URL(safe)
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1)
  if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    id = url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)$/)?.[1] ?? url.searchParams.get('v')
  }
  if (id && /^[\w-]{11}$/.test(id)) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` }
  if (['vimeo.com', 'player.vimeo.com'].includes(host)) {
    const vimeoId = url.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1]
    if (vimeoId) return { kind: 'embed', url: `https://player.vimeo.com/video/${vimeoId}` }
  }
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { kind: 'video', url: safe }
  return null
}
