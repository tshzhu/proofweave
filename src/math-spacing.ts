import { normalizeLabelPrefix } from "./labels.ts";

export interface MathSpacingOptions {
  enabled: boolean
  relations: boolean
  binaryOperators: boolean
  punctuation: boolean
  compactParentheses: boolean
  pairedBars: boolean
  namedFunctions: boolean
}

export interface MathCleanupOptions {
  normalizeLabelPrefixes: boolean
  fontCommandBraces: boolean
  collapseSpaces: boolean
}

export const DEFAULT_MATH_SPACING_OPTIONS: Readonly<MathSpacingOptions> = {
  enabled: true,
  relations: true,
  binaryOperators: true,
  punctuation: true,
  compactParentheses: true,
  pairedBars: true,
  namedFunctions: true,
}

export const DEFAULT_MATH_CLEANUP_OPTIONS: Readonly<MathCleanupOptions> = {
  normalizeLabelPrefixes: true,
  fontCommandBraces: true,
  collapseSpaces: true,
}

type TokenKind =
  | 'alignment'
  | 'atom'
  | 'bar'
  | 'bar-close'
  | 'bar-open'
  | 'binary'
  | 'close'
  | 'command'
  | 'function'
  | 'open'
  | 'opaque'
  | 'punctuation'
  | 'relation'
  | 'script'
  | 'spacing'

interface MathToken {
  end: number
  kind: TokenKind
  start: number
  value: string
}

const RELATION_COMMANDS = new Set([
  '\\approx',
  '\\asto',
  '\\cong',
  '\\coloneqq',
  '\\eqqcolon',
  '\\equiv',
  '\\ge',
  '\\geq',
  '\\geqslant',
  '\\given',
  '\\in',
  '\\le',
  '\\leq',
  '\\leqslant',
  '\\Leftarrow',
  '\\Leftrightarrow',
  '\\leftarrow',
  '\\leftrightarrow',
  '\\longrightarrow',
  '\\Longrightarrow',
  '\\longleftrightarrow',
  '\\Longleftrightarrow',
  '\\longmapsto',
  '\\mapsto',
  '\\mid',
  '\\ne',
  '\\neq',
  '\\notin',
  '\\parallel',
  '\\perp',
  '\\prec',
  '\\preceq',
  '\\propto',
  '\\pto',
  '\\rightarrow',
  '\\Rightarrow',
  '\\simeq',
  '\\sim',
  '\\subset',
  '\\subseteq',
  '\\sqsubset',
  '\\sqsubseteq',
  '\\succ',
  '\\succeq',
  '\\supset',
  '\\supseteq',
  '\\to',
])

const BINARY_COMMANDS = new Set([
  '\\ast',
  '\\bullet',
  '\\cap',
  '\\circ',
  '\\cdot',
  '\\cup',
  '\\diamond',
  '\\div',
  '\\land',
  '\\lor',
  '\\mp',
  '\\oplus',
  '\\otimes',
  '\\pm',
  '\\setminus',
  '\\times',
  '\\vee',
  '\\wedge',
])

const NAMED_FUNCTIONS = new Set([
  '\\arccos',
  '\\arcsin',
  '\\arctan',
  '\\argmax',
  '\\argmin',
  '\\cos',
  '\\cosh',
  '\\cot',
  '\\csc',
  '\\det',
  '\\dim',
  '\\exp',
  '\\gcd',
  '\\inf',
  '\\ln',
  '\\log',
  '\\max',
  '\\min',
  '\\sec',
  '\\sin',
  '\\sinh',
  '\\sup',
  '\\tan',
  '\\tanh',
])

