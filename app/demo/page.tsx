"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import AgentPanel from "@/components/agent/AgentPanel";
import LiveStorefront from "@/components/fixture/LiveStorefront";
import OriginalStorefront from "@/components/fixture/OriginalStorefront";
import ChainVerification from "@/components/webmcp/ChainVerification";
import { useAgentState } from "@/hooks/use-agent-state";
import { useCommerceState } from "@/hooks/use-commerce-state";
import { useEventLog } from "@/hooks/use-event-log";
import { useNegotiationState } from "@/hooks/use-negotiation-state";
import { useRemediationState } from "@/hooks/use-remediation-state";
import { getScenario } from "@/lib/agent/intent-parser";
import {
  executeA11yTool,
  type ToolResult,
} from "@/lib/webmcp/runtime";
import {
  ALL_NEEDS,
  type AccessibilityNeed,
  type AuditResult,
  type RemediationCategory,
  type VerificationResult,
} from "@/types/accessibility";

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

export default function DemoPage() {
  const agent = useAgentState();
  const commerce = useCommerceState();
  const remediation = useRemediationState();
  const negotiation = useNegotiationState();
  const eventLog = useEventLog();

  const [auditSummary, setAuditSummary] = useState<AuditResult[] | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: AuditResult[] = [];
      for (const name of AUDIT_TOOLS) {
        const result = await executeA11yTool(name, {});
        if (result.ok) results.push(result.data as AuditResult);
      }
      if (!cancelled) setAuditSummary(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [remediation, commerce]);

  async function runVerify(): Promise<void> {
    const result = await executeA11yTool("verify_accessibility_profile", {});
    if (result.ok) setVerification(result.data as VerificationResult);
  }

  function handlePreferencesSubmit(
    event: FormEvent<HTMLFormElement>
  ): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const needs = data
      .getAll("needs")
      .map((value) => String(value))
      .filter((value): value is AccessibilityNeed =>
        (ALL_NEEDS as readonly string[]).includes(value)
      );
    if (needs.length === 0) return;
    void executeA11yTool("negotiate_accessibility_profile", { needs });
  }

  const allPass = auditSummary?.every((audit) => audit.pass) ?? false;
  const lastNegotiation = negotiation.lastNegotiation;
  const utterance = agent.scenarioId
    ? getScenario(agent.scenarioId).utterance
    : "Run a scenario in the agent panel, or set your needs below.";

  return (
    <main id="main">
      <section className="panel need-strip">
        <div>
          <p className="group-label">User need</p>
          <p className="need-text">{utterance}</p>
        </div>
        <div className="chips">
          <span className="chip">phase: {agent.phase}</span>
          <span className="chip">task: {commerce.taskState}</span>
          <span className={`chip ${allPass ? "chip-pass" : "chip-fail"}`}>
            task accessibility: {allPass ? "PASS" : "BLOCKED"}
          </span>
          {agent.lastOrderId ? (
            <span className="chip chip-pass">order {agent.lastOrderId}</span>
          ) : null}
        </div>

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

        {lastNegotiation ? (
          <div className="chips">
            {lastNegotiation.accepted.map((item) => (
              <span
                key={item.need}
                className={`chip ${
                  item.status === "supported" ? "chip-pass" : "chip-partial"
                }`}
              >
                {item.need} to {item.capability}
                {item.status === "partial" ? " (partial)" : ""}
              </span>
            ))}
            {lastNegotiation.rejected.map((item) => (
              <span key={item.need} className="chip chip-fail">
                {item.need}: rejected
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="triad">
        <section className="panel" aria-label="Original experience">
          <h2>Original experience</h2>
          <p className="muted">
            Frozen preview of the site as shipped: invisible focus, unnamed
            icon button, non-keyboard size selector, unlabeled checkout
            fields. Inert — for visual comparison only.
          </p>
          <OriginalStorefront />
        </section>

        <div className="col-center">
          <AgentPanel />
        </div>

        <section className="panel" aria-label="Adapted experience">
          <h2>Adapted experience</h2>
          <div className="chips">
            {CATEGORIES.map((category) => (
              <span
                key={category}
                className={`chip ${
                  remediation.applied[category] ? "chip-pass" : ""
                }`}
              >
                {category}: {remediation.applied[category] ? "on" : "off"}
              </span>
            ))}
          </div>
          <LiveStorefront />

          <p className="group-label">Verification</p>
          <div className="button-row">
            <button type="button" onClick={() => void runVerify()}>
              Verify
            </button>
          </div>
          {verification ? (
            <div className="chips">
              <span
                className={`chip ${
                  verification.taskAccessibility === "PASS"
                    ? "chip-pass"
                    : "chip-fail"
                }`}
              >
                {verification.taskAccessibility}
              </span>
              {verification.checks.map((check) => (
                <span
                  key={check.id}
                  className={`chip ${check.pass ? "chip-pass" : "chip-fail"}`}
                >
                  {check.title}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>
      
      <ChainVerification />

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
        <h2>Tool event log</h2>
        {eventLog.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <pre className="code">{JSON.stringify(eventLog, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}