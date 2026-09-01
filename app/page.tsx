import Link from "next/link";

/**
 * A bookmarklet that loads the probe from this origin. Kept as a one-liner
 * so it survives a copy-paste into a bookmark; the real logic lives in
 * `public/a11ymcp-probe.js`.
 */
const PROBE_BOOKMARKLET =
  "javascript:(function(){var s=document.createElement('script');" +
  "s.src='https://a11ymcp.vercel.app/a11ymcp-probe.js?'+Date.now();" +
  "document.body.appendChild(s);})();";

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

        <h2>Try it on any page</h2>
        <p>
          Make a new bookmark with this as its URL, then run it on any
          website:
        </p>
        <pre className="code bookmarklet">{PROBE_BOOKMARKLET}</pre>
        <p>
          It reports what the page looks like to an agent: whether WebMCP is
          available, how many tools the page registers, and whether it
          declares an accessibility capability contract. On almost every site
          today the answer is <em>none</em> — which is the point.
        </p>
        <p className="muted">
          The probe deliberately does <strong>not</strong> adapt the page it
          runs on. Changing someone else&rsquo;s site uninvited is exactly the
          overlay behaviour A11yMCP exists to replace, so the probe reads and
          reports, and adds nothing but its own dismissible panel.
        </p>
      </section>
    </main>
  );
}