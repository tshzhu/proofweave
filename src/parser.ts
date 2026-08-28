import {
  type Diagnostic,
  type EnvironmentKind,
  isEnvironmentKind,
} from "./labels.ts";

export interface SourceBlock {
  line: number;
}

export interface HeadingBlock extends SourceBlock {
  type: "heading";
  level: number;
  text: string;
}

export interface ParagraphBlock extends SourceBlock {
  type: "paragraph";
  text: string;
}

export interface CommentBlock extends SourceBlock {
  type: "comment";
  lines: string[];
}

export interface DisplayMathBlock extends SourceBlock {
  type: "display-math";
  body: string;
  sourceStyle: "brackets" | "dollars" | "equation";
}

export interface ListItem extends SourceBlock {
  blocks: Block[];
}

export interface ListBlock extends SourceBlock {
  type: "list";
  ordered: boolean;
  items: ListItem[];
}

export interface TheoremBlock extends SourceBlock {
  type: "theorem";
  kind: EnvironmentKind;
  identifier: string;
  level: number;
  statement: Block[];
  proof?: Block[];
  hasStatementHeading: boolean;
  hasProofHeading: boolean;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | CommentBlock
  | DisplayMathBlock
  | ListBlock
  | TheoremBlock;

export interface DocumentAst {
  type: "document";
  blocks: Block[];
  diagnostics: Diagnostic[];
}

interface SourceLine {
  text: string;
  number: number;
}

interface HeadingMatch {
  level: number;
  text: string;
}

interface ListMarker {
  indent: number;
  ordered: boolean;
  content: string;
  markerWidth: number;
}

const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const LIST_RE = /^(\s*)(?:(\d+)[.)]|([-+*]))[ \t]+(.*)$/;

function heading(line: string): HeadingMatch | undefined {
  const match = line.match(HEADING_RE);
  if (!match) return undefined;
  return { level: match[1]!.length, text: match[2]!.trim() };
}

function theoremHeading(match: HeadingMatch): {
  kind: EnvironmentKind;
  identifier: string;
} | undefined {
  const parts = match.text.match(/^(\S+)(?:[ \t]+(.*))?$/);
  if (!parts || !isEnvironmentKind(parts[1]!)) return undefined;
  return {
    kind: parts[1]!.toLowerCase() as EnvironmentKind,
    identifier: (parts[2] ?? "").trim(),
  };
}

function indentation(value: string): number {
  let columns = 0;
  for (const character of value) {
    columns += character === "\t" ? 4 - (columns % 4) : 1;
  }
  return columns;
}

function listMarker(line: string): ListMarker | undefined {
  const match = line.match(LIST_RE);
  if (!match) return undefined;
  return {
    indent: indentation(match[1]!),
    ordered: Boolean(match[2]),
    content: match[4]!,
    markerWidth: match[0].indexOf(match[4]!),
  };
}

function lineAt(lines: SourceLine[], index: number): SourceLine {
  const line = lines[index];
  if (!line) throw new RangeError(`Source line ${index} is outside the parser range.`);
  return line;
}

function removeIndent(value: string, columns: number): string {
  let consumed = 0;
  let index = 0;
  while (index < value.length && consumed < columns) {
    if (value[index] === " ") consumed += 1;
    else if (value[index] === "\t") consumed += 4 - (consumed % 4);
    else break;
    index += 1;
  }
  return value.slice(index);
}

function displayOpening(text: string):
  | { style: DisplayMathBlock["sourceStyle"]; open: string; close: string }
  | undefined {
  const trimmed = text.trim();
  if (trimmed.startsWith("\\[")) {
    return { style: "brackets", open: "\\[", close: "\\]" };
  }
  if (trimmed.startsWith("$$")) {
    return { style: "dollars", open: "$$", close: "$$" };
  }
  if (trimmed.startsWith("\\begin{equation}")) {
    return {
      style: "equation",
      open: "\\begin{equation}",
      close: "\\end{equation}",
    };
  }
  return undefined;
}

