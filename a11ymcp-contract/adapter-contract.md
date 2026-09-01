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
7. Tools return **MCP tool results**, because WebMCP tools are MCP tools:

   ```jsonc
   {
     "content": [{ "type": "text", "text": "<one-line outcome for the model>" }],
     "structuredContent": { "ok": true, "data": { /* machine payload */ } },
     "isError": false
   }
   ```

   The text block is what an agent reads; `structuredContent` carries the
   payload for programmatic callers. Failures set `isError: true` and put the
   reason — with a `nextAction` recovery hint where one exists — in both.
8. Tools accept their arguments as either a JSON string or an object: a
   native implementation calls `executeTool(toolDescriptor, jsonString)`.
   Coerce before validating.
9. Registrations are torn down by aborting the `AbortSignal` passed to
   `registerTool(definition, { signal })`. Do not depend on a returned handle
   or on `unregisterTool` — neither is in the spec.
10. Cross-origin exposure is **default-deny and per tool**. A tool with no
    `exposedTo` is same-origin only; naming an origin in
    `registerTool(def, { exposedTo: [...] })` is the only way to share one.
    An embedder that asks for a tool it was not given must be **refused with
    a reason**, not handed an empty result — "you may not" and "there is
    nothing" are different answers, and an agent needs to know which it got.
11. The framed document is the authority. An embedder's
    `getTools({ fromOrigins })` states an interest, not an entitlement, and
    the frame must still be granted `allow="tools"` by its embedder before it
    may expose anything at all.
12. Declarative form tools submit **only** when the form carries
    `toolautosubmit`. Leave it off for anything consequential: the agent may
    fill the form, and a person presses the button.