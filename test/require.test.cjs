const { test } = require("node:test");
const assert = require("node:assert/strict");
const { lookup, isAgentEmail, domains } = require("agent-email-domains");

test("CommonJS build works", () => {
  assert.equal(lookup("bot@revdokumail.com")?.provider, "Revdoku");
  assert.equal(isAgentEmail("jane@gmail.com"), false);
  assert.ok(domains.length > 0);
});
