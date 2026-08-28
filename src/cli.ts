#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { argv, stderr, stdin, stdout } from "node:process";
import { convertMarkdown, type Diagnostic } from "./renderer.ts";
import {
  CLI_HELP,
  CLI_VERSION,
  parseCLIArguments,
} from "./options.ts";

async function readStandardInput(): Promise<string> {
  let value = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) value += chunk;
  return value;
}

function writeDiagnostics(diagnostics: Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const line = diagnostic.line && diagnostic.line > 0 ? ` line ${diagnostic.line}` : "";
    stderr.write(`[${diagnostic.severity}]${line} ${diagnostic.code}: ${diagnostic.message}\n`);
  }
}

export async function runCLI(args: readonly string[] = argv.slice(2)): Promise<number> {
  try {
    const parsed = parseCLIArguments(args);
    if (parsed.help) {
      stdout.write(`${CLI_HELP}\n`);
      return 0;
    }
    if (parsed.version) {
      stdout.write(`${CLI_VERSION}\n`);
      return 0;
    }
    if (parsed.modify && (!parsed.inputPath || parsed.inputPath === "-")) {
      throw new Error("--modify requires an input file.");
    }
    if (parsed.inputPath && parsed.inputPath !== "-" && extname(parsed.inputPath).toLowerCase() !== ".md") {
      throw new Error("Input file must use the .md extension.");
    }

    const markdown = parsed.inputPath && parsed.inputPath !== "-"
      ? await readFile(parsed.inputPath, "utf8")
      : await readStandardInput();
    const result = convertMarkdown(markdown, parsed.options);
    writeDiagnostics(result.diagnostics);

    if (parsed.modify) {
      await writeFile(parsed.inputPath!, result.latex, "utf8");
    } else if (parsed.outputPath) {
      await writeFile(parsed.outputPath, result.latex, "utf8");
    } else {
      stdout.write(result.latex);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`proofweave: ${message}\n`);
    stderr.write("Try 'proofweave --help' for more information.\n");
    return 1;
  }
}

process.exitCode = await runCLI();
