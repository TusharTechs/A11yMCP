import type { RemediationCategory } from "@/types/accessibility";

export interface RemediationDirective {
  selector: string;
  change: string;
}

export interface SiteManifest {
  site: string;
  rootSelector: string;
  capabilities: Array<{
    id: RemediationCategory;
    title: string;
    status: "supported";
    auditTool: string;
    repairTool: string;
  }>;
  directives: Record<RemediationCategory, RemediationDirective[]>;
}

/**
 * The site-declared accessibility manifest.
 *
 * This is the core A11yMCP idea: the website itself declares how it can be
 * adapted. The engine validates and applies these directives; it never
 * invents fixes and never touches the DOM arbitrarily.
 */
export const SITE_MANIFEST: SiteManifest = {
  site: "NOMA fixture",
  rootSelector: "#noma-fixture",
  capabilities: [
    {
      id: "accessible_names",
      title: "Accessible names",
      status: "supported",
      auditTool: "audit_accessible_names",
      repairTool: "repair_accessible_names",
    },
    {
      id: "keyboard_navigation",
      title: "Keyboard navigation",
      status: "supported",
      auditTool: "audit_keyboard_navigation",
      repairTool: "repair_keyboard_navigation",
    },
    {
      id: "form_association",
      title: "Form association",
      status: "supported",
      auditTool: "audit_form_associations",
      repairTool: "repair_form_associations",
    },
    {
      id: "focus_management",
      title: "Focus management",
      status: "supported",
      auditTool: "audit_focus_visibility",
      repairTool: "repair_focus_management",
    },
  ],
  directives: {
    accessible_names: [
      {
        selector: '[data-a11ymcp-target="wishlist"]',
        change: 'aria-label="Add NOMA Runner to wishlist"',
      },
    ],
    keyboard_navigation: [
      {
        selector: '[role="radio"]',
        change:
          "tabindex=0 plus keyboard handlers (Enter/Space select, arrows move)",
      },
    ],
    form_association: [
      {
        selector: "#email",
        change:
          'label[for="email"], aria-describedby="email-error", role="alert" on error',
      },
    ],
    focus_management: [
      {
        selector: "#noma-fixture",
        change: "focus token: defect-focus -> fixed-focus",
      },
    ],
  },
};

export function getFixtureRoot(): Element | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(SITE_MANIFEST.rootSelector);
}