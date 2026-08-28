import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { convertMarkdown } from '../src/renderer.ts'

const fixtures = [
  '/scratch1/workspace/proof-from-rethlas/krr_generalize/.rethlas/state/results/krr_generalize/problem/blueprint_verified.md',
  '/scratch1/workspace/proof-from-rethlas/bo_inexact_reds/.rethlas/state/results/bo_inexact_reds/problem/blueprint_verified.md',
  '/scratch1/workspace/proof-from-rethlas/tp_adascale/.rethlas/state/results/tp_adascale/problem/blueprint_verified.md',
]

test('keeps repeated large-fixture conversion deterministic and structurally intact', {
  skip: fixtures.some((path) => !existsSync(path))
}, () => {
  for (const path of fixtures) {
    const input = readFileSync(path, 'utf8')
    const first = convertMarkdown(input)
    const second = convertMarkdown(input)
    assert.equal(second.latex, first.latex, path)
    assert.deepEqual(second.diagnostics, first.diagnostics, path)
    assert.ok(first.latex.length > input.length, path)
    assert.equal(first.diagnostics.length, 0, path)
  }
})

test('exposes a reproducible benchmark command without adding runtime dependencies', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const script = readFileSync(new URL('../scripts/benchmark.ts', import.meta.url), 'utf8')
  assert.equal(packageJson.scripts.benchmark, 'node --experimental-strip-types scripts/benchmark.ts')
  assert.match(script, /PROOFWEAVE_BENCH_ITERATIONS/)
  assert.match(script, /averageMs/)
  assert.match(script, /outputBytes/)
  assert.match(script, /diagnostics/)
})
