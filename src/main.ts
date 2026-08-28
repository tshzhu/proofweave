import './styles.css'
import { EXAMPLE_MARKDOWN } from './example.ts'
import {
  MarkdownFileImportError,
  readMarkdownFile,
  validateMarkdownDrop,
} from './file-import.ts'
import { highlightCode } from './highlight.ts'
import {
  cliCommand,
  cloneConverterOptions,
  DEFAULT_CONVERTER_OPTIONS,
  isCleanupRule,
  isMathSpacingRule,
  optionsToCLIArgs,
  type ConverterOptions,
} from './options.ts'
import {
  convertMarkdown,
  type ConversionResult,
  type Diagnostic,
  type DisplayMathStyle,
  type InlineMathStyle,
  type SectionNumbering,
} from './renderer.ts'

type EditorView = 'markdown' | 'latex'

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing UI element: ${selector}`)
  return element
}

const editor = requireElement<HTMLTextAreaElement>('#document-editor')
const editorShell = requireElement<HTMLElement>('#editor')
const highlightLayer = requireElement<HTMLElement>('#highlight-layer')
const highlightOutput = requireElement<HTMLElement>('#highlight-code')
const lineNumbers = requireElement<HTMLElement>('#line-numbers')
const dropOverlay = requireElement<HTMLElement>('#drop-overlay')
const themeToggle = requireElement<HTMLButtonElement>('#theme-toggle')
const editorZoomOut = requireElement<HTMLButtonElement>('#editor-zoom-out')
const editorZoomIn = requireElement<HTMLButtonElement>('#editor-zoom-in')
const editorZoomValue = requireElement<HTMLOutputElement>('#editor-zoom-value')
const editorCopy = requireElement<HTMLButtonElement>('#editor-copy')
const optionsForm = requireElement<HTMLFormElement>('#options-form')
const loadExample = requireElement<HTMLButtonElement>('#load-example')
const clearInput = requireElement<HTMLButtonElement>('#clear-input')
const modeStatus = requireElement<HTMLElement>('#editor-mode-status')
const documentStats = requireElement<HTMLElement>('#document-stats')
const diagnosticsList = requireElement<HTMLElement>('#diagnostics-list')
const primaryAction = requireElement<HTMLButtonElement>('#primary-action')
const downloadOutput = requireElement<HTMLButtonElement>('#download-output')
const copyStatus = requireElement<HTMLElement>('#copy-status')
const fileMessage = requireElement<HTMLElement>('#editor-file-message')
const cliCommandOutput = requireElement<HTMLElement>('#cli-command')

let view: EditorView = 'markdown'
let source = EXAMPLE_MARKDOWN
let options: ConverterOptions = cloneConverterOptions(DEFAULT_CONVERTER_OPTIONS)
let latestResult: ConversionResult = { latex: '', diagnostics: [] }
let copyResetTimer: number | undefined
let dragDepth = 0
type Theme = 'dark' | 'light'
const THEME_STORAGE_KEY = 'proofweave-theme'
const EDITOR_ZOOM_STORAGE_KEY = 'proofweave-editor-zoom'
const DEFAULT_EDITOR_ZOOM = 100
const MIN_EDITOR_ZOOM = 80
const MAX_EDITOR_ZOOM = 160
const EDITOR_ZOOM_STEP = 10
let editorZoomPercent = DEFAULT_EDITOR_ZOOM

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function updateThemeColor(theme: Theme): void {
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = theme === 'light' ? '#ffffff' : '#1c222a'
}

function applyTheme(theme: Theme, persist = true): void {
  document.documentElement.dataset.theme = theme
  themeToggle.setAttribute('aria-pressed', String(theme === 'light'))
  const nextLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
  themeToggle.setAttribute('aria-label', nextLabel)
  themeToggle.title = nextLabel
  updateThemeColor(theme)
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Private browsing or a blocked storage policy should not break the UI.
    }
  }
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function normalizeEditorZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EDITOR_ZOOM
  const stepped = Math.round(value / EDITOR_ZOOM_STEP) * EDITOR_ZOOM_STEP
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, stepped))
}

function readStoredEditorZoom(): number {
  try {
    const stored = localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY)
    return stored === null ? DEFAULT_EDITOR_ZOOM : normalizeEditorZoom(Number(stored))
  } catch {
    return DEFAULT_EDITOR_ZOOM
  }
}

function applyEditorZoom(value: number, persist = true): void {
  editorZoomPercent = normalizeEditorZoom(value)
  document.documentElement.style.setProperty('--editor-font-scale', String(editorZoomPercent / 100))
  editorZoomValue.value = `${editorZoomPercent}%`
  editorZoomValue.textContent = `${editorZoomPercent}%`
  editorZoomValue.setAttribute('aria-valuenow', String(editorZoomPercent))
  editorZoomOut.disabled = editorZoomPercent === MIN_EDITOR_ZOOM
  editorZoomIn.disabled = editorZoomPercent === MAX_EDITOR_ZOOM
  syncEditorScroll()
  if (persist) {
    try {
      localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, String(editorZoomPercent))
    } catch {
      // Keep zoom usable when browser storage is unavailable.
    }
  }
}

function currentText(): string {
  return view === 'markdown' ? source : latestResult.latex
}

function updateLineNumbers(): void {
  const text = currentText()
  const lineCount = Math.max(1, text.split('\n').length)
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join('\n')
  lineNumbers.parentElement?.scrollTo({ top: editor.scrollTop })
}

function updateHighlight(): void {
  highlightOutput.innerHTML = highlightCode(currentText(), view)
  highlightLayer.scrollTop = editor.scrollTop
  highlightLayer.scrollLeft = editor.scrollLeft
}

function syncEditorScroll(): void {
  lineNumbers.parentElement?.scrollTo({ top: editor.scrollTop })
  highlightLayer.scrollTop = editor.scrollTop
  highlightLayer.scrollLeft = editor.scrollLeft
}

function renderDiagnostics(diagnostics: Diagnostic[]): void {
  diagnosticsList.replaceChildren()

  if (!diagnostics.length) {
    const status = document.createElement('div')
    status.className = 'diagnostic-status success'
    status.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.6-4-4 1.4-1.4 2.6 2.6 8.2-8.2L18.8 7l-9.6 9.6Z" /></svg><span>No diagnostics for the current input.</span>'
    diagnosticsList.append(status)
    return
  }

  for (const diagnostic of diagnostics) {
    const item = document.createElement('div')
    item.className = `diagnostic-status ${diagnostic.severity}`

    const marker = document.createElement('span')
    marker.className = 'diagnostic-marker'
    marker.textContent = diagnostic.severity === 'error' ? '!' : '!'

    const content = document.createElement('span')
    const line = diagnostic.line && diagnostic.line > 0 ? `Line ${diagnostic.line}: ` : ''
    content.textContent = `${line}${diagnostic.message}`

    item.append(marker, content)
    diagnosticsList.append(item)
  }
}

function renderCLICommand(): void {
  cliCommandOutput.replaceChildren()
  cliCommandOutput.append('proofweave ')
  for (const argument of optionsToCLIArgs(options)) {
    const separator = argument.indexOf('=')
    const optionName = document.createElement('span')
    optionName.className = 'cli-option-name'
    optionName.textContent = separator < 0 ? argument : argument.slice(0, separator)
    cliCommandOutput.append(optionName)
    if (separator >= 0) {
      cliCommandOutput.append('=')
      const optionValue = document.createElement('span')
      optionValue.className = 'cli-option-value'
      optionValue.textContent = argument.slice(separator + 1)
      cliCommandOutput.append(optionValue)
    }
    cliCommandOutput.append(' ')
  }
  cliCommandOutput.append('YOUR_FILE.md')
  cliCommandOutput.dataset.command = cliCommand(options)
}

function updateStats(): void {
  const inputCount = source.length.toLocaleString()
  const outputCount = latestResult.latex.length.toLocaleString()
  const diagnosticCount = latestResult.diagnostics.length.toLocaleString()
  documentStats.textContent = `${inputCount} input / ${outputCount} output / ${diagnosticCount} diagnostics`
}

function renderEditor(): void {
  editor.value = currentText()
  editor.readOnly = view === 'latex'
  editor.classList.toggle('is-output', view === 'latex')
  editor.setAttribute('aria-label', view === 'markdown' ? 'Markdown source' : 'Generated LaTeX output')
  modeStatus.textContent = view === 'markdown' ? 'Editing Markdown' : 'Viewing generated LaTeX'
  primaryAction.textContent = view === 'markdown' ? 'View LaTeX' : 'Copy LaTeX'
  editorCopy.querySelector('span')!.textContent = 'Copy'
  editorCopy.disabled = !currentText()
  updateLineNumbers()
  updateHighlight()
}

function convert(): void {
  try {
    latestResult = convertMarkdown(source, options)
  } catch (error) {
    latestResult = {
      latex: '',
      diagnostics: [{
        severity: 'error',
        code: 'conversion-failed',
        message: error instanceof Error ? error.message : String(error),
        line: 0,
      }],
    }
  }

  renderDiagnostics(latestResult.diagnostics)
  renderCLICommand()
  updateStats()
  downloadOutput.disabled = !latestResult.latex
  primaryAction.disabled = !latestResult.latex
  if (view === 'latex') renderEditor()
}

function setCheckedRadio(name: string, value: string): void {
  const input = optionsForm.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)
  if (input) input.checked = true
}

function updateMathSpacingControls(): void {
  optionsForm.querySelectorAll<HTMLInputElement>('[data-math-spacing-rule]').forEach((input) => {
    input.disabled = !options.mathSpacing.enabled
  })
}

function setView(nextView: EditorView): void {
  view = nextView
  setCheckedRadio('view', view)
  editor.scrollTop = 0
  editor.scrollLeft = 0
  renderEditor()
  if (view === 'markdown') editor.focus()
}

function showFileMessage(message: string, kind: 'error' | 'success'): void {
  fileMessage.textContent = message
  fileMessage.className = `file-message ${kind}`
}

function clearFileMessage(): void {
  fileMessage.textContent = ''
  fileMessage.className = 'file-message'
}

function clearDropState(): void {
  dragDepth = 0
  editorShell.classList.remove('file-drop-active', 'file-drop-invalid')
}

function updateDropState(): void {
  const markdown = view === 'markdown'
  editorShell.classList.toggle('file-drop-active', markdown)
  editorShell.classList.toggle('file-drop-invalid', !markdown)
  dropOverlay.querySelector('strong')!.textContent = markdown
    ? 'Drop Markdown file'
    : 'Markdown import unavailable'
  dropOverlay.querySelector('span')!.textContent = markdown
    ? 'Import one .md file and view the generated LaTeX'
    : 'Switch to Edit Markdown before dropping a file'
}

function isFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

async function importMarkdownFile(file: File): Promise<void> {
  try {
    source = await readMarkdownFile(file)
    clearFileMessage()
    convert()
    setView('latex')
    showFileMessage(`Imported ${file.name} and generated LaTeX.`, 'success')
  } catch (error) {
    const message = error instanceof Error ? error.message : `Could not read ${file.name}.`
    showFileMessage(message, 'error')
  }
}

function clearCopyStatus(): void {
  if (copyResetTimer !== undefined) window.clearTimeout(copyResetTimer)
  copyStatus.textContent = ''
  editorCopy.classList.remove('copied')
}

async function copyText(text: string): Promise<void> {
  if (!text) return
  clearCopyStatus()

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    editor.focus()
    editor.select()
    document.execCommand('copy')
    editor.setSelectionRange(0, 0)
  }

  copyStatus.textContent = 'Copied to clipboard.'
  editorCopy.classList.add('copied')
  editorCopy.querySelector('span')!.textContent = 'Copied'
  copyResetTimer = window.setTimeout(() => {
    copyStatus.textContent = ''
    editorCopy.classList.remove('copied')
    editorCopy.querySelector('span')!.textContent = 'Copy'
  }, 1500)
}

editor.addEventListener('input', () => {
  if (view !== 'markdown') return
  source = editor.value
  updateLineNumbers()
  updateHighlight()
  clearFileMessage()
  convert()
})

editor.addEventListener('scroll', () => {
  syncEditorScroll()
})

editorShell.addEventListener('dragenter', (event) => {
  if (!isFileDrag(event)) return
  event.preventDefault()
  dragDepth += 1
  updateDropState()
  if (view === 'latex') {
    showFileMessage('File import is only available while editing Markdown.', 'error')
  }
})

editorShell.addEventListener('dragover', (event) => {
  if (!isFileDrag(event)) return
  event.preventDefault()
  updateDropState()
  if (event.dataTransfer) event.dataTransfer.dropEffect = view === 'markdown' ? 'copy' : 'none'
})

editorShell.addEventListener('dragleave', (event) => {
  if (!editorShell.classList.contains('file-drop-active')
    && !editorShell.classList.contains('file-drop-invalid')) return
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) clearDropState()
})

editorShell.addEventListener('drop', (event) => {
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (!isFileDrag(event) && files.length === 0) return
  event.preventDefault()
  clearDropState()

  try {
    const file = validateMarkdownDrop(view, files)
    void importMarkdownFile(file as File)
  } catch (error) {
    const message = error instanceof MarkdownFileImportError
      ? error.message
      : 'Could not import the dropped file.'
    showFileMessage(message, 'error')
  }
})

editor.addEventListener('keydown', (event) => {
  if (view !== 'markdown' || event.key !== 'Tab') return
  event.preventDefault()
  const start = editor.selectionStart
  const end = editor.selectionEnd
  editor.setRangeText('\t', start, end, 'end')
  editor.dispatchEvent(new Event('input', { bubbles: true }))
})

optionsForm.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return

  if (target.type === 'checkbox') {
    if (target.name === 'mathSpacingEnabled') {
      options = {
        ...options,
        mathSpacing: { ...options.mathSpacing, enabled: target.checked },
      }
      updateMathSpacingControls()
      convert()
      return
    }

    const cleanupRule = target.dataset.cleanupRule
    if (isCleanupRule(cleanupRule)) {
      options = {
        ...options,
        cleanup: { ...options.cleanup, [cleanupRule]: target.checked },
      }
      convert()
      return
    }

    const rule = target.dataset.mathSpacingRule
    if (isMathSpacingRule(rule)) {
      options = {
        ...options,
        mathSpacing: { ...options.mathSpacing, [rule]: target.checked },
      }
      convert()
    }
    return
  }

  if (target.type !== 'radio') return

  if (target.name === 'view' && (target.value === 'markdown' || target.value === 'latex')) {
    setView(target.value)
    return
  }

  if (target.name === 'indent' && ['0', '2', '4', 'tab'].includes(target.value)) {
    options = {
      ...options,
      indent: target.value === 'tab' ? 'tab' : Number(target.value) as 0 | 2 | 4,
    }
  } else if (target.name === 'inline' && ['parentheses', 'dollar'].includes(target.value)) {
    options = { ...options, inlineMath: target.value as InlineMathStyle }
  } else if (target.name === 'statementDisplay' && ['brackets', 'dollars', 'equation'].includes(target.value)) {
    options = { ...options, statementDisplayMath: target.value as DisplayMathStyle }
  } else if (target.name === 'outsideDisplay' && ['brackets', 'dollars', 'equation'].includes(target.value)) {
    options = { ...options, outsideDisplayMath: target.value as DisplayMathStyle }
  } else if (target.name === 'sectionNumbering' && ['numbered', 'unnumbered'].includes(target.value)) {
    options = { ...options, sectionNumbering: target.value as SectionNumbering }
  } else {
    return
  }

  convert()
})

themeToggle.addEventListener('click', () => {
  const current = currentTheme()
  applyTheme(current === 'light' ? 'dark' : 'light')
})

editorZoomOut.addEventListener('click', () => {
  applyEditorZoom(editorZoomPercent - EDITOR_ZOOM_STEP)
})

editorZoomIn.addEventListener('click', () => {
  applyEditorZoom(editorZoomPercent + EDITOR_ZOOM_STEP)
})

loadExample.addEventListener('click', () => {
  source = EXAMPLE_MARKDOWN
  clearFileMessage()
  setView('markdown')
  convert()
})

clearInput.addEventListener('click', () => {
  source = ''
  clearFileMessage()
  setView('markdown')
  convert()
})

editorCopy.addEventListener('click', () => void copyText(currentText()))

primaryAction.addEventListener('click', () => {
  if (view === 'markdown') setView('latex')
  else void copyText(latestResult.latex)
})

downloadOutput.addEventListener('click', () => {
  if (!latestResult.latex) return
  const blob = new Blob([latestResult.latex], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'proofweave-output.tex'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
})

applyTheme(readStoredTheme(), false)
applyEditorZoom(readStoredEditorZoom(), false)
editor.value = source
updateMathSpacingControls()
convert()
renderEditor()
