"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import AgentPanel from "@/components/agent/AgentPanel";
import JudgeMode from "@/components/judge/JudgeMode";
import ProofRace from "@/components/judge/ProofRace";
import ChainVerification from "@/components/webmcp/ChainVerification";
import LiveStorefront from "@/components/fixture/LiveStorefront";
import OriginalStorefront from "@/components/fixture/OriginalStorefront";
import { useAgentState } from "@/hooks/use-agent-state";
import { useCommerceState } from "@/hooks/use-commerce-state";
import { useEventLog } from "@/hooks/use-event-log";
import { useNegotiationState } from "@/hooks/use-negotiation-state";
import { useRemediationState } from "@/hooks/use-remediation-state";
import { getScenario } from "@/lib/agent/intent-parser";
import { downloadEvidenceReport } from "@/lib/accessibility/evidence-report";
import {
  getCurrentManifest,
  getSiteId,
  setSite,
  subscribeSite,
} from "@/lib/accessibility/manifest";
import { getRemediationHistory } from "@/lib/accessibility/remediation";
import { invokeTool } from "@/lib/webmcp/runtime";
import {
  ALL_NEEDS,
  type AccessibilityNeed,
  type AuditResult,
  type RemediationCategory,
  type SiteId,
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
  "reduced_motion",
];

