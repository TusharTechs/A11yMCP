"use client";

import { useState } from "react";
import {
  getBrowserTools,
  invokeTool,
  isNativeWebMCP,
  webmcpTransportLabel,
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
  const [transport, setTransport] = useState<string>("");
  const [running, setRunning] = useState(false);

  async function runChain(): Promise<void> {
    setRunning(true);
    setTransport(webmcpTransportLabel());
    const native = isNativeWebMCP();
    const via = native
      ? "document.modelContext (native)"
      : "document.modelContext (A11yMCP spec polyfill)";
    const out: ChainResult[] = [];

    // 1. registerTool -> getTools
    const browserTools = await getBrowserTools();
    if (!browserTools) {
      out.push({
        id: "discovery",
        label: "registerTool → getTools",
        status: "fail",
        detail: "No document.modelContext.getTools available.",
      });
    } else {
      const names = browserTools.map((tool) => tool.name);
      const core = [
        "get_accessibility_capabilities",
        "negotiate_accessibility_profile",
        "verify_accessibility_profile",
      ].every((name) => names.includes(name));
      out.push({
        id: "discovery",
        label: "registerTool → getTools",
        status: core ? "pass" : "fail",
        detail: `${browserTools.length} tools visible via getTools(); core A11yMCP tools present: ${core}. Transport: ${via}.`,
      });
    }

    // 2. executeTool (read)
    const read = await invokeTool("get_accessibility_capabilities", {});
    out.push({
      id: "execute-read",
      label: "executeTool (read)",
      status: read.ok ? "pass" : "fail",
      detail: read.ok
        ? `Executed through ${via}.`
        : `Failed: ${read.error.message}`,
    });

    // 3. executeTool (approval-gated remediation)
    const repair = await invokeTool("repair_focus_management", {
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

    // 4. invalid input rejection
    const invalid = await invokeTool("repair_focus_management", {});
    out.push({
      id: "invalid",
      label: "invalid input rejection",
      status: !invalid.ok ? "pass" : "fail",
      detail: !invalid.ok
        ? "Structured schema rejection returned through executeTool."
        : "BUG: invalid input accepted.",
    });

    // 5. consequential gate
    const consequential = await invokeTool("place_order", {
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

    // 6. cancellation
    const controller = new AbortController();
    controller.abort();
    const aborted = await invokeTool(
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
        Exercises the real chain through <code>document.modelContext</code>:
        registerTool → getTools → executeTool → validation → gates →
        cancellation. When a browser ships native WebMCP it is used
        automatically; otherwise A11yMCP installs a spec-compatible polyfill so
        the same code path runs everywhere.
      </p>
      <div className="button-row">
        <button type="button" disabled={running} onClick={() => void runChain()}>
          Run chain verification
        </button>
      </div>
      {transport ? (
        <p className={isNativeWebMCP() ? "status-ok" : "muted"}>
          Live transport: <strong>{transport}</strong>
        </p>
      ) : null}
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
