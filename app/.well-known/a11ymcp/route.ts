import { NextResponse } from "next/server";
import { SITE_A, SITE_B, type SiteManifest } from "@/lib/accessibility/manifest";

/**
 * Well-known A11yMCP capability manifest.
 *
 * Proposed convention: a site publishes its accessibility capability
 * contract at `/.well-known/a11ymcp`, independent of its rendering code.
 * An agent-aware browser (or the drop-in `a11ymcp-adapter.js`) reads this
 * and registers the matching WebMCP tools.
 *
 * `?site=site-b` returns the alternate config used by the A/B demo.
 */
function serialize(manifest: SiteManifest) {
  return {
    protocol: "a11ymcp/0.5",
    site: manifest.site,
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Prototype capability contract. Not an official standard; not a legal accessibility certification.",
    capabilities: manifest.capabilities.map((capability) => ({
      id: capability.id,
      title: capability.title,
      status: capability.status,
      limitation: capability.limitation ?? null,
      auditTool: capability.auditTool,
      repairTool: capability.repairTool,
    })),
    notDeclared: manifest.notDeclared,
  };
}

export function GET(request: Request): NextResponse {
  const site = new URL(request.url).searchParams.get("site");
  const manifest = site === "site-b" ? SITE_B : SITE_A;
  return NextResponse.json(serialize(manifest), {
    headers: {
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}
