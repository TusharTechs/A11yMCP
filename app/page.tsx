import Link from "next/link";

export default function LandingPage() {
  return (
    <main id="main" className="landing">
      <section className="hero">
        <h1>Make the web adaptable to the person using it.</h1>
        <p>
          A11yMCP lets websites expose accessibility capabilities to AI agents,
          so agents can adapt live experiences to human needs, verify the
          result, and complete real tasks.
        </p>
        <div className="button-row">
          <Link className="cta" href="/demo">
            Try the live demo
          </Link>
          <Link className="cta secondary" href="/#how">
            How WebMCP works
          </Link>
          <Link className="cta secondary" href="/inspector">
            WebMCP inspector
          </Link>
          <a className="cta secondary" href="/partner">
            Drop-in adapter demo
          </a>
        </div>
      </section>

      <section id="how" className="panel how">
        <h2>Why WebMCP, not browser automation?</h2>
        <p>
          Browser automation forces agents to infer UI semantics from DOM and
          pixels, then perform fragile sequences of clicks and typing. WebMCP
          lets the website explicitly declare structured capabilities and
          schemas, so an agent can invoke typed, validated operations instead
          of guessing how the interface works.
        </p>
        <ol>
          <li>Human need is expressed.</li>
          <li>Agent discovers site capabilities via WebMCP.</li>
          <li>Agent negotiates an accessibility profile.</li>
          <li>User approves reversible remediation.</li>
          <li>Site adapts live; agent verifies.</li>
          <li>Human task completes.</li>
        </ol>
        <h2>What was previously difficult</h2>
        <p>
          Before WebMCP, an agent saw DOM plus pixels and had to infer what
          each control does, which adaptations are possible, how to modify
          them, and whether the change worked. With WebMCP, the agent sees
          structured capabilities, schemas, and current state — and can
          discover, select, invoke, and verify.
        </p>

        <h2>Any site can opt in</h2>
        <p>
          The <a href="/partner">Partner site demo</a> is a plain static HTML
          page this app does not render. It became agent-adaptable by adding
          one <code>&lt;link rel=&quot;a11ymcp-manifest&quot;&gt;</code> and one{" "}
          <code>&lt;script src=&quot;/a11ymcp-adapter.js&quot;&gt;</code>. The
          adapter reads the site-declared manifest and registers the same
          discover → negotiate → approve → adapt → verify tool flow on{" "}
          <code>document.modelContext</code>.
        </p>
      </section>
    </main>
  );
}