import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { EXAMPLE_MARKDOWN } from '../src/example.ts'
import { CLI_HELP, DEFAULT_CONVERTER_OPTIONS } from '../src/options.ts'
import { convertMarkdown } from '../src/renderer.ts'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

function markedFence(name: 'input' | 'output', language: 'markdown' | 'latex'): string {
  const fence = '```'
  const pattern = new RegExp(
    `<!-- proofweave-example-${name}:start -->\\n${fence}${language}\\n([\\s\\S]*?)\\n${fence}\\n<!-- proofweave-example-${name}:end -->`,
  )
  const value = pattern.exec(readme)?.[1]
  assert.notEqual(value, undefined, `Missing marked ${name} example in README.md`)
  return value!
}

test('keeps the README before/after example synchronized with the default renderer', () => {
  const actual = convertMarkdown(EXAMPLE_MARKDOWN, DEFAULT_CONVERTER_OPTIONS)
  assert.deepEqual(actual.diagnostics, [])
  assert.equal(`${markedFence('input', 'markdown')}\n`, EXAMPLE_MARKDOWN)
  assert.equal(markedFence('output', 'latex'), actual.latex)
  assert.match(actual.latex, /\\begin\{lemma\}\\label\{lem:uniform-noise\}/)
  assert.match(actual.latex, /\n\t\\begin\{equation\}/)
  assert.doesNotMatch(actual.latex, /\\square/)
  assert.match(markedFence('input', 'markdown'), /<!--\nThis Markdown note is kept as LaTeX comments\.[\s\S]*?-->/)
  assert.match(markedFence('output', 'latex'), /\n\n% This Markdown note is kept as LaTeX comments\.[\s\S]*?% \\\[x\*y\\\]\n\n\\begin\{lemma\}/)
  assert.doesNotMatch(markedFence('output', 'latex'), /\n%\n% This Markdown note|%\n\n\\begin\{lemma\}/)
  assert.doesNotMatch(markedFence('output', 'latex'), /<!--|-->/)
  assert.match(markedFence('output', 'latex'), /\\newcommand\{\\vx\}\{\\bm\{x\}\}[\s\S]*\\newcommand\{\\mTheta\}\{\\bm\{\\Theta\}\}[\s\S]*\\newcommand\{\\fX\}\{\\mathcal\{X\}\}/)
  assert.match(readme, /\[Notation for Machine Learning\]\(https:\/\/notation\.baai\.ac\.cn\/en\)/)
})

test('documents every public CLI flag and alias exposed by CLI help', () => {
  const helpOptions = CLI_HELP.split('\n').flatMap((line) => {
    const optionField = /^\s{2}(.+?)(?:\s{2,}|$)/.exec(line)?.[1]
    return optionField ? [...optionField.matchAll(/(?:^|,\s*)(--?[^,\s]+)/g)].map((match) => match[1]!) : []
  })
  assert.equal(helpOptions.length, 34)
  for (const option of helpOptions) {
    assert.ok(readme.includes(`\`${option}\``), `README does not document ${option}`)
  }

  for (const valueSet of [
    '--indent=tab|2|4|0',
    '--inline-math=dollar|parentheses',
    '--statement-display=dollars|brackets|equation',
    '--other-display=dollars|brackets|equation',
    '--section-numbering=unnumbered|numbered',
  ]) {
    assert.ok(readme.includes(`\`${valueSet}\``), `README does not document ${valueSet}`)
  }
})

test('describes CLI defaults, streams, failures, and only supported installation modes', () => {
  for (const phrase of [
    'Node.js 22 or newer',
    'stdin',
    'stdout',
    'stderr',
    'non-zero exit status',
    '`--modify` is destructive',
    'enabled by default',
    'Tidy options remain effective when `--no-math-spacing` is used',
    'math-spacing subrules are effective only while `--math-spacing` is enabled',
  ]) {
    assert.ok(readme.includes(phrase), `README is missing CLI behavior: ${phrase}`)
  }
  assert.match(readme, /cannot be combined\s+with `--output`/)
  assert.doesNotMatch(readme, /npm install -g proofweave|docker compose|from ['"]proofweave['"]/i)
  assert.doesNotMatch(readme, /AI-generated|publication-ready/)
  assert.doesNotMatch(CLI_HELP, /AI-generated|publication-ready/)
})
