import {
  DEFAULT_MATH_SPACING_OPTIONS,
  type MathSpacingOptions,
} from "./math-spacing.ts";
import type { DisplayMathStyle, InlineMathStyle } from "./math.ts";

export type IndentOption = 0 | 2 | 4 | "tab";
export type SectionNumbering = "numbered" | "unnumbered";

export interface ConverterOptions {
  indent: IndentOption;
  inlineMath: InlineMathStyle;
  statementDisplayMath: DisplayMathStyle;
  outsideDisplayMath: DisplayMathStyle;
  sectionNumbering: SectionNumbering;
  removeBoxed: boolean;
  mathSpacing: MathSpacingOptions;
}

export const MATH_SPACING_RULES = [
  "relations",
  "binaryOperators",
  "punctuation",
  "compactParentheses",
  "pairedBars",
  "namedFunctions",
  "fontCommandBraces",
  "collapseSpaces",
] as const satisfies readonly Exclude<keyof MathSpacingOptions, "enabled">[];

export type MathSpacingRule = (typeof MATH_SPACING_RULES)[number];

export const DEFAULT_CONVERTER_OPTIONS: Readonly<ConverterOptions> = {
  indent: "tab",
  inlineMath: "dollar",
  statementDisplayMath: "equation",
  outsideDisplayMath: "brackets",
  sectionNumbering: "unnumbered",
  removeBoxed: true,
  mathSpacing: DEFAULT_MATH_SPACING_OPTIONS,
};

export const CLI_VERSION = "0.1.0";
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
    mathSpacing: { ...options.mathSpacing },
  };
}

export function isMathSpacingRule(value: string | undefined): value is MathSpacingRule {
  return MATH_SPACING_RULES.includes(value as MathSpacingRule);
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
  if (!options.removeBoxed) args.push("--no-remove-boxed");

  if (!options.mathSpacing.enabled) {
    args.push("--no-math-spacing");
    return args;
  }

  const ruleFlags: Readonly<Record<MathSpacingRule, string>> = {
    relations: "relations",
    binaryOperators: "binary-operators",
    punctuation: "punctuation",
    compactParentheses: "compact-parentheses",
    pairedBars: "paired-bars",
    namedFunctions: "named-functions",
    fontCommandBraces: "font-command-braces",
    collapseSpaces: "collapse-spaces",
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
  return [CLI_NAME, ...optionsToCLIArgs(options), inputPath].join(" ");
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

function setBooleanOption(options: ConverterOptions, flag: string): boolean {
  const enabled = !flag.startsWith("--no-");
  const name = flag.replace(/^--(?:no-)?/, "");
  if (name === "math-spacing") {
    options.mathSpacing.enabled = enabled;
    return true;
  }
  if (name === "remove-boxed") {
    options.removeBoxed = enabled;
    return true;
  }
  const rules: Readonly<Record<string, MathSpacingRule>> = {
    relations: "relations",
    "binary-operators": "binaryOperators",
    punctuation: "punctuation",
    "compact-parentheses": "compactParentheses",
    "paired-bars": "pairedBars",
    "named-functions": "namedFunctions",
    "font-command-braces": "fontCommandBraces",
    "collapse-spaces": "collapseSpaces",
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

Convert AI-generated Markdown mathematical proofs into clean, publication-ready
LaTeX proof content. Read stdin when FILE is omitted or is '-'. Write LaTeX to
stdout unless --output or --modify is used.

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
  --[no-]math-spacing
  --[no-]relations
  --[no-]binary-operators
  --[no-]punctuation
  --[no-]compact-parentheses
  --[no-]paired-bars
  --[no-]named-functions
  --[no-]font-command-braces
  --[no-]collapse-spaces`;

export type { DisplayMathStyle, InlineMathStyle } from "./math.ts";
