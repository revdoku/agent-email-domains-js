import { entries, listVersion } from "./data.generated.js";
import type { DomainEntry, Match } from "./types.js";

export type { Category, DomainEntry, Match } from "./types.js";

/** All listed domains. */
export const domains: readonly DomainEntry[] = entries;

/** Version of the revdoku/agent-email-domains release that the data comes from. */
export { listVersion };

const byDomain = new Map(entries.map((entry) => [entry.domain, entry]));

/**
 * Finds the listed domain for an email address or a domain.
 * Subdomains match their listed parent. Returns null for unlisted or invalid input.
 */
export function lookup(emailOrDomain: string | null | undefined): Match | null {
  const host = hostOf(emailOrDomain);
  if (!host) return null;
  for (let candidate = host; ; ) {
    const entry = byDomain.get(candidate);
    if (entry) {
      return {
        domain: host,
        matched: entry.domain,
        provider: entry.provider,
        category: entry.category,
      };
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

function hostOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let host = value.trim().toLowerCase();
  host = host.slice(host.lastIndexOf("@") + 1);
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.length === 0 || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.split(".").some((label) => label.length === 0)) return null;
  return host;
}