const OPAQUE_ARGUMENT_COMMANDS = new Set([
  '\\begin',
  '\\bm',
  '\\boldsymbol',
  '\\cite',
  '\\cref',
  '\\end',
  '\\eqref',
  '\\label',
  '\\hat',
  '\\mathbb',
  '\\mathbf',
  '\\mathcal',
  '\\mathfrak',
  '\\mathit',
  '\\mathnormal',
  '\\overbrace',
  '\\overline',
  '\\overleftarrow',
  '\\overleftrightarrow',
  '\\overrightarrow',
  '\\mathrm',
  '\\mathsf',
  '\\mathscr',
  '\\mathtt',
  '\\mbox',
  '\\operatorname',
  '\\ref',
  '\\tag',
  '\\text',
  '\\textnormal',
  '\\textrm',
  '\\tilde',
  '\\underline',
  '\\vec',
  '\\widecheck',
  '\\widehat',
  '\\widetilde',
])

const PRESERVE_GROUP_COMMANDS = new Set([
  '\\cite',
  '\\cref',
  '\\eqref',
  '\\label',
  '\\ref',
  '\\tag',
])

const LABEL_ARGUMENT_COMMANDS = new Set([
  '\\cref',
  '\\eqref',
  '\\label',
  '\\ref',
])

const SINGLE_ATOM_COMMANDS = new Set([
  '\\bm',
  '\\boldsymbol',
  '\\breve',
  '\\check',
  '\\dddot',
  '\\ddot',
  '\\dot',
  '\\grave',
  '\\hat',
  '\\mathbb',
  '\\mathcal',
  '\\mathfrak',
  '\\mathit',
  '\\mathnormal',
  '\\mathbf',
  '\\mathrm',
  '\\mathsf',
  '\\mathscr',
  '\\mathtt',
  '\\acute',
  '\\overbrace',
  '\\overline',
  '\\overleftarrow',
  '\\overleftrightarrow',
  '\\overrightarrow',
  '\\tilde',
  '\\underline',
  '\\vec',
  '\\widecheck',
  '\\widehat',
  '\\widetilde',
])

const NON_ATOMIC_FONT_ARGUMENT_COMMANDS = new Set([
  '\\begin',
  '\\big',
  '\\Big',
  '\\Bigg',
  '\\bigg',
  '\\left',
  '\\operatorname',
  '\\text',
])

const SPACING_COMMANDS = new Set([
  '\\ ',
  '\\!',
  '\\,',
  '\\:',
  '\\;',
  '\\enspace',
  '\\hfill',
  '\\hspace',
  '\\kern',
  '\\mkern',
  '\\negmedspace',
  '\\negthickspace',
  '\\negthinspace',
  '\\quad',
  '\\qquad',
  '\\thickspace',
  '\\thinspace',
])

const AMBIGUOUS_BAR_COMMANDS = new Set(['\\|', '\\vert', '\\Vert'])
const OPEN_BAR_COMMANDS = new Set(['\\lvert', '\\lVert'])
const CLOSE_BAR_COMMANDS = new Set(['\\rvert', '\\rVert'])
const CALL_WRAPPER_COMMANDS = new Set([
  '\\abs',
  '\\card',
  '\\left',
  '\\norm',
  '\\set',
])

const RECURSIVE_GROUP_COMMANDS = new Set([
  '\\binom',
  '\\dfrac',
  '\\frac',
  '\\overset',
  '\\sqrt',
  '\\tfrac',
  '\\underset',
])

function commandAt(value: string, index: number): string {
  let end = index + 1
  if (/[A-Za-z@]/.test(value[end] ?? '')) {
    end += 1
    while (end < value.length && /[A-Za-z@]/.test(value[end] ?? '')) end += 1
    if (value[end] === '*') end += 1
  } else if (end < value.length) {
    end += 1
  }
  return value.slice(index, end)
}

