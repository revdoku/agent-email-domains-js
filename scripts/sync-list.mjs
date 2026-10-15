#!/usr/bin/env node
// Copies domains.json from a release of revdoku/agent-email-domains into data/.
// Usage: node scripts/sync-list.mjs --latest
//        node scripts/sync-list.mjs --tag v1.2.0
//        node scripts/sync-list.mjs --from ../agent-email-domains --version 1.2.0
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "revdoku/agent-email-domains";
const ROOT = join(fileURLToPath(import.meta.url), "../..");
const args = parseArgs(process.argv.slice(2));

let text;
let version;
let source;
if (args.from) {
  if (!args.version) fail("--from needs --version X.Y.Z");
  version = args.version;
  source = "local";
  text = readFileSync(join(args.from, "domains.json"), "utf8");
} else {
  const tag = args.tag ?? (args.latest ? await latestTag() : null);
  if (!tag) fail("use --latest, --tag vX.Y.Z, or --from PATH --version X.Y.Z");
  version = tag.replace(/^v/, "");
  source = `https://raw.githubusercontent.com/${REPO}/${tag}/domains.json`;
  text = await fetchText(source);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`bad list version "${version}"`);
const entries = JSON.parse(text);
if (!Array.isArray(entries) || entries.length === 0) fail("domains.json must be a non-empty array");
for (const entry of entries) {
  if (typeof entry?.domain !== "string" || !["agent_inbox", "test_inbox"].includes(entry.category)) {
    fail(`unexpected entry: ${JSON.stringify(entry)}`);
  }
}

const sha256 = createHash("sha256").update(text).digest("hex");
writeFileSync(join(ROOT, "data/domains.json"), text);
writeFileSync(
  join(ROOT, "data/SOURCE.json"),
  `${JSON.stringify({ list_version: version, source, sha256 }, null, 2)}\n`,
);
console.log(`data/domains.json: list v${version}, ${entries.length} domains`);

async function latestTag() {
  const headers = { accept: "application/vnd.github+json" };
  if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
  if (!response.ok) fail(`GitHub API: HTTP ${response.status}`);
  return (await response.json()).tag_name;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) fail(`${url}: HTTP ${response.status}`);
  return response.text();
}

function parseArgs(list) {
  const result = {};
  for (let i = 0; i < list.length; i++) {
    const key = list[i].replace(/^--/, "");
    if (key === "latest") result.latest = true;
    else result[key] = list[++i];
  }
  return result;
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
