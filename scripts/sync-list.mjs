#!/usr/bin/env node
// Copies domains.json from a release of revdoku/agent-email-domains into data/.
// Usage: node scripts/sync-list.mjs --latest
//        node scripts/sync-list.mjs --tag v1.2.0
//        node scripts/sync-list.mjs --from ../agent-email-domains --version 1.2.0
// It refuses a list that looks wrong, because releases publish without human review.
// Add --force to accept an older list version than the current one.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "revdoku/agent-email-domains";
const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;
// Mail providers used by people. A list entry that covers one of these would flag ordinary users.
const PEOPLE_MAIL = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de",
  "web.de", "mail.ru", "yandex.ru", "qq.com", "163.com", "126.com", "naver.com", "zoho.com", "fastmail.com",
];
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
const sourcePath = join(ROOT, "data/SOURCE.json");
const current = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, "utf8")).list_version : null;
if (current && compare(version, current) < 0 && !args.force) {
  fail(`list v${version} is older than the current v${current}. Add --force to accept it.`);
}

const entries = JSON.parse(text);
if (!Array.isArray(entries) || entries.length === 0) fail("domains.json must be a non-empty array");
const seen = new Set();
for (const entry of entries) {
  const valid = typeof entry?.domain === "string" && DOMAIN.test(entry.domain) && typeof entry.provider === "string";
  if (!valid || !["agent_inbox", "test_inbox"].includes(entry.category)) {
    fail(`unexpected entry: ${JSON.stringify(entry)}`);
  }
  if (seen.has(entry.domain)) fail(`duplicate domain: ${entry.domain}`);
  seen.add(entry.domain);
  const covered = PEOPLE_MAIL.find((domain) => domain === entry.domain || domain.endsWith(`.${entry.domain}`));
  if (covered) fail(`${entry.domain} would match ${covered}, which people use`);
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
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) fail(`GitHub API: HTTP ${response.status}`);
  return (await response.json()).tag_name;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) fail(`${url}: HTTP ${response.status}`);
  return response.text();
}

function parseArgs(list) {
  const result = {};
  for (let i = 0; i < list.length; i++) {
    const key = list[i].replace(/^--/, "");
    if (key === "latest" || key === "force") result[key] = true;
    else result[key] = list[++i];
  }
  return result;
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function compare(a, b) {
  const [x, y] = [a, b].map((value) => value.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