function numberEnd(value: string, start: number): number | undefined {
  let end = start
  if (value[end] === '.') {
    if (!/[0-9]/.test(value[end + 1] ?? '')) return undefined
    end += 1
    while (/[0-9]/.test(value[end] ?? '')) end += 1
  } else {
    if (!/[0-9]/.test(value[end] ?? '')) return undefined
    while (/[0-9]/.test(value[end] ?? '')) end += 1
    if (value[end] === '.') {
      end += 1
      while (/[0-9]/.test(value[end] ?? '')) end += 1
    }
  }

  if (value[end] === 'e' || value[end] === 'E') {
    let exponent = end + 1
    if (value[exponent] === '+' || value[exponent] === '-') exponent += 1
    const exponentStart = exponent
    while (/[0-9]/.test(value[exponent] ?? '')) exponent += 1
    if (exponent > exponentStart) end = exponent
  }
  return end
}

function identifierEnd(value: string, start: number): number {
  let end = start
  while (end < value.length) {
    const codePoint = value.codePointAt(end)
    if (codePoint === undefined || !/[\p{L}\p{N}]/u.test(String.fromCodePoint(codePoint))) break
    end += codePoint > 0xffff ? 2 : 1
  }
  return end
}

function commandBase(command: string): string {
  return command.endsWith('*') ? command.slice(0, -1) : command
}

function groupEnd(value: string, start: number): number | undefined {
  if (value[start] !== '{') return undefined
  let depth = 0
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1
      continue
    }
    if (value[index] === '{') depth += 1
    else if (value[index] === '}') {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return undefined
}

function singleFontAtomEnd(value: string, start: number): number | undefined {
  if (start >= value.length || value[start] === '{' || value[start] === '[') return undefined
  if (value[start] === '\\') {
    const command = commandAt(value, start)
    const base = commandBase(command)
    const afterCommand = start + command.length
    if (NON_ATOMIC_FONT_ARGUMENT_COMMANDS.has(base)) return undefined
    // A command followed by an argument group is a compound atom (for example
    // `\\sqrt{x}`), so do not split it by wrapping only the control word.
    if (value[afterCommand] === '{' || value[afterCommand] === '[') return undefined
    return afterCommand
  }
  const codePoint = value.codePointAt(start)
  return codePoint === undefined ? undefined : start + (codePoint > 0xffff ? 2 : 1)
}

function braceFontCommandArguments(value: string): string {
  if (!value.includes('\\')) return value
  let result = ''
  for (let index = 0; index < value.length;) {
    if (value[index] !== '\\') {
      result += value[index]
      index += 1
      continue
    }

    const command = commandAt(value, index)
    const afterCommand = index + command.length
    const base = commandBase(command)

    if (SINGLE_ATOM_COMMANDS.has(base)) {
      let argumentStart = afterCommand
      while (argumentStart < value.length && /[ \t]/.test(value[argumentStart] ?? '')) argumentStart += 1

      if (value[argumentStart] === '{') {
        const end = groupEnd(value, argumentStart)
        if (end !== undefined) {
          result += command + value.slice(argumentStart, end)
          index = end
          continue
        }
      }

      const argumentEnd = singleFontAtomEnd(value, argumentStart)
      if (argumentEnd !== undefined) {
        result += `${command}{${value.slice(argumentStart, argumentEnd)}}`
        index = argumentEnd
        continue
      }
    }

    // Text, labels, and other opaque command arguments are not mathematical
    // source for this rule. Skip their balanced group as one unit.
    if (OPAQUE_ARGUMENT_COMMANDS.has(base) && value[afterCommand] === '{') {
      const end = groupEnd(value, afterCommand)
      if (end !== undefined) {
        result += value.slice(index, end)
        index = end
        continue
      }
    }

    result += command
    index = afterCommand
  }
  return result
}

