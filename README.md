# agent-email-domains

Detect signups that use an inbox made for an AI agent or for test automation.

```sh
npm install agent-email-domains
```

```js
import { lookup, isAgentEmail } from "agent-email-domains";

lookup("bot@revdokumail.com");
// { host: "revdokumail.com", matched: "revdokumail.com", provider: "Revdoku", category: "agent_inbox" }
isAgentEmail("jane@gmail.com"); // false
```

- Accepts `bot@example.com`, `Bot <bot@example.com>` or a domain. Subdomains match their parent: `x@abc.mailosaur.net` matches `mailosaur.net`. Invalid input returns `null`.
- `isAgentEmail()` is true for both categories. For AI agents only: `lookup(email)?.category === "agent_inbox"`.
- Zero dependencies, about 3 KB. ESM and CommonJS, with TypeScript types. Works in Node.js 18+, Deno, browsers and edge runtimes.
- Also exports `domains` (domain, provider, category) and `listVersion`. Evidence and notes are in `agent-email-domains/domains.json`.
- Route matches instead of blocking them: mark the account as an agent and offer your API plan (`agent_inbox`), or allow test inboxes in staging (`test_inbox`).
- Agents that use a custom domain or Gmail are not detected.

**Prompt for your AI coding assistant:** "Install `agent-email-domains`. In the signup handler, call `lookup(email)`. If it returns a match, do not block the signup. Save `match.category` on the user and show agent accounts our API option."

The list, raw files and how to add a domain: [revdoku/agent-email-domains](https://github.com/revdoku/agent-email-domains). [MIT](LICENSE).

Maintained by [Revdoku](https://revdoku.com/?utm_source=github&utm_medium=readme&utm_campaign=agent-email-domains-js) — email inboxes for AI agents.
