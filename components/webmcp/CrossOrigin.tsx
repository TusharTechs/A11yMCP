"use client";

import { useEffect, useRef, useState } from "react";
import {
  ToolFrameUnavailable,
  connectToolFrame,
  type FederatedTool,
} from "@/lib/webmcp/federation";

/**
 * Cross-origin tools: this page asking a framed third-party widget what it is
 * willing to share, and being told no when it overreaches.
 *
 * The frame is sandboxed without `allow-same-origin`, so it has an opaque
 * origin and there is no shared JS context to cheat with — every line in the
 * log below is a real `postMessage` round trip that the widget chose to
 * answer.
 */

type LogEntry = { kind: "ok" | "refused" | "info"; text: string };

export default function CrossOrigin() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [origin, setOrigin] = useState("");
  const [trustUs, setTrustUs] = useState(true);
  const [tools, setTools] = useState<FederatedTool[] | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const push = (entry: LogEntry): void =>
    setLog((current) => [...current, entry].slice(-10));

  // The widget is configured to trust one origin. Flip the toggle and it is
  // configured to trust somebody else — so it stops answering us.
  const configuredEmbedder = trustUs ? origin : "https://not-this-site.example";
  const frameSrc = origin
    ? `/tool-frame.html?embedder=${encodeURIComponent(configuredEmbedder)}`
    : "";

  async function discover(): Promise<void> {
    const frame = frameRef.current;
    if (!frame || busy) return;
    setBusy(true);
    setTools(null);
    setLog([]);

    try {
      // The frame is sandboxed, so its origin is opaque and cannot be
      // targeted by name; "*" is the only valid target for it.
      const client = connectToolFrame(frame, "*");

      const listed = await client.getTools();
      setTools(listed);
      push({
        kind: "ok",
        text: `getTools() → ${listed.length} tool(s): ${
          listed.map((tool) => tool.name).join(", ") || "none"
        }`,
      });

      if (listed.length > 0) {
        const result = await client.executeTool(listed[0].name, {});
        push({
          kind: result.ok ? "ok" : "refused",
          text: result.ok
            ? `executeTool("${listed[0].name}") → ${JSON.stringify(result.data).slice(0, 120)}`
            : `executeTool("${listed[0].name}") → ${result.error.message}`,
        });
      }

      // Now overreach on purpose: a tool the widget never exposed.
      const forbidden = await client.executeTool("charge_travel_card", {});
      push({
        kind: forbidden.ok ? "ok" : "refused",
        text: forbidden.ok
          ? "charge_travel_card ran — this should not happen."
          : `executeTool("charge_travel_card") → ${forbidden.error.message}`,
      });
    } catch (error) {
      push({
        kind: "refused",
        text:
          error instanceof ToolFrameUnavailable
            ? error.message
            : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-label="Cross-origin tools">
      <h2>Cross-origin tools</h2>
      <p className="muted">
        A third-party widget in a sandboxed iframe — an opaque origin, so no
        shared globals and no shared storage. It registers three tools and
        opts <em>two</em> of them in to this page with{" "}
        <code>registerTool(def, {"{ exposedTo }"})</code>. The third is never
        exposed. This page holds <code>allow=&quot;tools&quot;</code> on the
        frame, which is what the Permissions Policy requires.
      </p>

      <div className="button-row">
        <button type="button" onClick={() => void discover()} disabled={busy || !origin}>
          {busy ? "Asking…" : "Ask the widget for its tools"}
        </button>
        <label className="pref-option">
          <input
            type="checkbox"
            checked={trustUs}
            onChange={(event) => {
              setTrustUs(event.target.checked);
              setTools(null);
              setLog([]);
            }}
          />
          the widget trusts this origin
        </label>
      </div>

      <div className="cross-origin">
        <div>
          <p className="group-label">What this page got back</p>
          <ol className="frame-log" aria-live="polite">
            {log.length === 0 ? (
              <li className="muted">Nothing asked yet.</li>
            ) : (
              log.map((entry, index) => (
                <li key={index} className={`frame-${entry.kind}`}>
                  {entry.text}
                </li>
              ))
            )}
          </ol>

          {tools ? (
            <div className="chips">
              <span
                className={`chip ${tools.length === 2 ? "chip-pass" : "chip-fail"}`}
              >
                {tools.length} of 3 tools visible
              </span>
              <span className="chip chip-pass">
                charge_travel_card: never exposed
              </span>
            </div>
          ) : null}
        </div>

        <div>
          <p className="group-label">The widget</p>
          {frameSrc ? (
            <iframe
              ref={frameRef}
              src={frameSrc}
              title="Meridian Transit widget"
              // The Permissions Policy the spec requires for a frame to
              // expose tools at all, and a sandbox with no allow-same-origin
              // so the frame really is a foreign origin.
              allow="tools"
              sandbox="allow-scripts"
              className="tool-frame"
            />
          ) : null}
        </div>
      </div>

      <p className="muted">
        Untick the box and the widget is configured to trust a different site.
        Nothing about this page changes — it simply stops getting answers,
        because the decision was never ours to make.
      </p>
    </section>
  );
}
