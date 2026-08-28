import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

import { EXAMPLE_MARKDOWN } from '../src/example.ts'
import { convertMarkdown } from '../src/renderer.ts'

const iterations = Math.max(1, Number.parseInt(process.env.PROOFWEAVE_BENCH_ITERATIONS ?? '30', 10) || 30)
const paths = process.argv.slice(2)
const inputs = paths.length
  ? paths.map((path) => ({ name: basename(path), path: resolve(path), input: readFileSync(path, 'utf8') }))
  : [{ name: 'built-in-example', path: undefined, input: EXAMPLE_MARKDOWN }]

for (const { name, path, input } of inputs) {
  for (let index = 0; index < 3; index += 1) convertMarkdown(input)

  const durations: number[] = []
  let output = ''
  let diagnostics = 0
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now()
    const result = convertMarkdown(input)
    durations.push(performance.now() - start)
    output = result.latex
    diagnostics = result.diagnostics.length
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0)
  console.log(JSON.stringify({
    name,
    path,
    iterations,
    inputBytes: input.length,
    outputBytes: output.length,
    diagnostics,
    averageMs: Number((total / iterations).toFixed(3)),
    minMs: Number(Math.min(...durations).toFixed(3)),
    maxMs: Number(Math.max(...durations).toFixed(3)),
  }))
}
