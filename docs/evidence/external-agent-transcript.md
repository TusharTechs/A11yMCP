# External Agent Transcript

A recording of a **third-party** agent driving A11yMCP through its WebMCP
tools — not the site's own guided agent, and not a script.

> **Status: _(update this line when you paste a run below)_**
>
> Nothing elsewhere in the repo should claim this transcript exists, or that
> "an external agent discovered N tools", until a real dated run is pasted
> into this file. Until then the load-bearing transport evidence is
> `docs/evidence/webmcp-transport-trace.json`, the `/inspector` chain panel,
> and `tests/unit/native-conformance.test.ts`.

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

**Date:**
**Client / model:**
**Transport chip reported:**

### Tools discovered

_(paste)_

### Transcript

_(paste verbatim)_

### Observations

- Did it discover the tools unprompted?
- Did it report `high_contrast` as unsupported rather than working around it?
- Did it wait for approval before changing the page?
- Did it change anything the site had not offered?
- Did the purchase complete?

---

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
