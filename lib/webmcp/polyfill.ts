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

import {
  DECLARATIVE_ATTRIBUTES,
  buildDeclarativeSchema,
  fillForm,
  submitForm,
} from "./declarative";
import { coerceToolInput, toMcpToolResponse } from "./mcp";

const POLYFILL_FLAG = "__a11ymcpPolyfill";
/** Non-enumerable hook used by the cross-origin federation host. */
export const EXPOSURE_QUERY = "__a11ymcpIsExposedTo";

function selfOrigin(): string {
  return typeof location !== "undefined" ? location.origin : "null";
}

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
 * Registration-time options the polyfill records per tool. `exposedTo` is the
 * spec's cross-origin control: by default a tool is visible only to its own
 * origin and to a built-in browser agent, and an author opts a tool in to a
 * named foreign origin explicitly. Default-deny is the whole point, so the
 * absence of `exposedTo` must never mean "everyone".
 */
interface ToolExposure {
  exposedTo: string[] | null;
}

/**
 * Returns the active `document.modelContext`, installing the polyfill first
 * if (and only if) the browser has no native implementation. Returns null
 * during server rendering.
 */
export function ensureModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;

  // A native implementation is expected to synthesize `<form toolname>` into
  // a tool itself. Not every one does — ChatGPT's browser did not, and the
  // form silently ceased to exist for the agent, which then fell back to
  // clicking the checkbox by hand. Reconcile against whatever the live
  // implementation actually exposes rather than assuming.
  if (document.modelContext) {
    syncDeclarativeForms(document.modelContext);
    return document.modelContext;
  }

  const tools = new Map<string, RegisteredTool>();
  const exposure = new Map<string, ToolExposure>();
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
    registerTool(
      tool: WebMCPToolDefinition,
      options?: WebMCPRegisterToolOptions
    ) {
      const stored = tool as unknown as RegisteredTool;
      tools.set(stored.name, stored);
      exposure.set(stored.name, {
        exposedTo: Array.isArray(options?.exposedTo)
          ? options.exposedTo.map(String)
          : null,
      });
      emitChange();

      const unregister = (): void => {
        if (tools.get(stored.name) === stored && tools.delete(stored.name)) {
          exposure.delete(stored.name);
          emitChange();
        }
      };

      // Spec lifecycle: registration is torn down by aborting the signal
      // handed to registerTool. The returned handle is a convenience the
      // polyfill keeps for callers that predate the signal option.
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted) unregister();
        else signal.addEventListener("abort", unregister, { once: true });
      }

      return { unregister };
    },
    unregisterTool(toolOrName: unknown) {
      const name =
        typeof toolOrName === "string"
          ? toolOrName
          : (toolOrName as { name?: string } | null)?.name;
      if (name && tools.delete(name)) emitChange();
    },
    getTools(options?: { fromOrigins?: string[] }) {
      const from = options?.fromOrigins;
      const all = Array.from(tools.values()).map(describe);
      if (!Array.isArray(from) || from.length === 0) return all;
      // A requester that names origins is asking for tools from those
      // origins. This page's own tools qualify only if its origin is named.
      return from.includes(selfOrigin()) ? all : [];
    },
    async executeTool(
      target: unknown,
      input?: unknown,
      context?: WebMCPToolExecuteContext
    ) {
      // Native WebMCP is called as executeTool(toolDescriptor, jsonString);
      // the app and older callers use executeTool(name, object). Accept both
      // so the same dispatch path works against either implementation.
      const name =
        typeof target === "string"
          ? target
          : String((target as { name?: unknown } | null)?.name ?? "");

      const tool = tools.get(name);
      if (!tool) {
        const failure = {
          ok: false as const,
          error: { message: `Tool not found: ${name}` },
        };
        return {
          content: [{ type: "text" as const, text: failure.error.message }],
          structuredContent: failure,
          isError: true,
        };
      }
      return tool.execute(coerceToolInput(input), context);
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

  // The federation host (lib/webmcp/federation.ts) needs to answer "may this
  // origin see this tool?" without exporting the registry itself.
  Object.defineProperty(modelContext, EXPOSURE_QUERY, {
    value: (name: string, origin: string): boolean => {
      const declared = exposure.get(name)?.exposedTo;
      return Array.isArray(declared) && declared.includes(origin);
    },
    enumerable: false,
  });

  document.modelContext = modelContext;
  syncDeclarativeForms(modelContext);
  return modelContext;
}

