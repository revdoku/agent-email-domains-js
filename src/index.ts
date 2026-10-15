import { data, listVersion } from "./data.generated.js";

/** `agent_inbox`: inboxes for AI agents. `test_inbox`: inboxes for QA and test automation. */
export type Category = "agent_inbox" | "test_inbox";

export interface DomainEntry {
  /** Listed domain. It also covers all its subdomains. */
  readonly domain: string;
  readonly provider: string;
  readonly category: Category;
}

export interface Match {
  /** Host from the input, lowercased (punycode for international names). */
  readonly host: string;
  /** Listed domain that matched: the host itself or one of its parents. */
  readonly matched: string;
  readonly provider: string;
  readonly category: Category;
}

/** All listed domains. Evidence and notes are in `agent-email-domains/domains.json`. */
export const domains: readonly DomainEntry[] = Object.freeze(
  data.map(([domain, provider, category]) => Object.freeze({ domain, provider, category })),
);

/** Version of the revdoku/agent-email-domains release that the data comes from. */
export { listVersion };

const byDomain = new Map(domains.map((entry) => [entry.domain, entry]));

/** Why an address looks automated. See `scoreEmail()`. */
export type Signal = "listed_domain" | "random_token" | "agent_word" | "test_word" | "long_digits";

export interface Score {
  /** From 0 (no signals) to 1. */
  readonly score: number;
  readonly signals: readonly Signal[];
}

export interface Options {
  /** Also flag unlisted addresses whose `scoreEmail()` score reaches `threshold`. Off by default. */
  readonly scoring?: boolean;
  /** Score needed when `scoring` is on. Default 0.5. */
  readonly threshold?: number;
}

const WEIGHTS: Record<Signal, number> = {
  listed_domain: 1,
  random_token: 0.6,
  agent_word: 0.6,
  test_word: 0.3,
  long_digits: 0.3,
};
const AGENT_WORDS = new Set(["agent", "agents", "bot", "bots", "gpt", "llm", "assistant", "automation", "autopilot", "crawler", "scraper"]);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const TEST_WORDS = new Set(["test", "tests", "testing", "qa", "e2e", "staging", "sandbox", "dummy", "fake"]);

/**
 * Finds the listed domain for an email address (`bot@agentmail.to`, `Bot <bot@agentmail.to>`)
 * or a domain. Subdomains match their listed parent. Returns null for unlisted or invalid input.
 */
export function lookup(emailOrDomain: string | null | undefined): Match | null {
  const parts = parse(emailOrDomain);
  const entry = parts && findEntry(parts.host);
  return entry ? { host: parts.host, matched: entry.domain, provider: entry.provider, category: entry.category } : null;
}

/**
 * True when the address or domain is on the list (either category).
 * With `{ scoring: true }`, also true when `scoreEmail()` reaches the threshold (default 0.5).
 */
export function isAgentEmail(emailOrDomain: string | null | undefined, options: Options = {}): boolean {
  if (lookup(emailOrDomain)) return true;
  return options.scoring === true && scoreEmail(emailOrDomain).score >= (options.threshold ?? 0.5);
}

/**
 * Scores how automated an address looks, from simple signals in the address itself.
 * It is a hint for routing or review, not proof: people also use numbers and words like "test".
 */
export function scoreEmail(email: string | null | undefined): Score {
  const parts = parse(email);
  if (!parts) return { score: 0, signals: [] };
  const signals: Signal[] = [];
  if (findEntry(parts.host)) signals.push("listed_domain");
  const tokens = parts.local.split(/[._+-]+/).filter((token) => token.length > 0);
  if (UUID.test(parts.local) || tokens.some(looksRandom)) signals.push("random_token");
  const words = tokens.map((token) => token.replace(/\d+$/, ""));
  if (words.some((word) => AGENT_WORDS.has(word))) signals.push("agent_word");
  if (words.some((word) => TEST_WORDS.has(word))) signals.push("test_word");
  if (hasLongDigits(parts.local.split("+")[0])) signals.push("long_digits");
  const total = signals.reduce((sum, signal) => sum + WEIGHTS[signal], 0);
  return { score: Math.min(1, Math.round(total * 100) / 100), signals };
}

function findEntry(host: string): DomainEntry | null {
  for (let candidate = host; ; ) {
    const entry = byDomain.get(candidate);
    if (entry) return entry;
    const dot = candidate.indexOf(".");
    if (dot === -1) return null;
    candidate = candidate.slice(dot + 1);
  }
}

// A machine-made token: a long hex string (UUID part, hash) or 8+ characters that switch
// between letters and digits at least 3 times ("k7m2x9q4v8nc"). "john1987" switches once.
function looksRandom(token: string): boolean {
  if (token.length >= 12 && /^[0-9a-f]+$/.test(token) && /\d/.test(token) && /[a-f]/.test(token)) return true;
  if (token.length < 8) return false;
  let switches = 0;
  for (let i = 1; i < token.length; i++) {
    if (/\d/.test(token[i]) !== /\d/.test(token[i - 1])) switches++;
  }
  return switches >= 3;
}

// 5+ trailing digits ("john23232"), or 4 that are not a likely birth year ("jane4821").
function hasLongDigits(local: string): boolean {
  const digits = /\d+$/.exec(local)?.[0] ?? "";
  if (digits.length >= 5) return true;
  if (digits.length !== 4) return false;
  const year = Number(digits);
  return year < 1940 || year > 2029;
}

// WHATWG URL exists in every supported runtime (Node.js, browsers, Deno, Bun, edge). Declared here to avoid DOM types.
declare const URL: new (input: string) => { readonly hostname: string };

function parse(value: unknown): { local: string; host: string } | null {
  if (typeof value !== "string") return null;
  let text = value.trim().toLowerCase();
  const angle = /<([^<>]*)>$/.exec(text);
  if (angle) text = angle[1];
  if (text.startsWith("mailto:")) text = text.slice("mailto:".length);
  const at = text.lastIndexOf("@");
  const local = at === -1 ? "" : text.slice(0, at);
  let host = text.slice(at + 1);
  // International names: "bücher.agentmail.to" and "agentmail。to" receive mail at the ASCII (punycode) host.
  if (/[^\x00-\x7f]/.test(host) && !/[\s:/?#%[\]\\@]/.test(host)) {
    try {
      host = new URL(`http://${host}`).hostname;
    } catch {
      return null;
    }
  }
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.length === 0 || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.split(".").some((label) => label.length === 0)) return null;
  return { local, host };
}
