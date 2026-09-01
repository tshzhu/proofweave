import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { highlightCode } from '../src/highlight.ts'

function decodeHighlighted(html: string): string {
  return html
    .replace(/<span class="token token-[^"]+">/g, '')
    .replace(/<\/span>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

test('highlights Markdown structure, environments, math, and inline markup', () => {
  const source = String.raw`## lemma highlighted
- **Bound** with \(x_1\) and ` + '`code`' + String.raw`
> quoted
\[
\mathcal X
\]`
  const html = highlightCode(source, 'markdown')

  for (const kind of ['marker', 'keyword', 'heading', 'list-marker', 'strong', 'math', 'code', 'quote', 'command']) {
    assert.match(html, new RegExp(`token-${kind}`))
  }
  assert.equal(decodeHighlighted(html), source)
})

test('highlights LaTeX commands, environments, math, numbers, and comments', () => {
  const source = String.raw`\begin{lemma}
\label{lem:one} $x_1 = 42$ % verified
\end{lemma}`
  const html = highlightCode(source, 'latex')

  for (const kind of ['command', 'environment', 'punctuation', 'math-delimiter', 'number', 'comment']) {
    assert.match(html, new RegExp(`token-${kind}`))
  }
  assert.equal(decodeHighlighted(html), source)
})

test('escapes untrusted editor text before producing highlight markup', () => {
  const source = `<script>alert("x")</script> & 'unsafe'`
  const html = highlightCode(source, 'markdown')

  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&amp;/)
  assert.equal(decodeHighlighted(html), source)
})

test('highlights complete Markdown comments as opaque comment text', () => {
  const source = String.raw`Before <!-- inline \(x+y\) --> after **bold**.
<!--
## hidden heading
- hidden list
\[x*y\]
-->
After.`
  const html = highlightCode(source, 'markdown')
  const comments = [...html.matchAll(/<span class="token token-comment">([\s\S]*?)<\/span>/g)]
  assert.equal(comments.length, 6)
  assert.ok((comments[0]?.[1] ?? '').includes(String.raw`&lt;!-- inline \(x+y\) --&gt;`))
  assert.match(comments[2]?.[1] ?? '', /## hidden heading/)
  assert.ok((comments[4]?.[1] ?? '').includes(String.raw`\[x*y\]`))
  for (const match of comments) assert.doesNotMatch(match[1] ?? '', /token-(?:heading|math|command|list-marker)/)
  assert.match(html, /token-strong">bold/)
  assert.equal(decodeHighlighted(html), source)
})

test('keeps comment markers in code literal and highlights unclosed comments to EOF', () => {
  const source = String.raw`Code ` + '`<!-- literal -->`' + String.raw`
~~~md
<!-- fenced -->
~~~
Text <!-- unclosed
## still commented`
  const html = highlightCode(source, 'markdown')
  assert.match(html, /token-code">&lt;!-- literal --&gt;/)
  assert.match(html, /token-code">&lt;!-- fenced --&gt;/)
  assert.match(html, /token-comment">&lt;!-- unclosed/)
  assert.match(html, /token-comment">## still commented/)
  assert.equal(decodeHighlighted(html), source)
})

const blueprintPath = '/scratch1/workspace/proof-from-rethlas/nwr_fill_distance/.rethlas/state/results/nwr_fill_distance/problem/blueprint_verified.md'

test('highlights the full verified blueprint without changing its text', {
  skip: !existsSync(blueprintPath),
}, () => {
  const source = readFileSync(blueprintPath, 'utf8')
  const html = highlightCode(source, 'markdown')
  assert.ok(html.length > source.length)
  assert.equal(decodeHighlighted(html), source)
})
