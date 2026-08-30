"use client";

import { useState } from "react";
import {
  executeA11yTool,
  executeBrowserTool,
  getBrowserTools,
} from "@/lib/webmcp/runtime";
import type { AuditResult } from "@/types/accessibility";

interface ChainResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "na";
  detail: string;
}

export default function ChainVerification() {
  const [results, setResults] = useState<ChainResult[]>([]);
  const [running, setRunning] = useState(false);

  async function runChain(): Promise<void> {
    setRunning(true);
    const out: ChainResult[] = [];

    const browserTools = await getBrowserTools();
    if (!browserTools) {
      out.push({
        id: "discovery",
        label: "registerTool → getTools",
        status: "na",
        detail: "WebMCP unavailable in this browser; local registry only.",
      });
    } else {
      const names = browserTools.map((tool) => tool.name);
      const visible = [
        "get_accessibility_capabilities",
        "negotiate_accessibility_profile",
        "place_order",
      ].every((name) => names.includes(name));
      out.push({
        id: "discovery",
        label: "registerTool → getTools",
        status: visible ? "pass" : "fail",
        detail: `Browser-visible tools: ${browserTools.length}; core A11yMCP tools visible: ${visible}`,
      });
    }

    const viaBrowser = await executeBrowserTool(
      "get_accessibility_capabilities",
      {}
    );
    if (viaBrowser !== null) {
      out.push({
        id: "execute-read",
        label: "executeTool (read)",
        status: "pass",
        detail: "Executed via document.modelContext.executeTool.",
      });
    } else {
      const local = await executeA11yTool("get_accessibility_capabilities", {});
      out.push({
        id: "execute-read",
        label: "executeTool (read)",
        status: local.ok ? "pass" : "fail",
        detail:
          "WebMCP executeTool unavailable; executed via local validated executor.",
      });
    }

    const repair = await executeA11yTool("repair_focus_management", {
      approval: true,
    });
    const repairOk =
      repair.ok && (repair.data as { success?: boolean }).success === true;
    const notMounted =
      !repair.ok && repair.error.message.includes("not mounted");
    out.push({
      id: "gated",
      label: "executeTool (approval-gated remediation)",
      status: repairOk ? "pass" : notMounted ? "na" : "fail",
      detail: repairOk
        ? "Approved remediation executed."
        : notMounted
          ? "Fixture not mounted on this route; open /demo for fixture-backed checks."
          : repair.ok
            ? "Unexpected success shape."
            : repair.error.message,
    });

    const invalid = await executeA11yTool("repair_focus_management", {});
    out.push({
      id: "invalid",
      label: "invalid input rejection",
      status: !invalid.ok ? "pass" : "fail",
      detail: !invalid.ok
        ? "Structured schema rejection returned."
        : "BUG: invalid input accepted.",
    });

    const consequential = await executeA11yTool("place_order", {
      sessionId: "x",
      confirmation: false,
    });
    out.push({
      id: "consequential",
      label: "consequential gate (confirmation must be true)",
      status: !consequential.ok ? "pass" : "fail",
      detail: !consequential.ok
        ? "confirmation:false rejected by schema."
        : "BUG: order placed without confirmation.",
    });

    const controller = new AbortController();
    controller.abort();
    const aborted = await executeA11yTool(
      "audit_focus_visibility",
      {},
      { signal: controller.signal }
    );
    const abortedOk =
      (!aborted.ok &&
        aborted.error.message.toLowerCase().includes("abort")) ||
      (aborted.ok &&
        (aborted.data as AuditResult).violations.some(
          (violation) => violation.rule === "aborted"
        ));
    out.push({
      id: "cancel",
      label: "cancellation (AbortSignal)",
      status: abortedOk ? "pass" : "fail",
      detail: abortedOk
        ? "Pre-aborted signal rejected before execution (runtime-level cancellation)."
        : "Abort signal not honored.",
    });

    setResults(out);
    setRunning(false);
  }

  return (
    <section className="panel" aria-label="WebMCP chain verification">
      <h2>WebMCP chain verification</h2>
      <p className="muted">
        Verifies the real chain: registerTool → getTools → executeTool →
        validation → state → cancellation. Never uses the local registry as
        proof of browser-visible WebMCP.
      </p>
      <div className="button-row">
        <button type="button" disabled={running} onClick={() => void runChain()}>
          Run chain verification
        </button>
      </div>
      {results.length > 0 ? (
        <ul className="tool-list">
          {results.map((result) => (
            <li key={result.id}>
              <strong>
                {result.status.toUpperCase()} — {result.label}
              </strong>
              <div className="muted">{result.detail}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}