export default function DemoPage() {
  const agent = useAgentState();
  const commerce = useCommerceState();
  const remediation = useRemediationState();
  const negotiation = useNegotiationState();
  const eventLog = useEventLog();

  const [judgeMode, setJudgeMode] = useState(false);
  const [siteId, setSiteId] = useState<SiteId>(getSiteId());
  const [auditSummary, setAuditSummary] = useState<AuditResult[] | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(
    null
  );
  const [needsSel, setNeedsSel] = useState<AccessibilityNeed[]>([
    "keyboard_only",
  ]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("a11ymcp:profile");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        site?: SiteId;
        needs?: AccessibilityNeed[];
      };
      if (saved.site && saved.site !== getSiteId()) setSite(saved.site);
      if (Array.isArray(saved.needs) && saved.needs.length > 0) {
        // one-time hydration from localStorage (not available during SSR,
        // so a lazy initializer can't do this)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNeedsSel(saved.needs);
      }
    } catch {
      /* ignore corrupted storage */
    }
  }, []);

  function persistProfile(nextNeeds: AccessibilityNeed[], nextSite: SiteId) {
    try {
      window.localStorage.setItem(
        "a11ymcp:profile",
        JSON.stringify({ site: nextSite, needs: nextNeeds })
      );
    } catch {
      /* storage unavailable */
    }
  }

  useEffect(() => {
    return subscribeSite(() => setSiteId(getSiteId()));
  }, []);

  useEffect(() => {
    // Read the query directly instead of useSearchParams() so /demo stays
    // statically prerendered and needs no Suspense boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJudgeMode(new URLSearchParams(window.location.search).has("judge"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: AuditResult[] = [];
      for (const name of AUDIT_TOOLS) {
        const result = await invokeTool(name, {});
        if (result.ok) results.push(result.data as AuditResult);
      }
      if (!cancelled) setAuditSummary(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [remediation, commerce, siteId]);

  async function runVerify(): Promise<void> {
    const result = await invokeTool("verify_accessibility_profile", {});
    if (result.ok) setVerification(result.data as VerificationResult);
  }

  async function switchSite(id: SiteId): Promise<void> {
    await invokeTool("rollback_all_remediations", {});
    setSite(id);
    persistProfile(needsSel, id);
  }

  async function exportEvidence(): Promise<void> {
    const results: AuditResult[] = [];
    for (const name of AUDIT_TOOLS) {
      const result = await invokeTool(name, {});
      if (result.ok) results.push(result.data as AuditResult);
    }
    const manifest = getCurrentManifest();
    downloadEvidenceReport({
      generatedAt: new Date().toISOString(),
      protocol: "a11ymcp/0.5",
      site: manifest.site,
      disclaimer:
        "Evidence report from a controlled runtime session. Not a legal accessibility certification.",
      requestedNeeds: negotiation.lastNegotiation?.requestedNeeds ?? [],
      negotiated: negotiation.lastNegotiation,
      applied: remediation.applied,
      remediationHistory: getRemediationHistory(),
      currentAudits: results,
      verification,
      unsupportedRequests: negotiation.lastNegotiation?.rejected ?? [],
      notDeclaredBySite: manifest.notDeclared,
    });
  }

  function handlePreferencesSubmit(
    event: FormEvent<HTMLFormElement>
  ): void {
    event.preventDefault();
    if (needsSel.length === 0) return;
    persistProfile(needsSel, siteId);
    void invokeTool("negotiate_accessibility_profile", {
      needs: needsSel,
    });
  }

  const allPass = auditSummary?.every((audit) => audit.pass) ?? false;
  const blockingCount =
    auditSummary
      ?.flatMap((audit) => audit.violations)
      .filter((violation) => violation.taskImpact === "blocking").length ?? 0;
  const lastNegotiation = negotiation.lastNegotiation;
  const utterance = agent.scenarioId
    ? getScenario(agent.scenarioId).utterance
    : "I use keyboard-only navigation. Help me buy these shoes.";

  return (
    <main id="main">
      {judgeMode ? <JudgeMode /> : null}

      <section className="panel need-strip">
        <div>
          <p className="group-label">User need</p>
          <p className="need-text">{utterance}</p>
          <p className="muted">
            What am I looking at? 1) The agent negotiates with the
            site&rsquo;s declared capabilities. 2) You approve reversible
            fixes. 3) The
            site adapts, verifies, and completes the task.
          </p>
        </div>

        <div className="chips">
          <span className="chip">site: {siteId}</span>
          <span className="chip">phase: {agent.phase}</span>
          <span className="chip">task: {commerce.taskState}</span>
          <span className={`chip ${allPass ? "chip-pass" : "chip-fail"}`}>
            task accessibility: {allPass ? "PASS" : "BLOCKED"}
          </span>
          <span className={`chip ${blockingCount === 0 ? "chip-pass" : "chip-fail"}`}>
            task-blocking: {blockingCount}
          </span>
          {agent.lastOrderId ? (
            <span className="chip chip-pass">order {agent.lastOrderId}</span>
          ) : null}
        </div>

        <div className="button-row">
          <button type="button" onClick={() => void switchSite("site-a")}>
            Site A (names/forms)
          </button>
          <button type="button" onClick={() => void switchSite("site-b")}>
            Site B (reduced motion)
          </button>
          <button type="button" onClick={() => void exportEvidence()}>
            Export evidence report
          </button>
        </div>

        {/*
          Declarative WebMCP tool. No `toolautosubmit`: an agent may stage the
          user's needs, but a person presses "Negotiate profile". The needs
          checkboxes share a name, so the derived schema is an array with an
          enum of the supported need ids.
        */}
        <form
          toolname="submit_accessibility_preferences"
          tooldescription="Stage the user's accessibility needs on this page so the site can negotiate an accessibility profile. Fills the form; the user submits it."
          onSubmit={handlePreferencesSubmit}
          className="pref-form"
        >
          {ALL_NEEDS.map((need, index) => (
            <label key={need} className="pref-option">
              <input
                type="checkbox"
                name="needs"
                value={need}
                toolparamdescription={
                  index === 0
                    ? "The accessibility needs to request, as an array of need ids. Only ids this site declares can be satisfied; the rest are rejected with a reason."
                    : undefined
                }
                checked={needsSel.includes(need)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...needsSel, need]
                    : needsSel.filter((item) => item !== need);
                  setNeedsSel(next);
                  persistProfile(next, siteId);
                }}
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

      {judgeMode ? <ProofRace /> : null}

      <ChainVerification />

      {auditSummary ? (
        <section className="panel">
          <h2>Audit summary (task-scoped)</h2>
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
            <p className="muted">
              No violations. The fixture is task-accessible.
            </p>
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