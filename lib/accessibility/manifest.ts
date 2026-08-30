import type {
  CapabilityStatus,
  RemediationCategory,
  SiteId,
} from "@/types/accessibility";

export interface RemediationDirective {
  selector: string;
  change: string;
}

export interface SiteManifest {
  id: SiteId;
  site: string;
  rootSelector: string;
  capabilities: Array<{
    id: RemediationCategory;
    title: string;
    status: CapabilityStatus;
    limitation?: string;
    auditTool: string;
    repairTool: string;
  }>;
  notDeclared: string[];
  directives: Record<RemediationCategory, RemediationDirective[]>;
}

/**
 * Site-declared accessibility manifests (reference contract).
 * Same human request produces different negotiated outcomes per site.
 */
export const SITE_A: SiteManifest = {
  id: "site-a",
  site: "NOMA Store A",
  rootSelector: "#noma-fixture",
  capabilities: [
    {
      id: "accessible_names",
      title: "Accessible names",
      status: "partial",
      limitation: "Declared names cover task-critical controls only.",
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
  notDeclared: ["high_contrast", "reduced_motion", "large_targets"],
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
      { selector: "#email", change: 'label[for], aria-describedby, role="alert"' },
      { selector: "#fullName", change: 'label[for], aria-describedby, role="alert"' },
      { selector: "#address", change: 'label[for], aria-describedby, role="alert"' },
      { selector: "#city", change: 'label[for], aria-describedby, role="alert"' },
      { selector: "#postalCode", change: 'label[for], aria-describedby, role="alert"' },
    ],
    focus_management: [
      { selector: "#noma-fixture", change: "focus token: defect-focus -> fixed-focus" },
    ],
    reduced_motion: [],
  },
};

export const SITE_B: SiteManifest = {
  id: "site-b",
  site: "NOMA Store B",
  rootSelector: "#noma-fixture",
  capabilities: [
    {
      id: "keyboard_navigation",
      title: "Keyboard navigation",
      status: "supported",
      auditTool: "audit_keyboard_navigation",
      repairTool: "repair_keyboard_navigation",
    },
    {
      id: "focus_management",
      title: "Focus management",
      status: "supported",
      auditTool: "audit_focus_visibility",
      repairTool: "repair_focus_management",
    },
    {
      id: "reduced_motion",
      title: "Reduced motion",
      status: "supported",
      auditTool: "audit_reduced_motion",
      repairTool: "repair_reduced_motion",
    },
  ],
  notDeclared: ["high_contrast", "large_targets", "screen_reader_labels", "form_support"],
  directives: {
    accessible_names: [],
    keyboard_navigation: [
      {
        selector: '[role="radio"]',
        change:
          "tabindex=0 plus keyboard handlers (Enter/Space select, arrows move)",
      },
    ],
    form_association: [],
    focus_management: [
      { selector: "#noma-fixture", change: "focus token: defect-focus -> fixed-focus" },
    ],
    reduced_motion: [
      { selector: "#noma-fixture", change: 'data-motion="reduced" (animations off)' },
    ],
  },
};

let currentSite: SiteId = "site-a";
const siteListeners = new Set<() => void>();

export function subscribeSite(listener: () => void): () => void {
  siteListeners.add(listener);
  return () => {
    siteListeners.delete(listener);
  };
}

export function getSiteId(): SiteId {
  return currentSite;
}

export function setSite(id: SiteId): void {
  if (id === currentSite) return;
  currentSite = id;
  siteListeners.forEach((listener) => listener());
}

export function getCurrentManifest(): SiteManifest {
  return currentSite === "site-b" ? SITE_B : SITE_A;
}

export function getFixtureRoot(): Element | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(getCurrentManifest().rootSelector);
}