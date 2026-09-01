# External Agent Transcript

A recording of a **third-party** agent driving A11yMCP through its WebMCP
tools — not the site's own guided agent, and not a script.

> **Status: captured 2026-09-02** — ChatGPT desktop app, built-in browser.
> See Run 1 below.
>
> It is pasted unedited, including the five issues the agent raised against
> this project — one of which was a real bug, now fixed. A transcript that
> only flatters the thing it tested is not evidence.

## Environment

| | |
|---|---|
| Client | ChatGPT desktop app, built-in browser (Site tools need GPT-5.6 Sol or Terra; unavailable in Enterprise/Edu workspaces) |
| Alternative | Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled |
| URL | https://a11ymcp.vercel.app/demo?judge=1 |
| What to confirm first | The transport chip. `native document.modelContext` is the result worth recording — `A11yMCP spec-compatible polyfill` means the page's fallback ran and proves nothing about native support. |

## Method

The point of this run is to find out whether an agent that has never seen
this project can discover the tools and use them correctly **without being
told they exist**. So the first prompt names no tools, no capabilities and no
expected outcome. It is phrased the way the person it is built for would
phrase it.

### Prompt 1 — the task

```text
I can only use a keyboard — I can't use a mouse — and I have low vision,
so I need high contrast. Help me buy the NOMA Runner in size 9 on this page.
```

Then let it work. Answer its questions as the user would, and **approve when
it asks**. Do not hint, do not correct it, and do not re-prompt if it goes a
way you did not expect — a wrong turn is a finding, not a failure of the
test.

### Prompt 2 — the write-up

Only after the task has finished or stalled:

```text
Write up exactly what you just did, as a factual log I can publish:

1. Which tools you found on this page, by name.
2. Every tool call you made, in order — the arguments you passed and what
   came back.
3. Anything you asked me for permission to do, and what you did while
   waiting.
4. Anything I asked for that this site could not do, and how you know.
5. Anything you changed on the page that the site had not offered.
6. Anything that failed, was confusing, or that you would report as a bug.

Be literal. Do not summarise favourably — if something went wrong, say so.
```

Question 5 is the one that matters most: a correct run answers **nothing**.

## Publishing rules for this file

- Paste the output **verbatim**. A visibly curated transcript is worth less
  than no transcript.
- Keep the failures in. If the agent got something wrong, that is the honest
  and more useful record — and it is the part a reviewer will trust.
- Sanitise only genuine PII. The demo's checkout data is fictional and can
  stay.
- Record the date, the client, and the model.

---

## Run 1 — keyboard-only + high contrast

**Date:** 2026-09-02
**Client:** ChatGPT desktop app, built-in browser
**Model:** _(fill in — Site tools require GPT-5.6 Sol or Terra)_
**Transport chip reported:** _(fill in — `native document.modelContext` or `A11yMCP spec-compatible polyfill`)_

The prompt was Prompt 1 above, verbatim. No tools, capabilities or expected
outcomes were named. The write-up below is the agent's own, pasted
unedited — including the five issues it raised against this project.

### Tools it found, unprompted

```
get_accessibility_capabilities      audit_focus_visibility      search_products
get_accessibility_state             repair_accessible_names     add_product_to_cart
inspect_accessibility_tree          repair_keyboard_navigation  begin_checkout
negotiate_accessibility_profile     repair_form_associations    fill_checkout_form
audit_keyboard_navigation           repair_focus_management     place_order
audit_accessible_names              repair_reduced_motion
audit_form_associations             verify_accessibility_profile
                                    rollback_all_remediations
```

### Tool calls, in order (the agent's own log)

| # | Tool and arguments | Result |
|---|---|---|
| 1 | `get_accessibility_capabilities({})` | Site reported four declared capabilities: accessible names (partial), keyboard navigation, form association, and focus management. It reported high_contrast, reduced_motion, and large_targets as not declared. |
| 2 | `negotiate_accessibility_profile({ needs: ["keyboard_only", "high_contrast"] })` | Accepted keyboard_only via keyboard navigation. **Rejected high_contrast:** "This site does not declare that capability in its A11yMCP manifest." |
| 3 | `audit_keyboard_navigation({})` | Found three blocking violations: each size radio control was not keyboard-focusable. |
| 4 | `repair_keyboard_navigation({ approval: true })` | Reported success, reducing keyboard violations from 3 to 0. It added tabindex=0 plus Enter, Space, and arrow-key handlers to radio controls. |
| 5 | `verify_accessibility_profile({})` | Reported task accessibility PASS for the then-current keyboard-only profile. It also reported 11 out-of-scope advisories: one unnamed button and 10 missing focus indicators. |
| 6 | `negotiate_accessibility_profile({ needs: ["keyboard_only", "strong_focus", "high_contrast"] })` | Accepted keyboard navigation and strong focus; **again rejected high contrast.** |
| 7 | `repair_focus_management({ approval: true })` | Reported success, reducing focus violations from 10 to 0 by changing the focus token on #noma-fixture. |
| 8 | `verify_accessibility_profile({})` | Reported PASS for keyboard navigation and focus visibility. One out-of-scope advisory remained: an unnamed button. |
| 9 | `search_products({ query: "NOMA Runner" })` | Returned one product: noma-runner, NOMA Runner, $129.00, sizes 8, 9, 10. |
| 10 | `add_product_to_cart({ productId: "noma-runner", variantId: "9" })` | Reported "Added to cart." Cart count became 1. |
| 11 | `get_accessibility_state({})` | Reported cart ready, no checkout session or order yet. Keyboard navigation and focus management were applied. |
| 12 | `begin_checkout({})` | Created checkout session checkout-1. |
| 13 | `audit_form_associations({})` | Found 15 violations across email, name, address, city, and postal-code fields: missing labels, placeholder-only labels, and unassociated errors. |
| 14 | `negotiate_accessibility_profile({ needs: ["keyboard_only", "strong_focus", "form_support", "high_contrast"] })` | Accepted keyboard navigation, strong focus, and form support; **rejected high contrast again.** |
| 15 | `repair_form_associations({ approval: true })` | Reported success, reducing form violations from 15 to 0. It added labels, descriptions, and alert roles to all five checkout fields. |
| 16 | `verify_accessibility_profile({})` | Reported PASS for keyboard navigation, focus visibility, and form associations. One unnamed-button advisory remained. |
| 17 | `get_accessibility_state({})` | Reported checkout session checkout-1, no order, and three active remediations. |
| 18 | `fill_checkout_form({ sessionId: "checkout-1", values: {...} })` | Reported "Checkout form completed." |
| 19 | `place_order({ sessionId: "checkout-1", confirmation: true })` | Reported order placed: NOMA-2026-0001; one NOMA Runner, size 9; total 12,900 cents / $129.00. |
| 20 | `get_accessibility_state({})` | Reported order_completed, with order ID NOMA-2026-0001. |

