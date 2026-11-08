import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Heading, Nodes, Root } from 'mdast'
import type { Doc, Subtopic, Topic } from './docs-data'
import { docsHeadingAnchors } from './docs-heading'

export type SearchEntry = {
  id: string
  topic: Topic
  subtopic: Subtopic
  anchorId: string | null
  title: string
  path: string[]
  text: string
  titleWords: string[]
  pathWords: string[]
  bodyWords: string[]
}
export type SearchResult = SearchEntry & { score: number; snippet: string; matchedWords: string[] }

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath, { singleDollarTextMath: false })
const stopWords = new Set('a an the is are was were be been being of to for in on at by with from and or how what why when where which who do does did can could should would please show me about explain tell i my it its this that using use work works working'.split(' '))

function normalize(text: string) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function words(text: string) {
  return normalize(text.replace(/([a-z])([A-Z])/g, '$1 $2')).match(/[\p{L}\p{N}_+#]+/gu) ?? []
}

function stem(word: string) {
  if (word.length > 5 && word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

const conceptGroups = [
  ['loop', 'iteration', 'iterate', 'iterating', 'for', 'while', 'foreach', 'repeat', 'repetition'],
  ['inheritance', 'inherit', 'inherits', 'extends', 'subclass', 'superclass'],
  ['polymorphism', 'overriding', 'override', 'overloading', 'overload'],
  ['encapsulation', 'getter', 'setter', 'private', 'visibility'],
  ['exception', 'error', 'errors', 'throw', 'throws', 'catch', 'try'],
  ['concurrency', 'concurrent', 'thread', 'threads', 'threading', 'multithreading', 'parallel'],
  ['array', 'arrays', 'list', 'lists', 'collection', 'collections'],
  ['install', 'installation', 'setup', 'configure', 'configuration'],
  ['function', 'functions', 'method', 'methods'],
  ['create', 'creation', 'instantiate', 'instantiation', 'new', 'constructor'],
  ['memory', 'heap', 'garbage', 'gc'],
  ['jvm', 'virtual', 'machine', 'runtime'],
]
const concepts = new Map<string, Set<string>>()
for (const group of conceptGroups) {
  const variants = new Set(group.map(stem))
  for (const word of variants) concepts.set(word, variants)
}

function plainText(node: Nodes): string {
  if (node.type === 'html') return node.value.replace(/<[^>]*>/g, ' ')
  if ('value' in node) return node.value
  if (node.type === 'image') return node.alt ?? ''
  if ('children' in node) return node.children.map(child => plainText(child as Nodes)).join(node.type === 'paragraph' || node.type === 'heading' || node.type === 'link' || node.type === 'strong' || node.type === 'emphasis' || node.type === 'delete' ? '' : ' ')
  return ''
}

function collectHeadings(tree: Root) {
  const headings: Heading[] = []
  const visit = (node: Nodes) => {
    if (node.type === 'heading') headings.push(node)
    if ('children' in node) node.children.forEach(child => visit(child as Nodes))
  }
  visit(tree)
  return headings
}

function entry(topic: Topic, subtopic: Subtopic, anchorId: string | null, title: string, path: string[], text: string): SearchEntry {
  return {
    id: `${topic.id}:${subtopic.id}:${anchorId ?? 'page'}`, topic, subtopic, anchorId, title, path,
    text: text.replace(/\s+/g, ' ').trim(), titleWords: [...new Set(words(title))], pathWords: [...new Set(words(path.join(' ')))], bodyWords: [...new Set(words(text))],
  }
}

export function buildDocsSearchIndex(doc: Doc): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const topic of doc.topics) {
    for (const subtopic of topic.subtopics) {
      entries.push(entry(topic, subtopic, null, subtopic.title, [topic.title], subtopic.description ?? ''))
      for (const item of subtopic.content) {
        const path = [topic.title, subtopic.title]
        if (item.type === 'code') {
          entries.push(entry(topic, subtopic, `content-${item.id}`, item.title, path, item.content))
          continue
        }
        const tree = parser.parse(item.content)
        const headings = collectHeadings(tree)
        const anchors = docsHeadingAnchors(item.id, headings.map(heading => heading.depth))
        const firstOffset = headings[0]?.position?.start.offset ?? item.content.length
        const introduction = plainText(parser.parse(item.content.slice(0, firstOffset)))
        if (!headings.length || introduction.trim()) {
          entries.push(entry(topic, subtopic, `content-${item.id}`, item.title, path, introduction))
        }
        const hierarchy: { depth: number; title: string }[] = []
        headings.forEach((heading, index) => {
          const title = plainText(heading)
          while (hierarchy.length && hierarchy[hierarchy.length - 1].depth >= heading.depth) hierarchy.pop()
          const start = heading.position?.end.offset ?? 0
          const end = headings[index + 1]?.position?.start.offset ?? item.content.length
          const text = plainText(parser.parse(item.content.slice(start, end)))
          entries.push(entry(topic, subtopic, anchors[index].id, title, [...path, ...hierarchy.map(parent => parent.title)], text))
          hierarchy.push({ depth: heading.depth, title })
        })
      }
    }
  }
  return entries
}

function typoMatch(a: string, b: string) {
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    const differences: number[] = []
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differences.push(i)
    return differences.length <= 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]])
  }
  const shorter = a.length < b.length ? a : b
  const longer = a.length < b.length ? b : a
  let i = 0
  while (i < shorter.length && shorter[i] === longer[i]) i++
  return shorter.slice(i) === longer.slice(i + 1)
}

function wordMatch(query: string, candidate: string, variants: Set<string> | undefined) {
  const root = stem(candidate)
  if (query === candidate || stem(query) === root) return 1
  if (query.length >= 3 && candidate.startsWith(query)) return 0.8
  if (variants?.has(root)) return 0.65
  if (typoMatch(query, candidate)) return 0.5
  return 0
}

function snippet(text: string, matches: string[]) {
  const lower = normalize(text)
  const firstMatch = matches.reduce((best, word) => {
    const position = lower.indexOf(word)
    return position >= 0 ? Math.min(best, position) : best
  }, text.length)
  const start = firstMatch === text.length ? 0 : Math.max(0, firstMatch - 55)
  const end = Math.min(text.length, start + 190)
  return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export function searchDocs(index: SearchEntry[], query: string, limit = 40): SearchResult[] {
  const allWords = words(query)
  const terms = [...new Set(allWords.filter(word => !stopWords.has(word)))]
  if (!terms.length) terms.push(...allWords)
  if (!terms.length) return []
  const phrase = normalize(query.trim())
  const results: SearchResult[] = []
  for (const item of index) {
    let score = 0
    let covered = 0
    const matches = new Set<string>()
    for (const term of terms) {
      const variants = concepts.get(stem(term))
      let best = 0
      for (const [field, weight] of [[item.titleWords, 20], [item.bodyWords, 5], [item.pathWords, 2]] as const) {
        let fieldBest = 0
        for (const candidate of field) {
          const match = wordMatch(term, candidate, variants)
          if (match) {
            fieldBest = Math.max(fieldBest, match)
            matches.add(candidate)
          }
        }
        best = Math.max(best, fieldBest * weight)
      }
      if (best) covered++
      score += best
    }
    if (covered < Math.ceil(terms.length * 0.7)) continue
    if (normalize(item.title).includes(phrase)) score += 60
    if (normalize(item.text).includes(phrase)) score += 12
    score += covered / terms.length * 30
    results.push({ ...item, score, matchedWords: [...matches], snippet: snippet(item.text, [...matches]) })
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit)
}