function formatNestedMathGroups(
  value: string,
  options: MathSpacingOptions,
  collapseSpaces: boolean,
): string {
  let result = ''
  for (let index = 0; index < value.length;) {
    if (value[index] === '\\') {
      const command = commandAt(value, index)
      const afterCommand = index + command.length
      const base = commandBase(command)
      result += command
      index = afterCommand

      if (OPAQUE_ARGUMENT_COMMANDS.has(base) && value[index] === '{') {
        const end = groupEnd(value, index)
        if (end !== undefined) {
          const inner = value.slice(index + 1, end - 1)
          const shouldFormat = !PRESERVE_GROUP_COMMANDS.has(base) && /\\[A-Za-z]/.test(inner)
          result += shouldFormat
            ? `{${formatMathCode(inner, options, collapseSpaces)}}`
            : value.slice(index, end)
          index = end
          continue
        }
      }

      while (RECURSIVE_GROUP_COMMANDS.has(base) && value[index] === '{') {
        const end = groupEnd(value, index)
        if (end === undefined) break
        const inner = value.slice(index + 1, end - 1)
        result += `{${formatMathCode(inner, options, collapseSpaces)}}`
        index = end
      }
      continue
    }

    if (value[index] === '^' || value[index] === '_') {
      const marker = value[index]
      result += marker
      index += 1
      if (value[index] === '{') {
        const end = groupEnd(value, index)
        if (end !== undefined) {
          const inner = value.slice(index + 1, end - 1)
          const scriptValue = /\\[A-Za-z]/.test(inner)
            ? formatMathCode(inner, { ...options, punctuation: false }, collapseSpaces)
            : inner
          result += `{${scriptValue}}`
          index = end
        }
      }
      continue
    }

    if (value[index] === '{') {
      const end = groupEnd(value, index)
      if (end !== undefined) {
        const inner = value.slice(index + 1, end - 1)
        result += `{${formatMathCode(inner, options, collapseSpaces)}}`
        index = end
        continue
      }
    }

    result += value[index]
    index += 1
  }
  return result
}

function tokenKindForCommand(command: string): TokenKind {
  const base = commandBase(command)
  if (RELATION_COMMANDS.has(base)) return 'relation'
  if (BINARY_COMMANDS.has(base)) return 'binary'
  if (NAMED_FUNCTIONS.has(base)) return 'function'
  if (SPACING_COMMANDS.has(base)) return 'spacing'
  if (AMBIGUOUS_BAR_COMMANDS.has(base)) return 'bar'
  if (OPEN_BAR_COMMANDS.has(base)) return 'bar-open'
  if (CLOSE_BAR_COMMANDS.has(base)) return 'bar-close'
  return 'command'
}

function maybeBarDelimiter(value: string, index: number, command: string): MathToken | undefined {
  const open = command === '\\left'
  const close = command === '\\right'
  if (!open && !close) return undefined
  const after = index + command.length
  for (const suffix of ['\\lVert', '\\lvert', '\\rVert', '\\rvert', '\\|', '|']) {
    if (value.startsWith(suffix, after)) {
      return {
        start: index,
        end: after + suffix.length,
        value: command + suffix,
        kind: open ? 'bar-open' : 'bar-close',
      }
    }
  }
  return undefined
}

