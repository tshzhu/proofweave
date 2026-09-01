import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { convertMarkdown } from '../src/renderer.ts'
import { cloneConverterOptions } from '../src/options.ts'

const projectRoot = dirname(new URL('../package.json', import.meta.url).pathname)
const cli = join(projectRoot, 'src/cli.ts')
const nodeArgs = ['--experimental-strip-types', cli]

function runCLI(args: string[], input?: string) {
  return spawnSync(process.execPath, [...nodeArgs, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    input,
  })
}

test('converts stdin to stdout byte-for-byte with the shared core', () => {
  const markdown = '## lemma stdin\n\n### statement\nFor \\(x<1\\), done.'
  const result = runCLI([], markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown).latex)
  assert.match(result.stderr, /missing-proof/)
})

test('applies a complete non-default CLI configuration identically to the web core', () => {
  const markdown = '# Section\n\n\\[\nx*y\n\\]'
  const args = [
    '--indent=4',
    '--inline-math=parentheses',
    '--statement-display=brackets',
    '--other-display=dollars',
    '--section-numbering=numbered',
    '--no-remove-boxed',
    '--no-normalize-label-prefixes',
    '--no-relations',
    '--no-binary-operators',
    '--no-punctuation',
    '--no-compact-parentheses',
    '--no-paired-bars',
    '--no-named-functions',
    '--no-font-command-braces',
    '--no-normalize-math-symbols',
    '--no-collapse-spaces',
  ]
  const options = cloneConverterOptions()
  options.indent = 4
  options.inlineMath = 'parentheses'
  options.statementDisplayMath = 'brackets'
  options.outsideDisplayMath = 'dollars'
  options.sectionNumbering = 'numbered'
  options.cleanup.removeBoxed = false
  options.cleanup.normalizeLabelPrefixes = false
  options.mathSpacing.relations = false
  options.mathSpacing.binaryOperators = false
  options.mathSpacing.punctuation = false
  options.mathSpacing.compactParentheses = false
  options.mathSpacing.pairedBars = false
  options.mathSpacing.namedFunctions = false
  options.cleanup.fontCommandBraces = false
  options.cleanup.normalizeMathSymbolNotation = false
  options.cleanup.collapseSpaces = false

  const result = runCLI(args, markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown, options).latex)
})

test('reads files and supports output and modify modes', () => {
  mkdirSync(join(projectRoot, '.tmp'), { recursive: true })
  const temporary = mkdtempSync(join(projectRoot, '.tmp/cli-'))
  try {
    const input = join(temporary, 'proof.md')
    const output = join(temporary, 'proof.tex')
    const markdown = '## definition file\n\n### statement\nText.'
    writeFileSync(input, markdown)

    const outputResult = runCLI(['--output', output, input])
    assert.equal(outputResult.status, 0)
    assert.equal(outputResult.stdout, '')
    assert.equal(readFileSync(output, 'utf8'), convertMarkdown(markdown).latex)

    const modifyResult = runCLI(['--modify', input])
    assert.equal(modifyResult.status, 0)
    assert.equal(modifyResult.stdout, '')
    assert.equal(readFileSync(input, 'utf8'), convertMarkdown(markdown).latex)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('provides help/version and rejects invalid invocation modes', () => {
  const help = runCLI(['--help'])
  assert.equal(help.status, 0)
  assert.match(help.stdout, /^Usage: proofweave/)

  const version = runCLI(['--version'])
  assert.equal(version.status, 0)
  assert.match(version.stdout, /^1\.0\.3/)

  const unknown = runCLI(['--unknown'])
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /Unknown option/)

  const stdinModify = runCLI(['--modify'], 'text')
  assert.equal(stdinModify.status, 1)
  assert.match(stdinModify.stderr, /requires an input file/)

  const wrongExtension = runCLI(['README.txt'])
  assert.equal(wrongExtension.status, 1)
  assert.match(wrongExtension.stderr, /\.md extension/)
})

test('toggles boxed cleanup through the CLI without drifting from the shared core', () => {
  const markdown = 'Inline \\(\\boxed{x+y}\\).'
  const defaultResult = runCLI([], markdown)
  assert.equal(defaultResult.status, 0)
  assert.doesNotMatch(defaultResult.stdout, /\\boxed/)

  const options = cloneConverterOptions()
  options.cleanup.removeBoxed = false
  const keepResult = runCLI(['--no-remove-boxed'], markdown)
  assert.equal(keepResult.status, 0)
  assert.equal(keepResult.stdout, convertMarkdown(markdown, options).latex)
  assert.match(keepResult.stdout, /\\boxed/)
})

test('applies set and transpose notation cleanup through the CLI', () => {
  const markdown = String.raw`Inline \(\big\{x\big\} and A^{\mathrm{T}}\).`
  const options = cloneConverterOptions()
  options.cleanup.unifySetNotation = true
  options.cleanup.unifyTransposeNotation = true
  options.cleanup.transposeExpression = String.raw`\mathsf{T}`
  const result = runCLI([
    '--unify-set-notation',
    '--unify-transpose',
    String.raw`--transpose-expression=\mathsf{T}`,
  ], markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown, options).latex)
  assert.match(result.stdout, /\\newcommand\{\\set\}/)
  assert.match(result.stdout, /\\newcommand\{\\transpose\}\{\{\\mathsf\{T\}\}\}/)
})

test('toggles vector, matrix, and family macro cleanup through the CLI', () => {
  const markdown = String.raw`Inline \(\mathbf{x} + \bm{\Theta} + \mathcal{F}\).`
  const enabled = runCLI([], markdown)
  assert.equal(enabled.status, 0)
  assert.match(enabled.stdout, /\\newcommand\{\\vx\}\{\\bm\{x\}\}/)
  assert.match(enabled.stdout, /\\newcommand\{\\mTheta\}\{\\bm\{\\Theta\}\}/)
  assert.match(enabled.stdout, /\\newcommand\{\\fF\}\{\\mathcal\{F\}\}/)

  const options = cloneConverterOptions()
  options.cleanup.normalizeMathSymbolNotation = false
  const disabled = runCLI(['--no-normalize-math-symbols'], markdown)
  assert.equal(disabled.status, 0)
  assert.equal(disabled.stdout, convertMarkdown(markdown, options).latex)
  assert.doesNotMatch(disabled.stdout, /\\newcommand/)
  assert.match(disabled.stdout, /\\mathbf\{x\} \+ \\bm\{\\Theta\} \+ \\mathcal\{F\}/)
})

test('shares label-prefix cleanup across theorem labels and existing references', () => {
  const markdown = String.raw`## proposition prop:claim

### statement
See \(\ref{prop:claim}\) and \(\mathrm{theorem:main}\).

### proof
Done.`
  const options = cloneConverterOptions()
  options.cleanup.normalizeLabelPrefixes = false
  const result = runCLI(['--no-normalize-label-prefixes'], markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown, options).latex)
  assert.match(result.stdout, /\\label\{prop:claim\}/)
  assert.match(result.stdout, /\\ref\{prop:claim\}/)
  assert.match(result.stdout, /\\ref\{theorem:main\}/)
})

