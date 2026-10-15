const { test } = require("node:test");
const assert = require("node:assert/strict");
const { lookup, isAgentEmail, scoreEmail, domains } = require("agent-email-domains");

test("CommonJS build works", () => {
  assert.equal(lookup("bot@revdokumail.com")?.provider, "Revdoku");
  assert.equal(isAgentEmail("jane@gmail.com"), false);
  assert.ok(domains.length > 0);
  assert.equal(scoreEmail("signup-bot@example.com").score, 0.6);
  assert.equal(isAgentEmail("signup-bot@example.com"), false);
});
