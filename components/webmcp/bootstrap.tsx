"use client";

import { useEffect } from "react";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import { pushEventLog } from "@/lib/observability/event-log";
import { invokeTool } from "@/lib/webmcp/runtime";
import {
  registerCoreA11yTools,
  setAgentCallbacks,
} from "@/lib/webmcp/tools";

export default function WebMCPBootstrap() {
  useEffect(() => {
    setAgentCallbacks({
      logEvent: pushEventLog,
      getRoot: () => getFixtureRoot(),
    });
    // Only the always-available tools are registered globally. Commerce
    // tools are task-scoped and registered by the storefront on mount.
    registerCoreA11yTools();

    // Evaluation transport for the benchmark harness. This calls the same
    // invokeTool() the UI uses, which routes through
    // document.modelContext.executeTool (native or the spec polyfill).
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("eval=1")
    ) {
      (window as unknown as { __a11ymcp?: unknown }).__a11ymcp = {
        invokeTool,
      };
    }
  }, []);

  return null;
}
