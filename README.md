# ProofWeave

ProofWeave converts Markdown mathematical proofs into clean, well-formatted
LaTeX.

Website: <https://tshzhu.github.io/proofweave/>

All conversion runs locally in the browser or CLI. Proof text is not uploaded
or saved by the application.

## Supported input

The converter recognizes `theorem`, `lemma`, `proposition`, `corollary`,
`assumption`, `definition`, and `remark` headings at any Markdown heading level.
Nested `statement` and `proof` headings define the corresponding LaTeX blocks:

```markdown
## lemma uniform-noise

### statement
For every \(x\in\mathcal X\), the estimate holds.

### proof
The preceding bound proves the claim. \square
```

The output is body content rather than a complete document:

```latex
\begin{lemma}\label{lem:uniform-noise}
  For every \(x\in\mathcal X\), the estimate holds.
\end{lemma}

\begin{proof}
  The preceding bound proves the claim.
\end{proof}
```

Proof-final `\\square` markers are removed automatically because LaTeX's
`proof` environment supplies the QED symbol. Display-math bodies are indented
according to the selected structure indentation, and any display containing a
`\\tag{...}` or `\\tag*{...}` is emitted as an `equation` environment so the tag
remains valid.

Tagged equations receive owner-aware labels on the opening line. For example,
`\\tag{10}` inside `\\label{thm:main}` becomes:

```latex
\begin{equation}\label{eqn:main-10}
  ... \tag{10}
\end{equation}
```

Confirmed plain-text references such as `(10)` become the matching
`\\eqref{eqn:main-10}`; ambiguous or unknown numbers remain unchanged.

Ordinary headings, paragraphs, nested ordered and unordered lists, inline math,
display math, basic emphasis, and code spans are also supported. Diagnostics flag
missing sections, duplicate labels, malformed math, and unsupported structures.

## Options

- Structure indentation: a tab (default), 2 spaces, 4 spaces, or none.
- Theme: light mode is the default on first visit; a saved dark/light choice is
  restored automatically.
- Inline math output: `$...$` (default) or `\(...\)`.
- Statement display math: `$$...$$`, `\[...\]`, or `equation` (default).
- Other display math, including proofs and ordinary body text: `$$...$$`,
  `\[...\]` (default), or `equation`.
- Section headings: unnumbered (default) or numbered. H1 maps to `section`, H2
  to `subsection`, and H3 or deeper to `subsubsection`.
- Math spacing: enabled by default, with independent controls for relations,
  binary operators, punctuation (including colon spacing), compact
  parentheses/function calls, paired bars, named functions, explicit braces
  around single-atom math font commands (for example, `\\mathcal X` becomes
  `\\mathcal{X}`), and collapsing repeated source spaces. The formatter adds
  readable implicit-multiplication gaps, protects scripts and text/tag/label
  arguments, and preserves explicit TeX spacing commands and comments.
- Math references: inside math, `\\mathrm{lem:example}` is normalized to
  `\\ref{lem:example}` for hyperref-compatible cross-references. Ordinary
  `\\mathrm{R}` and text/tag/label arguments are left unchanged.
- Labels use canonical three-letter prefixes: `thm`, `lem`, `pro`, `cor`,
  `asm`, `def`, and `rmk`. Legacy aliases such as `prop:` and full prefixes
  such as `proposition:` are normalized automatically.
- Tagged equations: every display containing `\\tag{N}` gets a stable label
  such as `\\label{eqn:main-N}` based on its theorem/proof owner (or
  `background` outside theorem environments). Unambiguous plain-text `(N)`
  references are converted to `\\eqref{...}`; unresolved or ambiguous numbers
  are left unchanged.
- Cleanup: `\\boxed{...}` wrappers are removed by default while preserving
  their contents. Disable this in the website or with `--no-remove-boxed`.
- Copy the result or download it as a `.tex` text file.

The renderer keeps one blank line around structural blocks such as section
headings, theorem/proof environments, and lists. Ordinary prose and display
math use a single line break so the output remains compact while environment
indentation stays readable.

The interface follows BibTeX Tidy's editor-and-sidebar workflow. Edit Markdown
in the full-height left pane, choose conversion options in the right sidebar,
then switch to the generated LaTeX view with **View LaTeX**. The editor's Copy
button copies whichever view is currently visible. Use the minus and plus
buttons beside Copy to adjust editor text from 80% to 160%; the default is 100%
with a 15px base size. Use the sun/moon button beside the ProofWeave heading to
switch between the dark editor theme and the red-and-white light theme. Both
preferences are kept locally in the browser. The GitHub button opens the source
repository.

Both editor views use syntax highlighting for their current language. While in
the Markdown view, you can also drop one `.md` file onto the editor to replace
the source and immediately switch to the generated LaTeX view. Other file types,
multiple files, and all drops made in the LaTeX view are rejected without
changing the current document.

Tabs in the editor and its synchronized highlight layer are displayed at a
four-space width; this changes visual alignment only, not the emitted LaTeX
indentation option or the underlying tab characters.

## Local development

Node.js 22 or newer is required.

```bash
npm ci
npm run dev
```

## Command-line usage

The CLI and website use the same conversion core and option model. Build the
local executable, then run it directly or expose it on your `PATH` with
`npm link`:

```bash
npm run build
./bin/proofweave.js proof.md > proof.tex
npm link
proofweave proof.md > proof.tex
```

With no input file (or with `-`), Markdown is read from stdin:

```bash
cat proof.md | proofweave --indent=4 --section-numbering=numbered > proof.tex
```

Use `--output/-o` to write another file or `--modify/-m` to overwrite the input:

```bash
proofweave --output proof.tex proof.md
proofweave --modify proof.md
```

Every conversion control in the website has a corresponding CLI option. Open
the **CLI** section at the bottom of the sidebar to see the command for the
current web configuration, or run `proofweave --help` for the complete
list.

Run the test suite and production build with:

```bash
npm test
npm run check
npm run build
npm run preview
```

## License

MIT