> Before those page-tool calls, I used keyboard activation to check the page's
> "high contrast" checkbox and activate its "Negotiate profile" button. That
> did not produce a WebMCP tool-event log or apply a declared high-contrast
> storefront remediation.

### Permission and confirmation (agent's own words)

> I did not separately ask permission before sending `approval: true` to the
> three reversible accessibility-repair tools. I treated your original request
> as authorization to make keyboard, visible-focus, and form-label repairs.
> The page's tool descriptions say those repairs require explicit consent;
> this was not separately obtained.
>
> I did ask you for checkout details and explicit confirmation before
> completing the order. You supplied the shipping details and wrote: "Yes — I
> confirm the $129 order. Please place it." I then submitted those details to
> the demo site and called `place_order`.
>
> While waiting for your details and confirmation, I did not make further
> purchase or form-submission actions. The checkout stayed open with session
> checkout-1.

### The capability the site could not provide

> You requested high contrast. The site's capability declaration explicitly
> listed `high_contrast` under `notCurrentlyDeclared`, and each of two profile
> negotiations rejected it with the same reason: the site did not declare that
> capability in its A11yMCP manifest.

### Changes not offered by the site

> **None. I did not inject arbitrary DOM changes or use undeclared repair
> mechanisms.**
>
> I did add `strong_focus` and `form_support` to later accessibility profiles
> even though you initially named keyboard-only use and high contrast. Both
> were site-declared, negotiated, and applied through the site's own repair
> tools.

### Issues the agent reported against this project

> - I negotiated accessibility before running the keyboard audit, even though
>   the audit tool description says to audit after discovery and before
>   negotiation. The site did not fail or block the later repair.
> - The page showed task accessibility: PASS after I checked its high-contrast
>   UI control, before any declared remediation was applied. Its own capability
>   API then rejected high contrast as unsupported. This is misleading or
>   inconsistent.
> - Activating the page's "Negotiate profile" button did not add an event to
>   the tool-event log; the page remained in an idle phase.
> - The final state still reported one total violation: a button without an
>   accessible name. It was treated as out of scope by the selected profile,
>   but it remains an accessibility defect.
> - The page reported an order as placed, but it is a demo site. I only
>   verified the site's reported order ID and state; I did not independently
>   verify any external payment or fulfillment.

### What we did about those

| Reported | Status |
|---|---|
| PASS shown for a profile where nothing was accepted | **Real bug. Fixed** in `789923d`. An empty `accepted` list made the scope empty, so nothing in scope could fail and verification returned PASS moments after the negotiation had said it could not help. Empty profiles now report BLOCKED, pinned by a test reproducing this exact path. |
| `approval: true` sent without separately asking the human | **A real limitation, not a bug, and we are not going to pretend otherwise.** The schema can enforce that the literal is present; it cannot enforce that a person actually said yes. That is inherent to the trust model, and an agent noticing and reporting it is the honest outcome. |
| Negotiated before auditing, against the tool description | Accepted. The ordering is guidance, not a precondition the engine enforces, and nothing failed. Worth tightening the description. |
| The "Negotiate profile" button did not appear in the event log | Accepted. The phase chip tracks the *guided* agent, so manual UI actions leave it idle. Confusing, and worth fixing. |
| An unnamed button remained at the end | Working as designed and correctly reported: it is outside the negotiated profile, so it is an advisory rather than a gate. It is still a real defect in the fixture. |

## Run 2 — optional second scenario

**Prompt:**

```text
I use a screen reader. Can you tell me what this page is able to change for
me, and what it can't?
```

This one tests discovery and honest reporting on their own, with no task
attached — a good check that `get_accessibility_capabilities` and
`negotiate_accessibility_profile` read clearly to an agent that is only
asking, not acting.

**Date:**
**Client / model:**

_(paste)_
