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
- [ ] Demo video < 3 minutes, YouTube, with audio, explicitly demonstrating
      WebMCP. **Not yet recorded.** Script: `docs/VIDEO_SCRIPT.md`.
- [~] Third-party recorded agent transcript (ChatGPT in-app browser / Chrome
      with a native WebMCP agent). **Optional supplementary evidence, not yet
      captured** — see `docs/evidence/external-agent-transcript.md`. The
      primary transport evidence is the reproducible chain trace above.

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
- `docs/evidence/external-agent-transcript.md` — optional, pending

## Honest status

Stage One functional requirements are met: real `document.modelContext`
registration and execution, a non-trivial workflow, a public repo and
deployed URL, and passing automated suites. Two submission items are still
outstanding and are tracked openly above: the demo video, and an optional
third-party agent transcript. Neither is faked or pre-claimed.
