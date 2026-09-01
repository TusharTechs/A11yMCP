# A11yMCP — Adaptive Web

Websites expose accessibility capabilities to agents, allowing them to adapt
live experiences to human needs, verify accessibility, and complete real
tasks.

## 1. The Problem
Websites block specific people from specific tasks even when they
"technically work". The metric that matters is task completion.

## 2. The Insight
Accessibility adaptation should be a declared, negotiated contract between
human, agent, and website — not inferred DOM hacking.

## 3. Why WebMCP
WebMCP is the only mechanism that lets the website itself declare
capabilities, schemas, state, and safe actions to an agent-aware browser.
Browser automation cannot provide declared verification or site consent.

## 4. How A11yMCP Works
Need → discovery → audit → negotiation → approval → live remediation →
verification → commerce task completion, all through 20 registered WebMCP
tools plus a declarative preference form.

## 5. Accessibility Capability Negotiation
Accepted / partial (with limitations) / rejected (with reasons). Unsupported
needs are never faked — a core trust property demonstrated in the demo.

## 6. Live Remediation
Site-declared directives applied by a site-owned adapter; reversible;
approval-gated; evidenced (before → why → action → after → verification).

## 7. Verification
Site-provided, task-scoped verification tools; PASS/BLOCKED per task.

## 8. Human + Agent Collaboration
Approval trust box for adaptations; literal confirmation for the
consequential order. Every tool call is dispatched through
`document.modelContext.executeTool`; a captured chain trace is in
`docs/evidence/webmcp-transport-trace.json`.

## 9. Technical Architecture
Next.js App Router; WebMCP runtime on `document.modelContext` with a
spec-compatible polyfill when no native implementation is present;
task-scoped tool lifecycle (`registerTool` / `unregisterTool` + `toolchange`);
deterministic engine and commerce store; capability manifest served
independently; zero external APIs or secrets.

## 10. Security
No arbitrary DOM tools; strict schemas; approval/confirmation gates;
rollback; structured errors with recovery hints; event log.

## 11. Real-world Impact
A reference model for e-commerce, banking, government, education, healthcare:
sites declare adaptations; agents adapt per person; humans stay in control.

## 12. Limitations
Controlled demo site; supported barrier set; task-scoped evidence, not
legal certification.

## 13. Adoption is one manifest + one script tag
`/partner` ("Vellum Books") is a plain static HTML page this app does not
render. `public/a11ymcp-adapter.js` (framework-free) reads its
`<link rel="a11ymcp-manifest">` and registers the same discover → negotiate →
approve → adapt → verify flow on `document.modelContext`. This is the
adoption story for any site.

## 14. Future Vision
An agent-native accessibility layer as a web convention — see
a11ymcp-contract/, the `/.well-known/a11ymcp` endpoint, and
docs/FOR_WEBSITE_OWNERS.md.