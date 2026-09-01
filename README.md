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

For every \(\mathbf{x}\in\mathcal X\), define \(S = \{\mathbf{v} \in \mathbb R^d : \mathbf{v}^{\mathsf{T}} \mathbf{v} \le 1\}\). Let \(\bm{\Theta}\) be the model matrix. Then
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
- Use consistent notation for \(\mathcal X\), \(\mathbf{x}\), and \(\bm{\Theta}\).
  - Nested items are supported.
- Use a display when a formula deserves its own line.
```
<!-- proofweave-example-input:end -->

After `proofweave proof.md` with the default options:

<!-- proofweave-example-output:start -->
```latex
\newcommand{\vx}{\bm{x}}
\newcommand{\vv}{\bm{v}}

\newcommand{\mTheta}{\bm{\Theta}}

\newcommand{\fX}{\mathcal{X}}

\newcommand{\set}[1]{\left\{#1\right\}} % set
\newcommand{\transpose}{{\mkern-1.0mu\mathsf{T}}} % transpose

\section*{Part I -- A small estimate}

This example demonstrates headings, theorem environments, lists, and math.

% This Markdown note is kept as LaTeX comments.
% ## This heading stays commented out
% \[x*y\]

\begin{lemma}\label{lem:uniform-noise}
	For every $\vx \in \fX$, define $S = \set{\vv \in \mathbb{R}^d : \vv^\transpose \vv \le 1}$. Let $\mTheta$ be the model matrix. Then
	\begin{equation}
		  | f(x) | \le C.
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
	\item Use consistent notation for $\fX$, $\vx$, and $\mTheta$.
		\begin{itemize}
			\item Nested items are supported.
		\end{itemize}
	\item Use a display when a formula deserves its own line.
\end{itemize}
```
<!-- proofweave-example-output:end -->

- The output is a LaTeX body, not a complete document; it does not add a preamble or document environment.
- Tabs are the default structural indentation, and display math in theorem statements uses `equation`.
- Math spacing, canonical labels, three-letter prefixes, notation macros, set/transpose cleanup, and proof-final `\square` cleanup are enabled by default.
- Declarations such as `\vx`, `\mTheta`, `\fX`, `\set`, and `\transpose` are emitted only when a matching expression was actually changed.
- Markdown comments become line-by-line LaTeX comments; their marker-only edge lines are removed and their contents remain inactive.

## CLI

### Installation and usage

Node.js 22 or newer is required. The published npm package contains only the CLI bundle.

```sh
npm install --global proofweave@latest
proofweave proof.md > proof.tex
```

Run it once without a global install:

```sh
npx proofweave@latest proof.md > proof.tex
```

Usage summary:

```text
proofweave [options] [FILE.md]
```

With no file, or with `-`, ProofWeave reads Markdown from stdin and writes LaTeX to stdout. Use
`--output FILE`/`-o FILE` to write a separate file, or `--modify`/`-m` to replace the input `.md`
file. Only one `.md` input file is accepted; diagnostics are written to stderr.

### Options

#### General

```text
--help, -h
    Show help.

--version, -v
    Show the CLI version.

--output FILE, -o FILE
    Write LaTeX to FILE instead of stdout.

--modify, -m
    Overwrite the input Markdown file with LaTeX.
```

#### Conversion

```text
--indent=tab|2|4|0
    Structural indentation; the default is tab.

--inline-math=dollar|parentheses
    Emit `$...$` (default) or `\(...\)`.

--statement-display=dollars|brackets|equation
    Display math inside theorem statements; the default is equation.

--other-display=dollars|brackets|equation
    Display math in proofs and ordinary text; the default is brackets (`\[...\]`).

--section-numbering=unnumbered|numbered
    Emit unnumbered section commands by default, or numbered commands.

Any display containing `\tag{...}` is forced to the equation environment.
```

#### Tidy

```text
--[no-]remove-boxed
    Remove or preserve `\boxed{...}` wrappers.

--[no-]normalize-label-prefixes
    Normalize theorem labels and references to `thm`, `lem`, `pro`, `cor`, `asm`, `def`, or `rmk`.

--[no-]font-command-braces
    Add braces around single-atom font arguments, for example `\mathcal X` → `\mathcal{X}`.

--[no-]collapse-spaces
    Collapse repeated literal spaces inside math while preserving explicit TeX spacing.

--[no-]normalize-inequality-commands
    Normalize equivalent greater-than, less-than, and not-equal spellings.

--ge-command=LATEX
    Target greater-or-equal command; default `\ge`.

--le-command=LATEX
    Target less-or-equal command; default `\le`.

--ne-command=LATEX
    Target not-equal command; default `\neq`.

--[no-]normalize-empty-set-command
    Normalize `\emptyset` and `\varnothing`.

--empty-set-command=LATEX
    Target empty-set command; default `\varnothing`.

--[no-]normalize-math-symbols
    Convert single bold lowercase/uppercase symbols to `\v*`/`\m*`, and single uppercase `\mathcal` symbols to `\f*`.

--[no-]unify-set-notation
    Convert matched escaped-brace set variants to `\set{...}`.

--[no-]unify-transpose
    Convert transpose spellings such as `^{T}`, `^{\top}`, and `^{\intercal}` to `^\transpose`.

--transpose-expression=LATEX
    Define the body of `\transpose`; default `\mkern-1.0mu\mathsf{T}`.

```

The `\v*`, `\m*`, and `\f*` conventions follow BAAI's
[Notation for Machine Learning](https://notation.baai.ac.cn/en).

#### Math spacing

```text
--[no-]math-spacing
    Enable or disable the math-spacing formatter as a whole.

--[no-]relations
    Add consistent spaces around relations such as `=`, `<`, `\le`, and `\in`.

--[no-]binary-operators
    Add consistent spaces around binary operators such as `+`, `-`, `*`, and `\times`.

--[no-]punctuation
    Normalize spaces around commas, semicolons, and colons.

--[no-]compact-parentheses
    Keep delimiters and function calls compact, for example `f(x)`.

--[no-]paired-bars
    Normalize inner spacing for paired absolute-value and norm bars, for example `| x |`.

--[no-]named-functions
    Add the appropriate gap after functions such as `\sin`, `\log`, and `\exp`.
```

Tidy options remain active when `--no-math-spacing` is used; the six math-spacing subrules are
effective only while `--math-spacing` is enabled. Use `proofweave --help` for the same option list
in compact form.

## Browser

Open <https://tshzhu.github.io/proofweave/> to edit Markdown in the browser. The editor supports
the same conversion options as the CLI, syntax highlighting, diagnostics, drag-and-drop of one
`.md` file, copy/download actions, editor zoom, and light/dark themes. Conversion runs entirely in
the browser.

### Shareable option URLs

When a conversion option differs from the default, ProofWeave adds a versioned `opt` query
parameter containing the same conversion flags shown in the CLI panel:

```text
https://tshzhu.github.io/proofweave/?opt=%7B%22v%22%3A1%2C%22args%22%3A%5B%22--indent%3D4%22%5D%7D
```

Copy the URL or the equivalent CLI command from the sidebar. Markdown content, theme, editor zoom,
and selected view are not stored in the URL.

## Development

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
npm run preview -- --port 4187
```

`npm run build` creates the browser site in `dist/` and the CLI bundle in `dist-cli/`.
`npm pack --dry-run` verifies that the npm package contains only the CLI launcher, CLI bundle,
README, LICENSE, and package metadata.

## License

[MIT](LICENSE)
