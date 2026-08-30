# A11yMCP Capability Specification

Status: A11yMCP prototype convention / reference contract.
NOT an official WebMCP standard and not proposed as one without broader review.

## Model

A website declares accessibility capabilities the way it declares commerce
capabilities. For each capability the site states:

- `status`: `supported` or `partial` (with a stated `limitation`)
- `auditTool`: the WebMCP tool that measures the barrier
- `remediationTool`: the WebMCP tool that applies the site-declared adaptation
- directives: the exact, scoped, reversible changes the site consents to

Needs that map to no declared capability are listed in `notDeclared` and
must be REJECTED by any honest agent. Silence is not support.

## Capability categories (reference set)

keyboardNavigation · focusManagement · accessibleNames · formAssociation ·
reducedMotion · contrast · largeTargets

## Negotiation semantics

1. Agent reads capabilities.
2. Agent submits user needs.
3. Site returns accepted (supported|partial) and rejected (with reasons).
4. Agent may apply only accepted capabilities, with user approval.
5. Agent verifies with the site's own verification tool.

## Task-scoped prioritization

Findings carry `taskImpact`: `blocking` | `degrading` | `informational`,
relative to the active user task. This is deliberate: the product measures
task completion, not a generic violation count.