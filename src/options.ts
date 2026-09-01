import {
  DEFAULT_MATH_SPACING_OPTIONS,
  DEFAULT_TRANSPOSE_EXPRESSION,
  type MathSpacingOptions,
} from "./math-spacing.ts";
import type { DisplayMathStyle, InlineMathStyle } from "./math.ts";

export type IndentOption = 0 | 2 | 4 | "tab";
export type SectionNumbering = "numbered" | "unnumbered";

export interface CleanupOptions {
  removeBoxed: boolean;
  normalizeLabelPrefixes: boolean;
  fontCommandBraces: boolean;
  collapseSpaces: boolean;
  normalizeInequalityCommands: boolean;
  greaterEqualCommand: string;
  lessEqualCommand: string;
  notEqualCommand: string;
  normalizeEmptySetCommand: boolean;
  emptySetCommand: string;
  normalizeMathSymbolNotation: boolean;
  unifySetNotation: boolean;
  unifyTransposeNotation: boolean;
  transposeExpression: string;
}

export interface ConverterOptions {
  indent: IndentOption;
  inlineMath: InlineMathStyle;
  statementDisplayMath: DisplayMathStyle;
  outsideDisplayMath: DisplayMathStyle;
  sectionNumbering: SectionNumbering;
  cleanup: CleanupOptions;
  mathSpacing: MathSpacingOptions;
}

export const MATH_SPACING_RULES = [
  "relations",
  "binaryOperators",
  "punctuation",
  "compactParentheses",
  "pairedBars",
  "namedFunctions",
] as const satisfies readonly Exclude<keyof MathSpacingOptions, "enabled">[];

export type MathSpacingRule = (typeof MATH_SPACING_RULES)[number];
export type CleanupBooleanRule = Exclude<keyof CleanupOptions, "transposeExpression" | "greaterEqualCommand" | "lessEqualCommand" | "notEqualCommand" | "emptySetCommand">;

export const DEFAULT_CLEANUP_OPTIONS: Readonly<CleanupOptions> = {
  removeBoxed: true,
  normalizeLabelPrefixes: true,
  fontCommandBraces: true,
  collapseSpaces: true,
  normalizeInequalityCommands: true,
  greaterEqualCommand: "\\ge",
  lessEqualCommand: "\\le",
  notEqualCommand: "\\neq",
  normalizeEmptySetCommand: true,
  emptySetCommand: "\\varnothing",
  normalizeMathSymbolNotation: true,
  unifySetNotation: true,
  unifyTransposeNotation: true,
  transposeExpression: DEFAULT_TRANSPOSE_EXPRESSION,
};

export const DEFAULT_CONVERTER_OPTIONS: Readonly<ConverterOptions> = {
  indent: "tab",
  inlineMath: "dollar",
  statementDisplayMath: "equation",
  outsideDisplayMath: "brackets",
  sectionNumbering: "unnumbered",
  cleanup: DEFAULT_CLEANUP_OPTIONS,
  mathSpacing: DEFAULT_MATH_SPACING_OPTIONS,
};

export const CLI_VERSION = "1.0.3";
export const CLI_NAME = "proofweave";

export interface ParsedCLIArguments {
  help: boolean;
  inputPath?: string;
  modify: boolean;
  options: ConverterOptions;
  outputPath?: string;
  version: boolean;
}

export function cloneConverterOptions(
  options: Readonly<ConverterOptions> = DEFAULT_CONVERTER_OPTIONS,
): ConverterOptions {
  return {
    ...options,
    cleanup: { ...options.cleanup },
    mathSpacing: { ...options.mathSpacing },
  };
}

export function isMathSpacingRule(value: string | undefined): value is MathSpacingRule {
  return MATH_SPACING_RULES.includes(value as MathSpacingRule);
}

export function isCleanupRule(value: string | undefined): value is CleanupBooleanRule {
  return value !== undefined
    && value in DEFAULT_CLEANUP_OPTIONS
    && typeof DEFAULT_CLEANUP_OPTIONS[value as keyof CleanupOptions] === "boolean";
}

