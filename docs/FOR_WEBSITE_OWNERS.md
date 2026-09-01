# For Website Owners

A11yMCP explores a model where your site exposes accessibility capabilities
to agents the same way it exposes commerce capabilities.

## Adoption path (prototype reference)

1. Declare an accessibility manifest (see a11ymcp-contract/): which
   capabilities you support, their status and limitations. Serve it
   statically at `/.well-known/a11ymcp` — no frontend rebuild required.
   This demo serves its manifest at `/api/a11ymcp-manifest` (try
   `?site=site-b`).
2. Register WebMCP tools for audit, negotiation, remediation, verification,
   and your existing commerce actions via `document.modelContext`. If you
   support browsers without native WebMCP yet, a small polyfill
   (`lib/webmcp/polyfill.ts` here) lets the same code run everywhere and
   defers to the native implementation once it ships. Register task-scoped
   tools (e.g. checkout) only while that UI is mounted; `unregisterTool` on
   unmount.
3. Implement a site-owned adapter that applies only your declared directives,
   reversibly, with approval gates on mutations and confirmation gates on
   consequential actions.
4. Expose site-provided verification so agents can confirm results.

## What you keep

- Control: agents get typed, scoped operations — never arbitrary DOM access.
- Honesty: unsupported needs are rejected, not faked.
- Evidence: every adaptation produces an auditable evidence chain.

## What this is not

A11yMCP is a prototype/reference implementation exploring this model. It is
not an official accessibility standard, not a certification path, and not a
claim that any of this is required or sufficient for legal compliance.