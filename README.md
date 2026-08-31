# ProofWeave

Convert Markdown mathematical proofs into clean, well-formatted LaTeX.
[Try it out](https://tshzhu.github.io/proofweave/).

There are two ways to use ProofWeave:

- [In your browser](https://tshzhu.github.io/proofweave/)
- [From the command line](#cli)

## Example

Before:

<!-- proofweave-example-input:start -->
```markdown
# Part I -- A small estimate

This example demonstrates headings, theorem environments, lists, and math.

<!--
This Markdown note is kept as LaTeX comments.
## This heading stays commented out
\[x*y\]
-->

## lemma uniform-noise

### statement

For every \(x\in\mathcal X\), define \(S = \{v \in \mathbb R^d : v^{\mathsf{T}} v \le 1\}\). Then
\[
  |f(x)| \le C.
\]

### proof

By the preceding estimate, the claim follows. \square

## proposition finite-sample

### statement

Assume $n \ge 1$. Then the estimator is well-defined.

### proof

The construction is deterministic, so the result follows.

## A useful checklist

- Keep the statement readable.
- Preserve \(\mathcal X\) exactly.
  - Nested items are supported.
- Use a display when a formula deserves its own line.
```
<!-- proofweave-example-input:end -->

After `proofweave proof.md` with the default options:

<!-- proofweave-example-output:start -->
```latex
\newcommand{\set}[1]{\left\{#1\right\}} % set
\newcommand{\transpose}{{\mkern-1.0mu\mathsf{T}}} % transpose

\section*{Part I -- A small estimate}

This example demonstrates headings, theorem environments, lists, and math.

% This Markdown note is kept as LaTeX comments.
% ## This heading stays commented out
% \[x*y\]

\begin{lemma}\label{lem:uniform-noise}
	For every $x \in \mathcal{X}$, define $S = \set{v \in \mathbb{R}^d : v^\transpose v \leq 1}$. Then
	\begin{equation}
		  | f(x) | \leq C.
	\end{equation}
\end{lemma}

\begin{proof}
	By the preceding estimate, the claim follows.
\end{proof}

\begin{proposition}\label{pro:finite-sample}
	Assume $n \ge 1$. Then the estimator is well-defined.
\end{proposition}

\begin{proof}
	The construction is deterministic, so the result follows.
\end{proof}

\subsection*{A useful checklist}

\begin{itemize}
	\item Keep the statement readable.
	\item Preserve $\mathcal{X}$ exactly.
		\begin{itemize}
			\item Nested items are supported.
		\end{itemize}
	\item Use a display when a formula deserves its own line.
\end{itemize}
```
<!-- proofweave-example-output:end -->

This is LaTeX body content, not a complete document. The leading indentation
above consists of tabs because `--indent=tab` is the default. The default
formatter also normalizes math spacing, braces `\mathcal{X}`, uses `equation`
inside statements, creates canonical labels, and removes the proof-final
`\square` because LaTeX's `proof` environment supplies the QED symbol. The
example also shows the default set/transpose cleanup and its two declarations;
declarations are emitted only when a matching expression was actually changed.

HTML-style Markdown comments `<!-- ... -->` are converted to safe, line-by-line
LaTeX comments. A multi-line comment becomes one `%` line per content line; the
opening and closing marker lines are not content and are omitted. One blank line
is kept before and after the comment, while headings, lists, formulas, and other
Markdown-looking text inside it remain inactive.

<a name="cli"></a>

## CLI

The CLI and website use the same conversion core and options.

### Requirements and installation

Node.js 22 or newer is required. ProofWeave is currently installed from source;
the package is not published to the npm registry.

```sh
git clone https://github.com/tshzhu/proofweave.git
cd proofweave
npm ci
npm run build
```

Run the repository-local executable:

```sh
./bin/proofweave.js proof.md > proof.tex
```

Optionally register the `proofweave` command on your local `PATH`:

```sh
npm link
proofweave --version
```

Re-run `npm run build` after changing the TypeScript source because the executable
loads `dist-cli/proofweave.js`.

### Usage

```text
Usage: proofweave [options] [FILE.md]
```

ProofWeave accepts at most one input file, and file input must have a `.md`
extension. It writes conversion diagnostics to stderr, leaving stdout or the
selected output file reserved for LaTeX. Invocation errors such as an unknown
option, an invalid value, multiple input files, or a non-Markdown input return a
non-zero exit status.

### Input and output

| Invocation | Behavior |
| --- | --- |
| `proofweave proof.md` | Read `proof.md` and write LaTeX to stdout. |
| `proofweave` | Read Markdown from stdin and write LaTeX to stdout. |
| `proofweave -` | Explicitly read Markdown from stdin. |
| `proofweave -o proof.tex proof.md` | Write LaTeX to `proof.tex`. |
| `proofweave --output proof.tex proof.md` | Long form of `-o`. |
| `proofweave -m proof.md` | Replace the input file with LaTeX. |
| `proofweave --modify proof.md` | Long form of `-m`. |
| `proofweave -- --proof.md` | Stop option parsing and read a file whose name starts with `-`. |

`--modify` is destructive: it overwrites the input `.md` file with generated
LaTeX. It requires a real input file, cannot read stdin, and cannot be combined
with `--output`.

### General options

| Option | Description |
| --- | --- |
| `--help`, `-h` | Print the complete CLI help and exit. |
| `--version`, `-v` | Print the ProofWeave version and exit. |
| `--output FILE`, `-o FILE` | Write LaTeX to `FILE` instead of stdout. |
| `--modify`, `-m` | Overwrite the input `.md` file with LaTeX. |

Value options accept either `--option=value` or `--option value`.

### Conversion options

| Option | Values and effect |
| --- | --- |
| `--indent=tab|2|4|0` | Structural indentation: a tab (default), 2 spaces, 4 spaces, or no indentation. |
| `--inline-math=dollar|parentheses` | Emit `$...$` (default) or `\(...\)`. |
| `--statement-display=dollars|brackets|equation` | Display math inside theorem statements: `equation` (default), `$$...$$`, or `\[...\]`. A display containing `\tag` is always forced to `equation`. |
| `--other-display=dollars|brackets|equation` | Display math in proofs and ordinary text: `\[...\]` (default), `$$...$$`, or `equation`. A display containing `\tag` is always forced to `equation`. |
| `--section-numbering=unnumbered|numbered` | Emit `\section*{...}`-style headings (default) or numbered section commands. |

### Cleanup and math-spacing options

All cleanup options and the math-spacing master/rules are enabled by default.
Both positive and negative forms are accepted, for example `--remove-boxed`
and `--no-remove-boxed`.
Cleanup options remain effective when `--no-math-spacing` is used; the six
math-spacing subrules are effective only while `--math-spacing` is enabled.

| Option | Effect |
| --- | --- |
| `--[no-]remove-boxed` | Remove or preserve `\boxed{...}` wrappers while retaining their contents. |
| `--[no-]normalize-label-prefixes` | Normalize theorem labels and existing `\ref`, `\eqref`, `\cref`, and `\label` prefixes to `thm`, `lem`, `pro`, `cor`, `asm`, `def`, and `rmk`. |
| `--[no-]font-command-braces` | Add braces around single-atom math font arguments, for example `\mathcal X` → `\mathcal{X}`. |
| `--[no-]collapse-spaces` | Collapse repeated literal spaces inside math to one space while preserving explicit TeX spacing commands. |
| `--[no-]normalize-inequality-commands` | Normalize `>=`, `> =`, `\ge`, `\geq`, `\geqq`, `\geqslant`, plus `<=`, `< =`, `\le`, `\leq`, `\leqq`, and `\leqslant` (enabled by default). |
| `--ge-command=LATEX` | Target greater-or-equal control word; default is `\ge`. |
| `--le-command=LATEX` | Target less-or-equal control word; default is `\leq`. |
| `--[no-]unify-set-notation` | Convert matched escaped set braces such as `\{x\}`, `\big\{x\big\}`, and `\left\{x\right\}` to `\set{x}` (enabled by default). |
| `--[no-]unify-transpose` | Convert transpose spellings such as `^{T}`, `^{\mathrm{T}}`, `^{\top}`, and `^{\intercal}` to `^\transpose` (enabled by default). |
| `--transpose-expression=LATEX` | Define the body of `\transpose`; default is `\mkern-1.0mu\mathsf{T}`. The value must be a non-empty single-line expression with balanced braces and no unescaped `%`. |
| `--[no-]math-spacing` | Enable or disable the math whitespace formatter as a whole. |
| `--[no-]relations` | Add consistent spaces around relations such as `=`, `<`, `\le`, and `\in`. |
| `--[no-]binary-operators` | Add consistent spaces around binary operators such as `+`, `-`, `*`, and `\times`, while protecting unary signs and scripts. |
| `--[no-]punctuation` | Normalize spaces around commas, semicolons, and colons in math. |
| `--[no-]compact-parentheses` | Keep delimiters and function calls compact, for example `f(x)` rather than `f ( x )`. |
| `--[no-]paired-bars` | Normalize inner spacing for paired absolute-value and norm bars, for example `| x |`. |
| `--[no-]named-functions` | Add the appropriate gap after functions such as `\sin`, `\log`, and `\exp`. |

Regardless of the selected display style, a formula containing `\tag{N}` uses
an `equation` environment and receives an owner-aware label such as
`\label{eqn:main-N}`. Unambiguous plain-text references such as `(N)` become
`\eqref{eqn:main-N}`. Math-styled theorem references such as
`\mathrm{lem:example}` become `\ref{lem:example}`.

When semantic notation cleanup actually changes a matching expression, the
generated body starts with the corresponding `\newcommand` declaration:
`\set` uses `\left\{#1\right\}`, while `\transpose` uses the configured
expression wrapped in a definition. Enabled cleanup with no matching conversion
does not emit an unused declaration. Declarations appear before any other body
content, including comments.

### Command examples

Write the default conversion to stdout:

```sh
proofweave proof.md > proof.tex
```

Use stdin explicitly:

```sh
cat proof.md | proofweave - > proof.tex
```

Write a separate output file:

```sh
proofweave --output proof.tex proof.md
```

Overwrite the input file after reviewing the destructive behavior:

```sh
proofweave --modify proof.md
```

Choose non-default delimiters, indentation, and numbered headings:

```sh
proofweave \
  --indent=4 \
  --inline-math=parentheses \
  --statement-display=brackets \
  --other-display=dollars \
  --section-numbering=numbered \
  proof.md > proof.tex
```

Preserve `\boxed{...}` and turn off selected spacing rules:

```sh
proofweave \
  --no-remove-boxed \
  --no-paired-bars \
  --no-collapse-spaces \
  proof.md > proof.tex
```

Disable all optional math whitespace formatting:

```sh
proofweave --no-math-spacing proof.md > proof.tex
```

Disable set cleanup, or customize the default transpose definition:

```sh
proofweave \
  --no-unify-set-notation \
  --transpose-expression='\mkern-1.0mu\mathsf{T}' \
  proof.md > proof.tex
```

When semantic cleanup modifies the input, the generated LaTeX starts with the
required `\newcommand` declaration before the converted body.

### Exit behavior

- `--help` and `--version` exit successfully without reading input.
- Successful conversion returns status 0. Conversion diagnostics are printed to
  stderr and do not contaminate stdout.
- Invalid invocations return status 1 and print a short error plus the
  `proofweave --help` hint.
- `--modify` requires a file and is mutually exclusive with `--output`.

<a name="browser"></a>

## Browser

Open <https://tshzhu.github.io/proofweave/>. Paste or drop one Markdown file into
the editor, select conversion options in the sidebar, and switch to the generated
LaTeX view. The browser and CLI expose the same conversion settings, and the
sidebar's **CLI** section shows the command corresponding to the current options.

The browser also provides syntax highlighting, diagnostics, copy/download
actions, 80%–160% editor text zoom, and persistent light/dark theme selection.
Conversion runs entirely in the browser.

### Shareable option URLs

When a conversion option differs from the default, ProofWeave adds an `opt`
query parameter to the current URL. The value is URL-encoded, versioned JSON
whose `args` array contains the same conversion flags shown by the CLI panel,
for example:

```text
https://tshzhu.github.io/proofweave/?opt=%7B%22v%22%3A1%2C%22args%22%3A%5B%22--indent%3D4%22%2C%22--no-remove-boxed%22%5D%7D
```

The sidebar's **CLI** section shows the equivalent local command and has its own
copy button. The following **URL** section shows the clean shareable URL and
provides a separate copy button. Both fields wrap and display their full content.

Opening that link restores the conversion settings and updates the form before
the first conversion. Changing a setting updates the URL with
`history.replaceState`, so the page is not reloaded. Returning to the default
configuration removes `opt`. The URL stores conversion options only; Markdown
content, theme, editor zoom, and the selected view are not included. Malformed,
unknown-version, or non-conversion payloads are rejected safely and the page
falls back to defaults with a visible diagnostic.

## Supported input and output

ProofWeave recognizes `theorem`, `lemma`, `proposition`, `corollary`,
`assumption`, `definition`, and `remark` headings at any Markdown heading level.
Nested `statement` and `proof` headings produce the corresponding LaTeX
environments. Labels use canonical prefixes `thm`, `lem`, `pro`, `cor`, `asm`,
`def`, and `rmk`.

Ordinary headings, paragraphs, ordered and unordered nested lists, inline math,
display math, bold, `*italic*` → `\textit{...}`, and code spans are supported. Proof-final
`\square` markers are removed automatically. Tagged equations receive stable
labels and unambiguous references are converted to `\eqref`. Optional semantic
cleanup can unify set braces and transpose superscripts as described above.

Fenced code blocks are preserved as readable text and reported with a diagnostic;
their headings and HTML-comment-looking lines are not parsed as document structure.
HTML comments outside code are emitted as line-by-line LaTeX comments, with the
marker-only edge lines removed.

The output is embeddable LaTeX body content. ProofWeave does not add
`\documentclass`, package imports, theorem declarations, or
`\begin{document}`/`\end{document}`.

## Development

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
npm run benchmark -- path/to/blueprint.md
npm run preview -- --port 4173
```

- `npm run dev` starts the Vite development server.
- `npm test` runs the converter, CLI, UI, and documentation tests.
- `npm run check` performs TypeScript type checking.
- `npm run build` creates the website in `dist/` and the CLI bundle in
  `dist-cli/`.
- `npm run benchmark -- path/to/blueprint.md` reports warm conversion latency,
  input/output sizes, and diagnostics without changing the source file.
- `npm run preview -- --port 4173` serves the production website locally.

## License

[MIT](LICENSE)
