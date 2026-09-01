# Accessibility Methodology

A11yMCP measures **whether a specific person can complete a specific task on
this page right now** — not WCAG conformance, and not a violation count. This
document states exactly what the engine checks, how it classifies findings,
where the checks are approximations, and how to validate the output with a
real screen reader.

## What is and isn't claimed

- **Not** a WCAG or ADA conformance engine. No success-criterion mapping, no
  "compliant" claim.
- **Not** a replacement for testing with disabled users and assistive
  technology.
- **Is** a deterministic, task-scoped runtime probe whose output is a piece
  of evidence: "for the negotiated profile, these task-blocking barriers are
  present / were removed."

## Task-impact taxonomy

Every finding carries `taskImpact`, relative to the active task (a
keyboard-driven checkout in the demo). Classifications live in
[`lib/accessibility/audits.ts`](../lib/accessibility/audits.ts) (`IMPACT_BY_RULE`).

| Impact | Meaning | Examples in the demo |
|---|---|---|
| `blocking` | the task cannot be completed by the affected user | interactive control not focusable; no visible focus; form field with no programmatic label; error text not associated with its field |
| `degrading` | the task is completable but materially harder | control with a weak/absent accessible name; positive `tabindex` |
| `informational` | no task impact for this profile; recorded for context | motion not reduced, when the user did not request reduced motion |

`verify_accessibility_profile` gates `PASS` / `BLOCKED` **only** on `blocking`
findings **inside the negotiated profile**. Everything else is returned in
`advisories` — visible, never hidden, never counted as "fixed."

## The audits

| Audit | Detects | Method |
|---|---|---|
| `audit_keyboard_navigation` | interactive elements not in the tab order; positive `tabindex` | role/tag detection + `tabindex` inspection |
| `audit_accessible_names` | interactive controls with an empty accessible name | a subset of the accname algorithm: `aria-label` → `aria-labelledby` → associated `<label>` → text content → `value` |
| `audit_form_associations` | fields with no label; placeholder-as-label; error text present but not referenced by `aria-describedby` | DOM relationship checks |
| `audit_focus_visibility` | focusable controls with no visible focus indicator | **runtime proxy** — see below |

### The focus-visibility probe is an approximation

`audit_focus_visibility` calls `.focus()` on each focusable element and reads
computed `outline` / `box-shadow`. This catches the common failure
(`outline: none` with no replacement) but it is a proxy, not ground truth: it
does not evaluate contrast of the indicator, `:focus-visible`-only styles
that depend on input modality, or indicators drawn by a parent/pseudo
element. It is labelled as a proxy everywhere it is surfaced.

## Negotiation and honesty

A need with no declared capability is `rejected` with a reason
([`negotiation.ts`](../lib/accessibility/negotiation.ts)). A capability the
site declares `partial` is accepted **with its stated `limitation`** attached
to every downstream result. `repair_reduced_motion` on a site that does not
declare `reduced_motion` returns `success: false` with an evidence chain —
not a silent no-op.

## Remediation is site-declared

The engine never invents a fix. `applyRemediation`
([`remediation.ts`](../lib/accessibility/remediation.ts)) applies only the
directives the manifest lists for a capability, records
`before → why → action → after → verification`, and registers an undo for
every change. The `a11ymcp-adapter.js` on the partner page follows the same
rule with a small applicable-directive format (`setAttr`, `addClass`,
`bindKeys`, `labelFromPlaceholder`, `announceErrors`).

## What the adapted DOM emits for assistive technology

The adaptations are ARIA/DOM changes that are directly inspectable:

| Capability | After adaptation, the page has |
|---|---|
| `accessible_names` | `aria-label` on the previously-unnamed control |
| `keyboard_navigation` | `tabindex="0"` + arrow/Enter/Space handlers on the `radiogroup` options |
| `form_association` / `form_labels` | `<label for>` or `aria-label` on each field; `aria-describedby` + `role="alert"` wiring the error text |
| `focus_management` / `focus_visibility` | a visible `outline` on `:focus` within the fixture |
| `reduced_motion` | `data-motion="reduced"` on the root; animations disabled |

## AT-testing runbook (manual)

Reduce reliance on the runtime proxy by confirming with a real screen reader.

1. `npm run build && npm run start`, open `/demo`.
2. **VoiceOver (macOS):** ⌘F5. **NVDA (Windows):** launch NVDA.
3. Before adaptation, in the "Original experience" column, try to:
   - Tab to the size selector — it is skipped.
   - Focus the wishlist icon button — it announces only "button".
   - Tab into checkout — fields announce only their placeholder or "edit text".
4. Run **Keyboard-only checkout**, approve.
5. In the "Adapted experience" column, repeat:
   - The size options are now reachable and arrow-navigable; each announces
     its label and checked state.
   - Focus is visible throughout.
6. Run **Screen reader checkout** and confirm the checkout fields now
   announce their labels and that a submitted error is announced via the
   live region.
7. Record findings (SR + version, what was and wasn't improved) below.

### Recorded runs

_(pending — add dated notes here after a manual pass)_
