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