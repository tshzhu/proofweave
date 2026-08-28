import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cliCommand,
  cloneConverterOptions,
  DEFAULT_CONVERTER_OPTIONS,
  MATH_SPACING_RULES,
  optionsToCLIArgs,
  parseCLIArguments,
} from '../src/options.ts'

test('uses a minimal command for the default web configuration', () => {
  assert.deepEqual(optionsToCLIArgs(DEFAULT_CONVERTER_OPTIONS), [])
  assert.equal(cliCommand(DEFAULT_CONVERTER_OPTIONS), 'proofweave YOUR_FILE.md')
})

test('round-trips every effective web option through CLI arguments', () => {
  const options = cloneConverterOptions()
  options.indent = 4
  options.inlineMath = 'parentheses'
  options.statementDisplayMath = 'brackets'
  options.outsideDisplayMath = 'dollars'
  options.sectionNumbering = 'numbered'
  options.removeBoxed = false
  options.mathSpacing.punctuation = false
  options.mathSpacing.pairedBars = false
  options.mathSpacing.collapseSpaces = false

  const parsed = parseCLIArguments(optionsToCLIArgs(options))
  assert.deepEqual(parsed.options, options)
  assert.equal(parsed.inputPath, undefined)
})

test('emits only the math spacing master flag while the formatter is disabled', () => {
  const options = cloneConverterOptions()
  options.mathSpacing.enabled = false
  for (const rule of MATH_SPACING_RULES) options.mathSpacing[rule] = false
  assert.deepEqual(optionsToCLIArgs(options), ['--no-math-spacing'])
  assert.equal(
    cliCommand(options, 'proof.md'),
    'proofweave --no-math-spacing proof.md',
  )
})

test('parses boolean aliases, split values, and I/O flags', () => {
  const parsed = parseCLIArguments([
    '--indent', '2',
    '--inline-math=parentheses',
    '--statement-display', 'dollars',
    '--other-display=equation',
    '--section-numbering=numbered',
    '--no-relations',
    '--no-font-command-braces',
    '-o', 'proof.tex',
    'proof.md',
  ])
  assert.equal(parsed.options.indent, 2)
  assert.equal(parsed.options.inlineMath, 'parentheses')
  assert.equal(parsed.options.statementDisplayMath, 'dollars')
  assert.equal(parsed.options.outsideDisplayMath, 'equation')
  assert.equal(parsed.options.sectionNumbering, 'numbered')
  assert.equal(parsed.options.mathSpacing.relations, false)
  assert.equal(parsed.options.mathSpacing.fontCommandBraces, false)
  assert.equal(parsed.outputPath, 'proof.tex')
  assert.equal(parsed.inputPath, 'proof.md')
})

test('serializes and parses the remove boxed option', () => {
  const options = cloneConverterOptions()
  assert.equal(options.removeBoxed, true)
  options.removeBoxed = false
  assert.ok(optionsToCLIArgs(options).includes('--no-remove-boxed'))
  assert.equal(parseCLIArguments(['--no-remove-boxed']).options.removeBoxed, false)
  assert.equal(parseCLIArguments(['--remove-boxed']).options.removeBoxed, true)
})

test('rejects invalid values, unknown flags, conflicts, and multiple files', () => {
  assert.throws(() => parseCLIArguments(['--indent=3']), /Invalid value for --indent/)
  assert.throws(() => parseCLIArguments(['--wat']), /Unknown option/)
  assert.throws(() => parseCLIArguments(['-m', '-o', 'out.tex', 'in.md']), /cannot be used together/)
  assert.throws(() => parseCLIArguments(['a.md', 'b.md']), /Only one input file/)
})
