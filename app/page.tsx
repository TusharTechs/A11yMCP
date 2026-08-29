"use client";

import { useEffect, useRef, useState } from "react";
import {
  executeA11yTool,
  getLocalTools,
  isWebMCPSupported,
  type ToolResult,
} from "@/lib/webmcp/runtime";
import {
  registerPhase1ToolsOnce,
  setPhase1Callbacks,
  type Phase1EventInput,
} from "@/lib/webmcp/tools";

interface UiEvent extends Phase1EventInput {
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
  const [focusEnabled, setFocusEnabledState] = useState(false);
  const [approval, setApproval] = useState(true);
  const [lastExecution, setLastExecution] = useState<LastToolExecution | null>(
    null
  );

  const focusEnabledRef = useRef(false);

  useEffect(() => {
    setPhase1Callbacks({
      logEvent: (event) => {
        setEvents((prev) =>
          [
            {
              ...event,
              id: makeId(),
              timestamp: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 80)
        );
      },
      getFocusEnabled: () => focusEnabledRef.current,
      setFocusEnabled: (value) => {
        focusEnabledRef.current = value;
        setFocusEnabledState(value);
      },
    });

    registerPhase1ToolsOnce();
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
      setLastExecution({
        tool: name,
        result,
      });
    } catch (error) {
      setLastExecution({
        tool: name,
        result: {
          ok: false,
          error: {
            message:
              error instanceof Error ? error.message : "Unexpected error",
          },
        },
      });
    }
  }

  return (
    <main>
      <h1>A11yMCP — Phase 1 WebMCP Proof</h1>
      <p className="muted">
        Goal: prove real WebMCP tool registration, validated execution, visible
        mutation, verification, and rollback.
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
            : "Local tool execution still works, but official Phase 1 verification requires a WebMCP-enabled Chrome build."}
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
          <h2>Live preview</h2>

          <div
            className={`preview-area ${
              focusEnabled ? "focus-enabled" : "focus-suppressed"
            }`}
          >
            <p className="muted">
              Tab to the button below. Before repair, focus is suppressed.
              After repair, focus should be clearly visible.
            </p>

            <button id="preview-button" className="preview-button" type="button">
              Keyboard preview control
            </button>
          </div>

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

          <div className="button-row">
            <button
              type="button"
              onClick={() => runTool("get_accessibility_capabilities", {})}
            >
              Get capabilities
            </button>

            <button
              type="button"
              onClick={() => runTool("get_accessibility_state", {})}
            >
              Get state
            </button>

            <button
              type="button"
              onClick={() => runTool("inspect_accessibility_tree", {})}
            >
              Inspect tree
            </button>

            <button
              type="button"
              onClick={() =>
                runTool("repair_focus_management", {
                  scope: "preview",
                  approval,
                })
              }
            >
              Repair focus
            </button>

            <button
              type="button"
              onClick={() => runTool("verify_accessibility_profile", {})}
            >
              Verify
            </button>

            <button
              type="button"
              onClick={() => runTool("rollback_focus_management", {})}
            >
              Rollback
            </button>
          </div>
        </section>
      </div>

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