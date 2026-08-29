"use client";

import { useEffect, useRef, useState } from "react";
import StorefrontFixture from "@/components/fixture/StorefrontFixture";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import {
  executeA11yTool,
  getLocalTools,
  isWebMCPSupported,
  type ToolResult,
} from "@/lib/webmcp/runtime";
import {
  registerPhase2ToolsOnce,
  setPhase2Callbacks,
  type Phase2EventInput,
} from "@/lib/webmcp/tools";
import { useRemediationState } from "@/hooks/use-remediation-state";
import type { AuditResult, RemediationCategory } from "@/types/accessibility";

interface UiEvent extends Phase2EventInput {
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

  useEffect(() => {
    setPhase2Callbacks({
      logEvent: (event) => {
        setEvents((prev) =>
          [
            {
              ...event,
              id: makeId(),
              timestamp: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 120)
        );
      },
      getRoot: () => getFixtureRoot(),
    });

    registerPhase2ToolsOnce();
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
            message: error instanceof Error ? error.message : "Unexpected error",
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
    setLastExecution({ tool: "run_all_audits", result: { ok: true, data: results } });
  }

  async function runAndRefresh(name: string, input: unknown): Promise<void> {
    await runTool(name, input);
    await refreshAudits();
  }

  const allPass = auditSummary?.every((audit) => audit.pass) ?? false;

  return (
    <main>
      <h1>A11yMCP — Phase 2 Accessibility Engine</h1>
      <p className="muted">
        Deterministic snapshot, audits, site-declared remediation, verification,
        and rollback on a controlled NOMA fixture.
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
                className={`chip ${remediation.applied[category] ? "chip-pass" : ""}`}
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
            <button type="button" onClick={() => runTool("get_accessibility_capabilities", {})}>
              Capabilities
            </button>
            <button type="button" onClick={() => runTool("get_accessibility_state", {})}>
              State
            </button>
            <button type="button" onClick={() => runTool("inspect_accessibility_tree", {})}>
              Tree
            </button>
          </div>

          <p className="group-label">Audits</p>
          <div className="button-row">
            <button type="button" onClick={runAllAudits}>
              Run all audits
            </button>
            <button type="button" onClick={() => runTool("audit_keyboard_navigation", {})}>
              Keyboard
            </button>
            <button type="button" onClick={() => runTool("audit_accessible_names", {})}>
              Names
            </button>
            <button type="button" onClick={() => runTool("audit_form_associations", {})}>
              Forms
            </button>
            <button type="button" onClick={() => runTool("audit_focus_visibility", {})}>
              Focus
            </button>
          </div>

          <p className="group-label">Remediation</p>
          <div className="button-row">
            <button type="button" onClick={() => runAndRefresh("repair_accessible_names", { approval })}>
              Repair names
            </button>
            <button type="button" onClick={() => runAndRefresh("repair_keyboard_navigation", { approval })}>
              Repair keyboard
            </button>
            <button type="button" onClick={() => runAndRefresh("repair_form_associations", { approval })}>
              Repair forms
            </button>
            <button type="button" onClick={() => runAndRefresh("repair_focus_management", { approval })}>
              Repair focus
            </button>
            <button type="button" onClick={() => runAndRefresh("rollback_all_remediations", {})}>
              Rollback all
            </button>
          </div>

          <p className="group-label">Verification</p>
          <div className="button-row">
            <button type="button" onClick={() => runTool("verify_accessibility_profile", {})}>
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
                  : `${audit.violations.length} violation${audit.violations.length === 1 ? "" : "s"}`}
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
            <p className="muted">No violations. The fixture is task-accessible.</p>
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