function parseDisplayMath(
  lines: SourceLine[],
  start: number,
  end: number,
  diagnostics: Diagnostic[],
): { block: DisplayMathBlock; next: number } | undefined {
  const startLine = lineAt(lines, start);
  const opening = displayOpening(startLine.text);
  if (!opening) return undefined;

  const first = startLine.text.trim();
  const afterOpen = first.slice(opening.open.length);
  const bodyLines: string[] = [];
  let cursor = start;

  const sameLineClose = afterOpen.indexOf(opening.close);
  if (sameLineClose >= 0) {
    bodyLines.push(afterOpen.slice(0, sameLineClose));
    return {
      block: {
        type: "display-math",
        line: startLine.number,
        body: bodyLines.join("\n").trim(),
        sourceStyle: opening.style,
      },
      next: start + 1,
    };
  }

  if (afterOpen.trim()) bodyLines.push(afterOpen);
  cursor += 1;
  while (cursor < end) {
    const current = lineAt(lines, cursor).text;
    const closeAt = current.indexOf(opening.close);
    if (closeAt >= 0) {
      bodyLines.push(current.slice(0, closeAt));
      return {
        block: {
          type: "display-math",
          line: startLine.number,
          body: bodyLines.join("\n").replace(/^\n+|\n+$/g, ""),
          sourceStyle: opening.style,
        },
        next: cursor + 1,
      };
    }
    bodyLines.push(current);
    cursor += 1;
  }

  diagnostics.push({
    severity: "warning",
    code: "unclosed-display-math",
    message: `Display math opened with ${opening.open} but has no closing delimiter.`,
    line: startLine.number,
  });
  return {
    block: {
      type: "display-math",
      line: startLine.number,
      body: bodyLines.join("\n").replace(/^\n+|\n+$/g, ""),
      sourceStyle: opening.style,
    },
    next: end,
  };
}

function parseComment(
  lines: SourceLine[],
  start: number,
  end: number,
  diagnostics: Diagnostic[],
  allowTheorems: boolean,
  marker = lineAt(lines, start).text.indexOf("<!--"),
): { blocks: Block[]; next: number } | undefined {
  const startLine = lineAt(lines, start);
  if (marker < 0) return undefined;

  const commentLines: string[] = [];
  let cursor = start;
  const remainder = startLine.text.slice(marker + "<!--".length);
  const close = remainder.indexOf("-->");
  if (close >= 0) {
    commentLines.push(remainder.slice(0, close));
    const trailing = remainder.slice(close + "-->".length);
    const blocks: Block[] = [];
    const before = startLine.text.slice(0, marker);
    if (before.trim()) {
      blocks.push(...parseRange([{ text: before, number: startLine.number }], 0, 1, diagnostics, allowTheorems));
    }
    blocks.push({ type: "comment", line: startLine.number, lines: [remainder.slice(0, close)] });
    if (trailing.trim()) {
      blocks.push(...parseRange([{ text: trailing, number: startLine.number }], 0, 1, diagnostics, allowTheorems));
    }
    return {
      blocks,
      next: start + 1,
    };
  }
  commentLines.push(remainder);
  cursor += 1;

  while (cursor < end) {
    const current = lineAt(lines, cursor).text;
    const closeAt = current.indexOf("-->");
    if (closeAt >= 0) {
      commentLines.push(current.slice(0, closeAt));
      const trailing = current.slice(closeAt + "-->".length);
      const blocks: Block[] = [];
      const before = startLine.text.slice(0, marker);
      if (before.trim()) {
        blocks.push(...parseRange([{ text: before, number: startLine.number }], 0, 1, diagnostics, allowTheorems));
      }
      blocks.push({ type: "comment", line: startLine.number, lines: commentLines });
      if (trailing.trim()) {
        blocks.push(...parseRange([{ text: trailing, number: lineAt(lines, cursor).number }], 0, 1, diagnostics, allowTheorems));
      }
      return {
        blocks,
        next: cursor + 1,
      };
    }
    commentLines.push(current);
    cursor += 1;
  }

  diagnostics.push({
    severity: "warning",
    code: "unclosed-comment",
    message: "A Markdown comment opened with <!-- but has no closing --> marker.",
    line: startLine.number,
  });
  const blocks: Block[] = [];
  const before = startLine.text.slice(0, marker);
  if (before.trim()) {
    blocks.push(...parseRange([{ text: before, number: startLine.number }], 0, 1, diagnostics, allowTheorems));
  }
  blocks.push({ type: "comment", line: startLine.number, lines: commentLines });
  return {
    blocks,
    next: end,
  };
}

function commentEnd(
  lines: SourceLine[],
  start: number,
  end: number,
  marker: number,
): number {
  const first = lineAt(lines, start).text.slice(marker + "<!--".length);
  if (first.includes("-->")) return start + 1;
  for (let cursor = start + 1; cursor < end; cursor += 1) {
    if (lineAt(lines, cursor).text.includes("-->")) return cursor + 1;
  }
  return end;
}

