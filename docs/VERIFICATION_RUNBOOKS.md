# Verification Runbooks

Run in order. Record outputs into docs/evidence/.

## Runbook A — chain verification (any browser)

Works with or without native WebMCP: without it, A11yMCP installs a
spec-compatible `document.modelContext` polyfill; with it (current Chrome
build, flag/origin trial as required), the native implementation is used and
the inspector banner says "Native document.modelContext detected".

1. `npm run build && npm run start` (production build, localhost).
2. Open http://localhost:3000/inspector.
3. Confirm the transport banner and that
   `document.modelContext.getTools()` lists the core tools (15). Open
   http://localhost:3000/demo — the count rises to 21 (20 imperative + the
   declarative `submit_accessibility_preferences` form) as the storefront
   registers task-scoped commerce tools; navigate away and it drops back.
4. Click "Run chain verification". Required results:
   - registerTool → getTools: PASS
   - read tool via executeTool: PASS
   - invalid input rejection: PASS
   - consequential gate: PASS
   - cancellation: PASS
   - approval-gated remediation: PASS or NA (fixture lives on /demo)
6. Open http://localhost:3000/demo in the same browser and re-run chain
   verification; approval-gated remediation must now PASS.
7. In the console, confirm results are MCP-shaped:

   ```js
   const mc = document.modelContext;
   const tool = (await mc.getTools()).find(t => t.name === "get_accessibility_capabilities");
   // the native call shape: a tool descriptor plus JSON-encoded arguments
   await mc.executeTool(tool, JSON.stringify({}));
   // -> { content: [{ type: "text", text: "…" }], structuredContent: { ok: true, data: {…} }, isError: false }
   ```

8. `npm run eval:webmcp` regenerates `docs/evidence/webmcp-transport-trace.json`
   and `public/eval-results.json`.

## Runbook A2 — native-implementation conformance (no browser needed)

The polyfill is forgiving, so it cannot prove the app works against a real
implementation. This suite drives register → discover → execute → unregister
through a strict stand-in that implements only the spec surface (a
promise-returning `registerTool`, no `unregisterTool`, and an `executeTool`
that accepts only a tool descriptor plus a JSON string):

```bash
npx vitest run tests/unit/native-conformance.test.ts
```

Also confirm the Permissions Policy ships (Chrome gates both WebMCP APIs
behind it):

```bash
curl -sI http://localhost:3000/demo | grep -i permissions-policy
# Permissions-Policy: tools=(self)
```

For stable Chrome without a flag, set `WEBMCP_ORIGIN_TRIAL_TOKEN` in the
**build** environment (Next.js evaluates `headers()` at build time) and an
`Origin-Trial` header is sent alongside it.

If registration silently fails, fix types/webmcp.d.ts + lib/webmcp/runtime.ts
+ lib/webmcp/polyfill.ts only (isolated by design) and re-run.

## Runbook B — ChatGPT in-app browser (OPTIONAL, native-WebMCP agent)

Optional supplementary evidence — not a dependency of any claim. See
`docs/evidence/external-agent-transcript.md` for the runbook and status.
Only meaningful in a browser that ships *native* WebMCP (so the native
`document.modelContext` is exercised, not the polyfill).

## Runbook C — Deployment and repository

1. Create public GitHub repo; push all commits; set MIT license visible in About.
2. Deploy to Netlify (hackathon credits) or Vercel free tier; confirm HTTPS.
3. From a clean browser profile: load `/`, `/demo`, `/inspector`;
   zero console errors; golden path completes.
4. Record URL + commit hash in docs/evidence/deployment.md.

## Runbook D — Automated suites

- `npm run test` (unit: schemas, names, audits, negotiation, security negatives)
- `npm run test:e2e` (golden path + negatives incl. repeated order)