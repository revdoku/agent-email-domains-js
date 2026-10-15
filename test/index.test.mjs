import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { lookup, isAgentEmail, scoreEmail, domains, listVersion } from "agent-email-domains";

const require = createRequire(import.meta.url);
const json = require("agent-email-domains/domains.json");

test("matches an address on a listed domain", () => {
  const entry = domains.find((item) => item.domain === "agentmail.to");
  assert.deepEqual(lookup("a@agentmail.to"), {
    host: "agentmail.to",
    matched: "agentmail.to",
    provider: entry.provider,
    category: "agent_inbox",
  });
});

test("matches subdomains of a listed domain", () => {
  const match = lookup("x@abc123.mailosaur.net");
  assert.equal(match?.matched, "mailosaur.net");
  assert.equal(match?.host, "abc123.mailosaur.net");
  assert.equal(match?.category, "test_inbox");
});

test("ignores case, spaces and a trailing dot", () => {
  assert.equal(lookup("  A@AgentMail.TO.  ")?.matched, "agentmail.to");
});

test("accepts a bare domain, a display name and a mailto: link", () => {
  assert.equal(isAgentEmail("agentmail.to"), true);
  assert.equal(lookup("Support Bot <bot@agentmail.to>")?.matched, "agentmail.to");
  assert.equal(lookup("<bot@agentmail.to>")?.matched, "agentmail.to");
  assert.equal(lookup("mailto:bot@agentmail.to")?.matched, "agentmail.to");
  assert.equal(lookup("a@xn--bcher-kva.agentmail.to")?.matched, "agentmail.to");
});

test("matches international and lookalike spellings that deliver to a listed domain", () => {
  assert.equal(lookup("a@bücher.mailosaur.net")?.host, "xn--bcher-kva.mailosaur.net");
  assert.equal(lookup("a@agentmail\u3002to")?.matched, "agentmail.to");
  assert.equal(lookup("a@\uff41gentmail.to")?.matched, "agentmail.to");
  assert.equal(lookup("a@bücher.com"), null);
  assert.equal(lookup("a@agentmail.to/\u00e9"), null);
});

test("never matches mail providers that people use", () => {
  const people = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.ru", "yandex.ru", "qq.com", "163.com", "zoho.com", "fastmail.com"];
  for (const domain of people) assert.equal(lookup(`jane@${domain}`), null, domain);
});

test("does not match company domains of listed providers", () => {
  for (const value of ["a@revdoku.com", "a@robotomail.com", "a@testmail.app", "a@agentboxd.com", "a@nylas.com"]) {
    assert.equal(lookup(value), null, value);
  }
});

test("handles very long input quickly", () => {
  const started = performance.now();
  assert.equal(lookup(`a@${"a".repeat(1_000_000)}.agentmail.to`), null);
  assert.ok(performance.now() - started < 500);
});

test("does not match lookalikes or other domains", () => {
  for (const value of ["notagentmail.to", "a@notagentmail.to", "a@agentmail.to.evil.com", "agentmail.to.evil.com", "jane@gmail.com", "a@to", "to"]) {
    assert.equal(lookup(value), null, value);
  }
});

test("returns null for invalid input without throwing", () => {
  for (const value of ["", " ", "@", "a@", "a@.", "a@b..c", ".agentmail.to", "agentmail.to..", "a@exa mple.com", "a@agentmail.to:25", "<>", "__proto__", null, undefined, 42, {}, [], new String("a@agentmail.to")]) {
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
  assert.equal(typeof listVersion, "string");
});

test("data is read-only", () => {
  assert.ok(Object.isFrozen(domains));
  assert.ok(Object.isFrozen(domains[0]));
});

test("scoring is off by default", () => {
  assert.equal(isAgentEmail("signup-bot@example.com"), false);
  assert.equal(isAgentEmail("signup-bot@example.com", { scoring: true }), true);
  assert.equal(isAgentEmail("bot@agentmail.to"), true);
});

test("scoreEmail finds simple signals", () => {
  const cases = {
    "acme.orders.k7m2x9q4v8nc@revdokumail.com": [1, ["listed_domain", "random_token"]],
    "signup-bot@example.com": [0.6, ["agent_word"]],
    "agent-3f9c@company.com": [0.6, ["agent_word"]],
    "Support Assistant <my.assistant@example.com>": [0.6, ["agent_word"]],
    "jane+k7m2x9q4@gmail.com": [0.6, ["random_token"]],
    "550e8400-e29b-41d4-a716-446655440000@example.com": [0.9, ["random_token", "long_digits"]],
    "test12345@example.com": [0.6, ["test_word", "long_digits"]],
    "john23232@gmail.com": [0.3, ["long_digits"]],
    "jane4821@gmail.com": [0.3, ["long_digits"]],
    "qa+run42@example.com": [0.3, ["test_word"]],
  };
  for (const [email, [score, signals]] of Object.entries(cases)) {
    assert.deepEqual(scoreEmail(email), { score, signals }, email);
  }
});

test("scoreEmail leaves ordinary personal addresses at 0", () => {
  const people = ["john.doe@gmail.com", "jane1987@gmail.com", "mike_2000@yahoo.com", "j.smith23@outlook.com", "ai.chen@gmail.com", "ci.wang@qq.com", "talbot@gmail.com", "robert.testa@gmail.com", "contestant@example.com", "agentcarter@example.com", "kim2024@gmail.com", "maria.garcia84@hotmail.com", "li.wei1990@163.com"];
  for (const email of people) assert.deepEqual(scoreEmail(email), { score: 0, signals: [] }, email);
});

test("threshold controls what scoring flags", () => {
  assert.equal(isAgentEmail("john23232@gmail.com", { scoring: true }), false);
  assert.equal(isAgentEmail("john23232@gmail.com", { scoring: true, threshold: 0.3 }), true);
});

test("scoreEmail never throws and is fast", () => {
  for (const value of ["", "@", "a@", null, undefined, 42, {}, "bot"]) {
    assert.deepEqual(scoreEmail(value), { score: 0, signals: [] }, String(value));
  }
  const started = performance.now();
  scoreEmail(`${"k7".repeat(500_000)}@example.com`);
  assert.ok(performance.now() - started < 1000);
});
