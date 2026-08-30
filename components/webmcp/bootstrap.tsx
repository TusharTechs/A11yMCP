"use client";

import { useEffect } from "react";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import { pushEventLog } from "@/lib/observability/event-log";
import { executeA11yTool } from "@/lib/webmcp/runtime";
import {
  registerWebMCPToolsOnce,
  setAgentCallbacks,
} from "@/lib/webmcp/tools";

export default function WebMCPBootstrap() {
  useEffect(() => {
    setAgentCallbacks({
      logEvent: pushEventLog,
      getRoot: () => getFixtureRoot(),
    });
    registerWebMCPToolsOnce();

    // Evaluation transport for the benchmark harness only.
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("eval=1")
    ) {
      (window as unknown as { __a11ymcp?: unknown }).__a11ymcp = {
        executeA11yTool,
      };
    }
  }, []);

  return null;
}