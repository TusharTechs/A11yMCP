# A11yMCP Capability Contract

A **prototype convention** — not an official WebMCP standard, and not proposed
as one without broader review. It explores what a site would need to declare
for an agent to adapt it for accessibility safely.

## The idea

A site publishes an accessibility capability manifest the way it publishes a
sitemap or `robots.txt` — at a well-known URL, independent of its rendering
code. An agent (or the drop-in `a11ymcp-adapter.js`) reads it and knows,
before touching the page:

- which adaptations the site **supports**, which are **partial** (with a
  stated limitation), and which needs it **does not declare**;
- the exact, scoped, reversible directives the site consents to;
- how to **verify** the result.

Needs with no declared capability are **rejected, not faked**. Silence is not
support.

## Files

| File | What it is |
|---|---|
| [`capability-spec.md`](capability-spec.md) | the model: capability status, negotiation semantics, task-impact taxonomy, transport |
| [`adapter-contract.md`](adapter-contract.md) | the six rules a site-owned adapter must follow |
| [`manifest.schema.json`](manifest.schema.json) | JSON Schema for the engine's internal manifest (descriptive `change` strings) |
| [`adapter-manifest.schema.json`](adapter-manifest.schema.json) | JSON Schema for the drop-in adapter's manifest (machine-applicable directives) |
| [`example-site-a.json`](example-site-a.json) · [`example-site-b.json`](example-site-b.json) | two configs — the same user request yields different negotiated outcomes |

## Live examples

- `GET /.well-known/a11ymcp` — the demo app's manifest (add `?site=site-b`)
- `GET /partner/a11ymcp.json` — the static partner page's manifest, in the
  adapter format

## Negotiation, in one exchange

```
agent →  get_accessibility_capabilities
site  ←  { capabilities: [{id:"keyboard_navigation", status:"supported"}, …],
           notDeclared: ["high_contrast", …] }

agent →  negotiate_accessibility_profile { needs: ["keyboard_only","high_contrast"] }
site  ←  { accepted: [{need:"keyboard_only", capability:"keyboard_navigation", status:"supported"}],
           rejected: [{need:"high_contrast", reason:"not declared by this site"}] }

agent →  (asks the human) → apply, with approval:true → verify → done
```
