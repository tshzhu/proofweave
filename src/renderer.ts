import type {
  Block,
  DisplayMathBlock,
  DocumentAst,
  HeadingBlock,
  CommentBlock,
  ListBlock,
  ParagraphBlock,
  TheoremBlock,
} from "./parser.ts";
import { parseMarkdown } from "./parser.ts";
import { renderDisplay, renderInline } from "./math.ts";
import {
  type Diagnostic,
  LabelRegistry,
  normalizeEquationComponent,
} from "./labels.ts";
import {
  DEFAULT_CONVERTER_OPTIONS,
  type ConverterOptions,
} from "./options.ts";
import type { MathCleanupUsage } from "./math-spacing.ts";

export const DEFAULT_RENDER_OPTIONS = DEFAULT_CONVERTER_OPTIONS;
export type RenderOptions = ConverterOptions;

export interface ConversionResult {
  latex: string;
  diagnostics: Diagnostic[];
}

interface RenderContext {
  options: RenderOptions;
  diagnostics: Diagnostic[];
  labels: LabelRegistry;
  theoremLabels: Map<TheoremBlock, string | undefined>;
  equations: EquationRegistry;
  cleanupUsage: MathCleanupUsage;
}

interface EquationRecord {
  block: DisplayMathBlock;
  label: string;
  owner: string;
  tag: string;
  unique: boolean;
}

interface EquationRegistry {
  byBlock: Map<DisplayMathBlock, EquationRecord>;
  byOwnerAndTag: Map<string, EquationRecord[]>;
  byTag: Map<string, EquationRecord[]>;
}

type RenderScope = "statement" | "outside";
type RenderBlockMode = "top-level" | "theorem-body" | "list-item";

function tagValue(body: string): string | undefined {
  return /\\tag(?:\*)?\s*\{([^{}]+)\}/.exec(body)?.[1]?.trim();
}

function equationKey(owner: string, tag: string): string {
  return `${owner}\u0000${tag}`;
}

function ownerFromLabel(label: string | undefined): string {
  if (!label) return "background";
  const separator = label.indexOf(":");
  return normalizeEquationComponent(separator < 0 ? label : label.slice(separator + 1)) || "background";
}

function indexDocument(ast: DocumentAst, context: RenderContext): void {
  const walk = (blocks: Block[], owner: string): void => {
    for (const block of blocks) {
      if (block.type === "display-math") {
        const rawTag = tagValue(block.body);
        if (!rawTag) continue;
        const tag = normalizeEquationComponent(rawTag);
        if (!tag) continue;
        const base = `eqn:${owner}-${tag}`;
        const key = equationKey(owner, rawTag);
        const local = context.equations.byOwnerAndTag.get(key) ?? [];
        const record: EquationRecord = {
          block,
          label: local.length === 0 ? base : `${base}-${local.length + 1}`,
          owner,
          tag: rawTag,
          unique: true,
        };
        local.push(record);
        context.equations.byOwnerAndTag.set(key, local);
        const global = context.equations.byTag.get(rawTag) ?? [];
        global.push(record);
        context.equations.byTag.set(rawTag, global);
        context.equations.byBlock.set(block, record);
      } else if (block.type === "theorem") {
        const labelResult = context.labels.create(block.kind, block.identifier, block.line);
        context.diagnostics.push(...labelResult.diagnostics);
        context.theoremLabels.set(block, labelResult.label);
        const theoremOwner = ownerFromLabel(labelResult.label);
        walk(block.statement, theoremOwner);
        if (block.proof) walk(block.proof, theoremOwner);
      } else if (block.type === "list") {
        for (const item of block.items) walk(item.blocks, owner);
      }
    }
  };
  walk(ast.blocks, "background");

  for (const records of context.equations.byOwnerAndTag.values()) {
    if (records.length < 2) continue;
    for (const record of records) record.unique = false;
    const first = records[0]!;
    context.diagnostics.push({
      severity: "warning",
      code: "duplicate-equation-tag",
      message: `Duplicate equation tag ${first.tag} in ${first.owner}; automatic references were left unchanged.`,
      line: first.block.line,
    });
  }
}

function resolveEquationReference(
  tag: string,
  owner: string,
  context: RenderContext,
): EquationRecord | "ambiguous" | undefined {
  const local = context.equations.byOwnerAndTag.get(equationKey(owner, tag)) ?? [];
  if (local.length === 1 && local[0]!.unique) return local[0];
  if (local.length > 1) return "ambiguous";
  const global = context.equations.byTag.get(tag) ?? [];
  if (global.length === 1 && global[0]!.unique) return global[0];
  if (global.length > 1) return "ambiguous";
  return undefined;
}