/**
 * WebMCP declarative API: a `<form toolname="..." tooldescription="...">` is
 * exposed as a tool whose input schema is derived from its fields — types,
 * enums, required, and per-field descriptions from `toolparamdescription`
 * (falling back to the label, then `aria-description`, then the placeholder).
 *
 * Executing the tool fills the form. It **submits only when the form carries
 * `toolautosubmit`**; otherwise the values are staged and the human presses
 * the button, which is the point of the attribute existing.
 *
 * Kept in sync with the DOM via a MutationObserver.
 */
function syncDeclarativeForms(mc: ModelContext): void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return;
  }

  const registered = new Map<HTMLFormElement, { unregister: () => void }>();

  /** Tool names the live implementation is already exposing. */
  const alreadyExposed = async (): Promise<Set<string>> => {
    if (typeof mc.getTools !== "function") return new Set();
    try {
      const tools = await mc.getTools();
      if (!Array.isArray(tools)) return new Set();
      return new Set(
        tools
          .map((tool) => (tool as { name?: unknown })?.name)
          .filter((name): name is string => typeof name === "string")
      );
    } catch {
      return new Set();
    }
  };

  const scan = async (): Promise<void> => {
    const forms = new Set(
      Array.from(document.querySelectorAll<HTMLFormElement>("form[toolname]"))
    );
    const exposed = await alreadyExposed();

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
      // The browser already synthesized this one — don't shadow it.
      if (exposed.has(name)) return;

      const autoSubmit = form.hasAttribute("toolautosubmit");
      const handle = mc.registerTool({
        name,
        title: name,
        description:
          form.getAttribute("tooldescription") ||
          `Fill the "${name}" form.`,
        inputSchema: buildDeclarativeSchema(form),
        annotations: {
          readOnlyHint: false,
          declarative: true,
          // Filling without submitting is not a consequential act; the
          // submit is, so say so where autosubmit is on.
          destructiveHint: autoSubmit,
        },
        execute: (rawInput: unknown) => {
          const input = coerceToolInput(rawInput);
          const values = (input && typeof input === "object" ? input : {}) as Record<
            string,
            unknown
          >;
          const filled = fillForm(form, values);
          if (autoSubmit) submitForm(form);

          return toMcpToolResponse(name, {
            ok: true,
            data: {
              tool: name,
              filled,
              submitted: autoSubmit,
              nextStep: autoSubmit
                ? null
                : "The form is filled but not submitted. Ask the user to review and submit it.",
            },
          });
        },
      });
      if (handle && typeof (handle as { unregister?: unknown }).unregister === "function") {
        registered.set(form, handle as { unregister: () => void });
      }
    });
  };

  void scan();
  new MutationObserver(() => void scan()).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: DECLARATIVE_ATTRIBUTES,
  });
}

/**
 * True when `name` is registered with an `exposedTo` list that includes
 * `origin`. Cross-origin access is default-deny: a tool with no `exposedTo`
 * is never visible to a foreign origin.
 */
export function isToolExposedTo(name: string, origin: string): boolean {
  const mc = typeof document !== "undefined" ? document.modelContext : undefined;
  const query = (mc as unknown as Record<string, unknown> | undefined)?.[
    EXPOSURE_QUERY
  ];
  return typeof query === "function"
    ? Boolean((query as (n: string, o: string) => boolean)(name, origin))
    : false;
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
