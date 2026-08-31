import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import test from 'node:test'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const fileImport = readFileSync(new URL('../src/file-import.ts', import.meta.url), 'utf8')
const optionsSource = readFileSync(new URL('../src/options.ts', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../public/icons/site.webmanifest', import.meta.url), 'utf8'))

function radioValues(name: string): string[] {
  const pattern = new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]+)"[^>]*>`, 'g')
  return [...html.matchAll(pattern)].map((match) => match[1] ?? '')
}

function checkedRadio(name: string): string | undefined {
  const pattern = new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]+)"[^>]*checked[^>]*>`)
  return pattern.exec(html)?.[1]
}

function spacingRuleValues(): string[] {
  return [...html.matchAll(/data-math-spacing-rule="([^"]+)"/g)]
    .map((match) => match[1] ?? '')
}

function detailsSection(summary: string): string {
  const pattern = new RegExp(`<details[^>]*>[\\s\\S]*?<summary>${summary.replace(/[()]/g, '\\$&')}<\\/summary>([\\s\\S]*?)<\\/details>`)
  return pattern.exec(html)?.[1] ?? ''
}

test('uses the BibTeX Tidy editor and fixed-sidebar structure', () => {
  assert.match(html, /<main id="editor"/)
  assert.match(html, /<aside id="sidebar"/)
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) 400px/)
  assert.match(css, /#editor[\s\S]*height:\s*100vh/)
  assert.match(css, /#sidebar[\s\S]*height:\s*100vh/)
  assert.doesNotMatch(html, /topbar|class="panel"|site-footer|diagnostics-panel/)
})

test('uses the ProofWeave brand and concise conversion description', () => {
  assert.match(html, /<title>ProofWeave — Convert Markdown proofs into clean LaTeX<\/title>/)
  assert.match(html, /<h1>ProofWeave<\/h1>/)
  assert.match(html, /Convert Markdown mathematical proofs into clean, well-formatted LaTeX\./)
  assert.doesNotMatch(html, /AI-generated|never uploaded|publishing, reading, and continued editing/)
  assert.doesNotMatch(html, /Markdown to LaTeX/)
})