export function optionsToCLIArgs(options: Readonly<ConverterOptions>): string[] {
  const args: string[] = [];

  if (options.indent !== DEFAULT_CONVERTER_OPTIONS.indent) {
    args.push(`--indent=${options.indent}`);
  }
  if (options.inlineMath !== DEFAULT_CONVERTER_OPTIONS.inlineMath) {
    args.push(`--inline-math=${options.inlineMath}`);
  }
  if (options.statementDisplayMath !== DEFAULT_CONVERTER_OPTIONS.statementDisplayMath) {
    args.push(`--statement-display=${options.statementDisplayMath}`);
  }
  if (options.outsideDisplayMath !== DEFAULT_CONVERTER_OPTIONS.outsideDisplayMath) {
    args.push(`--other-display=${options.outsideDisplayMath}`);
  }
  if (options.sectionNumbering !== DEFAULT_CONVERTER_OPTIONS.sectionNumbering) {
    args.push(`--section-numbering=${options.sectionNumbering}`);
  }
  if (!options.cleanup.removeBoxed) args.push("--no-remove-boxed");
  if (!options.cleanup.normalizeLabelPrefixes) args.push("--no-normalize-label-prefixes");
  if (!options.cleanup.fontCommandBraces) args.push("--no-font-command-braces");
  if (!options.cleanup.collapseSpaces) args.push("--no-collapse-spaces");
  if (!options.cleanup.normalizeInequalityCommands) args.push("--no-normalize-inequality-commands");
  if (options.cleanup.greaterEqualCommand !== DEFAULT_CLEANUP_OPTIONS.greaterEqualCommand) {
    args.push(`--ge-command=${options.cleanup.greaterEqualCommand}`);
  }
  if (options.cleanup.lessEqualCommand !== DEFAULT_CLEANUP_OPTIONS.lessEqualCommand) {
    args.push(`--le-command=${options.cleanup.lessEqualCommand}`);
  }
  // The comparison cleanup flag controls >=, <=, and != families together.
  if (options.cleanup.notEqualCommand !== DEFAULT_CLEANUP_OPTIONS.notEqualCommand) {
    args.push(`--ne-command=${options.cleanup.notEqualCommand}`);
  }
  if (!options.cleanup.normalizeEmptySetCommand) args.push("--no-normalize-empty-set-command");
  if (options.cleanup.emptySetCommand !== DEFAULT_CLEANUP_OPTIONS.emptySetCommand) {
    args.push(`--empty-set-command=${options.cleanup.emptySetCommand}`);
  }
  if (!options.cleanup.normalizeMathSymbolNotation) args.push("--no-normalize-math-symbols");
  if (!options.cleanup.unifySetNotation) args.push("--no-unify-set-notation");
  if (!options.cleanup.unifyTransposeNotation) args.push("--no-unify-transpose");
  if (options.cleanup.transposeExpression !== DEFAULT_CLEANUP_OPTIONS.transposeExpression) {
    args.push(`--transpose-expression=${options.cleanup.transposeExpression}`);
  }

  if (!options.mathSpacing.enabled) args.push("--no-math-spacing");
  const ruleFlags: Readonly<Record<MathSpacingRule, string>> = {
    relations: "relations",
    binaryOperators: "binary-operators",
    punctuation: "punctuation",
    compactParentheses: "compact-parentheses",
    pairedBars: "paired-bars",
    namedFunctions: "named-functions",
  };
  for (const rule of MATH_SPACING_RULES) {
    if (!options.mathSpacing[rule]) args.push(`--no-${ruleFlags[rule]}`);
  }
  return args;
}

export function cliCommand(
  options: Readonly<ConverterOptions>,
  inputPath = "YOUR_FILE.md",
): string {
  return [CLI_NAME, ...optionsToCLIArgs(options), inputPath]
    .map((argument, index) => index === 0 ? argument : shellQuoteCLIArgument(argument))
    .join(" ");
}

