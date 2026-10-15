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

/**
 * Finds the listed domain for an email address (`bot@agentmail.to`, `Bot <bot@agentmail.to>`)
 * or a domain. Subdomains match their listed parent. Returns null for unlisted or invalid input.
 */
export function lookup(emailOrDomain: string | null | undefined): Match | null {
  const host = hostOf(emailOrDomain);
  if (!host) return null;
  for (let candidate = host; ; ) {
    const entry = byDomain.get(candidate);
    if (entry) {
      return { host, matched: entry.domain, provider: entry.provider, category: entry.category };
    }
    const dot = candidate.indexOf(".");
    if (dot === -1) return null;
    candidate = candidate.slice(dot + 1);
  }
}

/** True when the address or domain is on the list (either category). */
export function isAgentEmail(emailOrDomain: string | null | undefined): boolean {
  return lookup(emailOrDomain) !== null;
}

// WHATWG URL exists in every supported runtime (Node.js, browsers, Deno, Bun, edge). Declared here to avoid DOM types.
declare const URL: new (input: string) => { readonly hostname: string };

function hostOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let host = value.trim().toLowerCase();
  const angle = /<([^<>]*)>$/.exec(host);
  if (angle) host = angle[1];
  host = host.slice(host.lastIndexOf("@") + 1);
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
  return host;
}
