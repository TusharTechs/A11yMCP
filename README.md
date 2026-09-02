<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.svg">
  <img src="docs/brand/wordmark-light.svg" width="340" alt="A11yMCP — the Adaptive Web">
</picture>

**Websites declare accessibility capabilities to AI agents — so an agent can adapt a live page to a person's needs, verify the result, and finish the task.**

*The WebMCP Challenge*

[**▶ Watch the 3-minute demo**](https://youtu.be/p1m6QgeKI6c) · [**Judge mode — start here**](https://a11ymcp.vercel.app/demo?judge=1) · [Live demo](https://a11ymcp.vercel.app/demo) · [Inspector](https://a11ymcp.vercel.app/inspector) · [Drop-in adapter demo](https://a11ymcp.vercel.app/partner) · [Architecture](#architecture) · [Run it locally](#run-it-locally)

![A11yMCP architecture](docs/architecture.svg)

</div>

---

## Sixty seconds

**[a11ymcp.vercel.app/demo?judge=1](https://a11ymcp.vercel.app/demo?judge=1)** — one
button, one checklist. A keyboard-only shopper cannot finish this checkout.
Watch the site declare what it can adapt, **refuse what it cannot**, ask
permission, adapt itself, verify its own work, and complete the purchase.

Then press **Run both lanes** for the same task attempted two ways, live, on
the same page:

![The side-by-side proof](docs/screenshots/08-proof-race.png)

Prefer your own agent? Judge mode has a copy-paste prompt. In Chrome with
`chrome://flags/#enable-webmcp-testing`, or the ChatGPT in-app browser, the
tools are on `document.modelContext` and your agent can call them directly.

---

## WebMCP Challenge — at a glance

**Every submission requirement is met, and every judging criterion maps to something you can click or run.**

| Judging criterion | How A11yMCP answers it | Where |
|---|---|---|
| **WebMCP implementation depth & skill** | Real `document.modelContext.registerTool` / `getTools` / `executeTool` + `toolchange`. 20 imperative tools + declarative form tools whose schemas are **derived from the markup** (types, enums, required, `toolparamdescription`, `toolautosubmit`), every result an **MCP tool result** (`content` blocks + `structuredContent`). **Task-scoped lifecycle** via the spec's `AbortSignal`. **Cross-origin `exposedTo` / `fromOrigins`** with a real sandboxed-frame demo. A **spec-compatible polyfill** means the same code path runs everywhere and stands down when a native implementation appears — and a [native-conformance suite](tests/unit/native-conformance.test.ts) proves the app does not depend on the polyfill's leniency. | [`runtime.ts`](lib/webmcp/runtime.ts) · [`mcp.ts`](lib/webmcp/mcp.ts) · [`declarative.ts`](lib/webmcp/declarative.ts) · [`federation.ts`](lib/webmcp/federation.ts) |
| **Complete, coherent product execution** | A full human journey — need → discover → audit → negotiate → approve → adapt → verify → buy — works end to end in `/demo`, is reduced to one button in [`/demo?judge=1`](https://a11ymcp.vercel.app/demo?judge=1), **and** works on a plain static third-party page (`/partner`) via a drop-in adapter (8 KB gzipped). Landing, demo, judge mode, inspector, partner site, deployed. | [`JudgeMode.tsx`](components/judge/JudgeMode.tsx) · [`guided-demo.ts`](lib/agent/guided-demo.ts) · [`a11ymcp-adapter.js`](public/a11ymcp-adapter.js) |
| **Credible real-world problem-solving impact** | Accessibility is the use case: ~1 in 6 people, and task completion (not a violation count) is the metric. The contract keeps the **site in control** of what it will adapt — the adoption model for e-commerce, banking, gov, health. | [`WHY_A11YMCP.md`](docs/WHY_A11YMCP.md) · [`FOR_WEBSITE_OWNERS.md`](docs/FOR_WEBSITE_OWNERS.md) |
| **Creative & novel concept** | Not another form-filler. **Capability *negotiation*** — the site returns `accepted` / `partial (with limitation)` / `rejected (with reason)`, and the agent never fakes a capability the site didn't declare. The [live side-by-side proof](components/judge/ProofRace.tsx) runs an actuation agent and a WebMCP agent against the same page and shows where the first one has to start guessing. | [`negotiation.ts:29`](lib/accessibility/negotiation.ts#L29) · [`actuation-baseline.ts`](lib/agent/actuation-baseline.ts) |
| Live deployed URL (works in a WebMCP browser) | https://a11ymcp.vercel.app — **verified end to end by ChatGPT's desktop browser over native `document.modelContext`**; the spec-compatible polyfill covers every other browser | [`deployment.md`](docs/evidence/deployment.md) |
| Public repo + OSS license | This repo, **MIT** | [`LICENSE`](LICENSE) |
| Demo video < 3 min, with audio | 2:59, narrated — the blocked task, the honest rejection, the approval gate, the adapted page, and the live side-by-side proof | [**▶ YouTube**](https://youtu.be/p1m6QgeKI6c) |

**Verify it yourself in one command** (no keys, no account):

```bash
npm i && npm run test && npm run test:e2e && npm run eval:webmcp
# unit + e2e + a measured WebMCP-vs-actuation benchmark, all from real runs
```

```bash
# see that tools go through the real channel, not a private hook:
grep -n "document.modelContext.executeTool" lib/webmcp/runtime.ts tests/eval/*.ts
# see the task-scoped lifecycle:
grep -n "unregisterCommerceA11yTools\|registerCommerceA11yTools" components/fixture/LiveStorefront.tsx lib/webmcp/tools.ts
# see the app driven by a STRICT native modelContext (no unregisterTool,
# executeTool(descriptor, jsonString) only) — the polyfill can't paper over it:
npx vitest run tests/unit/native-conformance.test.ts
```

---

## The problem

A website can pass an audit and still stop a specific person from finishing a
specific task: a keyboard-only user who cannot reach the size selector, a
low-vision user with no visible focus, a checkout whose errors are never
announced. Automated scanners find issues for a developer to fix *later*.
Overlays mutate the page without the site's knowledge or consent. Neither
helps the person standing at the checkout **now**.

A11yMCP treats accessibility adaptation as a **contract** between three
parties — the human, their agent, and the website — where the website is a
first-class participant that declares what it can safely adapt, how, and how
to check it worked.

## What it does

Give the agent a need. Through WebMCP tools it then:

| # | Step | Tool | What happens |
|---|------|------|--------------|
| 1 | **Need** | — | "I can only use a keyboard. Buy the NOMA Runner in size 9." |
| 2 | **Discover** | `get_accessibility_capabilities` | Reads the site's declared capability manifest (served at `/.well-known/a11ymcp`). |
| 3 | **Audit** | `audit_keyboard_navigation` … | Task-scoped checks; each finding tagged `blocking` / `degrading` / `informational`. |
| 4 | **Negotiate** | `negotiate_accessibility_profile` | Needs → `accepted` (supported/partial) + `rejected` (with reasons). Undeclared needs are **rejected, not faked**. |
| 5 | **Approve** | *(human gate)* | A trust box: what / why / scope / reversible. The agent waits. |
| 6 | **Adapt** | `repair_keyboard_navigation` … | The **site's own adapter** applies only its declared directives, reversibly. `approval: true` is required at the schema level. |
| 7 | **Verify** | `verify_accessibility_profile` | Re-audits and returns `PASS` / `BLOCKED` **for the negotiated profile**, plus an `advisories` array for everything else. |
| 8 | **Task** | `search_products` → `place_order` | The real purchase. `place_order` needs `confirmation: true` — a literal, schema-enforced. |

Every adaptation is reversible (`rollback_all_remediations`), every step
writes to an event log, and every structured error carries a `nextAction`
recovery hint.

## Why WebMCP, not browser automation

A browser-automation agent infers meaning from DOM + pixels and its only way
to "adapt" a page is to inject CSS/DOM it made up. Four things it structurally
cannot do — and a declared contract can:

| | Browser actuation | WebMCP (A11yMCP) |
|---|---|---|
| **Discover** what adaptations exist | guesses | `get_accessibility_capabilities` |
| **Consent** — does the site allow this change? | no concept | `approval: true` literal, site-owned adapter |
| **Verify** against the site's definition of done | self-built heuristic | `verify_accessibility_profile` (site-provided) |
| **Honesty** on unsupported needs | silently hacks something | `rejected` with a reason — never faked |

A fair, reproducible benchmark (`npm run eval:webmcp`) runs the same tasks on
the same pages with a competent actuation baseline (reads roles/names,
retries) and with WebMCP tools. Numbers are written by the harness, never by
hand:

| | Actuation | WebMCP |
|---|---|---|
| task success rate | **0.17** | **0.83** |
| failed actions | 38 | 6 |
| unauthorized mutations | **6** | **0** |
| verification | heuristic-or-none | structured |

Full methodology, including where actuation *wins* (T5), is in
[`public/eval-results.json`](public/eval-results.json) and rendered at
[`/inspector`](https://a11ymcp.vercel.app/inspector).

## The tool surface

20 imperative tools + 1 declarative form, all with agent-first descriptions
(when / when-not / preconditions / failure-recovery), strict schemas
(`additionalProperties: false`), and MCP annotations. Browse them live with
sample inputs at [`/inspector`](https://a11ymcp.vercel.app/inspector).

| Group | Tools |
|---|---|
| **Discovery & state** | `get_accessibility_capabilities` · `get_accessibility_state` · `inspect_accessibility_tree` |
| **Negotiation** | `negotiate_accessibility_profile` · `submit_accessibility_preferences` *(declarative form)* |
| **Audits** (task-scoped) | `audit_keyboard_navigation` · `audit_accessible_names` · `audit_form_associations` · `audit_focus_visibility` |
| **Remediation** (approval-gated, reversible) | `repair_keyboard_navigation` · `repair_accessible_names` · `repair_form_associations` · `repair_focus_management` · `repair_reduced_motion` · `rollback_all_remediations` |
| **Verification** | `verify_accessibility_profile` |
| **Commerce** (task-scoped lifecycle) | `search_products` · `add_product_to_cart` · `begin_checkout` · `fill_checkout_form` · `place_order` |

## Any site can opt in

[`/partner`](https://a11ymcp.vercel.app/partner) — **"Vellum Books"** — is a
plain static HTML page that this app does not render. It ships with four
accessibility defects. It became agent-adaptable by adding two lines:

```html
<link rel="a11ymcp-manifest" href="/partner/a11ymcp.json" />
<script src="/a11ymcp-adapter.js" defer></script>
```

[`a11ymcp-adapter.js`](public/a11ymcp-adapter.js) (8 KB gzipped, no framework) reads
the site-declared manifest, installs the WebMCP polyfill if the browser has
no native implementation, and registers the same
discover → negotiate → **approve** → adapt → verify → roll back flow
(6 imperative tools + any `form[toolname]` as a declarative tool) on
`document.modelContext`. It **only** applies directives the manifest
declares, and every mutation is reversible. This is the adoption story: a
manifest file plus a script tag.

## Architecture

**[Open the architecture diagram →](docs/architecture.svg)**

Next.js App Router. One WebMCP runtime, one deterministic accessibility
engine, one adapter model, exercised two ways — a rich app (`/demo`) and a
static page + drop-in script (`/partner`).

### The WebMCP chain — native, else polyfill

[`registerA11yTool`](lib/webmcp/runtime.ts#L66) registers every tool through
`document.modelContext`. If the browser has no native implementation,
[`ensureModelContext`](lib/webmcp/polyfill.ts#L36) installs a spec-compatible
one (`registerTool` / `unregisterTool` / `getTools` / `executeTool` /
`toolchange`) and **stands down the moment a native one is present**. Every
call in the app — demo, inspector, guided agent, benchmark — is dispatched
through [`invokeTool`](lib/webmcp/runtime.ts#L141) →
`document.modelContext.executeTool`. There is no private bypass;
`/inspector` shows which transport is live, and
[`webmcp-transport-trace.json`](docs/evidence/webmcp-transport-trace.json)
captures the chain.

### The registration, verbatim

Every tool is registered through the spec's own call. This is
[`runtime.ts`](lib/webmcp/runtime.ts), lightly abridged:

```js
document.modelContext.registerTool(
  {
    name: "search_products",
    description:
      "Searches the deterministic NOMA catalog and updates the visible " +
      "results. Call at the start of a purchase task; the returned product " +
      "ids and sizes are the valid inputs for add_product_to_cart.",
    inputSchema: { /* strict JSON Schema, additionalProperties: false */ },
    annotations: { readOnlyHint: false, idempotentHint: true },
    execute: async (input, context) => {
      const result = await executeA11yTool(name, coerceToolInput(input), {
        signal: context?.signal,
      });
      return toMcpToolResponse(name, result); // MCP content blocks
    },
  },
  { signal: controller.signal } // the spec's unregistration path
);
```

`ensureModelContext()` runs first, so `document.modelContext` is always the
live implementation — the browser's own where one exists, the
spec-compatible polyfill otherwise. There is no private registry and no
side channel: [`/inspector`](https://a11ymcp.vercel.app/inspector) lists what
`getTools()` reports, and every call in the app, the tests and the benchmark
goes out through `executeTool`.

### Tools return MCP tool results

WebMCP tools *are* MCP tools, so `execute()` resolves to an MCP tool result —
not a bespoke shape an agent would have to guess at:

```jsonc
{
  "content": [{ "type": "text",
                "text": "verify_accessibility_profile: task accessibility PASS; 2 advisories." }],
  "structuredContent": { "ok": true, "data": { "taskAccessibility": "PASS", "…": "…" } },
  "isError": false
}
```

The `content` block is what a model reads; `structuredContent` carries the
exact `{ ok, data }` payload the UI, the guided agent and the benchmark
consume. [`mcp.ts`](lib/webmcp/mcp.ts) wraps on the way out and unwraps on the
way back in, so one shape serves both audiences.

### Conformance with a *native* implementation

The polyfill is deliberately forgiving, which makes it a bad oracle: code can
pass against it and still break in the one browser that matters. So the app
targets the native contract, checked against a strict stand-in **and against
the signatures in the shipping Chrome binary**:

| Spec behaviour | What A11yMCP does |
|---|---|
| `registerTool(def, { signal })` resolves a **promise** | awaited and error-handled; a returned handle is treated as a polyfill convenience |
| unregistering is **`controller.abort()`** — there is no `unregisterTool` | aborting the registration signal is the primary teardown path; the handle and `unregisterTool` are fallbacks only |
| `executeTool(toolDescriptor, jsonString, { signal })` | the descriptor is resolved from `getTools()` and arguments are JSON-encoded; the `(name, object)` form is retried only on an argument-shape error |
| arguments arrive as a **JSON string** | every tool coerces string-or-object input before validation |
| `executeTool` resolves a **JSON string**, not an object — and may resolve null | the result is parsed before unwrapping; a null resolution is reported as a failed call, not a successful empty one |
| both APIs are gated by the `tools` Permissions Policy | `Permissions-Policy: tools=(self)` is sent on every route |

[`tests/unit/native-conformance.test.ts`](tests/unit/native-conformance.test.ts)
builds a `document.modelContext` that implements *only* that surface — no
`unregisterTool`, an `executeTool` that throws a `TypeError` for anything but
a descriptor plus a JSON string, and results serialized the way the browser
serializes them — and drives register → discover → execute → unregister
through it.

The last row of that table came from reading Chrome 152 rather than the docs.
The shipping binary declares:

```
ScriptPromise<IDLNullable<IDLString>>
blink::ModelContext::executeTool(ScriptState*, RegisteredTool*, String,
                                 const ExecuteToolOptions*)
```

The result is JSON-**serialized**. The stand-in had been returning an object,
because it was written from the published examples — so it certified an
unwrapper that would have handed the UI a raw string on every native call.
A test double is only as good as the contract you wrote it from, which is the
most useful thing this project taught me.

For stable Chrome, set `WEBMCP_ORIGIN_TRIAL_TOKEN` in the **build**
environment and the site sends an `Origin-Trial` header, so a visitor does
not have to flip `chrome://flags/#enable-webmcp-testing`.

### Driven by a third-party agent

On 2026-09-02, ChatGPT's desktop-app browser — running the **browser's own
native `document.modelContext`**, not this page's polyfill — was pointed at
the deployed site and given one sentence — *"I can only use a keyboard, and I have low vision,
so I need high contrast. Help me buy the NOMA Runner in size 9"* — with no
tools, capabilities or expected outcomes named.

It discovered all 20 tools, called `get_accessibility_capabilities` first,
and **rejected `high_contrast` twice**, quoting the manifest reason back. It
re-negotiated when it wanted more capabilities, waited for confirmation
before the order, and placed it. Asked afterwards what it had changed that
the site had not offered, it answered:

> **None. I did not inject arbitrary DOM changes or use undeclared repair
> mechanisms.**

Asked whether it had told the *user* that high contrast was unavailable, or
only logged it: *"I stated the high-contrast limitation in my reply to you,
not only in tool results."* A refusal the agent swallows is worth nothing to
the person in front of the screen.

It also reported five issues against this project, and one of them was a real
bug: verification returned PASS for a profile where the site had accepted
*nothing*, because an empty scope has nothing left in it to fail. Fixed, with
a test that reproduces the agent's exact path.

Both fixes were then **re-verified by the same agent over the same native
transport** — it now reports 21 tools rather than 20, with the declarative
form among them, so it no longer has to click that form by hand.

The full run is pasted unedited — criticism included — in
[`docs/evidence/external-agent-transcript.md`](docs/evidence/external-agent-transcript.md).

### Cross-origin tools: `exposedTo`, and default-deny

Most of the WebMCP surface is same-page. The interesting half is what
happens when one origin embeds another, and the spec answers it in three
parts that only mean something together: the embedder must grant the frame
`allow="tools"`; the framed document opts each tool in to a named foreign
origin with `registerTool(def, { exposedTo })`; the embedder asks with
`getTools({ fromOrigins })`.

[`/inspector`](https://a11ymcp.vercel.app/inspector) runs it. A third-party
widget sits in an iframe sandboxed **without** `allow-same-origin`, so it has
an opaque origin — no shared globals, no shared storage, `postMessage` as the
only channel. It registers three tools and exposes two:

| | |
|---|---|
| `getTools()` from the embedder | **2 of 3** — the third was never exposed |
| `executeTool("charge_travel_card")` | **refused by name**, with a reason |
| the widget reconfigured to trust another origin | stops answering entirely |

"You may not" and "there is nothing" are different answers, and the widget
gives the right one. [`federation.ts`](lib/webmcp/federation.ts) is the
TypeScript reference implementation;
[`tool-frame.html`](public/tool-frame.html) mirrors the host half in vanilla
JS, because a third-party widget shouldn't need your framework.

### Declarative tools, derived from the markup

A `<form toolname>` becomes a tool whose schema is read off the fields —
input types and formats, `<select>` and radio-group enums, numeric bounds,
`required`, and per-field descriptions from `toolparamdescription` (falling
back to the label, then `aria-description`, then the placeholder).

`toolautosubmit` is the part worth dwelling on. Without it the tool fills the
form and **stops**. The partner page uses both, deliberately:

| Form | `toolautosubmit` | Why |
|---|---|---|
| `search_catalogue` | yes | searching is harmless and reversible |
| `fill_book_order` | **no** | placing an order is consequential — the agent may prepare it, a person presses the button |

### Try it on any page

A [bookmarklet](public/a11ymcp-probe.js) reports what any page looks like to
an agent: the WebMCP transport, how many tools the page registers, and
whether it declares an accessibility capability contract. On almost every
site the answer is *none*, which is the argument.

It deliberately does **not** adapt the page it runs on. Changing someone
else's site uninvited is exactly the overlay behaviour A11yMCP exists to
replace; a probe that did it would be arguing against itself.

### Capability negotiation

Most WebMCP demos expose actions. A11yMCP exposes a *negotiation*:
[`negotiateProfile`](lib/accessibility/negotiation.ts#L29) maps the user's
needs against the site's manifest and returns `accepted` (with `supported` |
`partial` + a stated `limitation`) and `rejected` (with a reason). A tool is
never called for a need this step rejected. The same request produces
different outcomes on Site A vs Site B — because the two sites declare
different capabilities.

### Site-declared remediation + the adapter contract

[`applyRemediation`](lib/accessibility/remediation.ts#L112) applies only the
directives the manifest declares for a capability, records a
before → why → action → after → verification evidence chain, and is fully
reversible via [`rollbackAll`](lib/accessibility/remediation.ts#L195). There
is no arbitrary-DOM tool. The rules are in
[`a11ymcp-contract/adapter-contract.md`](a11ymcp-contract/adapter-contract.md).

### Profile-scoped verification

[`buildVerification`](lib/accessibility/verification.ts#L49) returns
`PASS` / `BLOCKED` **for the negotiated profile only**. A keyboard-only user
who negotiated keyboard + focus is not "blocked" because an unrelated icon
button lacks a name — that is reported in `advisories`. Verification confirms
exactly what was agreed, nothing more, nothing less.

### Task-scoped tool lifecycle

15 core tools are always registered. The 5 commerce tools are registered by
[`LiveStorefront`](components/fixture/LiveStorefront.tsx#L16) **only while a
storefront is on the page** and `unregisterTool` on unmount (emitting
`toolchange`). This follows the March 2026 spec revision that removed
`provideContext` to discourage "ghost tools." `document.modelContext.getTools()`
returns 15 on `/` and 21 on `/demo` (20 imperative + the declarative
`submit_accessibility_preferences` form).

### Safety model

| Control | Mechanism |
|---|---|
| No arbitrary DOM/JS tool | the tool surface is closed; only declared directives apply |
| Consent for adaptations | [`ApprovalInputSchema`](lib/webmcp/schemas.ts#L14) rejects missing/`false` `approval` |
| Consent for consequential actions | [`PlaceOrderInputSchema`](lib/webmcp/schemas.ts#L119) requires the literal `confirmation: true` |
| Reversibility | `rollback_all_remediations`; the adapter records an undo for every change |
| Bad input | strict Zod + JSON schemas; structured errors carry `nextAction` |
| Runaway work | `AbortSignal` honored at the runtime level for every tool |
| Auditability | full event log; a re-run order is rejected; stale state is rejected |

### Decisions worth pointing at

| | |
|---|---|
| **The comparison is run, not replayed** | The side-by-side proof does not animate `eval-results.json`. Both lanes execute live on the same fixture — the actuation lane really walks the tab order and really injects the tabindex it was never authorized to inject, then undoes it. |
| **Conformance is tested against the strict contract, not the friendly one** | The polyfill accepts anything, so passing against it proved little. A strict native stand-in (promise-returning `registerTool`, no `unregisterTool`, descriptor + JSON string only) now gates the register/execute/unregister paths. |
| **The transport is real, or an honest polyfill — never a private hook** | The benchmark used to reach into a `?eval=1` global. Now [`tests/eval/benchmark.spec.ts`](tests/eval/benchmark.spec.ts) calls `document.modelContext.executeTool` like any agent would. |
| **Verification is scoped, so "PASS" means something** | Global "all audits pass" made the flagship keyboard task fail its own benchmark. Scoping to the negotiated profile is both more correct and on-thesis. |
| **The adapter is decoupled from the app** | [`a11ymcp-adapter.js`](public/a11ymcp-adapter.js) is vanilla JS driven entirely by a manifest file — proof the contract model isn't wired into one framework. |
| **Unsupported needs fail loudly** | `high_contrast` on a site that doesn't declare it returns `rejected`, and `repair_reduced_motion` on Site A returns `success: false` with an evidence chain — not a silent no-op. |

### Where things live

| Path | Role |
|---|---|
| `lib/webmcp/` | `runtime` (register/execute/lifecycle) · `mcp` (MCP result envelope) · `declarative` (form → schema) · `federation` (cross-origin) · `polyfill` · `tools` (the 20 tools) · `schemas` |
| `lib/accessibility/` | `manifest` · `tree` · `audits` · `negotiation` · `remediation` · `verification` · `profiles` · `evidence-report` |
| `lib/ecommerce/` | deterministic NOMA catalog / cart / checkout |
| `lib/agent/` | `guided-demo` (a labelled, deterministic agent) · `intent-parser` · `actuation-baseline` (the live no-WebMCP lane) · `proof-race` |
| `app/` | `/` landing · `/demo` · `/inspector` · `/.well-known/a11ymcp` · `/api/a11ymcp-manifest` |
| `public/` | `a11ymcp-adapter.js` · `a11ymcp-probe.js` (the bookmarklet) · `tool-frame.html` (the cross-origin widget) · `partner/` (static third-party page + its manifest) |
| `a11ymcp-contract/` | manifest + adapter-manifest schemas · capability spec · adapter contract · two example site configs · README |
| `tests/` | `unit/` (142) · `e2e/` (14: golden + negatives + adapter + judge mode + cross-origin) · `eval/` (benchmark + transport trace) |

## Evidence

| Artifact | What it shows | Regenerate |
|---|---|---|
| [`docs/evidence/webmcp-transport-trace.json`](docs/evidence/webmcp-transport-trace.json) | `registerTool → getTools → executeTool`, MCP-shaped results, the native `(descriptor, jsonString)` call shape, schema + gate rejections, task-scoped unregistration | `npm run eval:webmcp` |
| [`public/eval-results.json`](public/eval-results.json) | measured WebMCP-vs-actuation benchmark (0.83 vs 0.17 task success) | `npm run eval:webmcp` |
| `npm run test` | 142 unit tests — schemas, audits, negotiation, verification scoping, polyfill, **native conformance**, **MCP result envelope**, **background-tab safety**, security negatives | — |
| `npm run test:e2e` | golden purchase path, security negatives, the drop-in adapter, declarative-form schemas and `toolautosubmit`, the probe, judge mode and the live side-by-side proof, **and cross-origin `exposedTo` across a real origin boundary** | — |
| `npm run eval:tools` | agent-first tool-description scorecard | — |
| [`docs/evidence/external-agent-transcript.md`](docs/evidence/external-agent-transcript.md) | *optional* — a run in a browser with **native** WebMCP. Not captured; not a dependency of any claim. | — |

## Screenshots

| | |
|---|---|
| ![Landing](docs/screenshots/01-landing.png) **The pitch** | ![Blocked](docs/screenshots/02-demo-blocked.png) **Task BLOCKED before adaptation** |
| ![Negotiation](docs/screenshots/03-negotiation-approval.png) **Negotiated profile + human approval gate** | ![Verified](docs/screenshots/04-adapted-verified.png) **Adapted, verified (PASS), order placed** |
| ![Inspector](docs/screenshots/05-inspector-chain.png) **The real chain + live transport** | ![Partner](docs/screenshots/06-partner-adapter.png) **A static third-party page, made adaptable** |
| ![Judge mode](docs/screenshots/07-judge-mode.png) **Judge mode: one button, paused at the approval gate** | ![Proof race](docs/screenshots/08-proof-race.png) **The same task, attempted two ways — live** |

Regenerate: `node docs/capture-screenshots.mjs` (drives headless Chromium; no account).

## Accessibility of A11yMCP itself

Keyboard operable, visible focus, landmarks, `aria-live` on the tool event
log and agent stream, `role="alertdialog"` on the approval and confirmation
gates, and `prefers-reduced-motion` support. The audit engine is a
documented runtime proxy — see
[`docs/ACCESSIBILITY_METHODOLOGY.md`](docs/ACCESSIBILITY_METHODOLOGY.md) for
the task-impact taxonomy, the focus-probe's limits, and an AT-testing
runbook.

## Run it locally

**Prerequisites:** Node 20+. No API keys, no accounts, no external services.

```bash
git clone https://github.com/TusharTechs/A11yMCP.git && cd A11yMCP
npm install
npm run dev            # http://localhost:3000
```

Open `/demo`, click **Keyboard-only checkout**, approve the adaptation,
confirm the order. Then open `/inspector` and run **chain verification**, and
`/partner` to see the drop-in adapter register tools on a static page (check
the console).

```bash
npm run test          # 142 unit tests (incl. strict native-WebMCP conformance)
npm run test:e2e      # golden + negatives + adapter + judge mode + cross-origin
npm run eval:tools    # tool-quality scorecard
npm run eval:webmcp   # benchmark + transport trace -> writes JSON evidence
npm run build         # production build
```

## Limitations

Controlled demo sites; a supported barrier set (keyboard, names, form
association, focus visibility, reduced motion) framed as a reference set, not
a WCAG engine; verification is task-scoped evidence, not legal ADA/WCAG
certification; the capability manifest format is a labelled prototype
convention, not a ratified standard; the guided agent is deterministic and
labelled as such (a native-WebMCP agent drives the identical tool path).

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Zod · `document.modelContext`
(+ spec polyfill) · vanilla-JS drop-in adapter · Playwright · Vitest ·
142 unit tests · reproducible benchmark · zero runtime dependencies beyond
`next` / `react` / `zod`

## Demo video

**[▶ Watch it on YouTube](https://youtu.be/p1m6QgeKI6c)** — 2:59, narrated, shot entirely from
[`/demo?judge=1`](https://a11ymcp.vercel.app/demo?judge=1).

| | |
|---|---|
| 0:00 | A keyboard-only shopper hits a wall — focus skips the size selector entirely |
| 0:18 | The agent asks the website what it can adapt, over `document.modelContext` |
| 0:34 | **The honest no** — a need this site does not declare is rejected, not faked |
| 0:50 | The run stops and asks permission before touching the page |
| 1:02 | Tab, again — the barrier is gone, and the site drew the focus ring itself |
| 1:22 | The site verifies its own work, scoped to what was negotiated |
| 1:34 | The purchase completes, behind a second confirmation gate |
| 1:46 | The same task attempted two ways, live, on the same page |
| 2:22 | A static page and a cross-origin widget doing the same thing |

Every interaction in the film is driven by
[`docs/direct-demo.mjs`](docs/direct-demo.mjs), so the whole run is
reproducible — including the focus annotation that makes the invisible
barrier visible.

## License

[MIT](LICENSE) — free to use, modify, and distribute, including commercially.
