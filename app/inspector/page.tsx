"use client";

import { useState } from "react";
import { useEventLog } from "@/hooks/use-event-log";
import {
  executeA11yTool,
  getLocalTools,
  isWebMCPSupported,
  type ToolResult,
} from "@/lib/webmcp/runtime";

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
  const [inputs, setInputs] = useState<Record<string, string>>(SAMPLE_INPUTS);
  const [results, setResults] = useState<Record<string, ToolResult>>({});
  const eventLog = useEventLog();

  const tools = getLocalTools();

  async function invoke(name: string): Promise<void> {
    const raw = inputs[name] ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setResults((prev) => ({
        ...prev,
        [name]: {
          ok: false,
          error: { message: "Input is not valid JSON." },
        },
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
            ? "document.modelContext detected — tools are registered with the browser."
            : "document.modelContext not detected — tools are registered with the A11yMCP runtime and can be invoked below."}
        </p>
        <p className="muted">
          Open /demo to mount the NOMA fixture; tools that need it return a
          structured "not mounted" error otherwise. In a WebMCP-enabled
          Chrome build these same tools appear in the browser tooling.
        </p>
      </section>

      {tools.map((tool) => (
        <section className="panel tool-card" key={tool.name}>
          <h2>
            {tool.name}{" "}
            <span className="chip">
              {tool.annotations?.readOnlyHint ? "read-only" : "state-changing"}
            </span>
          </h2>
          <p className="muted">{tool.description}</p>
          <pre className="code">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
          <label className="group-label" htmlFor={`input-${tool.name}`}>
            Input JSON
          </label>
          <textarea
            id={`input-${tool.name}`}
            className="code tool-input"
            rows={3}
            value={inputs[tool.name] ?? "{}"}
            onChange={(event) =>
              setInputs((prev) => ({ ...prev, [tool.name]: event.target.value }))
            }
          />
          <div className="button-row">
            <button type="button" onClick={() => void invoke(tool.name)}>
              Invoke
            </button>
          </div>
          {results[tool.name] ? (
            <pre className="code">
              {JSON.stringify(results[tool.name], null, 2)}
            </pre>
          ) : null}
        </section>
      ))}

      <section className="panel" aria-live="polite">
        <h2>Recent tool events</h2>
        <pre className="code">{JSON.stringify(eventLog.slice(-30), null, 2)}</pre>
      </section>
    </main>
  );
}