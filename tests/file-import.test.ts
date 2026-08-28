import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MarkdownFileImportError,
  readMarkdownFile,
  validateMarkdownDrop,
  type TextFile,
} from '../src/file-import.ts'

function textFile(name: string, content = '# Imported'): TextFile {
  return { name, text: async () => content }
}

test('accepts exactly one case-insensitive .md file in Markdown view', async () => {
  const lower = validateMarkdownDrop('markdown', [textFile('proof.md')])
  const upper = validateMarkdownDrop('markdown', [textFile('PROOF.MD')])
  assert.equal(await readMarkdownFile(lower), '# Imported')
  assert.equal(upper.name, 'PROOF.MD')
})

test('rejects file imports in LaTeX view before inspecting the extension', () => {
  assert.throws(
    () => validateMarkdownDrop('latex', [textFile('proof.md')]),
    (error: unknown) => error instanceof MarkdownFileImportError
      && error.message === 'File import is only available while editing Markdown.',
  )
})

test('rejects multiple files and non-.md extensions with precise messages', () => {
  assert.throws(
    () => validateMarkdownDrop('markdown', []),
    /Drop one \.md file at a time\./,
  )
  assert.throws(
    () => validateMarkdownDrop('markdown', [textFile('one.md'), textFile('two.md')]),
    /Drop one \.md file at a time\./,
  )
  assert.throws(
    () => validateMarkdownDrop('markdown', [textFile('proof.markdown')]),
    /Unsupported file type\. Drop a \.md file while editing Markdown\./,
  )
})

test('turns File.text failures into readable import errors', async () => {
  const file: TextFile = {
    name: 'broken.md',
    text: async () => { throw new Error('disk failure') },
  }
  await assert.rejects(
    () => readMarkdownFile(file),
    /Could not read broken\.md\. Check the file and try again\./,
  )
})