export function shellQuoteCLIArgument(argument: string): string {
  return !/[\\\s'"`$;&|<>()[\]{}*!?]/.test(argument)
    ? argument
    : `'${argument.replaceAll("'", "'\\\"'\\\"'")}'`;
}

export const OPTIONS_URL_PARAMETER = "opt";
export const OPTIONS_URL_VERSION = 1;

interface OptionsUrlPayload {
  v: number;
  args: string[];
}

export function optionsToUrlSearch(options: Readonly<ConverterOptions>): string {
  const payload: OptionsUrlPayload = {
    v: OPTIONS_URL_VERSION,
    args: optionsToCLIArgs(options),
  };
  const search = new URLSearchParams();
  if (payload.args.length > 0) {
    search.set(OPTIONS_URL_PARAMETER, JSON.stringify(payload));
  }
  return search.toString();
}

export function shareUrlForOptions(
  currentHref: string,
  options: Readonly<ConverterOptions>,
): string {
  const url = new URL(currentHref);
  url.searchParams.delete(OPTIONS_URL_PARAMETER);
  const encoded = optionsToUrlSearch(options);
  if (encoded) {
    const value = new URLSearchParams(encoded).get(OPTIONS_URL_PARAMETER);
    if (value !== null) url.searchParams.set(OPTIONS_URL_PARAMETER, value);
  }
  return url.href;
}

export function optionsFromUrlSearch(search: string): {
  options: ConverterOptions;
  error?: string;
} {
  const options = cloneConverterOptions();
  const encoded = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    .get(OPTIONS_URL_PARAMETER);
  if (!encoded) return { options };

  try {
    const payload = JSON.parse(encoded) as unknown;
    if (!payload || typeof payload !== "object") throw new Error("payload must be an object");
    const candidate = payload as Partial<OptionsUrlPayload>;
    if (candidate.v !== OPTIONS_URL_VERSION) throw new Error(`unsupported version ${String(candidate.v)}`);
    if (!Array.isArray(candidate.args) || !candidate.args.every((value) => typeof value === "string")) {
      throw new Error("args must be an array of strings");
    }
    if (candidate.args.some((argument) => argument === "--" || !argument.startsWith("--"))) {
      throw new Error("args must contain long conversion options only");
    }
    if (candidate.args.some((argument) => ["--help", "-h", "--version", "-v", "--modify", "-m", "--output", "-o"].includes(argument))) {
      throw new Error("I/O and process flags are not allowed");
    }
    const parsed = parseCLIArguments(candidate.args);
    if (parsed.inputPath || parsed.outputPath || parsed.modify || parsed.help || parsed.version) {
      throw new Error("only conversion options are allowed");
    }
    if (JSON.stringify(optionsToCLIArgs(parsed.options)) !== JSON.stringify(candidate.args)) {
      throw new Error("args are not in the canonical ProofWeave order");
    }
    return { options: parsed.options };
  } catch (error) {
    return {
      options,
      error: `Could not restore URL options: ${error instanceof Error ? error.message : String(error)}. Using defaults.`,
    };
  }
}

function parseValue<T extends string>(
  flag: string,
  value: string,
  allowed: readonly T[],
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid value for ${flag}: ${value}. Expected ${allowed.join(" | ")}.`);
  }
  return value as T;
}

export function validateTransposeExpression(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Transpose expression must not be empty.");
  if (/[\r\n]/.test(normalized)) throw new Error("Transpose expression must be a single line.");
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && normalized[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) throw new Error("Transpose expression must not contain an unescaped '%'.");
  }
  let depth = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === "\\") {
      index += 1;
      continue;
    }
    if (normalized[index] === "{") depth += 1;
    else if (normalized[index] === "}") {
      depth -= 1;
      if (depth < 0) throw new Error("Transpose expression has unbalanced braces.");
    }
  }
  if (depth !== 0) throw new Error("Transpose expression has unbalanced braces.");
  return normalized;
}

export function validateInequalityCommand(value: string, flag = "Inequality command"): string {
  const normalized = value.trim();
  if (!/^\\[A-Za-z@]+$/.test(normalized)) {
    throw new Error(`${flag} must be one LaTeX control word such as \\ge or \\le.`);
  }
  return normalized;
}

function setBooleanOption(options: ConverterOptions, flag: string): boolean {
  const enabled = !flag.startsWith("--no-");
  const name = flag.replace(/^--(?:no-)?/, "");
  if (name === "math-spacing") {
    options.mathSpacing.enabled = enabled;
    return true;
  }
  const cleanupRules: Readonly<Record<string, CleanupBooleanRule>> = {
    "remove-boxed": "removeBoxed",
    "normalize-label-prefixes": "normalizeLabelPrefixes",
    "font-command-braces": "fontCommandBraces",
    "collapse-spaces": "collapseSpaces",
    "normalize-inequality-commands": "normalizeInequalityCommands",
    "normalize-empty-set-command": "normalizeEmptySetCommand",
    "normalize-math-symbols": "normalizeMathSymbolNotation",
    "unify-set-notation": "unifySetNotation",
    "unify-transpose": "unifyTransposeNotation",
    "unify-transpose-notation": "unifyTransposeNotation",
  };
  const cleanupRule = cleanupRules[name];
  if (cleanupRule) {
    options.cleanup[cleanupRule] = enabled;
    return true;
  }
  const rules: Readonly<Record<string, MathSpacingRule>> = {
    relations: "relations",
    "binary-operators": "binaryOperators",
    punctuation: "punctuation",
    "compact-parentheses": "compactParentheses",
    "paired-bars": "pairedBars",
    "named-functions": "namedFunctions",
  };
  const rule = rules[name];
  if (!rule) return false;
  options.mathSpacing[rule] = enabled;
  return true;
}

export function parseCLIArguments(args: readonly string[]): ParsedCLIArguments {
  const options = cloneConverterOptions();
  const inputPaths: string[] = [];
  let outputPath: string | undefined;
  let modify = false;
  let help = false;
  let version = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--") {
      inputPaths.push(...args.slice(index + 1));
      break;
    }
    if (!argument.startsWith("-") || argument === "-") {
      inputPaths.push(argument);
      continue;
    }

    const equal = argument.indexOf("=");
    const flag = equal < 0 ? argument : argument.slice(0, equal);
    const inlineValue = equal < 0 ? undefined : argument.slice(equal + 1);
    const takeValue = (): string => {
      if (inlineValue !== undefined) {
        if (!inlineValue) throw new Error(`Expected a value for ${flag}.`);
        return inlineValue;
      }
      const next = args[index + 1];
      if (next === undefined || (next.startsWith("-") && next !== "-")) {
        throw new Error(`Expected a value for ${flag}.`);
      }
      index += 1;
      return next;
    };

    if (flag === "--help" || flag === "-h") {
      if (inlineValue !== undefined) throw new Error(`${flag} does not accept a value.`);
      help = true;
    } else if (flag === "--version" || flag === "-v") {
      if (inlineValue !== undefined) throw new Error(`${flag} does not accept a value.`);
      version = true;
    } else if (flag === "--output" || flag === "-o") {
      outputPath = takeValue();
    } else if (flag === "--modify" || flag === "-m") {
      if (inlineValue !== undefined) throw new Error(`${flag} does not accept a value.`);
      modify = true;
    } else if (flag === "--indent") {
      const value = parseValue(flag, takeValue(), ["tab", "2", "4", "0"] as const);
      options.indent = value === "tab" ? "tab" : Number(value) as 0 | 2 | 4;
    } else if (flag === "--inline-math") {
      options.inlineMath = parseValue(flag, takeValue(), ["dollar", "parentheses"] as const);
    } else if (flag === "--statement-display") {
      options.statementDisplayMath = parseValue(
        flag,
        takeValue(),
        ["dollars", "brackets", "equation"] as const,
      );
    } else if (flag === "--other-display") {
      options.outsideDisplayMath = parseValue(
        flag,
        takeValue(),
        ["dollars", "brackets", "equation"] as const,
      );
    } else if (flag === "--section-numbering") {
      options.sectionNumbering = parseValue(
        flag,
        takeValue(),
        ["unnumbered", "numbered"] as const,
      );
    } else if (flag === "--transpose-expression") {
      options.cleanup.transposeExpression = validateTransposeExpression(takeValue());
    } else if (flag === "--ge-command") {
      options.cleanup.greaterEqualCommand = validateInequalityCommand(takeValue(), flag);
    } else if (flag === "--le-command") {
      options.cleanup.lessEqualCommand = validateInequalityCommand(takeValue(), flag);
    } else if (flag === "--ne-command") {
      options.cleanup.notEqualCommand = validateInequalityCommand(takeValue(), flag);
    } else if (flag === "--empty-set-command") {
      options.cleanup.emptySetCommand = validateInequalityCommand(takeValue(), flag);
    } else if (!setBooleanOption(options, flag)) {
      throw new Error(`Unknown option: ${flag}.`);
    } else if (inlineValue !== undefined) {
      throw new Error(`${flag} does not accept a value.`);
    }
  }

  if (inputPaths.length > 1) throw new Error("Only one input file is permitted.");
  if (modify && outputPath) throw new Error("--modify and --output cannot be used together.");

  return {
    help,
    inputPath: inputPaths[0],
    modify,
    options,
    outputPath,
    version,
  };
}

export const CLI_HELP = `Usage: proofweave [options] [FILE.md]

Convert Markdown mathematical proofs into clean, well-formatted LaTeX. Read stdin
when FILE is omitted or is '-'. Write LaTeX to stdout unless --output or --modify
is used.

I/O:
  --output, -o FILE                 Write output to FILE
  --modify, -m                      Overwrite the input .md file
  --help, -h                        Show help
  --version, -v                     Show version

Conversion options:
  --indent=tab|2|4|0
  --inline-math=dollar|parentheses
  --statement-display=dollars|brackets|equation
  --other-display=dollars|brackets|equation
  --section-numbering=unnumbered|numbered
  --[no-]remove-boxed
  --[no-]normalize-label-prefixes
  --[no-]font-command-braces
  --[no-]collapse-spaces
  --[no-]normalize-inequality-commands
  --ge-command=LATEX
  --le-command=LATEX
  --ne-command=LATEX
  --[no-]normalize-empty-set-command
  --empty-set-command=LATEX
  --[no-]normalize-math-symbols
  --[no-]unify-set-notation
  --[no-]unify-transpose
  --transpose-expression=LATEX
  --[no-]math-spacing
  --[no-]relations
  --[no-]binary-operators
  --[no-]punctuation
  --[no-]compact-parentheses
  --[no-]paired-bars
  --[no-]named-functions
`;

export type { DisplayMathStyle, InlineMathStyle } from "./math.ts";
