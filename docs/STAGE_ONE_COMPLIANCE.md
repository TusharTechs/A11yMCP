# Stage One Compliance Checklist (pass/fail viability)

Status key: [x] done · [~] partial · [ ] pending

- [x] Actual `document.modelContext.registerTool(...)` (current API; the
      deprecated `navigator.modelContext` is never used). When the browser
      has no native implementation, A11yMCP installs a spec-compatible
      `document.modelContext` polyfill (`lib/webmcp/polyfill.ts`) so the same
      code path runs in every environment; native wins automatically when
      present.
- [x] Non-trivial WebMCP workflow (discovery → audit → negotiation →
      approval → remediation → verification → commerce)
- [x] Tools discoverable via `document.modelContext.getTools()` and
      executable via `document.modelContext.executeTool()` — exercised by the
      /inspector "chain verification" panel and by
      `tests/eval/transport-trace.spec.ts`, which writes a captured trace to
      `docs/evidence/webmcp-transport-trace.json`.
- [x] Tools return **MCP tool results**: `content: [{ type: "text", text }]`
      plus `structuredContent` and `isError`. Asserted in the transport trace
      (`resultsAreMcpShaped`, `errorsFlagIsError`) and in
      `tests/unit/mcp-envelope.test.ts`.
- [x] Conformance with a **native** implementation, not just the polyfill:
      `registerTool(def, { signal })` is awaited and torn down by aborting the
      signal (the spec's only defined unregistration path — there is no
      `unregisterTool`), and `executeTool` is called as
      `(toolDescriptor, jsonString, { signal })` with the `(name, object)`
      form retried only on an argument-shape error. Proved by
      `tests/unit/native-conformance.test.ts`, which drives the app through a
      strict stand-in that implements *only* the spec surface, and by the
      `descriptorAndJsonStringAccepted` assertion in the transport trace.
      The stand-in's call and return shapes were additionally checked against
      the signatures in the shipping Chrome 152 binary, which is how a
      return-type mismatch was found: native `executeTool` resolves a JSON
      *string*, not an object. Fixed; the stand-in now serializes the same way.
- [x] `Permissions-Policy: tools=(self)` sent on every route (Chrome gates
      both WebMCP APIs behind it). A Chrome 149 origin-trial token can be
      supplied via the `WEBMCP_ORIGIN_TRIAL_TOKEN` build-time env var so the
      deployed site works in stable Chrome without a flag. See
      `next.config.ts`.
- [x] Task-scoped tool lifecycle: 15 core tools are always registered; the 5
      commerce tools register only while a storefront is mounted and are
      unregistered on unmount (emits `toolchange`). The declarative
      `<form toolname>` is picked up as a 21st tool on `/demo`.
- [x] Decoupled adoption proof: `public/a11ymcp-adapter.js` (framework-free)
      makes a plain static page (`public/partner/index.html`, not rendered by
      this app) agent-adaptable via `<link rel="a11ymcp-manifest">` + one
      `<script>`. Covered by `tests/e2e/adapter.spec.ts`.
- [x] **Cross-origin tool access**, the deepest part of the spec: a widget in
      an iframe sandboxed without `allow-same-origin` (an opaque origin, so
      `postMessage` is the only channel) registers three tools and exposes
      two with `registerTool(def, { exposedTo })`. The embedder holds
      `allow="tools"`, sees 2 of 3, and is refused by name — with a reason —
      when it asks for the third. Reconfigure the widget to trust another
      origin and it stops answering. `lib/webmcp/federation.ts`,
      `public/tool-frame.html`, `tests/e2e/cross-origin.spec.ts`,
      `tests/unit/federation.test.ts`.
- [x] **Declarative API in full**: form schemas are derived from the markup
      (input types and formats, select/radio enums, numeric bounds,
      `required`) with per-field descriptions from `toolparamdescription`,
      falling back to the label, `aria-description`, then the placeholder.
      `toolautosubmit` is honoured: without it a tool fills the form and
      stops. The partner page uses both cases deliberately — search
      autosubmits, placing an order does not.
- [x] Manifest served independently at `/.well-known/a11ymcp` (and
      `/api/a11ymcp-manifest`).
