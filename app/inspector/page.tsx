"use client";

import { useEffect, useState } from "react";
import ChainVerification from "@/components/webmcp/ChainVerification";
import WhyWebMCP from "@/components/webmcp/WhyWebMCP";
import { useEventLog } from "@/hooks/use-event-log";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import { pushEventLog } from "@/lib/observability/event-log";
import {
  invokeTool,
  getBrowserTools,
  getLocalTools,
  isNativeWebMCP,
  subscribeToolChange,
  webmcpTransportLabel,
  type BrowserToolInfo,
  type ToolResult,
} from "@/lib/webmcp/runtime";
import {
  registerWebMCPToolsOnce,
  setAgentCallbacks,
} from "@/lib/webmcp/tools";

const SAMPLE_INPUTS: Record<string, string> = {
  get_accessibility_capabilities: "{}",
  get_accessibility_state: "{}",
  inspect_accessibility_tree: "{}",
  negotiate_accessibility_profile: '{"needs":["keyboard_only","strong_focus"]}',
  audit_keyboard_navigation: "{}",
  audit_accessible_names: "{}",
  audit_form_associations: "{}",
  audit_focus_visibility: "{}",
  repair_accessible_names: '{"approval":true}',
  repair_keyboard_navigation: '{"approval":true}',
  repair_form_associations: '{"approval":true}',
  repair_focus_management: '{"approval":true}',
  verify_accessibility_profile: "{}",
  rollback_all_remediations: "{}",
  search_products: '{"query":"runner"}',
  add_product_to_cart: '{"productId":"noma-runner","variantId":"9"}',
  begin_checkout: "{}",
  fill_checkout_form:
    '{"sessionId":"checkout-1","values":{"email":"alex@example.com","fullName":"Alex Sharma","address":"12 Lake Street","city":"Bengaluru","postalCode":"560001"}}',
  place_order: '{"sessionId":"checkout-1","confirmation":true}',
};

const GROUPS: Array<{ title: string; names: string[] }> = [
    {
      title: "Discovery and state",
      names: [
        "get_accessibility_capabilities",
        "get_accessibility_state",
        "inspect_accessibility_tree",
      ],
    },
    { title: "Negotiation", names: ["negotiate_accessibility_profile"] },
    {
      title: "Audits",
      names: [
        "audit_keyboard_navigation",
        "audit_accessible_names",
        "audit_form_associations",
        "audit_focus_visibility",
      ],
    },
    {
      title: "Remediation (approval-gated)",
      names: [
        "repair_accessible_names",
        "repair_keyboard_navigation",
        "repair_form_associations",
        "repair_focus_management",
        "repair_reduced_motion",
        "rollback_all_remediations",
      ],
    },
    { title: "Verification", names: ["verify_accessibility_profile"] },
    {
      title: "Commerce",
      names: [
        "search_products",
        "add_product_to_cart",
        "begin_checkout",
        "fill_checkout_form",
        "place_order",
      ],
    },
  ];