function parseList(
  lines: SourceLine[],
  start: number,
  end: number,
  diagnostics: Diagnostic[],
): { block: ListBlock; next: number } {
  const startLine = lineAt(lines, start);
  const first = listMarker(startLine.text)!;
  const baseIndent = first.indent;
  const ordered = first.ordered;
  const items: ListItem[] = [];
  let cursor = start;

  while (cursor < end) {
    const currentLine = lineAt(lines, cursor);
    const marker = listMarker(currentLine.text);
    if (!marker || marker.indent !== baseIndent || marker.ordered !== ordered) break;

    const itemLine = currentLine.number;
    const itemLines: SourceLine[] = [{ text: marker.content, number: itemLine }];
    const contentIndent = Math.max(baseIndent + 2, marker.markerWidth);
    cursor += 1;

    while (cursor < end) {
      const continuation = lineAt(lines, cursor);
      const candidate = listMarker(continuation.text);
      if (candidate && candidate.indent === baseIndent) break;
      if (candidate && candidate.indent < baseIndent) break;
      if (!candidate && continuation.text.trim() && indentation(continuation.text.match(/^\s*/)?.[0] ?? "") <= baseIndent) {
        break;
      }
      itemLines.push({
        text: continuation.text.trim() ? removeIndent(continuation.text, contentIndent) : "",
        number: continuation.number,
      });
      cursor += 1;
    }

    while (itemLines.length && !itemLines[itemLines.length - 1]!.text.trim()) itemLines.pop();
    items.push({
      line: itemLine,
      blocks: parseRange(itemLines, 0, itemLines.length, diagnostics, false),
    });
  }

  return {
    block: { type: "list", line: startLine.number, ordered, items },
    next: cursor,
  };
}

function parseTheorem(
  lines: SourceLine[],
  start: number,
  end: number,
  diagnostics: Diagnostic[],
): { block: TheoremBlock; next: number } {
  const startLine = lineAt(lines, start);
  const matchedHeading = heading(startLine.text)!;
  const theorem = theoremHeading(matchedHeading)!;
  const theoremLevel = matchedHeading.level;

  // Some verified blueprints include ordinary titled subsections inside a
  // statement before the explicit proof marker.  Find that marker first,
  // while remembering the first ordinary heading that could otherwise close
  // the environment.  A following theorem heading always starts a new
  // environment and therefore stops the scan immediately.
  let firstBoundaryHeading: number | undefined;
  let statementMarker: { index: number; name: "statement" } | undefined;
  let proofMarker: { index: number; name: "proof" } | undefined;
  let cursor = start + 1;
  while (cursor < end) {
    const commentMarker = lineAt(lines, cursor).text.indexOf("<!--");
    if (commentMarker >= 0) {
      cursor = commentEnd(lines, cursor, end, commentMarker);
      continue;
    }
    const candidate = heading(lineAt(lines, cursor).text);
    if (!candidate) {
      cursor += 1;
      continue;
    }

    const name = candidate.text.trim().toLowerCase();
    if (candidate.level > theoremLevel && name === "statement" && !statementMarker) {
      statementMarker = { index: cursor, name: "statement" };
      cursor += 1;
      continue;
    }
    if (candidate.level > theoremLevel && name === "proof" && !proofMarker) {
      proofMarker = { index: cursor, name: "proof" };
      break;
    }

    if (candidate.level <= theoremLevel) {
      if (theoremHeading(candidate)) {
        firstBoundaryHeading = cursor;
        break;
      }
      firstBoundaryHeading ??= cursor;
    }
    cursor += 1;
  }

  let boundary = firstBoundaryHeading ?? end;
  if (proofMarker) {
    boundary = proofMarker.index + 1;
    while (boundary < end) {
      const candidate = heading(lineAt(lines, boundary).text);
      if (candidate && candidate.level <= theoremLevel) break;
      boundary += 1;
    }
  }

  const markers: Array<{ index: number; name: "statement" | "proof" }> = [];
  if (statementMarker && statementMarker.index < boundary) markers.push(statementMarker);
  if (proofMarker && proofMarker.index < boundary) markers.push(proofMarker);

  const firstMarkerIndex = markers[0]?.index ?? boundary;
  const preamble = parseRange(lines, start + 1, firstMarkerIndex, diagnostics, true);

  let statement: Block[] = preamble;
  if (statementMarker) {
    const nextMarker = markers.find((marker) => marker.index > statementMarker.index);
    statement = [
      ...preamble,
      ...parseRange(
        lines,
        statementMarker.index + 1,
        nextMarker?.index ?? boundary,
        diagnostics,
        true,
      ),
    ];
  }

  let proof: Block[] | undefined;
  if (proofMarker) {
    const nextMarker = markers.find((marker) => marker.index > proofMarker.index);
    proof = parseRange(
      lines,
      proofMarker.index + 1,
      nextMarker?.index ?? boundary,
      diagnostics,
      true,
    );
  }

  if (!statementMarker) {
    diagnostics.push({
      severity: "warning",
      code: "missing-statement",
      message: `The ${theorem.kind} environment has no statement heading; its leading content was used as the statement.`,
      line: startLine.number,
    });
  }
  if (!proofMarker) {
    diagnostics.push({
      severity: "warning",
      code: "missing-proof",
      message: `The ${theorem.kind} environment has no proof heading.`,
      line: startLine.number,
    });
  }
  if (statementMarker && proofMarker && proofMarker.index < statementMarker.index) {
    diagnostics.push({
      severity: "warning",
      code: "section-order",
      message: "The proof heading appears before the statement heading.",
      line: lineAt(lines, proofMarker.index).number,
    });
  }

  return {
    block: {
      type: "theorem",
      line: startLine.number,
      kind: theorem.kind,
      identifier: theorem.identifier,
      level: matchedHeading.level,
      statement,
      proof,
      hasStatementHeading: Boolean(statementMarker),
      hasProofHeading: Boolean(proofMarker),
    },
    next: boundary,
  };
}

