export type HighlightLanguage = 'markdown' | 'latex'

function escapeHtml(value: string): string {
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

function isLatexSpecial(value: string, index: number, allowComment: boolean): boolean {
  const character = value[index]
  return character === '\\'
    || character === '$'
    || character === '{'
    || character === '}'
    || character === '['
    || character === ']'
    || /[0-9]/.test(character ?? '')
    || (allowComment && character === '%' && !isEscaped(value, index))
}

function highlightLatexFragment(value: string, allowComment: boolean): string {
  let output = ''

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
    while (end < value.length && !isLatexSpecial(value, end, allowComment)) end += 1
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

function highlightMarkdown(value: string): string {
  const lines = value.split('\n')
  let fence: '```' | '~~~' | undefined
  let display: 'dollars' | 'brackets' | 'equation' | undefined

  return lines.map((line) => {
    const trimmed = line.trimStart()

    if (fence) {
      if (trimmed.startsWith(fence)) {
        fence = undefined
        return token('marker', line)
      }
      return token('code', line)
    }

    if (display) {
      const highlighted = highlightLatexFragment(line, false)
      if (
        (display === 'dollars' && trimmed.includes('$$'))
        || (display === 'brackets' && trimmed.includes('\\]'))
        || (display === 'equation' && trimmed.includes('\\end{equation}'))
      ) display = undefined
      return `<span class="token token-math">${highlighted}</span>`
    }

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const marker = trimmed.slice(0, 3) as '```' | '~~~'
      if (trimmed.indexOf(marker, 3) < 0) fence = marker
      return token('marker', line)
    }

    if (trimmed.startsWith('$$')) {
      if (trimmed.indexOf('$$', 2) < 0) display = 'dollars'
      return `<span class="token token-math">${highlightLatexFragment(line, false)}</span>`
    }
    if (trimmed.startsWith('\\[')) {
      if (!trimmed.includes('\\]', 2)) display = 'brackets'
      return `<span class="token token-math">${highlightLatexFragment(line, false)}</span>`
    }
    if (trimmed.startsWith('\\begin{equation}')) {
      if (!trimmed.includes('\\end{equation}')) display = 'equation'
      return `<span class="token token-math">${highlightLatexFragment(line, false)}</span>`
    }

    const heading = /^(\s*)(#{1,6})([ \t]+)(.*)$/.exec(line)
    if (heading) {
      return escapeHtml(heading[1] ?? '')
        + token('marker', heading[2] ?? '')
        + escapeHtml(heading[3] ?? '')
        + highlightMarkdownHeading(heading[4] ?? '')
    }

    const list = /^(\s*)([-+*]|\d+[.)])([ \t]+)(.*)$/.exec(line)
    if (list) {
      return escapeHtml(list[1] ?? '')
        + token('list-marker', list[2] ?? '')
        + escapeHtml(list[3] ?? '')
        + highlightMarkdownInline(list[4] ?? '')
    }

    const quote = /^(\s*)(>)([ \t]?)(.*)$/.exec(line)
    if (quote) {
      return escapeHtml(quote[1] ?? '')
        + token('marker', quote[2] ?? '')
        + escapeHtml(quote[3] ?? '')
        + token('quote', quote[4] ?? '')
    }

    return highlightMarkdownInline(line)
  }).join('\n')
}

function highlightLatex(value: string): string {
  return value.split('\n').map((line) => highlightLatexFragment(line, true)).join('\n')
}

export function highlightCode(value: string, language: HighlightLanguage): string {
  return language === 'markdown' ? highlightMarkdown(value) : highlightLatex(value)
}