function tokenizeLine(value: string): MathToken[] {
  const tokens: MathToken[] = []

  for (let index = 0; index < value.length;) {
    if (/[ \t]/.test(value[index] ?? '')) {
      index += 1
      continue
    }

    const start = index
    const character = value[index] ?? ''

    if (character === '\\') {
      const command = commandAt(value, index)
      const combinedBar = maybeBarDelimiter(value, index, command)
      if (combinedBar) {
        tokens.push(combinedBar)
        index = combinedBar.end
        continue
      }

      const afterCommand = index + command.length
      const base = commandBase(command)
      if (OPAQUE_ARGUMENT_COMMANDS.has(base) && value[afterCommand] === '{') {
        const end = groupEnd(value, afterCommand)
        if (end !== undefined) {
          tokens.push({
            start,
            end,
            value: value.slice(start, end),
            kind: base === '\\operatorname' ? 'function' : 'opaque',
          })
          index = end
          continue
        }
      }

      tokens.push({
        start,
        end: afterCommand,
        value: command,
        kind: tokenKindForCommand(command),
      })
      index = afterCommand
      continue
    }

    const relation = value.startsWith('<=', index) || value.startsWith('>=', index)
      || value.startsWith('!=', index) || value.startsWith('==', index)
      || value.startsWith(':=', index)
    if (relation) {
      tokens.push({ start, end: start + 2, value: value.slice(start, start + 2), kind: 'relation' })
      index += 2
      continue
    }

    if ('=<>'.includes(character)) {
      tokens.push({ start, end: start + 1, value: character, kind: 'relation' })
      index += 1
      continue
    }

    if ('+-*/'.includes(character)) {
      tokens.push({ start, end: start + 1, value: character, kind: 'binary' })
      index += 1
      continue
    }

    if (character === '&') {
      tokens.push({ start, end: start + 1, value: character, kind: 'alignment' })
      index += 1
      continue
    }

    if (character === ',' || character === ';' || character === ':') {
      tokens.push({ start, end: start + 1, value: character, kind: 'punctuation' })
      index += 1
      continue
    }

    if (character === '|') {
      const bar = value[index + 1] === '|' ? '||' : '|'
      tokens.push({ start, end: start + bar.length, value: bar, kind: 'bar' })
      index += bar.length
      continue
    }

    if ('([{'.includes(character)) {
      tokens.push({ start, end: start + 1, value: character, kind: 'open' })
      index += 1
      continue
    }

    if (')]}'.includes(character)) {
      tokens.push({ start, end: start + 1, value: character, kind: 'close' })
      index += 1
      continue
    }

    if (character === '_' || character === '^') {
      if (value[index + 1] === '{') {
        const end = groupEnd(value, index + 1)
        if (end !== undefined) {
          tokens.push({ start, end, value: value.slice(start, end), kind: 'script' })
          index = end
          continue
        }
      }
      // TeX also permits a single token as a script argument (`x_i`, `f^*`,
      // or `x^\star`).  Keep the marker and that argument in one token.  If
      // they are split, a following `*` is incorrectly classified as a binary
      // operator and the formatter emits the invalid-looking `f^ * x`.
      let end = start + 1
      if (end < value.length && !/[ \t\n]/.test(value[end] ?? '')) {
        if (value[end] === '\\') {
          const command = commandAt(value, end)
          end += command.length
          while (value[end] === '{' || value[end] === '[') {
            const close = value[end] === '{' ? '}' : ']'
            let depth = 0
            let cursor = end
            for (; cursor < value.length; cursor += 1) {
              if (value[cursor] === '\\') {
                cursor += 1
                continue
              }
              if (value[cursor] === value[end]) depth += 1
              else if (value[cursor] === close) {
                depth -= 1
                if (depth === 0) {
                  end = cursor + 1
                  break
                }
              }
            }
            if (cursor >= value.length) break
          }
        } else {
          end += 1
        }
      }
      tokens.push({ start, end, value: value.slice(start, end), kind: 'script' })
      index = end
      continue
    }

    const number = numberEnd(value, index)
    if (number !== undefined) {
      tokens.push({ start, end: number, value: value.slice(start, number), kind: 'atom' })
      index = number
      continue
    }

    const identifier = identifierEnd(value, index)
    if (identifier > index) {
      tokens.push({ start, end: identifier, value: value.slice(start, identifier), kind: 'atom' })
      index = identifier
      continue
    }

    tokens.push({ start, end: start + 1, value: character, kind: 'atom' })
    index += 1
  }

  return tokens
}

function isOperandStart(token: MathToken | undefined): boolean {
  return token !== undefined && [
    'atom',
    'bar',
    'bar-open',
    'command',
    'function',
    'opaque',
    'open',
  ].includes(token.kind)
}

function isOperandEnd(token: MathToken | undefined): boolean {
  return token !== undefined && [
    'atom',
    'bar',
    'bar-close',
    'close',
    'command',
    'function',
    'opaque',
    'script',
  ].includes(token.kind)
}

