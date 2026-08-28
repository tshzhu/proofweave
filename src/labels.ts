export const ENVIRONMENT_KINDS = [
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "assumption",
  "definition",
  "remark",
] as const;

export type EnvironmentKind = (typeof ENVIRONMENT_KINDS)[number];

export interface Diagnostic {
  severity: "warning" | "error";
  code: string;
  message: string;
  line?: number;
}

export const LABEL_PREFIX: Readonly<Record<EnvironmentKind, string>> = {
  theorem: "thm",
  lemma: "lem",
  proposition: "pro",
  corollary: "cor",
  assumption: "asm",
  definition: "def",
  remark: "rmk",
};

const PREFIX_ALIASES: Readonly<Record<EnvironmentKind, readonly string[]>> = {
  theorem: ["thm", "theorem"],
  lemma: ["lem", "lemma"],
  proposition: ["pro", "prop", "proposition"],
  corollary: ["cor", "corollary"],
  assumption: ["asm", "assumption"],
  definition: ["def", "definition"],
  remark: ["rmk", "remark"],
};

const ANY_PREFIX_PATTERN = /^(?:thm|theorem|lem|lemma|pro|prop|proposition|cor|corollary|asm|assumption|def|definition|rmk|remark):/i;

function environmentKindForPrefix(prefix: string): EnvironmentKind | undefined {
  const normalized = prefix.toLowerCase();
  return ENVIRONMENT_KINDS.find((candidate) => PREFIX_ALIASES[candidate].includes(normalized));
}

/** Normalize a label's environment prefix to the canonical three-letter form. */
export function normalizeLabelPrefix(identifier: string, enabled = true): string {
  const value = identifier.trim();
  if (!enabled) return value;
  const match = /^([A-Za-z]+):(.*)$/.exec(value);
  if (!match) return value;

  const kind = environmentKindForPrefix(match[1]!);
  return kind ? `${LABEL_PREFIX[kind]}:${match[2]}` : value;
}

export function isEnvironmentKind(value: string): value is EnvironmentKind {
  return (ENVIRONMENT_KINDS as readonly string[]).includes(value.toLowerCase());
}

/** Convert a human/Rethlas identifier to the conservative label alphabet. */
export function normalizeIdentifier(identifier: string): string {
  return identifier
    .trim()
    .normalize("NFKC")
    .replace(/\s+/gu, "-")
    .replace(/[^\p{L}\p{N}:._-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-:.]+|[-:.]+$/g, "");
}

/** Return a conservative equation-label component while preserving readable tags. */
export function normalizeEquationComponent(value: string): string {
  return normalizeIdentifier(value).replace(/:/g, "-");
}

export interface LabelResult {
  label?: string;
  diagnostics: Diagnostic[];
}

export class LabelRegistry {
  private readonly counts = new Map<string, number>();
  private readonly normalizePrefixes: boolean;

  constructor(normalizePrefixes = true) {
    this.normalizePrefixes = normalizePrefixes;
  }

  create(kind: EnvironmentKind, identifier: string, line?: number): LabelResult {
    const diagnostics: Diagnostic[] = [];
    const value = identifier.trim();
    const explicit = /^([A-Za-z]+):(.*)$/.exec(value);
    const explicitKind = explicit ? environmentKindForPrefix(explicit[1]!) : undefined;
    const withoutPrefix = explicitKind ? explicit![2]! : value.replace(ANY_PREFIX_PATTERN, "");
    const normalized = normalizeIdentifier(withoutPrefix);

    if (!normalized) {
      diagnostics.push({
        severity: "warning",
        code: "missing-identifier",
        message: `The ${kind} heading has no usable identifier, so no label was generated.`,
        line,
      });
      return { diagnostics };
    }

    const prefix = !this.normalizePrefixes && explicitKind ? explicit![1]! : LABEL_PREFIX[kind];
    const base = normalizeLabelPrefix(`${prefix}:${normalized}`, this.normalizePrefixes);
    const occurrence = (this.counts.get(base) ?? 0) + 1;
    this.counts.set(base, occurrence);

    if (occurrence === 1) {
      return { label: base, diagnostics };
    }

    const label = `${base}-${occurrence}`;
    diagnostics.push({
      severity: "warning",
      code: "duplicate-label",
      message: `Duplicate label ${base}; generated ${label} for this occurrence.`,
      line,
    });
    return { label, diagnostics };
  }
}
