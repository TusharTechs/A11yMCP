# A11yMCP — The Adaptive Web

Websites expose accessibility capabilities to AI agents, allowing them to
adapt live experiences to human needs, verify the result, and complete real
tasks.

## The Problem

A website can technically "work" while still blocking a specific person from
completing a task: a keyboard-only user who cannot reach a control, a user
who cannot see focus, a checkout form whose errors are never announced.
A11yMCP measures **task completion**, not a generic violation count.

## Why WebMCP

Browser automation forces agents to infer semantics from DOM and pixels and
its only remediation strategy is arbitrary DOM injection. WebMCP lets the
website declare structured capabilities, schemas, state, and safe actions.
A11yMCP uses that contract for accessibility adaptation — and then verifies
the resulting task state. See `docs/WHY_A11YMCP.md`.

## The Human Journey

Need → Discovery → Audit → Negotiation → Approval → Adaptation →
Verification → Task completion.

## Why This Was Difficult Before

Before WebMCP an agent saw DOM + pixels and had to guess what each control
does, which adaptations are possible, how to modify them, and whether the
change worked. With WebMCP the agent sees declared capabilities, schemas,
and state — and can discover, select, invoke, and verify.

## WebMCP vs Browser Actuation

A fair, reproducible benchmark (`npm run eval:webmcp`) runs the same tasks
with a competent actuation baseline and with WebMCP tools, on two site
configurations. Results are written to `public/eval-results.json` and
rendered in `/inspector`. Numbers are produced by real runs, never
hand-entered.

## Real Evaluation Results

- External real-agent transcript (ChatGPT in-app browser):
  `docs/evidence/external-agent-transcript.md`
- Measured benchmark: `public/eval-results.json`
- Suites: `npm run test`, `npm run test:e2e`, `npm run eval:tools`

## Architecture

Next.js App Router. Isolated WebMCP runtime (`lib/webmcp/runtime.ts`) using
`document.modelContext.registerTool`. Deterministic accessibility engine
(tree, audits, negotiation, site-declared remediation, verification).
Deterministic NOMA commerce store. Guided demo harness (labeled as such)
plus real external-agent proof.

## WebMCP Tools

20 imperative tools + 1 declarative preference form. Full agent-first
descriptions and schemas are visible at `/inspector`, grouped by purpose
(discovery, negotiation, audits, remediation, verification, commerce).

## Capability Contract

`a11ymcp-contract/` contains the reference manifest schema, two example
site configurations, the capability spec, and the adapter contract.
Labeled clearly as a prototype convention — not an official standard.

## Safety Model

Typed scoped mutations only; no arbitrary DOM/JS tools. Approval gates on
remediation (`approval: true`), literal `confirmation: true` on the
consequential order tool. Rollback for every adaptation. Structured errors
carry `nextAction` recovery hints. Full event log.

## Accessibility Methodology

Deterministic runtime audits scoped to the active task, with findings tagged
`blocking | degrading | informational`. The focus probe is a documented
runtime proxy, not a WCAG conformance engine. A11yMCP itself is keyboard
operable with visible focus, landmarks, live regions, and reduced-motion
support.

## Limitations

Controlled demo site; supported barrier set only; verification is
task-scoped evidence, not WCAG/ADA certification; unsupported capabilities
are rejected, not faked.

## Run Locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # unit
npm run test:e2e     # golden + negatives
npm run eval:tools   # tool-quality scorecard
npm run eval:webmcp  # benchmark → public/eval-results.json
npm run build && npm run start