function binaryOperatorIndices(tokens: MathToken[]): Set<number> {
  const result = new Set<number>()
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (token.kind !== 'binary') continue
    if (!isOperandEnd(tokens[index - 1]) || !isOperandStart(tokens[index + 1])) continue
    result.add(index)
  }
  return result
}

function pairedBarIndices(tokens: MathToken[]): {
  closes: Set<number>
  opens: Set<number>
} {
  const opens = new Set<number>()
  const closes = new Set<number>()
  const ambiguous: number[] = []

  tokens.forEach((token, index) => {
    if (token.kind === 'bar-open') opens.add(index)
    else if (token.kind === 'bar-close') closes.add(index)
    else if (token.kind === 'bar') ambiguous.push(index)
  })

  let pending: number | undefined
  for (const index of ambiguous) {
    if (pending !== undefined) {
      opens.add(pending)
      closes.add(index)
      pending = undefined
      continue
    }
    const previous = tokens[index - 1]
    if (previous === undefined || [
      'alignment',
      'bar-open',
      'binary',
      'open',
      'punctuation',
      'relation',
    ].includes(previous.kind)) {
      pending = index
    }
  }

  return { opens, closes }
}

function isDelimiterCommand(token: MathToken): boolean {
  return /^(?:\\left|\\right|\\big|\\Big|\\bigg|\\Bigg|\\[{}|])/.test(token.value)
}

function isOpeningDelimiterCommand(token: MathToken): boolean {
  return /^(?:\\left|\\bigl|\\Bigl|\\biggl|\\Biggl)$/.test(token.value)
}

function isClosingDelimiterCommand(token: MathToken): boolean {
  return /^(?:\\right|\\bigr|\\Bigr|\\biggr|\\Biggr)$/.test(token.value)
}

function isCompactSetDelimiter(token: MathToken): boolean {
  return /^\\[{}|]$/.test(token.value)
}

function collapsedGap(value: string, collapseSpaces: boolean): string {
  return collapseSpaces ? value.replace(/[ \t]{2,}/g, ' ') : value
}

function implicitProductGap(left: MathToken, right: MathToken): boolean {
  if (!isOperandEnd(left) || !isOperandStart(right)) return false
  if (left.kind === 'bar' || left.kind === 'bar-open' || left.kind === 'bar-close') return false
  if (right.kind === 'bar' || right.kind === 'bar-open' || right.kind === 'bar-close') return false
  if (left.kind === 'open' || right.kind === 'close') return false
  if (right.kind === 'open') return left.kind === 'script'
  if (isDelimiterCommand(left) || isDelimiterCommand(right)) return false
  if (left.kind === 'atom' && right.kind === 'atom') return false
  return true
}

