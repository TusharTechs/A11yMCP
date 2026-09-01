"use client";

import { useEffect, useMemo, useState } from "react";
import { useAgentState } from "@/hooks/use-agent-state";
import { resolveDecision, runGuidedAgent } from "@/lib/agent/guided-demo";
import {
  getBrowserTools,
  subscribeToolChange,
  webmcpTransportLabel,
  isNativeWebMCP,
} from "@/lib/webmcp/runtime";
import type { StreamEntry } from "@/types/agent";

/**
 * The eight steps a judge should be able to watch happen, in order, without
 * reading anything first. Each is marked done by evidence already present in
 * the guided agent's stream — no parallel state to drift out of sync.
 */
interface JudgeStep {
  id: string;
  label: string;
  /** The claim being demonstrated, in one line. */
  claim: string;
  done: (stream: StreamEntry[], orderId: string | null) => boolean;
  detail: (stream: StreamEntry[]) => string | null;
}

const resultFor = (stream: StreamEntry[], tool: string): string | null =>
  stream.find((entry) => entry.kind === "result" && entry.tool === tool)?.text ??
  null;

const anyResult = (stream: StreamEntry[], prefix: string): StreamEntry | null =>
  stream.find(
    (entry) => entry.kind === "result" && (entry.tool ?? "").startsWith(prefix)
  ) ?? null;

/** A tool *call* recorded in the stream, before its result arrives. */
const anyCall = (stream: StreamEntry[], prefix: string): boolean =>
  stream.some(
    (entry) => entry.kind === "tool" && (entry.tool ?? "").startsWith(prefix)
  );

const STEPS: JudgeStep[] = [
  {
    id: "need",
    label: "A person states a need",
    claim: "Plain language in, no tool names.",
    done: (stream) => stream.some((entry) => entry.kind === "user"),
    detail: (stream) =>
      stream.find((entry) => entry.kind === "user")?.text ?? null,
  },
  {
    id: "discover",
    label: "The agent asks what the site can adapt",
    claim: "Discovery — impossible without a declared contract.",
    done: (stream) =>
      Boolean(resultFor(stream, "get_accessibility_capabilities")),
    detail: (stream) => resultFor(stream, "get_accessibility_capabilities"),
  },
  {
    id: "audit",
    label: "The site audits itself for this task",
    claim: "Barriers tagged blocking / degrading, not a violation count.",
    done: (stream) => Boolean(anyResult(stream, "audit_")),
    detail: (stream) => anyResult(stream, "audit_")?.text ?? null,
  },
  {
    id: "negotiate",
    label: "Needs are negotiated — and one is refused",
    claim: "An undeclared need is rejected with a reason, never faked.",
    done: (stream) =>
      Boolean(resultFor(stream, "negotiate_accessibility_profile")),
    detail: (stream) => resultFor(stream, "negotiate_accessibility_profile"),
  },
  {
    id: "approve",
    label: "The human approves before anything changes",
    claim: "`approval: true` is enforced at the schema level.",
    // Evidenced by a repair being *attempted* at all: the guided agent waits
    // on the decision before it issues one.
    done: (stream) => anyCall(stream, "repair_"),
    detail: () => "Approved — the agent waited for a decision before acting.",
  },
  {
    id: "adapt",
    label: "The site adapts itself, reversibly",
    claim: "Only the site's own declared directives are applied.",
    done: (stream) => Boolean(anyResult(stream, "repair_")),
    detail: (stream) => anyResult(stream, "repair_")?.text ?? null,
  },
  {
    id: "verify",
    label: "The site verifies the result",
    claim: "PASS is scoped to the negotiated profile — so it means something.",
    done: (stream) =>
      Boolean(resultFor(stream, "verify_accessibility_profile")),
    detail: (stream) => resultFor(stream, "verify_accessibility_profile"),
  },
  {
    id: "task",
    label: "The person finishes what they came to do",
    claim: "`place_order` needs a literal `confirmation: true`.",
    done: (_stream, orderId) => Boolean(orderId),
    detail: (stream) => resultFor(stream, "place_order"),
  },
];

const AGENT_PROMPT = `I can only use a keyboard — I can't use a mouse. I also have low vision and need high contrast.

Use this page's WebMCP tools to help me buy the NOMA Runner in size 9:
1. Call get_accessibility_capabilities to see what this site can adapt.
2. Call negotiate_accessibility_profile with my needs. Tell me plainly which
   ones this site cannot support — do not work around them.
3. Ask me before changing anything, then apply only the accepted adaptations.
4. Call verify_accessibility_profile and tell me the result.
5. Complete the purchase, and confirm with me before placing the order.`;

