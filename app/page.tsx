"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import AgentPanel from "@/components/agent/AgentPanel";
import StorefrontFixture from "@/components/fixture/StorefrontFixture";
import { useCommerceState } from "@/hooks/use-commerce-state";
import { useNegotiationState } from "@/hooks/use-negotiation-state";
import { useRemediationState } from "@/hooks/use-remediation-state";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import { APPLY_ORDER, PROFILE_PRESETS } from "@/lib/accessibility/profiles";
import {
  executeA11yTool,
  getLocalTools,
  isWebMCPSupported,
  type ToolResult,
} from "@/lib/webmcp/runtime";
import {
  registerWebMCPToolsOnce,
  setAgentCallbacks,
  type AgentEventInput,
} from "@/lib/webmcp/tools";
import {
  ALL_NEEDS,
  type AccessibilityNeed,
  type AuditResult,
  type RemediationCategory,
} from "@/types/accessibility";

interface UiEvent extends AgentEventInput {
  id: string;
  timestamp: string;
}

interface ToolSummary {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
}

interface LastToolExecution {
  tool: string;
  result: ToolResult;
}

const AUDIT_TOOLS = [
  "audit_keyboard_navigation",
  "audit_accessible_names",
  "audit_form_associations",
  "audit_focus_visibility",
] as const;

const CATEGORIES: RemediationCategory[] = [
  "accessible_names",
  "keyboard_navigation",
  "form_association",
  "focus_management",
];

const VALID_CHECKOUT = {
  email: "alex@example.com",
  fullName: "Alex Sharma",
  address: "12 Lake Street",
  city: "Bengaluru",
  postalCode: "560001",
};