function isBlockStart(lines: SourceLine[], index: number, allowTheorems: boolean): boolean {
  const value = lineAt(lines, index).text;
  if (value.includes("<!--")) return true;
  const matchedHeading = heading(value);
  if (matchedHeading) return true;
  if (listMarker(value)) return true;
  if (displayOpening(value)) return true;
  if (/^\s*(```|~~~)/.test(value)) return true;
  return allowTheorems && Boolean(matchedHeading && theoremHeading(matchedHeading));
}

function parseRange(
  lines: SourceLine[],
  start: number,
  end: number,
  diagnostics: Diagnostic[],
  allowTheorems: boolean,
): Block[] {
  const blocks: Block[] = [];
  let cursor = start;

  while (cursor < end) {
    const currentLine = lineAt(lines, cursor);
    if (!currentLine.text.trim()) {
      cursor += 1;
      continue;
    }

    const commentMarker = currentLine.text.indexOf("<!--");
    const parsedComment = commentMarker >= 0
      ? parseComment(lines, cursor, end, diagnostics, allowTheorems, commentMarker)
      : undefined;
    if (parsedComment) {
      blocks.push(...parsedComment.blocks);
      cursor = parsedComment.next;
      continue;
    }

    const matchedHeading = heading(currentLine.text);
    const matchedTheorem = matchedHeading ? theoremHeading(matchedHeading) : undefined;
    if (allowTheorems && matchedTheorem) {
      const parsed = parseTheorem(lines, cursor, end, diagnostics);
      blocks.push(parsed.block);
      cursor = parsed.next;
      continue;
    }

    if (matchedHeading) {
      blocks.push({
        type: "heading",
        line: currentLine.number,
        level: matchedHeading.level,
        text: matchedHeading.text,
      });
      cursor += 1;
      continue;
    }


    const parsedDisplay = parseDisplayMath(lines, cursor, end, diagnostics);
    if (parsedDisplay) {
      blocks.push(parsedDisplay.block);
      cursor = parsedDisplay.next;
      continue;
    }

    const marker = listMarker(currentLine.text);
    if (marker) {
      const parsed = parseList(lines, cursor, end, diagnostics);
      blocks.push(parsed.block);
      cursor = parsed.next;
      continue;
    }

    if (/^\s*(```|~~~)/.test(currentLine.text)) {
      const fence = currentLine.text.trim().slice(0, 3);
      const firstLine = currentLine.number;
      cursor += 1;
      const content: string[] = [];
      while (cursor < end && !lineAt(lines, cursor).text.trim().startsWith(fence)) {
        content.push(lineAt(lines, cursor).text);
        cursor += 1;
      }
      if (cursor < end) cursor += 1;
      diagnostics.push({
        severity: "warning",
        code: "fenced-code",
        message: "Fenced code is outside the supported proof subset and was preserved as readable text.",
        line: firstLine,
      });
      blocks.push({ type: "paragraph", line: firstLine, text: content.join(" ") });
      continue;
    }

    const paragraphStart = cursor;
    const paragraph: string[] = [];
    while (
      cursor < end &&
      lineAt(lines, cursor).text.trim() &&
      (cursor === paragraphStart || !isBlockStart(lines, cursor, allowTheorems))
    ) {
      paragraph.push(lineAt(lines, cursor).text.trim());
      cursor += 1;
    }
    blocks.push({
      type: "paragraph",
      line: lineAt(lines, paragraphStart).number,
      text: paragraph.join(" "),
    });
  }
  return blocks;
}

export function parseMarkdown(input: string): DocumentAst {
  const normalized = input.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n").map((text, index) => ({ text, number: index + 1 }));
  const diagnostics: Diagnostic[] = [];
  return {
    type: "document",
    blocks: parseRange(lines, 0, lines.length, diagnostics, true),
    diagnostics,
  };
}
