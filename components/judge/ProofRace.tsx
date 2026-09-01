"use client";

import { useCallback, useRef, useState } from "react";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import type { ActuationOutcome, LaneStep } from "@/lib/agent/actuation-baseline";
import {
  runProofRace,
  type RaceLane,
  type WebMCPOutcome,
} from "@/lib/agent/proof-race";

type LaneState = {
  steps: LaneStep[];
  outcome: ActuationOutcome | WebMCPOutcome | null;
};

const EMPTY: LaneState = { steps: [], outcome: null };

const LANES: Array<{
  id: RaceLane;
  title: string;
  subtitle: string;
}> = [
  {
    id: "actuation",
    title: "Without WebMCP",
    subtitle: "A browser-actuation agent, driving the real DOM",
  },
  {
    id: "webmcp",
    title: "With WebMCP",
    subtitle: "The same goal, through the site's declared tools",
  },
];

function verdictClass(outcome: ActuationOutcome | WebMCPOutcome): string {
  return outcome.verdict === "COMPLETED" ? "chip-pass" : "chip-fail";
}

/**
 * The side-by-side proof. Both lanes run live against the same storefront —
 * the actuation lane really walks the tab order and really injects the
 * attributes it has no permission to inject (and undoes them); the WebMCP
 * lane really calls the registered tools.
 */
export default function ProofRace() {
  const [running, setRunning] = useState(false);
  const [lanes, setLanes] = useState<Record<RaceLane, LaneState>>({
    actuation: EMPTY,
    webmcp: EMPTY,
  });
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const approvalResolver = useRef<((approved: boolean) => void) | null>(null);

  const resolveApproval = useCallback((approved: boolean) => {
    const resolve = approvalResolver.current;
    approvalResolver.current = null;
    setAwaitingApproval(false);
    resolve?.(approved);
  }, []);

  async function start(): Promise<void> {
    const root = getFixtureRoot();
    if (!root || running) return;

    setRunning(true);
    setLanes({ actuation: EMPTY, webmcp: EMPTY });

    try {
      await runProofRace(root, {
        onStep: (lane, step) =>
          setLanes((current) => ({
            ...current,
            [lane]: { ...current[lane], steps: [...current[lane].steps, step] },
          })),
        onLaneDone: (lane, outcome) =>
          setLanes((current) => ({
            ...current,
            [lane]: { ...current[lane], outcome },
          })),
        requestApproval: () =>
          new Promise<boolean>((resolve) => {
            approvalResolver.current = resolve;
            setAwaitingApproval(true);
          }),
      });
    } finally {
      setRunning(false);
      approvalResolver.current = null;
      setAwaitingApproval(false);
    }
  }

  return (
    <section className="panel race" aria-label="Side-by-side proof">
      <h2>The same task, attempted two ways</h2>
      <p className="muted">
        &ldquo;I can only use a keyboard. Buy the NOMA Runner in size 9.&rdquo;
        Both lanes run live against the storefront above — the left lane walks
        the real tab order and really injects the attributes it was never
        given permission to inject (then undoes them). Nothing here is a
        recording.
      </p>

      <div className="button-row">
        <button type="button" onClick={() => void start()} disabled={running}>
          {running ? "Running…" : "Run both lanes"}
        </button>
      </div>

      {awaitingApproval ? (
        <div
          className="trust-box"
          role="alertdialog"
          aria-label="Approval requested"
        >
          <h3>The WebMCP lane is asking permission</h3>
          <p>
            WHAT: apply the site&rsquo;s declared keyboard and focus
            adaptations
          </p>
          <p>WHY: required by the negotiated profile</p>
          <p>SCOPE: this session only · REVERSIBLE: yes</p>
          <div className="button-row">
            <button type="button" onClick={() => resolveApproval(true)}>
              Approve
            </button>
            <button type="button" onClick={() => resolveApproval(false)}>
              Deny
            </button>
          </div>
        </div>
      ) : null}

      <div className="race-lanes">
        {LANES.map((lane) => {
          const state = lanes[lane.id];
          return (
            <div key={lane.id} className={`race-lane race-lane-${lane.id}`}>
              <h3>{lane.title}</h3>
              <p className="muted">{lane.subtitle}</p>

              <ol className="race-steps" aria-live="polite">
                {state.steps.map((step, index) => (
                  <li key={`${lane.id}-${index}`} className={`race-${step.status}`}>
                    <span className="race-step-label">{step.label}</span>
                    <span className="race-step-detail">{step.detail}</span>
                  </li>
                ))}
                {state.steps.length === 0 ? (
                  <li className="muted">Not started.</li>
                ) : null}
              </ol>

              {state.outcome ? (
                <div className="race-verdict">
                  <span className={`chip ${verdictClass(state.outcome)}`}>
                    {state.outcome.verdict === "COMPLETED" ? "✓" : "✗"}{" "}
                    {state.outcome.headline}
                  </span>
                  <div className="chips">
                    <span
                      className={`chip ${
                        state.outcome.metrics.unauthorizedMutations === 0
                          ? "chip-pass"
                          : "chip-fail"
                      }`}
                    >
                      unauthorized mutations:{" "}
                      {state.outcome.metrics.unauthorizedMutations}
                    </span>
                    <span
                      className={`chip ${
                        state.outcome.metrics.siteVerifications > 0
                          ? "chip-pass"
                          : "chip-fail"
                      }`}
                    >
                      site verifications:{" "}
                      {state.outcome.metrics.siteVerifications}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="muted">
        This is one task, run once, in front of you. The six-task measured
        version is <code>npm run eval:webmcp</code>, whose numbers are in{" "}
        <a href="/inspector">the inspector</a> — including the task where
        actuation wins.
      </p>
    </section>
  );
}
