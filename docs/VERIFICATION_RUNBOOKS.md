# Verification Runbooks

Run in order. Record outputs into docs/evidence/.

## Runbook A — Chrome with WebMCP enabled

1. Use a current Chrome build with WebMCP enabled (per current Chrome/WebMCP
   docs: flag or origin trial as presently required).
2. `npm run build && npm run start` (production build, localhost).
3. Open http://localhost:3000/inspector.
4. Confirm the "WebMCP runtime" section shows
   `Browser-visible tools: 20` (19 imperative + 1 declarative where supported)
   and NOT the "WebMCP unavailable" fallback.
5. Click "Run chain verification". Required results:
   - registerTool → getTools: PASS
   - read tool via executeTool: PASS
   - invalid input rejection: PASS
   - consequential gate: PASS
   - cancellation: PASS
   - approval-gated remediation: PASS or NA (fixture lives on /demo)
6. Open http://localhost:3000/demo in the same browser and re-run chain
   verification; approval-gated remediation must now PASS.
7. In DevTools console, verify directly:
   `await document.modelContext.getTools()` lists A11yMCP tools.
8. Save screenshots + console output to docs/evidence/chrome-webmcp/.

If registration silently fails, fix types/webmcp.d.ts + lib/webmcp/runtime.ts
only (isolated by design) and re-run.

## Runbook B — ChatGPT in-app browser (external real agent)

1. Deploy per Runbook C first (HTTPS required).
2. In the ChatGPT desktop app, open the deployed URL in the in-app browser.
3. Give the agent exactly this request:
   "I can only use a keyboard. Please help me buy the NOMA Runner shoes on
   this website. Use the website's WebMCP tools if it exposes them."
4. Record: discovered tools, selected tools, arguments, results, failures,
   retries, final outcome.
5. Save the sanitized transcript to docs/evidence/external-agent-transcript.md
   (template provided). Do not fabricate; if the agent fails, fix
   descriptions/schemas and re-run.
6. Repeat once with the low-vision request to capture the honest-rejection
   behavior ("high contrast" must be reported unsupported).

## Runbook C — Deployment and repository

1. Create public GitHub repo; push all commits; set MIT license visible in About.
2. Deploy to Netlify (hackathon credits) or Vercel free tier; confirm HTTPS.
3. From a clean browser profile: load `/`, `/demo`, `/inspector`;
   zero console errors; golden path completes.
4. Record URL + commit hash in docs/evidence/deployment.md.

## Runbook D — Automated suites

- `npm run test` (unit: schemas, names, audits, negotiation, security negatives)
- `npm run test:e2e` (golden path + negatives incl. repeated order)