test('provides bounded editor text zoom beside the copy action', () => {
  assert.match(html, /class="editor-controls"[\s\S]*id="editor-zoom-out"[\s\S]*id="editor-zoom-value"[\s\S]*id="editor-zoom-in"[\s\S]*id="editor-copy"/)
  assert.match(html, /id="editor-zoom-value"[\s\S]*aria-valuemin="80"[\s\S]*aria-valuemax="160"[\s\S]*aria-valuenow="100"/)
  assert.match(css, /--editor-font-size:\s*15px/)
  assert.match(css, /--editor-font-scale:\s*1/)
  assert.match(css, /--mono-normal:\s*400 calc\(var\(--editor-font-size\) \* var\(--editor-font-scale\)\)/)
  assert.match(main, /EDITOR_ZOOM_STORAGE_KEY = 'proofweave-editor-zoom'/)
  assert.match(main, /DEFAULT_EDITOR_ZOOM = 100/)
  assert.match(main, /MIN_EDITOR_ZOOM = 80/)
  assert.match(main, /MAX_EDITOR_ZOOM = 160/)
  assert.match(main, /EDITOR_ZOOM_STEP = 10/)
  assert.match(main, /document\.documentElement\.style\.setProperty\('--editor-font-scale'/)
  assert.match(main, /editorZoomOut\.disabled = editorZoomPercent === MIN_EDITOR_ZOOM/)
  assert.match(main, /editorZoomIn\.disabled = editorZoomPercent === MAX_EDITOR_ZOOM/)
  assert.match(main, /localStorage\.setItem\(EDITOR_ZOOM_STORAGE_KEY, String\(editorZoomPercent\)\)/)
  assert.match(main, /applyEditorZoom\(readStoredEditorZoom\(\), false\)/)
  assert.match(main, /function applyEditorZoom[\s\S]*syncEditorScroll\(\)/)
  assert.match(main, /requestAnimationFrame/)
  assert.match(main, /pendingEditorFrame/)
  assert.match(main, /lastHighlightedText/)
  assert.match(main, /lastLineNumberText/)
  assert.match(main, /lastDiagnosticsKey/)
  assert.match(main, /lastCLICommand/)
  assert.match(main, /lastStatsKey/)
})

test('aligns the theme toggle with the heading and includes a GitHub action', () => {
  assert.match(html, /<div class="intro-heading">[\s\S]*<h1>ProofWeave<\/h1>[\s\S]*id="theme-toggle"[\s\S]*<\/div>/)
  assert.doesNotMatch(html, /toolbar-topline/)
  assert.match(css, /\.intro-heading\s*\{[\s\S]*justify-content:\s*space-between/)
  assert.match(html, /id="load-example"[\s\S]*id="clear-input"[\s\S]*href="https:\/\/github\.com\/tshzhu\/proofweave">GitHub<\/a>/)
  assert.match(css, /\.btn\s*\{[\s\S]*text-decoration:\s*none/)
  assert.match(css, /a\.btn:focus-visible/)
})

test('configures complete relative favicon and web app icon metadata', () => {
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon\.png"/)
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\.\/icons\/favicon-32x32\.png"/)
  assert.match(html, /rel="icon" type="image\/png" sizes="16x16" href="\.\/icons\/favicon-16x16\.png"/)
  assert.match(html, /rel="icon" href="\.\/icons\/favicon\.ico" sizes="any"/)
  assert.match(html, /rel="manifest" href="\.\/icons\/site\.webmanifest"/)
  assert.equal(manifest.name, 'ProofWeave')
  assert.equal(manifest.short_name, 'ProofWeave')
  assert.equal(manifest.start_url, './')
  assert.equal(manifest.scope, './')
  assert.deepEqual(manifest.icons, [
    { src: './android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: './android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
  ])
  for (const name of [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'site.webmanifest',
  ]) {
    assert.ok(statSync(new URL(`../public/icons/${name}`, import.meta.url)).size > 100, `${name} is missing or empty`)
  }
})

test('defaults to the light theme while preserving a stored dark choice', () => {
  assert.match(html, /<html[^>]+data-theme="light"/)
  assert.match(html, /<meta name="theme-color" content="#ffffff"/)
  assert.match(html, /aria-label="Switch to dark mode"/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /localStorage\.getItem\('proofweave-theme'\) === 'dark' \? 'dark' : 'light'/)
  assert.match(main, /localStorage\.getItem\(THEME_STORAGE_KEY\) === 'dark' \? 'dark' : 'light'/)
  assert.match(main, /return 'light'/)
})

test('exposes all editor views and conversion options as sidebar radios', () => {
  assert.deepEqual(radioValues('view'), ['markdown', 'latex'])
  assert.deepEqual(radioValues('indent'), ['tab', '2', '4', '0'])
  assert.equal(checkedRadio('indent'), 'tab')
  assert.deepEqual(radioValues('inline'), ['dollar', 'parentheses'])
  assert.equal(checkedRadio('inline'), 'dollar')
  assert.deepEqual(radioValues('statementDisplay'), ['dollars', 'brackets', 'equation'])
  assert.equal(checkedRadio('statementDisplay'), 'equation')
  assert.deepEqual(radioValues('outsideDisplay'), ['dollars', 'brackets', 'equation'])
  assert.equal(checkedRadio('outsideDisplay'), 'brackets')
  assert.deepEqual(radioValues('sectionNumbering'), ['unnumbered', 'numbered'])
  assert.equal(checkedRadio('sectionNumbering'), 'unnumbered')
  assert.equal(radioValues('display').length, 0)
  assert.deepEqual(spacingRuleValues(), [
    'relations',
    'binaryOperators',
    'punctuation',
    'compactParentheses',
    'pairedBars',
    'namedFunctions',
  ])
  assert.match(html, /name="mathSpacingEnabled" checked/)
  assert.equal((html.match(/data-math-spacing-rule="[^"]+" checked/g) ?? []).length, 6)
  assert.equal((html.match(/data-cleanup-rule="[^"]+" checked/g) ?? []).length, 6)
  assert.equal((html.match(/data-cleanup-rule="[^"]+"/g) ?? []).length, 6)
  assert.match(html, /class="option-row math-spacing-master"[\s\S]*class="math-spacing-rules"/)
  assert.ok(html.indexOf('name="mathSpacingEnabled"') < html.indexOf('data-math-spacing-rule="relations"'))
  assert.doesNotMatch(detailsSection('Math spacing'), /data-cleanup-rule=/)
  assert.match(detailsSection('Cleanup'), /data-cleanup-rule="removeBoxed" checked[\s\S]*data-cleanup-rule="normalizeLabelPrefixes" checked[\s\S]*data-cleanup-rule="fontCommandBraces" checked[\s\S]*data-cleanup-rule="collapseSpaces" checked/)
  assert.match(detailsSection('Cleanup'), /data-cleanup-rule="unifySetNotation" checked/)
  assert.match(detailsSection('Cleanup'), /data-cleanup-rule="unifyTransposeNotation" checked/)
  assert.match(detailsSection('Cleanup'), /name="transposeExpression"[^>]+value="\\mkern-1\.0mu\\mathsf\{T\}"/)
  assert.match(main, /validateTransposeExpression/)
  assert.match(main, /transposeExpressionInput\.value = options\.cleanup\.transposeExpression/)
  assert.match(main, /target\.type === 'text' && target\.name === 'transposeExpression'/)
  assert.match(main, /cleanup: \{ \.\.\.options\.cleanup, transposeExpression \}/)
  assert.match(optionsSource, /unifySetNotation: true/)
  assert.match(optionsSource, /unifyTransposeNotation: true/)
  assert.match(optionsSource, /transposeExpression: DEFAULT_TRANSPOSE_EXPRESSION/)
  assert.ok(html.indexOf('<summary>Math spacing</summary>') < html.indexOf('<summary>Diagnostics</summary>'))
  assert.match(html, /<summary>Diagnostics<\/summary>/)
  assert.match(html, /id="primary-action"[\s\S]*View LaTeX/)
  assert.match(html, /id="download-output"/)
})

test('uses sentence case headings and places a dynamic CLI panel last', () => {
  assert.deepEqual(
    [...html.matchAll(/<summary>([^<]+)<\/summary>/g)].map((match) => match[1]),
    [
      'View',
      'Indentation',
      'Inline math',
      'Display math (statement)',
      'Display math (main text)',
      'Section headings',
      'Math spacing',
      'Cleanup',
      'Diagnostics',
      'CLI',
      'URL',
    ],
  )
  assert.match(html, /<details id="cli-panel">[\s\S]*<summary>CLI<\/summary>/)
  assert.match(html, /To run this configuration on the command line:/)
  assert.match(html, /id="cli-command"[\s\S]*proofweave YOUR_FILE\.md/)
  assert.ok(html.indexOf('<summary>Diagnostics</summary>') < html.indexOf('<summary>CLI</summary>'))
  assert.ok(html.indexOf('<summary>CLI</summary>') < html.indexOf('<summary>URL</summary>'))
  assert.ok(html.indexOf('<summary>URL</summary>') < html.indexOf('</form>'))
  assert.match(main, /function renderCLICommand\(\)/)
  assert.match(main, /optionsToCLIArgs\(options\)/)
  assert.match(main, /const command = cliCommand\(options\)/)
  assert.match(main, /cliCommandOutput\.dataset\.command = command/)
  assert.match(optionsSource, /export function optionsToCLIArgs/)
  assert.match(optionsSource, /export function parseCLIArguments/)
})

test('provides copy controls for the shareable URL and CLI command', () => {
  assert.match(html, /<details id="url-panel">[\s\S]*id="url-command"[\s\S]*id="url-copy"[\s\S]*Copy shareable URL/)
  assert.match(html, /<details id="cli-panel">[\s\S]*id="cli-command"[\s\S]*id="cli-copy"[\s\S]*Copy CLI command/)
  assert.match(css, /\.share-field\s*\{[\s\S]*grid-template-columns/)
  assert.match(main, /urlCommandOutput\.textContent = shareUrl/)
  assert.match(main, /copyShareValue\(cliCommandOutput\.dataset\.command/)
  assert.match(main, /copyShareValue\(urlCommandOutput\.dataset\.url/)
})

test('shows complete URL and CLI content with the same code-field style', () => {
  assert.match(css, /\.share-field > #url-command,[\s\S]*\.share-field > #cli-command\s*\{[\s\S]*width:\s*100%[\s\S]*min-width:\s*0/)
  assert.match(css, /#url-command,[\s\S]*#cli-command\s*\{[\s\S]*overflow-wrap:\s*anywhere[\s\S]*white-space:\s*normal/)
  assert.doesNotMatch(detailsSection('URL'), /<textarea/)
})

test('supports shareable conversion-option URLs without storing document state', () => {
  assert.match(optionsSource, /OPTIONS_URL_PARAMETER = ['"]opt['"];/)
  assert.match(optionsSource, /OPTIONS_URL_VERSION = 1/)
  assert.match(optionsSource, /export function optionsToUrlSearch/)
  assert.match(optionsSource, /export function optionsFromUrlSearch/)
  assert.match(main, /optionsFromUrlSearch\(window\.location\.search\)/)
  assert.match(main, /optionsToUrlSearch\(options\)/)
  assert.match(main, /shareUrlForOptions\(window\.location\.href, options\)/)
  assert.match(main, /history\.replaceState\(null, '', next\)/)
  assert.match(main, /url\.searchParams\.delete\('opt'\)/)
  assert.match(main, /restoredOptions\.error/)
  assert.match(main, /syncOptionsForm\(\)/)
  assert.doesNotMatch(main, /localStorage\.setItem\([^)]*source|localStorage\.setItem\([^)]*options/)
})

test('keeps the requested interactions wired to the new interface', () => {
  for (const behavior of [
    'renderLatex',
    'parseMarkdown',
    'updateLineNumbers',
    'setView',
    'navigator.clipboard.writeText',
    "anchor.download = 'proofweave-output.tex'",
    'primaryAction.disabled',
    'statementDisplayMath',
    'outsideDisplayMath',
    'sectionNumbering',
    'mathSpacing',
    'isMathSpacingRule',
    'cleanup',
    'isCleanupRule',
    'updateMathSpacingControls',
    "input.disabled = !options.mathSpacing.enabled",
    'themeToggle',
    'readStoredTheme',
    'currentTheme',
    'applyTheme',
    'localStorage.setItem(THEME_STORAGE_KEY, theme)',
    "document.documentElement.dataset.theme = theme",
    'themeToggle.addEventListener',
    'updateThemeColor',
    'highlightCode',
    'validateMarkdownDrop',
    'isFileDrag',
    "includes('Files')",
    "setView('latex')",
    "event.dataTransfer.dropEffect = view === 'markdown' ? 'copy' : 'none'",
  ]) {
    assert.ok(main.includes(behavior), `Missing UI behavior: ${behavior}`)
  }
  assert.doesNotMatch(main, /\bdisplayMath:/)
  assert.match(html, /id="highlight-layer"[\s\S]*id="highlight-code"/)
  assert.match(html, /id="drop-overlay"/)
  assert.match(html, /id="editor-file-message"[^>]+role="alert"/)
  assert.match(css, /#document-editor[\s\S]*-webkit-text-fill-color:\s*transparent/)
  assert.match(css, /#highlight-layer,[\s\S]*#document-editor[\s\S]*tab-size:\s*4/)
  assert.match(css, /#document-editor::selection,[\s\S]*#document-editor::-moz-selection[\s\S]*background:\s*var\(--selection-bg\)/)
  assert.match(css, /#document-editor::selection,[\s\S]*color:\s*transparent/)
  assert.match(css, /--selection-bg:\s*rgba\(/)
  assert.match(css, /input\[type='checkbox'\]/)
  assert.match(css, /\.math-spacing-rules\s*\{[\s\S]*margin:\s*0/)
  assert.match(css, /\.option-row:has\(input:disabled\)[\s\S]*opacity:\s*0\.45/)
  assert.match(main, /querySelectorAll<HTMLInputElement>\('\[data-math-spacing-rule\]'\)/)
  assert.doesNotMatch(main, /querySelectorAll<HTMLInputElement>\('\[data-cleanup-rule\]'\)[\s\S]*disabled/)
  assert.match(css, /:root\[data-theme='light'\]/)
  assert.match(css, /--accent|--red:\s*#b31b1b/)
  assert.match(css, /\.token-command\s*\{\s*color:\s*var\(--light-blue\)/)
  assert.match(css, /\.token-math,[\s\S]*\.token-number\s*\{\s*color:\s*var\(--green\)/)
  assert.match(html, /id="theme-toggle"[^>]+aria-label="Switch to dark mode"/)
  assert.match(html, /class="theme-icon theme-icon-sun"/)
  assert.match(html, /class="theme-icon theme-icon-moon"/)
  assert.match(main, /dragover[\s\S]*event\.preventDefault\(\)/)
  assert.match(main, /drop[\s\S]*event\.preventDefault\(\)/)
  assert.match(main, /source = await readMarkdownFile\(file\)[\s\S]*convert\(\)[\s\S]*setView\('latex'\)/)
  assert.match(fileImport, /File import is only available while editing Markdown\./)
  assert.match(fileImport, /Unsupported file type\. Drop a \.md file while editing Markdown\./)
})

test('ships the same local font families used by the reference interface', () => {
  for (const name of [
    'IBMPlexSans-Light.woff2',
    'IBMPlexSans-Medium.woff2',
    'Inconsolata-Regular.woff2',
  ]) {
    const url = new URL(`../public/fonts/${name}`, import.meta.url)
    assert.ok(statSync(url).size > 30_000, `${name} is missing or truncated`)
    assert.ok(css.includes(`/fonts/${name}`))
  }
})

test('provides the narrow-screen stacked layout without negative tracking', () => {
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /#sidebar[\s\S]*width:\s*100%/)
  assert.doesNotMatch(css, /letter-spacing:\s*-/)
})