function desiredGap(
  tokens: MathToken[],
  boundary: number,
  original: string,
  options: MathSpacingOptions,
  collapseSpaces: boolean,
  binaries: Set<number>,
  bars: ReturnType<typeof pairedBarIndices>,
  scriptNested = false,
): string {
  const left = tokens[boundary]!
  const right = tokens[boundary + 1]!

  if (options.punctuation && left.kind === 'punctuation' && right.kind === 'spacing') return ' '
  if (left.kind === 'spacing' || right.kind === 'spacing') return collapsedGap(original, collapseSpaces)
  if (options.punctuation && !scriptNested && (left.value === ':' || right.value === ':')) return ' '

  if (options.compactParentheses) {
    if (isClosingDelimiterCommand(right)) return ''
    if (isCompactSetDelimiter(left)) return ''
    if (isCompactSetDelimiter(right) && left.kind !== 'relation' && left.kind !== 'punctuation') return ''
    if (left.value === '\\|' || right.value === '\\|') return ''
    if (left.kind === 'open' || right.kind === 'close') return ''
    if (isOpeningDelimiterCommand(right) && isOperandEnd(left)) return ''
    if (right.kind === 'open' && [
      'atom',
      'close',
      'command',
      'function',
      'opaque',
    ].includes(left.kind)) return ''
    if (right.kind === 'open' && left.kind === 'script') {
      const previous = tokens[boundary - 1]
      return left.value.includes('\\top') || (previous?.kind === 'atom' && /^[A-Z]/.test(previous.value)) ? ' ' : ''
    }
  }

  if (options.punctuation) {
    if (!scriptNested && (right.value === ':' || left.value === ':')) return ' '
    if (right.value === '.') return ''
    if (right.kind === 'punctuation') return ''
    if (left.kind === 'punctuation') return right.kind === 'close' ? '' : ' '
  }

  if (options.pairedBars) {
    if (left.value === '\\|' || right.value === '\\|') return left.value === ':' || right.value === ':' ? ' ' : ''
    if (bars.opens.has(boundary) && !bars.closes.has(boundary + 1)) return ' '
    if (bars.closes.has(boundary + 1) && !bars.opens.has(boundary)) return ' '
  }

  if (options.relations) {
    if (right.value === '\\not' && tokens[boundary + 2]?.kind === 'relation') return ' '
    if (left.value === '\\not' && right.kind === 'relation') return ''
    if (right.kind === 'alignment' && tokens[boundary + 2]?.kind === 'relation') {
      return isOperandEnd(left) ? ' ' : original
    }
    if (right.kind === 'relation') return left.kind === 'alignment' ? '' : ' '
    if (left.kind === 'relation') return ' '
  }

  if (options.binaryOperators) {
    if (scriptNested && (left.value === '+' || left.value === '-' || right.value === '+' || right.value === '-')) return original
    if (binaries.has(boundary + 1)) return ' '
    if (binaries.has(boundary)) return ' '
  }

  if (options.namedFunctions && left.kind === 'function') {
    if (right.kind === 'open' || right.kind === 'script' || isDelimiterCommand(right)) return ''
    if (right.kind === 'command' && CALL_WRAPPER_COMMANDS.has(right.value)) return ''
    if (isOperandStart(right)) return ' '
  }

  if (original.length === 0 && implicitProductGap(left, right)) return ' '

  return collapsedGap(original, collapseSpaces)
}

function commentStart(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '%') continue
    let slashes = 0
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
      slashes += 1
    }
    if (slashes % 2 === 0) return index
  }
  return -1
}

function isReferenceLabel(value: string): boolean {
  return /^\s*[^{}\s\\]+:[^{}\s\\]+\s*$/.test(value)
}

function normalizeReferenceLine(value: string, normalizeLabelPrefixes: boolean): string {
  const comment = commentStart(value)
  const code = comment < 0 ? value : value.slice(0, comment)
  const suffix = comment < 0 ? '' : value.slice(comment)
  let result = ''

  for (let index = 0; index < code.length;) {
    if (code[index] !== '\\') {
      result += code[index]
      index += 1
      continue
    }

    const command = commandAt(code, index)
    const afterCommand = index + command.length
    const base = commandBase(command)
    let groupStart = afterCommand
    while (groupStart < code.length && /[ \t]/.test(code[groupStart] ?? '')) groupStart += 1

    if (base === '\\mathrm' && code[groupStart] === '{') {
      const end = groupEnd(code, groupStart)
      if (end !== undefined) {
        const content = code.slice(groupStart + 1, end - 1)
        if (isReferenceLabel(content)) {
          const label = normalizeLabelPrefixes ? normalizeLabelPrefix(content) : content.trim()
          result += `\\ref{${label}}`
        } else {
          result += code.slice(index, end)
        }
        index = end
        continue
      }
    }

    if (LABEL_ARGUMENT_COMMANDS.has(base) && code[groupStart] === '{') {
      const end = groupEnd(code, groupStart)
      if (end !== undefined) {
        const content = code.slice(groupStart + 1, end - 1)
        const label = normalizeLabelPrefixes ? normalizeLabelPrefix(content) : content
        result += `${code.slice(index, groupStart)}{${label}}`
        index = end
        continue
      }
    }

    // Keep text, labels, tags, citations, and existing references opaque so
    // a literal `\\mathrm{...}` inside their argument is never rewritten.
    if (OPAQUE_ARGUMENT_COMMANDS.has(base) && code[groupStart] === '{') {
      const end = groupEnd(code, groupStart)
      if (end !== undefined) {
        result += code.slice(index, end)
        index = end
        continue
      }
    }

    result += command
    index = afterCommand
  }

  return result + suffix
}

