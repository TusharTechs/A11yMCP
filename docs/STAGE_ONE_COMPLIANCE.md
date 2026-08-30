# Stage One Compliance Checklist (pass/fail viability)

Status key: ✅ done · ⏳ pending human runbook · 🧪 code ready, awaiting run

- [x] Actual `document.modelContext.registerTool(...)` (current API; `navigator.modelContext` not used)
- [x] Non-trivial WebMCP workflow (discovery → audit → negotiation → approval → remediation → verification → commerce)
- [🧪] WebMCP tools discoverable in supported browser (`getTools()` chain verifier implemented; Runbook A)
- [🧪] WebMCP tools executable in supported browser (`executeTool()` chain verifier; Runbook A)
- [🧪] Live project behaves as described (Playwright golden + negative specs; run `npm run test:e2e`)
- [x] No secret credentials required for basic judging (zero env vars required)
- [x] Production build has no blocking errors (`npm run build`; Runbook C re-check on deploy)
- [⏳] Public working HTTPS URL (Runbook C)
- [⏳] Repository publicly accessible (Runbook C)
- [x] Open-source license present (MIT, repo root; set visible in GitHub About in Runbook C)
- [⏳] All required source/assets/instructions present (README in P1 batch; instructions already in docs/)
- [⏳] Demo video < 3 minutes and explicitly demonstrates WebMCP (final phase)
- [x] Testing instructions provided (docs/VERIFICATION_RUNBOOKS.md)

## Hard gate

A11yMCP is not "Grand Prize ready" until every box is ✅ and the evidence
files under docs/evidence/ are populated from real runs.