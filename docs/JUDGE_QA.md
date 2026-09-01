# Final Judge Q&A (evidence-backed)

## "I have sixty seconds."
Open **`/demo?judge=1`** and press one button. An eight-step checklist fills
in as it happens: the need, discovery, the audit, a negotiation that
**refuses** one need this site does not declare, the run stopping for your
approval, the adaptation, the site's own verification, the purchase. Then
press **Run both lanes** for the same task attempted with and without
WebMCP, live, on the same page. If you would rather drive it with your own
agent, judge mode has a copy-paste prompt.

## Chrome/WebMCP engineer — "Why is WebMCP necessary?"
Because the demonstrated behaviors require a declared contract: capability
discovery (`get_accessibility_capabilities`), site consent (approval-gated
remediation), declared task-scoped verification, and honest rejection of
unsupported needs. The benchmark (`public/eval-results.json`) shows actuation
cannot discover support, cannot verify against the site's own contract, and
mutates without consent (`unauthorized_mutations > 0`), while WebMCP does all
four. `docs/evidence/webmcp-transport-trace.json` captures the real
`registerTool → getTools → executeTool` chain, plus task-scoped
unregistration on unmount.

## Browser engineer — "Does this actually work against a *native* implementation?"
That is the question the polyfill cannot answer, so it is tested separately.
`tests/unit/native-conformance.test.ts` builds a `document.modelContext` that
implements only the documented spec surface — `registerTool(def, { signal })`
returning a promise, **no `unregisterTool`**, and an `executeTool` that
accepts a descriptor from `getTools()` plus a JSON string and throws a
`TypeError` for anything else — and drives register → discover → execute →
unregister through it. So the task-scoped lifecycle runs on
`controller.abort()` (the spec's only defined teardown), arguments are
JSON-encoded, and every tool coerces string-or-object input. The polyfill's
handle and `unregisterTool` are fallbacks, never the primary path.
`Permissions-Policy: tools=(self)` ships on every route, and a Chrome 149
origin-trial token can be set at build time via `WEBMCP_ORIGIN_TRIAL_TOKEN`.

## Agent engineer — "Can an independent agent use the tools?"
The tool surface is agent-first: descriptions carry when / when-not /
preconditions / failure-recovery, schemas are strict
(`additionalProperties:false`), and `nextAction` hints thread through every
structured error. `eval:tools` scores this. Every call in the app is
dispatched through `document.modelContext.executeTool` (native when the
browser has it, otherwise the spec-compatible polyfill), so an agent that
speaks WebMCP drives the same path the demo does. Results come back as MCP
tool results — a readable `content` text block plus `structuredContent`
carrying the machine payload — so a model gets the outcome without parsing
anything. A recorded run in a
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

## Skeptic — "Is the comparison rigged?"
No, and you can watch it. The side-by-side proof runs both lanes live on the
same fixture in front of you — it does not animate a stored result. The
actuation lane genuinely enumerates the tab order (the size options are not
in it), genuinely probes the computed focus style, and then genuinely
injects the `tabindex` it was never authorized to inject, so the
`unauthorized mutations` counter is a count of real DOM writes. It undoes
them before it finishes. The lane even *succeeds* at reaching the control —
the point is not that actuation cannot act, it is that it cannot ask, cannot
get consent, and cannot verify. The wider six-task measurement is
`npm run eval:webmcp` (`public/eval-results.json`), and it names the task
where actuation wins.

## Hackathon judge — "Why does this beat other WebMCP projects?"
Strongest idea (accessibility capability *negotiation*), a real
implementation (20 tools + a declarative form, imperative + declarative APIs,
MCP-shaped tool results, task-scoped `AbortSignal` lifecycle, cancellation, a
spec-compatible polyfill *and* a strict native-conformance suite), decoupled
adoption (a static page made adaptable by a manifest + a script tag),
reproducible evidence (transport trace + measured benchmark + 123 unit +
e2e), and a complete human
story (blocked task → negotiated adaptation → verified → completed purchase).
Open gaps are listed honestly in `docs/STAGE_ONE_COMPLIANCE.md` rather than
papered over.
