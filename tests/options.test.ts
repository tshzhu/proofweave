import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cliCommand,
  cloneConverterOptions,
  DEFAULT_CONVERTER_OPTIONS,
  MATH_SPACING_RULES,
  optionsToCLIArgs,
  optionsFromUrlSearch,
  optionsToUrlSearch,
  shareUrlForOptions,
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
  options.cleanup.removeBoxed = false
  options.cleanup.unifySetNotation = true
  options.cleanup.unifyTransposeNotation = true
  options.cleanup.transposeExpression = String.raw`\mathsf{T}`
  options.cleanup.normalizeLabelPrefixes = false
  options.cleanup.fontCommandBraces = false
  options.mathSpacing.punctuation = false
  options.mathSpacing.pairedBars = false
  options.cleanup.collapseSpaces = false

  const parsed = parseCLIArguments(optionsToCLIArgs(options))
  assert.deepEqual(parsed.options, options)
  assert.equal(parsed.inputPath, undefined)
})

test('keeps independent cleanup flags while the math spacing master is disabled', () => {
  const options = cloneConverterOptions()
  options.mathSpacing.enabled = false
  for (const rule of MATH_SPACING_RULES) options.mathSpacing[rule] = false
  options.cleanup.normalizeLabelPrefixes = false
  options.cleanup.fontCommandBraces = false
  options.cleanup.collapseSpaces = false
  assert.deepEqual(optionsToCLIArgs(options), [
    '--no-normalize-label-prefixes',
    '--no-font-command-braces',
    '--no-collapse-spaces',
    '--no-math-spacing',
    '--no-relations',
    '--no-binary-operators',
    '--no-punctuation',
    '--no-compact-parentheses',
    '--no-paired-bars',
    '--no-named-functions',
  ])
  assert.equal(
    cliCommand(options, 'proof.md'),
    'proofweave --no-normalize-label-prefixes --no-font-command-braces --no-collapse-spaces --no-math-spacing --no-relations --no-binary-operators --no-punctuation --no-compact-parentheses --no-paired-bars --no-named-functions proof.md',
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
  assert.equal(parsed.options.cleanup.fontCommandBraces, false)
  assert.equal(parsed.outputPath, 'proof.tex')
  assert.equal(parsed.inputPath, 'proof.md')
})

test('serializes and parses all independent cleanup options', () => {
  const options = cloneConverterOptions()
  assert.deepEqual(options.cleanup, {
    removeBoxed: true,
    normalizeLabelPrefixes: true,
    fontCommandBraces: true,
    collapseSpaces: true,
    unifySetNotation: false,
    unifyTransposeNotation: false,
    transposeExpression: String.raw`\mkern-1.0mu\mathsf{T}`,
  })
  for (const [key, flag] of [
    ['removeBoxed', 'remove-boxed'],
    ['normalizeLabelPrefixes', 'normalize-label-prefixes'],
    ['fontCommandBraces', 'font-command-braces'],
    ['collapseSpaces', 'collapse-spaces'],
  ] as const) {
    const configured = cloneConverterOptions()
    configured.cleanup[key] = false
    assert.ok(optionsToCLIArgs(configured).includes(`--no-${flag}`))
    assert.equal(parseCLIArguments([`--no-${flag}`]).options.cleanup[key], false)
    assert.equal(parseCLIArguments([`--${flag}`]).options.cleanup[key], true)
  }
  const setEnabled = cloneConverterOptions()
  setEnabled.cleanup.unifySetNotation = true
  assert.ok(optionsToCLIArgs(setEnabled).includes('--unify-set-notation'))
  assert.equal(parseCLIArguments(['--unify-set-notation']).options.cleanup.unifySetNotation, true)
  assert.equal(parseCLIArguments(['--no-unify-set-notation']).options.cleanup.unifySetNotation, false)
  const enabled = cloneConverterOptions()
  enabled.cleanup.unifyTransposeNotation = true
  assert.ok(optionsToCLIArgs(enabled).includes('--unify-transpose'))
  assert.equal(parseCLIArguments(['--unify-transpose']).options.cleanup.unifyTransposeNotation, true)
  const configured = cloneConverterOptions()
  configured.cleanup.transposeExpression = String.raw`\mathbf{T}`
  assert.ok(optionsToCLIArgs(configured).includes(String.raw`--transpose-expression=\mathbf{T}`))
  assert.equal(
    parseCLIArguments([String.raw`--transpose-expression=\mathbf{T}`]).options.cleanup.transposeExpression,
    String.raw`\mathbf{T}`,
  )
})

test('validates transpose expressions before accepting CLI or URL options', () => {
  assert.throws(() => parseCLIArguments(['--transpose-expression=']), /Expected a value/)
  assert.throws(() => parseCLIArguments(['--transpose-expression=% bad']), /must not contain/)
  assert.throws(() => parseCLIArguments(['--transpose-expression={bad']), /unbalanced braces/)
})

test('round-trips conversion options through the versioned URL payload', () => {
  const options = cloneConverterOptions()
  options.indent = 4
  options.inlineMath = 'parentheses'
  options.cleanup.removeBoxed = false
  options.cleanup.unifySetNotation = true
  options.cleanup.unifyTransposeNotation = true
  options.cleanup.transposeExpression = String.raw`\mathsf{T}`
  options.mathSpacing.enabled = false
  options.mathSpacing.relations = false
  options.mathSpacing.namedFunctions = false

  const search = optionsToUrlSearch(options)
  assert.match(search, /^opt=%7B%22v%22%3A1%2C%22args%22%3A/)
  const restored = optionsFromUrlSearch(search)
  assert.equal(restored.error, undefined)
  assert.deepEqual(restored.options, options)
  assert.equal(optionsToUrlSearch(DEFAULT_CONVERTER_OPTIONS), '')
})

test('rejects malformed, unknown-version, and non-conversion URL options', () => {
  for (const search of [
    'opt=%7Bbroken',
    `opt=${encodeURIComponent(JSON.stringify({ v: 99, args: [] }))}`,
    `opt=${encodeURIComponent(JSON.stringify({ v: 1, args: ['--output', 'out.tex'] }))}`,
    `opt=${encodeURIComponent(JSON.stringify({ v: 1, args: ['proof.md'] }))}`,
  ]) {
    const restored = optionsFromUrlSearch(search)
    assert.ok(restored.error)
    assert.deepEqual(restored.options, DEFAULT_CONVERTER_OPTIONS)
  }
})

test('builds a share URL without losing path, hash, or unrelated parameters', () => {
  const options = cloneConverterOptions()
  options.indent = 2
  const url = shareUrlForOptions(
    'https://example.test/proofweave/?source=demo#cli',
    options,
  )
  const parsed = new URL(url)
  assert.equal(parsed.pathname, '/proofweave/')
  assert.equal(parsed.searchParams.get('source'), 'demo')
  assert.equal(parsed.hash, '#cli')
  assert.deepEqual(optionsFromUrlSearch(parsed.search).options, options)

  const defaults = new URL(shareUrlForOptions(url, DEFAULT_CONVERTER_OPTIONS))
  assert.equal(defaults.searchParams.has('opt'), false)
})

test('rejects invalid values, unknown flags, conflicts, and multiple files', () => {
  assert.throws(() => parseCLIArguments(['--indent=3']), /Invalid value for --indent/)
  assert.throws(() => parseCLIArguments(['--wat']), /Unknown option/)
  assert.throws(() => parseCLIArguments(['-m', '-o', 'out.tex', 'in.md']), /cannot be used together/)
  assert.throws(() => parseCLIArguments(['a.md', 'b.md']), /Only one input file/)
})