export default function InspectorPage() {
  const [native, setNative] = useState(false);
  const [transport, setTransport] = useState("server");
  const [browserTools, setBrowserTools] = useState<BrowserToolInfo[] | null>(
    null
  );
  const [localTools, setLocalTools] = useState<
    ReturnType<typeof getLocalTools>
  >([]);
  const [inputs, setInputs] = useState<Record<string, string>>(SAMPLE_INPUTS);
  const [results, setResults] = useState<Record<string, ToolResult>>({});
  const eventLog = useEventLog();

  useEffect(() => {
    // Ensure callbacks + registration exist even if the layout bootstrap
    // hasn't run yet (fresh /inspector load). Both are idempotent.
    setAgentCallbacks({
      logEvent: pushEventLog,
      getRoot: () => getFixtureRoot(),
    });
    registerWebMCPToolsOnce();
    // client-only registry + transport detection; must run after mount
    /* eslint-disable react-hooks/set-state-in-effect */
    setLocalTools(getLocalTools());
    setNative(isNativeWebMCP());
    setTransport(webmcpTransportLabel());
    /* eslint-enable react-hooks/set-state-in-effect */

    let cancelled = false;
    const refresh = () => {
      void getBrowserTools().then((tools) => {
        if (!cancelled) setBrowserTools(tools);
      });
    };
    refresh();
    const unsubscribe = subscribeToolChange(refresh);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function invoke(name: string): Promise<void> {
    const raw = inputs[name] ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setResults((prev) => ({
        ...prev,
        [name]: { ok: false, error: { message: "Input is not valid JSON." } },
      }));
      return;
    }
    const result = await invokeTool(name, parsed);
    setResults((prev) => ({ ...prev, [name]: result }));
  }

  return (
    <main id="main">
      <section className="panel">
        <h1>WebMCP inspector</h1>
        <p className={native ? "status-ok" : "status-warn"}>
          {native
            ? "Native document.modelContext detected — using the browser's WebMCP implementation."
            : "No native WebMCP in this browser — A11yMCP installed a spec-compatible document.modelContext polyfill."}
        </p>
        <p className="muted">
          Live tool transport: <strong>{transport}</strong>. Every invocation
          below (and in /demo) is dispatched through
          <code> document.modelContext.executeTool</code>. The polyfill
          implements the same imperative surface as the W3C draft and stands
          down the moment a native implementation is present.
        </p>
      </section>

      <section className="panel" aria-label="WebMCP tools via document.modelContext">
        <h2>Tools via document.modelContext.getTools()</h2>
        {browserTools ? (
          <>
            <p className={native ? "status-ok" : "muted"}>
              {browserTools.length} tools returned by{" "}
              <code>document.modelContext.getTools()</code>
              {native
                ? " (native browser implementation)."
                : " (A11yMCP polyfill). This count changes as task-scoped tools register/unregister — open /demo to see commerce tools appear."}
            </p>
            <ul className="tool-list">
              {browserTools.map((tool) => (
                <li key={tool.name}>
                  <strong>{tool.name}</strong>
                  {tool.origin ? (
                    <span className="muted"> origin: {tool.origin}</span>
                  ) : null}
                  <div className="muted">{tool.description ?? ""}</div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="status-warn">
            document.modelContext.getTools() is not available in this
            environment.
          </p>
        )}
      </section>

      <ChainVerification />

      <WhyWebMCP />

      <section className="panel" aria-label="Local demo registry">
        <h2>Local demo registry ({localTools.length})</h2>
        <p className="muted">
          Development fallback and schema reference. Open /demo to mount the
          NOMA fixture; fixture-backed tools return a structured &quot;not
          mounted&quot; error otherwise.
        </p>
      </section>

      {GROUPS.map((group) => (
        <div key={group.title}>
          <h2 className="group-title">{group.title}</h2>
          {localTools
            .filter((tool) => group.names.includes(tool.name))
            .map((tool) => (
              <section className="panel tool-card" key={tool.name}>
                <h2>
                  {tool.name}{" "}
                  <span className="chip">
                    {tool.annotations?.readOnlyHint
                      ? "read-only"
                      : "state-changing"}
                  </span>
                </h2>
                <p className="muted">{tool.description}</p>
                <pre className="code">
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
                <label className="group-label" htmlFor={`input-${tool.name}`}>
                  Input JSON
                </label>
                <textarea
                  id={`input-${tool.name}`}
                  className="code tool-input"
                  rows={3}
                  value={inputs[tool.name] ?? "{}"}
                  onChange={(event) =>
                    setInputs((prev) => ({
                      ...prev,
                      [tool.name]: event.target.value,
                    }))
                  }
                />
                <div className="button-row">
                  <button
                    type="button"
                    id={`invoke-${tool.name}`}
                    onClick={() => void invoke(tool.name)}
                  >
                    Invoke
                  </button>
                </div>
                {results[tool.name] ? (
                  <pre className="code" id={`result-${tool.name}`}>
                    {JSON.stringify(results[tool.name], null, 2)}
                  </pre>
                ) : null}
              </section>
            ))}
        </div>
      ))}

      <section className="panel" aria-live="polite">
        <h2>Recent tool events</h2>
        <pre className="code">
          {JSON.stringify(eventLog.slice(-30), null, 2)}
        </pre>
      </section>
    </main>
  );
}