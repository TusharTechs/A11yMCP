import { NextResponse } from "next/server";
import { SITE_A, SITE_B } from "@/lib/accessibility/manifest";

/**
 * The A11yMCP capability manifest, served independently of the app bundle.
 *
 * The proposed well-known location is `/.well-known/a11ymcp`; this route is
 * the demo's stand-in. A site can publish a contract like this without
 * touching its rendering code — an agent-aware browser (or the A11yMCP
 * adapter) reads it, and `get_accessibility_capabilities` mirrors it.
 *
 * `?site=site-b` returns the alternate configuration used by the A/B demo.
 */
export function GET(request: Request): NextResponse {
  const site = new URL(request.url).searchParams.get("site");
  const manifest = site === "site-b" ? SITE_B : SITE_A;

  return NextResponse.json(
    {
      protocol: "a11ymcp/0.5",
      wellKnown: "/.well-known/a11ymcp",
      generatedAt: new Date().toISOString(),
      disclaimer:
        "Prototype capability contract. Not an official standard; not a legal accessibility certification.",
      site: manifest.site,
      capabilities: manifest.capabilities.map((capability) => ({
        id: capability.id,
        title: capability.title,
        status: capability.status,
        limitation: capability.limitation ?? null,
        auditTool: capability.auditTool,
        repairTool: capability.repairTool,
      })),
      notDeclared: manifest.notDeclared,
    },
    {
      headers: {
        "cache-control": "public, max-age=60",
        "content-type": "application/json; charset=utf-8",
      },
    }
  );
}
