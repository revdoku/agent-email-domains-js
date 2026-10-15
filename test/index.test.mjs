import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { lookup, isAgentEmail, domains, listVersion } from "agent-email-domains";

const require = createRequire(import.meta.url);
const json = require("agent-email-domains/domains.json");

test("matches an address on a listed domain", () => {
  const entry = domains.find((item) => item.domain === "agentmail.to");
  assert.deepEqual(lookup("a@agentmail.to"), {
    domain: "agentmail.to",
    matched: "agentmail.to",
    provider: entry.provider,
    category: "agent_inbox",
  });
});

test("matches subdomains of a listed domain", () => {
  const match = lookup("x@abc123.mailosaur.net");
  assert.equal(match?.matched, "mailosaur.net");
  assert.equal(match?.domain, "abc123.mailosaur.net");
  assert.equal(match?.category, "test_inbox");
});

test("ignores case, spaces and a trailing dot", () => {
  assert.equal(lookup("  A@AgentMail.TO.  ")?.matched, "agentmail.to");
});

test("accepts a bare domain", () => {
  assert.equal(isAgentEmail("agentmail.to"), true);
});

test("does not match lookalikes or other domains", () => {
  for (const value of ["notagentmail.to", "a@notagentmail.to", "a@agentmail.to.evil.com", "jane@gmail.com", "testmail.app"]) {
    assert.equal(lookup(value), null, value);
  }
});

test("returns null for invalid input without throwing", () => {
  for (const value of ["", " ", "@", "a@", "a@.", "a@b..c", "a@exa mple.com", null, undefined, 42, {}, []]) {
    assert.equal(lookup(value), null, String(value));
    assert.equal(isAgentEmail(value), false);
  }
});

test("every listed domain resolves to its own entry", () => {
  assert.ok(domains.length > 0);
  for (const entry of domains) {
    assert.equal(lookup(`x@${entry.domain}`)?.category, entry.category, entry.domain);
    assert.equal(lookup(`x@sub.${entry.domain}`)?.matched, entry.domain, entry.domain);
  }
});

test("exports the list version and the raw JSON", () => {
  assert.match(listVersion, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(json.map((entry) => entry.domain), domains.map((entry) => entry.domain));
});

test("data is read-only", () => {
  assert.ok(Object.isFrozen(domains));
  assert.ok(Object.isFrozen(domains[0]));
});