export default function JudgeMode() {
  const agent = useAgentState();
  const [transport, setTransport] = useState("detecting…");
  const [native, setNative] = useState(false);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = (): void => {
      setTransport(webmcpTransportLabel());
      setNative(isNativeWebMCP());
      void getBrowserTools().then((tools) =>
        setToolCount(tools ? tools.length : null)
      );
    };
    refresh();
    return subscribeToolChange(refresh);
  }, []);

  const progress = useMemo(
    () =>
      STEPS.map((step) => ({
        ...step,
        isDone: step.done(agent.stream, agent.lastOrderId),
        text: step.detail(agent.stream),
      })),
    [agent.stream, agent.lastOrderId]
  );

  const doneCount = progress.filter((step) => step.isDone).length;
  const activeIndex = progress.findIndex((step) => !step.isDone);

  async function copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the text is selectable below */
    }
  }

  return (
    <section className="panel judge" aria-label="Judge mode">
      <div className="judge-head">
        <div>
          <p className="group-label">Judge mode</p>
          <h2>Sixty seconds, one button.</h2>
          <p className="muted">
            A keyboard-only shopper cannot finish a checkout on this page.
            Watch the site declare what it can adapt, refuse what it cannot,
            ask permission, adapt itself, verify its own work, and complete
            the purchase.
          </p>
        </div>

        <div className="chips">
          <span className={`chip ${native ? "chip-pass" : "chip-partial"}`}>
            transport: {transport}
          </span>
          {toolCount !== null ? (
            <span className="chip">
              {toolCount} tools on document.modelContext
            </span>
          ) : null}
          <span className="chip">
            {doneCount}/{STEPS.length} steps
          </span>
        </div>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="cta"
          disabled={agent.running}
          onClick={() => void runGuidedAgent("judge-run")}
        >
          {agent.running ? "Running…" : "Start the run"}
        </button>
        {agent.lastOrderId ? (
          <span className="chip chip-pass">order {agent.lastOrderId}</span>
        ) : null}
      </div>

      {agent.awaiting ? (
        <div
          className="trust-box"
          role="alertdialog"
          aria-label={
            agent.awaiting === "remediation"
              ? "Approval requested"
              : "Order confirmation"
          }
        >
          <h3>
            {agent.awaiting === "remediation"
              ? "The agent is asking permission"
              : "Confirm the order"}
          </h3>
          <p>
            {agent.awaiting === "remediation"
              ? "It will apply only the adaptations this site declared, and every one is reversible."
              : "Placing an order is consequential, so it takes a second, separate confirmation."}
          </p>
          <div className="button-row">
            <button type="button" onClick={() => resolveDecision("approved")}>
              {agent.awaiting === "remediation" ? "Approve" : "Confirm order"}
            </button>
            <button type="button" onClick={() => resolveDecision("denied")}>
              {agent.awaiting === "remediation" ? "Deny" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}

      <ol className="judge-steps" aria-live="polite">
        {progress.map((step, index) => (
          <li
            key={step.id}
            className={
              step.isDone
                ? "judge-step judge-done"
                : index === activeIndex && agent.running
                  ? "judge-step judge-active"
                  : "judge-step"
            }
          >
            <span className="judge-marker" aria-hidden="true">
              {step.isDone ? "✓" : index + 1}
            </span>
            <div>
              <span className="judge-step-label">{step.label}</span>
              <span className="judge-step-claim">{step.claim}</span>
              {step.isDone && step.text ? (
                <span className="judge-step-detail">{step.text}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <details className="judge-prompt">
        <summary>Prefer to drive it with your own agent?</summary>
        <p className="muted">
          In a browser with WebMCP enabled — Chrome with{" "}
          <code>chrome://flags/#enable-webmcp-testing</code>, or the ChatGPT
          in-app browser — the tools above are on{" "}
          <code>document.modelContext</code> and your agent can call them
          directly. Paste this:
        </p>
        <pre className="code">{AGENT_PROMPT}</pre>
        <div className="button-row">
          <button type="button" onClick={() => void copyPrompt()}>
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
        <p className="muted">
          The honest answer on step 2: this site declares keyboard,
          focus, accessible-name and form support. It does{" "}
          <strong>not</strong> declare high contrast — so a correct agent
          should tell you so rather than inventing a stylesheet.
        </p>
      </details>
    </section>
  );
}
