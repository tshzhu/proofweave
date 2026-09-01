export type HighlightLanguage = 'markdown' | 'latex'

function escapeHtml(value: string): string {
  if (!/[&<>"']/.test(value)) return value
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

function token(kind: string, value: string): string {
  return `<span class="token token-${kind}">${escapeHtml(value)}</span>`
}

function isEscaped(value: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashes += 1
  }
  return slashes % 2 === 1
}

function findUnescaped(value: string, needle: string, start: number): number {
  let index = value.indexOf(needle, start)
  while (index >= 0) {
    if (!isEscaped(value, index)) return index
    index = value.indexOf(needle, index + needle.length)
  }
  return -1
}

function latexCommandAt(value: string, index: number): string | undefined {
  if (value[index] !== '\\') return undefined
  return /^\\(?:[A-Za-z@]+\*?|.)/.exec(value.slice(index))?.[0]
}

const LATEX_SPECIAL = '\\${}[]0123456789'
const LATEX_SPECIAL_WITH_COMMENT = `${LATEX_SPECIAL}%`

function highlightLatexFragment(value: string, allowComment: boolean): string {
  let output = ''
  const special = allowComment ? LATEX_SPECIAL_WITH_COMMENT : LATEX_SPECIAL

  for (let index = 0; index < value.length;) {
    const character = value[index]

    if (allowComment && character === '%' && !isEscaped(value, index)) {
      output += token('comment', value.slice(index))
      break
    }

    if (character === '\\') {
      const command = latexCommandAt(value, index) ?? '\\'
      const afterCommand = index + command.length
      if ((command === '\\begin' || command === '\\end') && value[afterCommand] === '{') {
        const close = value.indexOf('}', afterCommand + 1)
        if (close >= 0) {
          output += token('command', command)
          output += token('punctuation', '{')
          output += token('environment', value.slice(afterCommand + 1, close))
          output += token('punctuation', '}')
          index = close + 1
          continue
        }
      }
      const kind = ['\\(', '\\)', '\\[', '\\]'].includes(command)
        ? 'math-delimiter'
        : 'command'
      output += token(kind, command)
      index = afterCommand
      continue
    }

    if (character === '$') {
      const delimiter = value[index + 1] === '$' ? '$$' : '$'
      output += token('math-delimiter', delimiter)
      index += delimiter.length
      continue
    }

    if (character && '{}[]'.includes(character)) {
      output += token('punctuation', character)
      index += 1
      continue
    }

    if (character && /[0-9]/.test(character)) {
      const number = /^[0-9]+(?:\.[0-9]+)?/.exec(value.slice(index))?.[0] ?? character
      output += token('number', number)
      index += number.length
      continue
    }

    let end = index + 1
    while (end < value.length && !special.includes(value[end] ?? '')) end += 1
    output += escapeHtml(value.slice(index, end))
    index = end
  }

  return output
}

function highlightMarkdownInline(value: string): string {
  let output = ''

  for (let index = 0; index < value.length;) {
    if (value[index] === '`') {
      const close = value.indexOf('`', index + 1)
      if (close >= 0) {
        output += token('marker', '`')
        output += token('code', value.slice(index + 1, close))
        output += token('marker', '`')
        index = close + 1
        continue
      }
    }

    if (value.startsWith('\\(', index)) {
      const close = findUnescaped(value, '\\)', index + 2)
      if (close >= 0) {
        output += token('math-delimiter', '\\(')
        output += `<span class="token token-math">${highlightLatexFragment(value.slice(index + 2, close), false)}</span>`
        output += token('math-delimiter', '\\)')
        index = close + 2
        continue
      }
    }

    if (value[index] === '$' && !isEscaped(value, index)) {
      const delimiter = value[index + 1] === '$' ? '$$' : '$'
      const close = findUnescaped(value, delimiter, index + delimiter.length)
      if (close >= 0) {
        output += token('math-delimiter', delimiter)
        output += `<span class="token token-math">${highlightLatexFragment(value.slice(index + delimiter.length, close), false)}</span>`
        output += token('math-delimiter', delimiter)
        index = close + delimiter.length
        continue
      }
    }

    const strongMarker = value.startsWith('**', index)
      ? '**'
      : value.startsWith('__', index) ? '__' : undefined
    if (strongMarker) {
      const close = value.indexOf(strongMarker, index + 2)
      if (close >= 0) {
        output += token('marker', strongMarker)
        output += token('strong', value.slice(index + 2, close))
        output += token('marker', strongMarker)
        index = close + 2
        continue
      }
    }

    if (value[index] === '*' || value[index] === '_') {
      const marker = value[index] ?? ''
      const close = value.indexOf(marker, index + 1)
      if (close > index + 1) {
        output += token('marker', marker)
        output += token('emphasis', value.slice(index + 1, close))
        output += token('marker', marker)
        index = close + 1
        continue
      }
    }

    if (value[index] === '[') {
      const link = /^\[([^\]]+)]\(([^)]+)\)/.exec(value.slice(index))
      if (link) {
        output += token('marker', '[')
        output += token('link', link[1] ?? '')
        output += token('marker', '](')
        output += token('url', link[2] ?? '')
        output += token('marker', ')')
        index += link[0].length
        continue
      }
    }

    if (value[index] === '\\') {
      const command = latexCommandAt(value, index)
      if (command) {
        output += token('command', command)
        index += command.length
        continue
      }
    }

    let end = index + 1
    while (end < value.length && !'`\\$*_['.includes(value[end] ?? '')) end += 1
    output += escapeHtml(value.slice(index, end))
    index = end
  }

  return output
}