const INVALID_CHECKOUT = {
  ...VALID_CHECKOUT,
  email: "not-an-email",
};

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export default function Home() {
  const [supported, setSupported] = useState(false);
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [approval, setApproval] = useState(true);
  const [auditSummary, setAuditSummary] = useState<AuditResult[] | null>(null);
  const [lastExecution, setLastExecution] = useState<LastToolExecution | null>(
    null
  );

  const remediation = useRemediationState();
  const negotiation = useNegotiationState();
  const commerce = useCommerceState();

  useEffect(() => {
    setAgentCallbacks({
      logEvent: (event) => {
        setEvents((prev) =>
          [
            {
              ...event,
              id: makeId(),
              timestamp: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 160)
        );
      },
      getRoot: () => getFixtureRoot(),
    });

    registerWebMCPToolsOnce();
    setSupported(isWebMCPSupported());

    setTools(
      getLocalTools().map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        readOnly: tool.annotations?.readOnlyHint === true,
      }))
    );
  }, []);

  async function runTool(name: string, input: unknown): Promise<void> {
    try {
      const result = await executeA11yTool(name, input);
      setLastExecution({ tool: name, result });
    } catch (error) {
      setLastExecution({
        tool: name,
        result: {
          ok: false,
          error: {
            message:
              error instanceof Error ? error.message : "Unexpected error",
          },
        },
      });
    }
  }

  async function refreshAudits(): Promise<AuditResult[]> {
    const results: AuditResult[] = [];
    for (const name of AUDIT_TOOLS) {
      const result = await executeA11yTool(name, {});
      if (result.ok) results.push(result.data as AuditResult);
    }
    setAuditSummary(results);
    return results;
  }

  async function runAllAudits(): Promise<void> {
    const results = await refreshAudits();
    setLastExecution({
      tool: "run_all_audits",
      result: { ok: true, data: results },
    });
  }

  async function runAndRefresh(name: string, input: unknown): Promise<void> {
    await runTool(name, input);
    await refreshAudits();
  }

  async function runNegotiation(needs: AccessibilityNeed[]): Promise<void> {
    await runTool("negotiate_accessibility_profile", { needs });
  }

  function handlePreferencesSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const needs = data
      .getAll("needs")
      .map((value) => String(value))
      .filter((value): value is AccessibilityNeed =>
        (ALL_NEEDS as readonly string[]).includes(value)
      );
    if (needs.length === 0) return;
    void runNegotiation(needs);
  }

  async function approveAndApply(): Promise<void> {
    const profile = negotiation.lastNegotiation;
    if (!profile) return;

    for (const category of APPLY_ORDER) {
      const item = profile.accepted.find((a) => a.capability === category);
      if (item) {
        await runTool(item.remediationTool, { approval: true });
      }
    }

    await refreshAudits();
  }

  const sessionId = commerce.checkoutSessionId ?? "no-session";

  const allPass = auditSummary?.every((audit) => audit.pass) ?? false;
  const lastNegotiation = negotiation.lastNegotiation;
  const partialAccepted =
    lastNegotiation?.accepted.filter((a) => a.status === "partial") ?? [];

  return (
    <main>
      <h1>A11yMCP — Phase 5 Agent Workflow</h1>
      <p className="muted">
        A deterministic guided agent drives the full chain: intent, discovery,
        audit, negotiation, approval, remediation, verification, task.
      </p>

      <section className="panel" aria-live="polite">
        <h2>Environment</h2>
        <p className={supported ? "status-ok" : "status-warn"}>
          {supported
            ? "document.modelContext detected"
            : "document.modelContext not detected"}
        </p>
        <p className="muted">
          {supported
            ? "This browser exposes WebMCP tool registration."
            : "Local tool execution still works, but official verification requires a WebMCP-enabled Chrome build."}
        </p>
      </section>

      <AgentPanel />

      <section className="panel">
        <h2>User need and negotiation</h2>

        <p className="group-label">Presets</p>
        <div className="button-row">
          {PROFILE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => runNegotiation(preset.needs)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <p className="group-label">Custom preference form</p>
        <form
          toolname="submit_accessibility_preferences"
          tooldescription="Submit the accessibility needs of the user so the site can negotiate an accessibility profile."
          onSubmit={handlePreferencesSubmit}
          className="pref-form"
        >
          {ALL_NEEDS.map((need) => (
            <label key={need} className="pref-option">
              <input
                type="checkbox"
                name="needs"
                value={need}
                defaultChecked={need === "keyboard_only"}
              />
              {need.replaceAll("_", " ")}
            </label>
          ))}
          <button type="submit">Negotiate profile</button>
        </form>
        <p className="muted negotiation-note">
          In browsers supporting the WebMCP declarative API, this form is also
          exposed to agents as the tool submit_accessibility_preferences.
        </p>

        {lastNegotiation ? (
          <div>
            <p className="group-label">Requested</p>
            <div className="chips">
              {lastNegotiation.requestedNeeds.map((need) => (
                <span key={need} className="chip">
                  {need}
                </span>
              ))}
            </div>

            <p className="group-label">Accepted</p>
            <div className="chips">
              {lastNegotiation.accepted.length === 0 ? (
                <span className="chip">none</span>
              ) : (
                lastNegotiation.accepted.map((item) => (
                  <span
                    key={item.need}
                    className={`chip ${
                      item.status === "supported" ? "chip-pass" : "chip-partial"
                    }`}
                  >
                    {item.need} to {item.capability}
                    {item.status === "partial" ? " (partial)" : ""}
                  </span>
                ))
              )}
            </div>
            {partialAccepted.map((item) => (
              <p key={item.need} className="muted negotiation-note">
                Partial: {item.limitation}
              </p>
            ))}

            <p className="group-label">Rejected</p>
            <div className="chips">
              {lastNegotiation.rejected.length === 0 ? (
                <span className="chip">none</span>
              ) : (
                lastNegotiation.rejected.map((item) => (
                  <span key={item.need} className="chip chip-fail">
                    {item.need}
                  </span>
                ))
              )}
            </div>
            {lastNegotiation.rejected.map((item) => (
              <p key={item.need} className="muted negotiation-note">
                {item.need}: {item.reason}
              </p>
            ))}

            <div className="button-row">
              <button
                type="button"
                disabled={!approval || lastNegotiation.accepted.length === 0}
                onClick={approveAndApply}
              >
                Approve and apply accepted capabilities
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">No negotiation yet.</p>
        )}
      </section>

      <div className="grid">
        <section className="panel">
          <h2>Registered tools</h2>
          {tools.length === 0 ? (
            <p className="muted">No tools registered.</p>
          ) : (
            <ul className="tool-list">
              {tools.map((tool) => (
                <li key={tool.name}>
                  <strong>{tool.name}</strong>
                  {tool.readOnly ? " — read-only" : " — state-changing"}
                  <div className="muted">{tool.description}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>NOMA fixture</h2>

          <div className="chips">
            {CATEGORIES.map((category) => (
              <span
                key={category}
                className={`chip ${
                  remediation.applied[category] ? "chip-pass" : ""
                }`}
              >
                {category}: {remediation.applied[category] ? "applied" : "off"}
              </span>
            ))}
          </div>

          <StorefrontFixture />

          <div className="checkbox">
            <input
              id="approval"
              type="checkbox"
              checked={approval}
              onChange={(event) => setApproval(event.target.checked)}
            />
            <label htmlFor="approval">
              User approval for reversible remediation
            </label>
          </div>

          <p className="group-label">Discovery</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => runTool("get_accessibility_capabilities", {})}
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => runTool("get_accessibility_state", {})}
            >
              State
            </button>
            <button
              type="button"
              onClick={() => runTool("inspect_accessibility_tree", {})}
            >
              Tree
            </button>
          </div>

          <p className="group-label">Audits</p>
          <div className="button-row">
            <button type="button" onClick={runAllAudits}>
              Run all audits
            </button>
            <button
              type="button"
              onClick={() => runTool("audit_keyboard_navigation", {})}
            >
              Keyboard
            </button>
            <button
              type="button"
              onClick={() => runTool("audit_accessible_names", {})}
            >
              Names
            </button>
            <button
              type="button"
              onClick={() => runTool("audit_form_associations", {})}
            >
              Forms
            </button>
            <button
              type="button"
              onClick={() => runTool("audit_focus_visibility", {})}
            >
              Focus
            </button>
          </div>

          <p className="group-label">Remediation</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() =>
                runAndRefresh("repair_accessible_names", { approval })
              }
            >
              Repair names
            </button>
            <button
              type="button"
              onClick={() =>
                runAndRefresh("repair_keyboard_navigation", { approval })
              }
            >
              Repair keyboard
            </button>
            <button
              type="button"
              onClick={() =>
                runAndRefresh("repair_form_associations", { approval })
              }
            >
              Repair forms
            </button>
            <button
              type="button"
              onClick={() =>
                runAndRefresh("repair_focus_management", { approval })
              }
            >
              Repair focus
            </button>
            <button
              type="button"
              onClick={() => runAndRefresh("rollback_all_remediations", {})}
            >
              Rollback all
            </button>
          </div>

          <p className="group-label">Commerce (agent path)</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => runTool("search_products", { query: "runner" })}
            >
              Search runner
            </button>
            <button
              type="button"
              onClick={() =>
                runTool("add_product_to_cart", {
                  productId: "noma-runner",
                  variantId: "9",
                })
              }
            >
              Add to cart
            </button>
            <button
              type="button"
              onClick={() => runTool("begin_checkout", {})}
            >
              Begin checkout
            </button>
            <button
              type="button"
              onClick={() =>
                runTool("fill_checkout_form", {
                  sessionId,
                  values: INVALID_CHECKOUT,
                })
              }
            >
              Fill invalid
            </button>
            <button
              type="button"
              onClick={() =>
                runTool("fill_checkout_form", {
                  sessionId,
                  values: VALID_CHECKOUT,
                })
              }
            >
              Fill valid
            </button>
            <button
              type="button"
              onClick={() =>
                runTool("place_order", { sessionId, confirmation: true })
              }
            >
              Place order
            </button>
          </div>

          <p className="group-label">Verification</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => runTool("verify_accessibility_profile", {})}
            >
              Verify
            </button>
          </div>
        </section>
      </div>

      {auditSummary ? (
        <section className="panel">
          <h2>Audit summary</h2>
          <div className="chips">
            {auditSummary.map((audit) => (
              <span
                key={audit.id}
                className={`chip ${audit.pass ? "chip-pass" : "chip-fail"}`}
              >
                {audit.title}:{" "}
                {audit.pass
                  ? "pass"
                  : `${audit.violations.length} violation${
                      audit.violations.length === 1 ? "" : "s"
                    }`}
              </span>
            ))}
            <span className={`chip ${allPass ? "chip-pass" : "chip-fail"}`}>
              Task: {allPass ? "PASS" : "BLOCKED"}
            </span>
          </div>
          {auditSummary.some((audit) => !audit.pass) ? (
            <pre className="code">
              {JSON.stringify(
                auditSummary.flatMap((audit) => audit.violations),
                null,
                2
              )}
            </pre>
          ) : (
            <p className="muted">
              No violations. The fixture is task-accessible.
            </p>
          )}
        </section>
      ) : null}

      <section className="panel" aria-live="polite">
        <h2>Last tool result</h2>
        {lastExecution ? (
          <pre className="code">{JSON.stringify(lastExecution, null, 2)}</pre>
        ) : (
          <p className="muted">No tool executed yet.</p>
        )}
      </section>

      <section className="panel" aria-live="polite">
        <h2>Event log</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <pre className="code">{JSON.stringify(events, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}