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
    '--no-relations',
    '--no-binary-operators',
    '--no-punctuation',
    '--no-compact-parentheses',
    '--no-paired-bars',
    '--no-named-functions',
    '--no-font-command-braces',
    '--no-collapse-spaces',
  ]
  const options = cloneConverterOptions()
  options.indent = 4
  options.inlineMath = 'parentheses'
  options.statementDisplayMath = 'brackets'
  options.outsideDisplayMath = 'dollars'
  options.sectionNumbering = 'numbered'
  options.removeBoxed = false
  options.mathSpacing.relations = false
  options.mathSpacing.binaryOperators = false
  options.mathSpacing.punctuation = false
  options.mathSpacing.compactParentheses = false
  options.mathSpacing.pairedBars = false
  options.mathSpacing.namedFunctions = false
  options.mathSpacing.fontCommandBraces = false
  options.mathSpacing.collapseSpaces = false

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
  assert.match(version.stdout, /^0\.1\.0/)

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
  options.removeBoxed = false
  const keepResult = runCLI(['--no-remove-boxed'], markdown)
  assert.equal(keepResult.status, 0)
  assert.equal(keepResult.stdout, convertMarkdown(markdown, options).latex)
  assert.match(keepResult.stdout, /\\boxed/)
})