test('normalizes inequality variants through configurable CLI commands', () => {
  const markdown = String.raw`Inline \(a>=b, c> =d, e\geqq f, g<=h, i< =j, k\leqslant l\).`
  const options = cloneConverterOptions()
  options.cleanup.greaterEqualCommand = String.raw`\geqslant`
  options.cleanup.lessEqualCommand = String.raw`\le`
  const result = runCLI([String.raw`--ge-command=\geqslant`, String.raw`--le-command=\le`], markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown, options).latex)
  assert.match(result.stdout, /a \\geqslant b/)
  assert.match(result.stdout, /g \\le h/)
})

test('normalizes not-equal and empty-set variants through configurable CLI commands', () => {
  const markdown = String.raw`Inline \(a\ne b, c\not=d, A=\emptyset, B=\varnothing\).`
  const options = cloneConverterOptions()
  options.cleanup.notEqualCommand = String.raw`\ne`
  options.cleanup.emptySetCommand = String.raw`\emptyset`
  const result = runCLI([String.raw`--ne-command=\ne`, String.raw`--empty-set-command=\emptyset`], markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown, options).latex)
  assert.match(result.stdout, /a \\ne b/)
  assert.match(result.stdout, /A = \\emptyset/)
})

test('keeps cleanup flags effective when math spacing is disabled', () => {
  const markdown = String.raw`Inline \(\boxed{\mathcal X                    \ref{prop:claim}}\).`
  const options = cloneConverterOptions()
  options.mathSpacing.enabled = false
  options.cleanup.removeBoxed = false
  options.cleanup.normalizeLabelPrefixes = false
  options.cleanup.fontCommandBraces = false
  options.cleanup.normalizeMathSymbolNotation = false
  options.cleanup.collapseSpaces = false
  const args = [
    '--no-math-spacing',
    '--no-remove-boxed',
    '--no-normalize-label-prefixes',
    '--no-font-command-braces',
    '--no-normalize-math-symbols',
    '--no-collapse-spaces',
  ]
  const result = runCLI(args, markdown)
  assert.equal(result.status, 0)
  assert.equal(result.stdout, convertMarkdown(markdown, options).latex)
  assert.match(result.stdout, /\\boxed\{\\mathcal X {20}\\ref\{prop:claim\}\}/)
})
