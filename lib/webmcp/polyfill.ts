/**
 * Spec-compatible `document.modelContext` polyfill.
 *
 * WebMCP (W3C Web Machine Learning CG — the `document.modelContext` draft,
 * moved from `navigator` in the May 2026 revision) is not yet in a stable
 * browser. This polyfill implements the imperative surface —
 * `registerTool` / `unregisterTool` / `getTools` / `executeTool` and the
 * `toolchange` event — so A11yMCP runs the *same* call path in every
 * environment: local dev, Playwright, CI, and a judging browser.
 *
 * When a native implementation is already present (Chrome behind a flag,
 * the ChatGPT in-app browser, an agent extension) we never touch it — the
 * native `document.modelContext` wins and this module is inert. The
 * inspector shows which transport is live via {@link isNativeWebMCP}.
 */

const POLYFILL_FLAG = "__a11ymcpPolyfill";

interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: WebMCPToolInputSchema;
  annotations?: WebMCPToolAnnotations;
  execute: (
    input: unknown,
    context?: WebMCPToolExecuteContext
  ) => unknown | Promise<unknown>;
}

/**
 * Returns the active `document.modelContext`, installing the polyfill first
 * if (and only if) the browser has no native implementation. Returns null
 * during server rendering.
 */
export function ensureModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  if (document.modelContext) return document.modelContext;

  const tools = new Map<string, RegisteredTool>();
  const listeners = new Set<() => void>();

  const emitChange = (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* a listener throwing is not the registry's problem */
      }
    }
  };

  const describe = (tool: RegisteredTool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    origin: "a11ymcp-polyfill",
  });

  const modelContext: ModelContext = {
    registerTool(tool: WebMCPToolDefinition) {
      const stored = tool as unknown as RegisteredTool;
      tools.set(stored.name, stored);
      emitChange();
      return {
        unregister: () => {
          if (tools.delete(stored.name)) emitChange();
        },
      };
    },
    unregisterTool(toolOrName: unknown) {
      const name =
        typeof toolOrName === "string"
          ? toolOrName
          : (toolOrName as { name?: string } | null)?.name;
      if (name && tools.delete(name)) emitChange();
    },
    getTools() {
      return Array.from(tools.values()).map(describe);
    },
    async executeTool(
      name: string,
      input: unknown,
      context?: WebMCPToolExecuteContext
    ) {
      const tool = tools.get(name);
      if (!tool) {
        return { ok: false, error: { message: `Tool not found: ${name}` } };
      }
      return tool.execute(input ?? {}, context);
    },
    addEventListener(type, listener) {
      if (type === "toolchange") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "toolchange") listeners.delete(listener);
    },
  };

  Object.defineProperty(modelContext, POLYFILL_FLAG, {
    value: true,
    enumerable: false,
  });

  document.modelContext = modelContext;
  syncDeclarativeForms(modelContext);
  return modelContext;
}

/**
 * WebMCP declarative API: a `<form toolname="..." tooldescription="...">`
 * is exposed as a tool whose input schema is derived from its named fields;
 * executing it fills those fields and submits the form. Kept in sync with
 * the DOM via a MutationObserver.
 */
function syncDeclarativeForms(mc: ModelContext): void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return;
  }

  const registered = new Map<HTMLFormElement, { unregister: () => void }>();

  const fieldNames = (form: HTMLFormElement): string[] =>
    Array.from(new Set(
      Array.from(form.elements)
        .map((el) => (el as HTMLInputElement).name)
        .filter((name): name is string => Boolean(name))
    ));

  const scan = (): void => {
    const forms = new Set(
      Array.from(document.querySelectorAll<HTMLFormElement>("form[toolname]"))
    );

    for (const [form, handle] of registered) {
      if (!forms.has(form)) {
        handle.unregister();
        registered.delete(form);
      }
    }

    forms.forEach((form) => {
      if (registered.has(form)) return;
      const name = form.getAttribute("toolname");
      if (!name) return;
      const names = fieldNames(form);
      const handle = mc.registerTool({
        name,
        title: name,
        description:
          form.getAttribute("tooldescription") ||
          `Submit the "${name}" form.`,
        inputSchema: {
          type: "object",
          properties: names.reduce<Record<string, unknown>>((acc, field) => {
            acc[field] = { type: "string" };
            return acc;
          }, {}),
          required: [],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, declarative: true },
        execute: (input: unknown) => {
          const values = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
          Object.keys(values).forEach((key) => {
            const field = form.elements.namedItem(key) as
              | HTMLInputElement
              | RadioNodeList
              | null;
            if (field && "value" in field) {
              (field as HTMLInputElement).value = String(values[key]);
            }
          });
          if (typeof form.requestSubmit === "function") form.requestSubmit();
          else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
          return { ok: true, data: { submitted: true, tool: name } };
        },
      });
      if (handle && typeof (handle as { unregister?: unknown }).unregister === "function") {
        registered.set(form, handle as { unregister: () => void });
      }
    });
  };

  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["toolname", "tooldescription"],
  });
}

/** True when a real (non-polyfill) `document.modelContext` is present. */
export function isNativeWebMCP(): boolean {
  return (
    typeof document !== "undefined" &&
    !!document.modelContext &&
    !(document.modelContext as unknown as Record<string, unknown>)[POLYFILL_FLAG]
  );
}

/** True when the A11yMCP polyfill is providing `document.modelContext`. */
export function isPolyfilledWebMCP(): boolean {
  return (
    typeof document !== "undefined" &&
    !!document.modelContext &&
    !!(document.modelContext as unknown as Record<string, unknown>)[POLYFILL_FLAG]
  );
}

/** Human-readable label for the live transport. */
export function webmcpTransportLabel(): string {
  if (isNativeWebMCP()) return "native document.modelContext";
  if (isPolyfilledWebMCP()) return "A11yMCP spec-compatible polyfill";
  return "unavailable";
}
