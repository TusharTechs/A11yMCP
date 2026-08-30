"use client";

import { useEffect, useState } from "react";
import ChainVerification from "@/components/webmcp/ChainVerification";
import WhyWebMCP from "@/components/webmcp/WhyWebMCP";
import { useEventLog } from "@/hooks/use-event-log";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import { pushEventLog } from "@/lib/observability/event-log";
import {
  executeA11yTool,
  getBrowserTools,
  getLocalTools,
  isWebMCPSupported,
  subscribeToolChange,
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

export default function InspectorPage() {
  const [supported] = useState(isWebMCPSupported);
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
    setLocalTools(getLocalTools());

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
    const result = await executeA11yTool(name, parsed);
    setResults((prev) => ({ ...prev, [name]: result }));
  }

  return (
    <main id="main">
      <section className="panel">
        <h1>WebMCP inspector</h1>
        <p className={supported ? "status-ok" : "status-warn"}>
          {supported
            ? "document.modelContext detected."
            : "document.modelContext not detected in this browser."}
        </p>
        <p className="muted">
          The two sections below are deliberately separate: browser-visible
          WebMCP tools are proof; the local demo registry is a development
          fallback. They are never presented as the same thing.
        </p>
      </section>

      <section className="panel" aria-label="Browser WebMCP tools">
        <h2>Browser WebMCP tools</h2>
        {browserTools ? (
          <>
            <p className="status-ok">
              Browser-visible tools: {browserTools.length}
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
            WebMCP unavailable in this browser. Local demo registry:{" "}
            {localTools.length} tools (below). This fallback is not evidence
            of browser-visible WebMCP.
          </p>
        )}
      </section>

      <ChainVerification />

      <WhyWebMCP />

      <section className="panel" aria-label="Local demo registry">
        <h2>Local demo registry ({localTools.length})</h2>
        <p className="muted">
          Development fallback and schema reference. Open /demo to mount the
          NOMA fixture; fixture-backed tools return a structured "not
          mounted" error otherwise.
        </p>
      </section>

      {localTools.map((tool) => (
        <section className="panel tool-card" key={tool.name}>
          <h2>
            {tool.name}{" "}
            <span className="chip">
              {tool.annotations?.readOnlyHint ? "read-only" : "state-changing"}
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

      <section className="panel" aria-live="polite">
        <h2>Recent tool events</h2>
        <pre className="code">
          {JSON.stringify(eventLog.slice(-30), null, 2)}
        </pre>
      </section>
    </main>
  );
}