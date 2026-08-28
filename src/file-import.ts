export type FileImportView = 'markdown' | 'latex'

export type TextFile = Pick<File, 'name' | 'text'>

export class MarkdownFileImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarkdownFileImportError'
  }
}

export function validateMarkdownDrop(
  view: FileImportView,
  files: readonly TextFile[],
): TextFile {
  if (view !== 'markdown') {
    throw new MarkdownFileImportError('File import is only available while editing Markdown.')
  }
  if (files.length !== 1) {
    throw new MarkdownFileImportError('Drop one .md file at a time.')
  }

  const file = files[0]!
  if (!file.name.toLowerCase().endsWith('.md')) {
    throw new MarkdownFileImportError(
      'Unsupported file type. Drop a .md file while editing Markdown.',
    )
  }
  return file
}

export async function readMarkdownFile(file: TextFile): Promise<string> {
  try {
    return await file.text()
  } catch {
    throw new MarkdownFileImportError(
      `Could not read ${file.name}. Check the file and try again.`,
    )
  }
}
