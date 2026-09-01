# Final Judge Q&A (evidence-backed)

## Chrome/WebMCP engineer — "Why is WebMCP necessary?"
Because the demonstrated behaviors require a declared contract: capability
discovery (`get_accessibility_capabilities`), site consent (approval-gated
remediation), declared task-scoped verification, and honest rejection of
unsupported needs. The benchmark (`public/eval-results.json`) shows actuation
cannot discover support, cannot verify against the site's own contract, and
mutates without consent (`unauthorized_mutations > 0`), while WebMCP does all
four. `docs/evidence/webmcp-transport-trace.json` captures the real
`registerTool → getTools → executeTool` chain, plus task-scoped
`unregisterTool` on unmount.

## Agent engineer — "Can an independent agent use the tools?"
The tool surface is agent-first: descriptions carry when / when-not /
preconditions / failure-recovery, schemas are strict
(`additionalProperties:false`), and `nextAction` hints thread through every
structured error. `eval:tools` scores this. Every call in the app is
dispatched through `document.modelContext.executeTool` (native when the
browser has it, otherwise the spec-compatible polyfill), so an agent that
speaks WebMCP drives the same path the demo does. A recorded run in a
browser with *native* WebMCP is tracked as optional supplementary evidence
in `docs/evidence/external-agent-transcript.md` and is not yet captured.

## Accessibility expert — "Are the claims responsible?"
Yes. No WCAG/ADA compliance claims. Audits are scoped to the negotiated
profile: `verify_accessibility_profile` returns PASS/BLOCKED for what was
negotiated and lists everything else as `advisories`, so a keyboard-only
user is not declared "blocked" by an unrelated unnamed control. Violations
are tagged blocking / degrading / informational; the focus probe is a
documented runtime proxy; partial capabilities carry limitations. The
product itself is keyboard operable with visible focus, landmarks, live
regions, and reduced-motion support.

## Product leader — "Who would adopt this?"
Sites where task completion matters and adaptation is brand-safe:
e-commerce, banking, government, education, healthcare. Adoption is a
manifest file plus a script tag: `/partner` ("Vellum Books") is a plain
static HTML page this app does not render, made agent-adaptable by
`<link rel="a11ymcp-manifest">` + `public/a11ymcp-adapter.js` (framework-free,
covered by `tests/e2e/adapter.spec.ts`). The manifest is served independently
at `/.well-known/a11ymcp`. Adoption path: `docs/FOR_WEBSITE_OWNERS.md`.

## Security engineer — "What prevents unsafe agent actions?"
No arbitrary DOM/JS tools; strict schemas; `approval` literal on
remediation; `confirmation` literal on orders; rollback; repeated-order
rejection; stale-state rejection with `nextAction` hints; everything logged.
Negative proofs in `tests/unit/security.test.ts`,
`tests/e2e/negative.spec.ts`, and the transport trace.

## Hackathon judge — "Why does this beat other WebMCP projects?"
Strongest idea (accessibility capability *negotiation*), a real
implementation (20 tools + a declarative form, imperative + declarative APIs,
task-scoped `registerTool`/`unregisterTool` lifecycle, `AbortSignal`
cancellation, a spec-compatible polyfill), decoupled adoption (a static page
made adaptable by a manifest + a script tag), reproducible evidence
(transport trace + measured benchmark + 95 unit + e2e), and a complete human
story (blocked task → negotiated adaptation → verified → completed purchase).
Open gaps are listed honestly in `docs/STAGE_ONE_COMPLIANCE.md` rather than
papered over.
