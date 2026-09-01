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
   http://localhost:3000/demo — the count rises to 20 as the storefront
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
7. `npm run eval:webmcp` regenerates `docs/evidence/webmcp-transport-trace.json`
   and `public/eval-results.json`.

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