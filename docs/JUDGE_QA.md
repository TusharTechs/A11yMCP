# Final Judge Q&A (evidence-backed)

## Chrome/WebMCP engineer — "Why is WebMCP necessary?"
Because the demonstrated behaviors require a declared contract: capability
discovery (get_accessibility_capabilities), site consent (approval-gated
remediation), declared verification, and honest rejection of unsupported
needs. The benchmark (public/eval-results.json) shows actuation cannot
discover support, cannot verify, and mutates without consent
(unauthorized_mutations > 0), while WebMCP does all four. Chain verification
panel proves registerTool → getTools → executeTool in a real browser.

## Agent engineer — "Can an independent agent use the tools?"
Yes. docs/evidence/external-agent-transcript.md records a real ChatGPT
in-app browser run: the agent discovered all tools, chose its own need set,
self-corrected via verification feedback, and paused for human confirmation.
Tool descriptions are agent-first (when/when-not/preconditions/failure
recovery) and pass the eval:tools scorecard.

## Accessibility expert — "Are the claims responsible?"
Yes. No WCAG/ADA compliance claims. Task-scoped audits with blocking/
degrading/informational tagging; documented focus-probe methodology;
partial capabilities carry limitations; the product itself is keyboard
operable with visible focus, landmarks, live regions, reduced motion.

## Product leader — "Who would adopt this?"
Sites where task completion matters and adaptation is brand-safe:
e-commerce, banking, government, education, healthcare. Adoption path in
docs/FOR_WEBSITE_OWNERS.md; the contract keeps sites in control.

## Security engineer — "What prevents unsafe agent actions?"
No arbitrary DOM/JS tools; strict schemas (additionalProperties:false);
approval literal on remediation; confirmation literal on orders; rollback;
repeated-order rejection; stale-state rejection with nextAction hints;
everything logged. Negative proofs in tests/unit/security.test.ts and e2e.

## Hackathon judge — "Why does this beat other WebMCP projects?"
Strongest idea (capability negotiation), strongest implementation (20 real
tools, both APIs, lifecycle, cancellation), strongest evidence (external
agent transcript + reproducible benchmark + full test suites), and a
complete human story (blocked task → adapted site → completed purchase).