# A11yMCP Adapter Contract

Status: prototype convention. NOT an official standard.

The adapter is site-owned code that applies manifest directives. Rules:

1. The site adapts ITSELF. The agent never receives arbitrary DOM access.
2. Only manifest directives may be applied; no invented fixes.
3. Every application is logged with before/after audit counts and an
   evidence chain (before → why → action → after → verification).
4. Every application is reversible (rollback_all_remediations).
5. Approval-gated tools reject missing or false approval at the schema level.
6. Verification is site-provided and task-scoped; it is evidence, not
   WCAG or legal certification.