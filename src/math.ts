import type { Diagnostic } from "./labels.ts";
import {
  DEFAULT_MATH_CLEANUP_OPTIONS,
  DEFAULT_MATH_SPACING_OPTIONS,
  formatMathSpacing,
  type MathCleanupOptions,
  type MathSpacingOptions,
} from "./math-spacing.ts";

export type InlineMathStyle = "parentheses" | "dollar";
export type DisplayMathStyle = "brackets" | "dollars" | "equation";

function balancedGroupEnd(value: string, start: number): number | undefined {
  if (value[start] !== "{") return undefined;
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === "{") depth += 1;
    else if (value[index] === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return undefined;
}

export function removeBoxedCommands(value: string): string {
  let result = "";
  for (let index = 0; index < value.length;) {
    if (!value.startsWith("\\boxed", index)) {
      result += value[index];
      index += 1;
      continue;
    }
    let groupStart = index + "\\boxed".length;
    while (groupStart < value.length && /[ \t]/.test(value[groupStart] ?? "")) groupStart += 1;
    const end = balancedGroupEnd(value, groupStart);
    if (end === undefined) {
      result += value[index];
      index += 1;
      continue;
    }
    result += removeBoxedCommands(value.slice(groupStart + 1, end - 1));
    index = end;
  }
  return result;
}

function normalizeMathBody(
  value: string,
  spacing: MathSpacingOptions,
  cleanup: MathCleanupOptions & { removeBoxed: boolean },
): string {
  const cleaned = cleanup.removeBoxed ? removeBoxedCommands(value) : value;
  return formatMathSpacing(cleaned, spacing, cleanup);
}

function escapePlainText(value: string): string {
  return value.replace(/[&%$#_{}~^]/g, (character) => {
    if (character === "~") return "\\textasciitilde{}";
    if (character === "^") return "\\textasciicircum{}";
    return `\\${character}`;
  });
}

function escapeCodeText(value: string): string {
  return value.replace(/[\\&%$#_{}~^]/g, (character) => {
    if (character === "\\") return "\\textbackslash{}";
    if (character === "~") return "\\textasciitilde{}";
    if (character === "^") return "\\textasciicircum{}";
    return `\\${character}`;
  });
}

function findUnescaped(value: string, needle: string, start: number): number {
  let index = value.indexOf(needle, start);
  while (index >= 0) {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
      slashes += 1;
    }
    if (slashes % 2 === 0) return index;
    index = value.indexOf(needle, index + needle.length);
  }
  return -1;
}

function consumeLatexCommand(value: string, start: number): number {
  const command = value.slice(start).match(/^\\(?:[A-Za-z@]+\*?|.)/);
  if (!command) return start + 1;
  let cursor = start + command[0].length;
  while (cursor < value.length && (value[cursor] === "{" || value[cursor] === "[")) {
    const open = value[cursor];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let index = cursor;
    for (; index < value.length; index += 1) {
      if (value[index] === open && value[index - 1] !== "\\") depth += 1;
      if (value[index] === close && value[index - 1] !== "\\") {
        depth -= 1;
        if (depth === 0) {
          cursor = index + 1;
          break;
        }
      }
    }
    if (index >= value.length) break;
  }
  return cursor;
}