const ENVIRONMENT_WORDS = new Set([
  'theorem',
  'lemma',
  'proposition',
  'corollary',
  'assumption',
  'definition',
  'remark',
  'statement',
  'proof',
])

function highlightMarkdownHeading(text: string): string {
  const word = /^([^\s]+)([\s\S]*)$/.exec(text)
  if (!word) return ''
  const first = word[1] ?? ''
  if (ENVIRONMENT_WORDS.has(first.toLowerCase())) {
    return token('keyword', first) + token('heading', word[2] ?? '')
  }
  return token('heading', text)
}

function markdownCommentStart(value: string, start = 0): number {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '`') {
      const close = value.indexOf('`', index + 1)
      if (close < 0) return -1
      index = close
      continue
    }
    if (value.startsWith('<!--', index)) return index
  }
  return -1
}

function highlightMarkdownInlineWithComments(value: string): { commentOpen: boolean; html: string } {
  let html = ''
  let cursor = 0
  while (cursor < value.length) {
    const start = markdownCommentStart(value, cursor)
    if (start < 0) return { commentOpen: false, html: html + highlightMarkdownInline(value.slice(cursor)) }
    html += highlightMarkdownInline(value.slice(cursor, start))
    const close = value.indexOf('-->', start + 4)
    if (close < 0) return { commentOpen: true, html: html + token('comment', value.slice(start)) }
    html += token('comment', value.slice(start, close + 3))
    cursor = close + 3
  }
  return { commentOpen: false, html }
}

function highlightMarkdown(value: string): string {
  const lines = value.split('\n')
  let fence: '```' | '~~~' | undefined
  let display: 'dollars' | 'brackets' | 'equation' | undefined
  let comment = false

  return lines.map((line) => {
    const trimmed = line.trimStart()

    if (fence) {
      if (trimmed.startsWith(fence)) {
        fence = undefined
        return token('marker', line)
      }
      return token('code', line)
    }

    let commentOutput = ''
    let cursor = 0
    if (comment) {
      const close = line.indexOf('-->')
      if (close < 0) return token('comment', line)
      commentOutput = token('comment', line.slice(0, close + 3))
      cursor = close + 3
      comment = false
    }

    const source = line.slice(cursor)
    const commentStart = markdownCommentStart(source)
    const normal = commentStart < 0 ? source : source.slice(0, commentStart)

    const highlightNormal = (): string => {
      const normalTrimmed = normal.trimStart()

      if (display) {
        const highlighted = highlightLatexFragment(normal, false)
        if (
          (display === 'dollars' && normalTrimmed.includes('$$'))
          || (display === 'brackets' && normalTrimmed.includes('\\]'))
          || (display === 'equation' && normalTrimmed.includes('\\end{equation}'))
        ) display = undefined
        return `<span class="token token-math">${highlighted}</span>`
      }

      if (normalTrimmed.startsWith('```') || normalTrimmed.startsWith('~~~')) {
        const marker = normalTrimmed.slice(0, 3) as '```' | '~~~'
        if (normalTrimmed.indexOf(marker, 3) < 0) fence = marker
        return token('marker', normal)
      }

      if (normalTrimmed.startsWith('$$')) {
        if (normalTrimmed.indexOf('$$', 2) < 0) display = 'dollars'
        return `<span class="token token-math">${highlightLatexFragment(normal, false)}</span>`
      }
      if (normalTrimmed.startsWith('\\[')) {
        if (!normalTrimmed.includes('\\]', 2)) display = 'brackets'
        return `<span class="token token-math">${highlightLatexFragment(normal, false)}</span>`
      }
      if (normalTrimmed.startsWith('\\begin{equation}')) {
        if (!normalTrimmed.includes('\\end{equation}')) display = 'equation'
        return `<span class="token token-math">${highlightLatexFragment(normal, false)}</span>`
      }

      const heading = /^(\s*)(#{1,6})([ \t]+)(.*)$/.exec(normal)
      if (heading) {
        return escapeHtml(heading[1] ?? '')
          + token('marker', heading[2] ?? '')
          + escapeHtml(heading[3] ?? '')
          + highlightMarkdownHeading(heading[4] ?? '')
      }

      const list = /^(\s*)([-+*]|\d+[.)])([ \t]+)(.*)$/.exec(normal)
      if (list) {
        return escapeHtml(list[1] ?? '')
          + token('list-marker', list[2] ?? '')
          + escapeHtml(list[3] ?? '')
          + highlightMarkdownInline(list[4] ?? '')
      }

      const quote = /^(\s*)(>)([ \t]?)(.*)$/.exec(normal)
      if (quote) {
        return escapeHtml(quote[1] ?? '')
          + token('marker', quote[2] ?? '')
          + escapeHtml(quote[3] ?? '')
          + token('quote', quote[4] ?? '')
      }

      return highlightMarkdownInline(normal)
    }

    let output = commentOutput + highlightNormal()
    if (commentStart < 0) return output

    const highlighted = highlightMarkdownInlineWithComments(source.slice(commentStart))
    comment = highlighted.commentOpen
    return output + highlighted.html
  }).join('\n')
}

function highlightLatex(value: string): string {
  return value.split('\n').map((line) => highlightLatexFragment(line, true)).join('\n')
}

export function highlightCode(value: string, language: HighlightLanguage): string {
  return language === 'markdown' ? highlightMarkdown(value) : highlightLatex(value)
}