- [x] A judge can see the whole thesis in sixty seconds without reading
      anything: `/demo?judge=1` is one button and a live eight-step
      checklist, with the transport and tool count stated up front and a
      copy-paste prompt for driving it with their own agent. Covered by
      `tests/e2e/judge-mode.spec.ts`.
- [x] The WebMCP-vs-actuation comparison is *run*, not replayed: the
      side-by-side proof executes both lanes live against the same fixture.
      The actuation lane really walks the tab order and really injects the
      tabindex it was never authorized to inject (and undoes it), so the
      `unauthorized mutations` counter on screen is measured, not asserted.
- [x] Remediation tools cannot hang in a hidden or backgrounded tab.
      `requestAnimationFrame` does not fire there, and remediation awaits a
      render before it re-audits — so every `repair_*` tool used to hang
      forever, silently, whenever the page was not the foreground tab (which
      is exactly how an agent in a side panel or a background tab would find
      it). Fixed with a timer fallback; pinned by
      `tests/unit/background-tab.test.ts`.
- [x] Live project behaves as described (Playwright golden + negative specs
      pass; run `npm run test:e2e`)
- [x] No secret credentials required for basic judging (zero env vars)
- [x] Production build has no blocking errors (`npm run build` clean; `npm run lint` clean)
- [x] Public working HTTPS URL (https://a11ymcp.vercel.app)
- [x] Repository publicly accessible (GitHub, MIT license)
- [x] Open-source license present (MIT in repo root)
- [x] All required source/assets/instructions present (README, LICENSE, docs/)
- [x] Testing instructions provided (docs/VERIFICATION_RUNBOOKS.md)
- [x] Demo video < 3 minutes, YouTube, with audio, explicitly demonstrating
      WebMCP: https://youtu.be/p1m6QgeKI6c — 2:59, narrated. Every interaction is
      driven by `docs/direct-demo.mjs`, so the run is reproducible.
- [x] Third-party recorded agent transcript (ChatGPT in-app browser / Chrome
      with a native WebMCP agent). **Captured 2026-09-02**: ChatGPT's desktop-app browser
      discovered all 20 tools unprompted, called
      `get_accessibility_capabilities` first, rejected `high_contrast` twice
      quoting the manifest reason, and reported making no changes the site had
      not offered. It also reported five issues against the project, one of
      which was a real bug (empty-profile PASS, fixed in `789923d`). Pasted
      unedited in `docs/evidence/external-agent-transcript.md`.


## Evidence files

- `docs/evidence/webmcp-transport-trace.json` — captured
  registerTool → getTools → executeTool chain, including MCP-shaped results
  and the native `(descriptor, jsonString)` call shape (regenerate with
  `npm run eval:webmcp`)
- `tests/unit/native-conformance.test.ts` — the app driven through a strict
  native `document.modelContext` (`npx vitest run tests/unit/native-conformance.test.ts`)
- `public/eval-results.json` — measured WebMCP-vs-actuation benchmark
- `docs/evidence/deployment.md` — deployed URL + commit hash
- `docs/VERIFICATION_RUNBOOKS.md` — manual verification instructions
- `docs/evidence/external-agent-transcript.md` — a ChatGPT desktop-browser
  run against the deployed site, pasted unedited (2026-09-02)

## Honest status

Stage One functional requirements are met: real `document.modelContext`
registration and execution, a non-trivial workflow, a public repo and
deployed URL, passing automated suites, a published demo video, and a
third-party agent transcript.

The ChatGPT run went through the browser's **native**
`document.modelContext` — the agent read the transport badge back as
`transport: native document.modelContext`, and the tool count corroborates
it. So the tools have now been exercised by a third-party agent over a real
native implementation, not only through the polyfill.

What is still **not** claimed: `docs/evidence/webmcp-transport-trace.json` is
a Playwright capture and correctly reports the polyfill, because Chromium has
no WebMCP flag; it is not evidence about native. And the declarative-form fix
that run produced (`d7d97dd`) has not itself been re-verified against a
native browser yet.

The ChatGPT run also reported that it sent `approval: true` without
separately asking the human first. That is a genuine limitation of the trust
model rather than a defect in this code: a schema can require the literal, it
cannot require that a person meant it. It is recorded rather than smoothed
over.