function renderMarkdownText(
  value: string,
  diagnostics: Diagnostic[],
  line?: number,
  transformPlain?: (value: string) => string,
): string {
  let output = "";
  let plain = "";
  const flush = () => {
    const escaped = escapePlainText(plain);
    output += transformPlain ? transformPlain(escaped) : escaped;
    plain = "";
  };

  for (let index = 0; index < value.length; ) {
    if (value[index] === "\\") {
      flush();
      const end = consumeLatexCommand(value, index);
      output += value.slice(index, end);
      index = end;
      continue;
    }

    if (value[index] === "`") {
      const close = value.indexOf("`", index + 1);
      if (close < 0) {
        diagnostics.push({
          severity: "warning",
          code: "unclosed-code-span",
          message: "An unclosed code span was preserved as text.",
          line,
        });
        plain += value[index];
        index += 1;
        continue;
      }
      flush();
      output += `\\texttt{${escapeCodeText(value.slice(index + 1, close))}}`;
      index = close + 1;
      continue;
    }

    const emphasis = value.startsWith("**", index) ? "**" : value[index] === "*" ? "*" : undefined;
    if (emphasis) {
      const close = value.indexOf(emphasis, index + emphasis.length);
      if (close >= 0) {
        flush();
        const body = renderMarkdownText(
          value.slice(index + emphasis.length, close),
          diagnostics,
          line,
          transformPlain,
        );
        output += emphasis === "**" ? `\\textbf{${body}}` : `\\textit{${body}}`;
        index = close + emphasis.length;
        continue;
      }
    }

    if (value[index] === "[" ) {
      const link = value.slice(index).match(/^\[([^\]]+)]\(([^)]+)\)/);
      if (link) {
        flush();
        output += `${renderMarkdownText(link[1]!, diagnostics, line, transformPlain)} (${escapePlainText(link[2]!)})`;
        diagnostics.push({
          severity: "warning",
          code: "markdown-link",
          message: "A Markdown link was converted to readable text; review the URL formatting.",
          line,
        });
        index += link[0].length;
        continue;
      }
    }

    plain += value[index];
    index += 1;
  }
  flush();
  return output;
}

export function renderInline(
  value: string,
  style: InlineMathStyle,
  diagnostics: Diagnostic[] = [],
  line?: number,
  spacing: MathSpacingOptions = DEFAULT_MATH_SPACING_OPTIONS,
  cleanup: MathCleanupOptions & { removeBoxed: boolean } = {
    ...DEFAULT_MATH_CLEANUP_OPTIONS,
    removeBoxed: true,
  },
  transformPlain?: (value: string) => string,
): string {
  const pieces: string[] = [];
  let plain = "";
  const flush = () => {
    if (plain) pieces.push(renderMarkdownText(plain, diagnostics, line, transformPlain));
    plain = "";
  };
  const delimiters = style === "parentheses" ? ["\\(", "\\)"] : ["$", "$"];

  for (let index = 0; index < value.length; ) {
    if (value.startsWith("\\(", index)) {
      const close = value.indexOf("\\)", index + 2);
      if (close >= 0) {
        flush();
        pieces.push(`${delimiters[0]}${normalizeMathBody(value.slice(index + 2, close), spacing, cleanup)}${delimiters[1]}`);
        index = close + 2;
        continue;
      }
      diagnostics.push({
        severity: "warning",
        code: "unclosed-inline-math",
        message: "Inline math opened with \\( but has no closing delimiter.",
        line,
      });
    }

    if (value[index] === "$" && value[index - 1] !== "\\" && value[index + 1] !== "$") {
      const close = findUnescaped(value, "$", index + 1);
      if (close >= 0 && value[close + 1] !== "$") {
        flush();
        pieces.push(`${delimiters[0]}${normalizeMathBody(value.slice(index + 1, close), spacing, cleanup)}${delimiters[1]}`);
        index = close + 1;
        continue;
      }
    }

    plain += value[index];
    index += 1;
  }
  flush();
  return pieces.join("");
}

export function renderDisplay(
  body: string,
  style: DisplayMathStyle,
  spacing: MathSpacingOptions,
  indent = "",
  cleanup: MathCleanupOptions & { removeBoxed: boolean } = {
    ...DEFAULT_MATH_CLEANUP_OPTIONS,
    removeBoxed: true,
  },
  equationLabel?: string,
): string {
  const normalizedBody = normalizeMathBody(body.replace(/^\n+|\n+$/g, ""), spacing, cleanup);
  const indentedBody = normalizedBody
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
  const effectiveStyle = /\\tag(?:\*)?\s*\{/.test(normalizedBody)
    ? "equation"
    : style;
  if (effectiveStyle === "dollars") return `$$\n${indentedBody}\n$$`;
  if (effectiveStyle === "equation") {
    const opening = `\\begin{equation}${equationLabel ? `\\label{${equationLabel}}` : ""}`;
    return `${opening}\n${indentedBody}\n\\end{equation}`;
  }
  return `\\[\n${indentedBody}\n\\]`;
}