function convertEquationReferences(
  value: string,
  owner: string,
  context: RenderContext,
  line?: number,
): string {
  let ambiguous = false;
  const converted = value.replace(/(^|[^\\\p{L}\p{N}_])\(([A-Za-z0-9][A-Za-z0-9._-]*)\)(?![\p{L}\p{N}_])/gu, (match, prefix: string, tag: string) => {
    const record = resolveEquationReference(tag, owner, context);
    if (record === "ambiguous") {
      ambiguous = true;
      return match;
    }
    return record ? `${prefix}\\eqref{${record.label}}` : match;
  });
  if (ambiguous) {
    context.diagnostics.push({
      severity: "warning",
      code: "ambiguous-equation-reference",
      message: "An equation reference matched more than one tagged equation and was left unchanged.",
      line,
    });
  }
  return converted;
}

function indentation(options: RenderOptions): string {
  return options.indent === "tab" ? "\t" : " ".repeat(options.indent);
}

function indentText(value: string, prefix: string): string {
  if (!prefix) return value;
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function isStructuralBlock(block: Block): boolean {
  return block.type === "heading"
    || block.type === "list"
    || block.type === "theorem"
    || block.type === "comment";
}

function blockSeparator(previous: Block, next: Block, mode: RenderBlockMode): string {
  if (previous.type === "comment" || next.type === "comment") return "\n\n";
  if (mode !== "top-level") return "\n";
  return isStructuralBlock(previous) || isStructuralBlock(next) ? "\n\n" : "\n";
}

function renderHeading(block: HeadingBlock, context: RenderContext, owner: string): string {
  const command = block.level === 1
    ? "section"
    : block.level === 2 ? "subsection" : "subsubsection";
  const star = context.options.sectionNumbering === "unnumbered" ? "*" : "";
  const title = renderInline(
    block.text,
    context.options.inlineMath,
    context.diagnostics,
    block.line,
    context.options.mathSpacing,
    context.options.cleanup,
    (value) => convertEquationReferences(value, owner, context, block.line),
    context.cleanupUsage,
  );
  return `\\${command}${star}{${title}}`;
}

function renderParagraph(block: ParagraphBlock, context: RenderContext, owner: string): string {
  return renderInline(
    block.text,
    context.options.inlineMath,
    context.diagnostics,
    block.line,
    context.options.mathSpacing,
    context.options.cleanup,
    (value) => convertEquationReferences(value, owner, context, block.line),
    context.cleanupUsage,
  );
}

function renderComment(block: CommentBlock): string {
  return block.lines
    .map((line) => line.length ? `% ${line}` : "%")
    .join("\n");
}

function renderMath(
  block: DisplayMathBlock,
  context: RenderContext,
  scope: RenderScope,
): string {
  const style = scope === "statement"
    ? context.options.statementDisplayMath
    : context.options.outsideDisplayMath;
  return renderDisplay(
    block.body,
    style,
    context.options.mathSpacing,
    indentation(context.options),
    context.options.cleanup,
    context.equations.byBlock.get(block)?.label,
    context.cleanupUsage,
  );
}

function renderList(
  block: ListBlock,
  context: RenderContext,
  scope: RenderScope,
  owner: string,
): string {
  const environment = block.ordered ? "enumerate" : "itemize";
  const step = indentation(context.options);
  const itemPrefix = step;
  const bodyPrefix = step + step;
  const items = block.items.map((item) => {
    const rendered = renderBlocks(item.blocks, context, scope, "list-item", owner);
    if (!rendered) return `${itemPrefix}\\item`;
    const lines = rendered.split("\n");
    const first = lines.shift() ?? "";
    const rest = lines.length ? `\n${indentText(lines.join("\n"), bodyPrefix)}` : "";
    return `${itemPrefix}\\item ${first}${rest}`;
  });
  return [`\\begin{${environment}}`, ...items, `\\end{${environment}}`].join("\n");
}

function stripTrailingQed(value: string): string {
  const trimmed = value.trimEnd();
  const displayLineQed = /([ \t]*\\(?:\[|\$\$|begin\{equation\*?\})[\s\S]*?)\n[ \t]*\\square[ \t]*\n([ \t]*(?:\\\]|\$\$|\\end\{equation\*?\}))[ \t]*$/;
  const displayMatch = displayLineQed.exec(trimmed);
  if (displayMatch) {
    const prefix = trimmed.slice(0, displayMatch.index);
    const withoutQed = `${displayMatch[1]}\n${displayMatch[2]}`.trimEnd();
    const cleanedDisplay = withoutQed.replace(/\\\[\n[ \t]*\\\][ \t]*$|\$\$\n[ \t]*\$\$[ \t]*$|\\begin\{equation\*?\}\n[ \t]*\\end\{equation\*?\}[ \t]*$/, '').trimEnd();
    return `${prefix}${cleanedDisplay}`.trimEnd();
  }
  const wrappedQed = /(?:^|\n)[ \t]*(?:\$\s*\\square\s*\$|\\\(\s*\\square\s*\\\)|\\\[\s*\\square\s*\\\]|\$\$\s*\\square\s*\$\$|\\begin\{equation\*?\}\s*\\square\s*\\end\{equation\*?\})[ \t]*$/;
  const wrapped = wrappedQed.exec(trimmed);
  if (wrapped) return trimmed.slice(0, wrapped.index).trimEnd();

  const command = /\\square[ \t]*$/.exec(trimmed);
  if (!command) return value;
  return trimmed.slice(0, command.index).trimEnd();
}

function renderTheorem(block: TheoremBlock, context: RenderContext): string {
  const step = indentation(context.options);
  const label = context.theoremLabels.get(block);
  const owner = ownerFromLabel(label);

  const statement = renderBlocks(block.statement, context, "statement", "theorem-body", owner);
  const theoremOpening = `\\begin{${block.kind}}${label ? `\\label{${label}}` : ""}`;
  const theoremLines = [theoremOpening];
  if (statement) theoremLines.push(indentText(statement, step));
  theoremLines.push(`\\end{${block.kind}}`);

  if (!block.proof) return theoremLines.join("\n");

  const proof = stripTrailingQed(renderBlocks(block.proof, context, "outside", "theorem-body", owner));
  const proofLines = ["\\begin{proof}"];
  if (proof) proofLines.push(indentText(proof, step));
  proofLines.push("\\end{proof}");
  return `${theoremLines.join("\n")}\n\n${proofLines.join("\n")}`;
}

function renderBlock(
  block: Block,
  context: RenderContext,
  scope: RenderScope,
  owner: string,
): string {
  switch (block.type) {
    case "heading":
      return renderHeading(block, context, owner);
    case "paragraph":
      return renderParagraph(block, context, owner);
    case "comment":
      return renderComment(block);
    case "display-math":
      return renderMath(block, context, scope);
    case "list":
      return renderList(block, context, scope, owner);
    case "theorem":
      return renderTheorem(block, context);
  }
}

function renderBlocks(
  blocks: Block[],
  context: RenderContext,
  scope: RenderScope,
  mode: RenderBlockMode = "top-level",
  owner = "background",
): string {
  let result = "";
  let previous: Block | undefined;
  for (const block of blocks) {
    const value = renderBlock(block, context, scope, owner);
    if (!value) continue;
    if (previous) result += blockSeparator(previous, block, mode);
    result += value;
    previous = block;
  }
  return result;
}

export function renderLatex(
  ast: DocumentAst,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): ConversionResult {
  const diagnostics = [...ast.diagnostics];
  const context: RenderContext = {
    options,
    diagnostics,
    labels: new LabelRegistry(options.cleanup.normalizeLabelPrefixes),
    theoremLabels: new Map(),
    equations: {
      byBlock: new Map(),
      byOwnerAndTag: new Map(),
      byTag: new Map(),
    },
    cleanupUsage: { setNotation: false, transposeNotation: false },
  };
  indexDocument(ast, context);
  const body = renderBlocks(ast.blocks, context, "outside")
    .replace(/[ \t]+$/gm, "")
    .trim();
  const declarations: string[] = [];
  if (options.cleanup.unifySetNotation && context.cleanupUsage.setNotation) {
    declarations.push(String.raw`\newcommand{\set}[1]{\left\{#1\right\}} % set`);
  }
  if (options.cleanup.unifyTransposeNotation && context.cleanupUsage.transposeNotation) {
    declarations.push(`\\newcommand{\\transpose}{{${options.cleanup.transposeExpression}}} % transpose`);
  }
  const latex = declarations.length === 0
    ? body
    : body
      ? declarations.join("\n") + "\n\n" + body
      : declarations.join("\n");
  return { latex, diagnostics };
}

export function convertMarkdown(
  input: string,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): ConversionResult {
  return renderLatex(parseMarkdown(input), options);
}

export type { Diagnostic };
export type { DisplayMathStyle, InlineMathStyle } from "./math.ts";
export type { IndentOption, SectionNumbering } from "./options.ts";
