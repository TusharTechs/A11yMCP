# Stage One Compliance Checklist (pass/fail viability)

Status key: ✅ done · ⏳ pending

- [x] Actual `document.modelContext.registerTool(...)` (current API; `navigator.modelContext` not used)
- [x] Non-trivial WebMCP workflow (discovery → audit → negotiation → approval → remediation → verification → commerce)
- [x] WebMCP tools discoverable in supported browser (ChatGPT in-app browser discovered all 19 tools — see `docs/evidence/external-agent-transcript.md`)
- [x] WebMCP tools executable in supported browser (same transcript; every tool executed with structured results)
- [x] Live project behaves as described (Playwright golden + negative specs pass; run `npm run test:e2e`)
- [x] No secret credentials required for basic judging (zero env vars required)
- [x] Production build has no blocking errors (`npm run build` clean; verified on deployed URL)
- [x] Public working HTTPS URL (https://a11ymcp.vercel.app)
- [x] Repository publicly accessible (GitHub public repo with MIT license visible in About)
- [x] Open-source license present (MIT in repo root; visible in GitHub About)
- [x] All required source/assets/instructions present (README, LICENSE, docs/, evidence/)
- [⏳] Demo video < 3 minutes and explicitly demonstrates WebMCP (final phase)
- [x] Testing instructions provided (docs/VERIFICATION_RUNBOOKS.md)

## Evidence files

- `docs/evidence/external-agent-transcript.md` — real ChatGPT in-app browser run
- `docs/evidence/deployment.md` — deployed URL + commit hash
- `docs/VERIFICATION_RUNBOOKS.md` — manual verification instructions

## Hard gate

A11yMCP is "Stage One compliant." The only remaining item is the <3-minute
demo video, which will be produced in the final submission phase.

All core requirements are met:
- Real WebMCP tools registered and discoverable in a judging environment
- External agent successfully discovered, selected, and executed tools
- Task completion verified end-to-end
- Public repo with MIT license
- Deployed HTTPS URL
- Automated test suites passing
- Zero external dependencies or secrets