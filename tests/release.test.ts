import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { CLI_VERSION } from '../src/options.ts'

const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('publishes to npm only from matching version tags through Trusted Publishing', () => {
  assert.match(workflow, /on:\n  push:\n    tags:\n      - "v\*"/)
  assert.doesNotMatch(workflow, /workflow_dispatch|branches:|release:/)
  assert.match(workflow, /permissions:\n  contents: read\n  id-token: write/)
  assert.match(workflow, /runs-on: ubuntu-latest/)
  assert.match(workflow, /uses: actions\/checkout@v6[\s\S]*fetch-depth: 0/)
  assert.match(workflow, /uses: actions\/setup-node@v6/)
  assert.match(workflow, /node-version: 24/)
  assert.match(workflow, /package-manager-cache: false/)
  assert.match(workflow, /npm install --global npm@latest/)
  assert.match(workflow, /npm ci[\s\S]*npm test[\s\S]*npm run check && npm run build:cli/)
  assert.match(workflow, /GITHUB_REF_NAME[\s\S]*v\$\{package_version\}/)
  assert.match(workflow, /cli_version[\s\S]*package_version/)
  assert.match(workflow, /git merge-base --is-ancestor "\$\{GITHUB_SHA\}" origin\/main/)
  assert.match(workflow, /run: npm publish/)
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./)
})

test('keeps the npm package CLI-only and avoids rebuilding the website on publish', () => {
  assert.equal(CLI_VERSION, packageJson.version)
  assert.deepEqual(packageJson.files, [
    'bin/proofweave.js',
    'dist-cli/proofweave.js',
    'LICENSE',
    'README.md',
    'package.json',
  ])
  assert.equal(packageJson.scripts.prepublishOnly, 'npm run check && npm run build:cli')
})
