/** Compact UI example. The full verified blueprint stays outside the production bundle. */
export const EXAMPLE_MARKDOWN = String.raw`# Part I -- A small estimate

This example demonstrates headings, theorem environments, lists, and math.

<!--
This Markdown note is kept as LaTeX comments.
## This heading stays commented out
\[x*y\]
-->

## lemma uniform-noise

### statement

For every \(x\in\mathcal X\),
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
`;
