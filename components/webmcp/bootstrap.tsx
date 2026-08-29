"use client";

import { useEffect } from "react";
import { getFixtureRoot } from "@/lib/accessibility/manifest";
import { pushEventLog } from "@/lib/observability/event-log";
import {
  registerWebMCPToolsOnce,
  setAgentCallbacks,
} from "@/lib/webmcp/tools";

/**
 * Registers the WebMCP tool surface on every route so judges can inspect
 * tools from any page. Tools that need the fixture return a structured
 * "not mounted" error when the demo page is not open.
 */
export default function WebMCPBootstrap() {
  useEffect(() => {
    setAgentCallbacks({
      logEvent: pushEventLog,
      getRoot: () => getFixtureRoot(),
    });
    registerWebMCPToolsOnce();
  }, []);

  return null;
}