function normalizeMathReferences(value: string, normalizeLabelPrefixes: boolean): string {
  if (!value.includes('\\')) return value
  return value.split('\n').map((line) => normalizeReferenceLine(line, normalizeLabelPrefixes)).join('\n')
}

function formatMathCode(
  value: string,
  options: MathSpacingOptions,
  collapseSpaces: boolean,
  scriptNested = false,
): string {
  if (!/[\\ \t<>=+\-*\/:;,|()[\]{}_]/.test(value)) return value
  const match = /^([ \t]*)(.*?)([ \t]*)$/.exec(value)
  const leading = match?.[1] ?? ''
  const core = match?.[2] ?? value
  const trailing = match?.[3] ?? ''
  const normalizedCore = formatNestedMathGroups(core, options, collapseSpaces)
  const tokens = tokenizeLine(normalizedCore)
  if (tokens.length < 2) return leading + normalizedCore + trailing

  const binaries = binaryOperatorIndices(tokens)
  const bars = pairedBarIndices(tokens)
  let result = normalizedCore.slice(0, tokens[0]!.start) + tokens[0]!.value

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]!
    const right = tokens[index + 1]!
    const original = normalizedCore.slice(left.end, right.start)
    result += desiredGap(tokens, index, original, options, collapseSpaces, binaries, bars, scriptNested)
    result += right.value
  }

  result += normalizedCore.slice(tokens[tokens.length - 1]!.end)
  return leading + result + trailing
}

function formatLine(value: string, options: MathSpacingOptions, collapseSpaces: boolean): string {
  const comment = commentStart(value)
  const code = comment < 0 ? value : value.slice(0, comment)
  if (comment < 0) return formatMathCode(code, options, collapseSpaces)
  return formatMathCode(code, options, collapseSpaces) + value.slice(comment)
}

function collapseMathSpacesOnly(value: string): string {
  const comment = commentStart(value)
  const code = comment < 0 ? value : value.slice(0, comment)
  const suffix = comment < 0 ? '' : value.slice(comment)
  const tokens = tokenizeLine(code)
  if (tokens.length < 2) return value
  let result = code.slice(0, tokens[0]!.end)
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]!
    const right = tokens[index + 1]!
    result += code.slice(left.end, right.start).replace(/[ \t]{2,}/g, ' ')
    result += right.value
  }
  result += code.slice(tokens[tokens.length - 1]!.end)
  return result + suffix
}

export function formatMathSpacing(
  value: string,
  options: MathSpacingOptions = DEFAULT_MATH_SPACING_OPTIONS,
  cleanup: MathCleanupOptions = DEFAULT_MATH_CLEANUP_OPTIONS,
): string {
  if (value.length === 0) return value
  if (!/[\\ \t<>=+\-*\/:;,|()[\]{}_]/.test(value)) return value
  const referenced = normalizeMathReferences(value, cleanup.normalizeLabelPrefixes)
  const normalized = cleanup.fontCommandBraces ? braceFontCommandArguments(referenced) : referenced
  if (!options.enabled) {
    return cleanup.collapseSpaces
      ? normalized.split('\n').map(collapseMathSpacesOnly).join('\n')
      : normalized
  }
  return normalized.split('\n').map((line) => formatLine(line, options, cleanup.collapseSpaces)).join('\n')
}
