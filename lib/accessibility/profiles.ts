import type {
  AccessibilityNeed,
  RemediationCategory,
  UserProfile,
} from "@/types/accessibility";

/**
 * Deterministic mapping from human accessibility needs to site capabilities.
 * A null value means no current site capability can satisfy this need;
 * the negotiation must reject it honestly instead of faking support.
 */
export const NEED_TO_CAPABILITY: Record<
  AccessibilityNeed,
  RemediationCategory | null
> = {
  keyboard_only: "keyboard_navigation",
  strong_focus: "focus_management",
  screen_reader_labels: "accessible_names",
  form_support: "form_association",
  high_contrast: null,
  reduced_motion: null,
  large_targets: null,
};

export const APPLY_ORDER: RemediationCategory[] = [
  "keyboard_navigation",
  "focus_management",
  "accessible_names",
  "form_association",
];

export const PROFILE_PRESETS: UserProfile[] = [
  {
    id: "keyboard-only",
    label: "Keyboard-only",
    needs: ["keyboard_only", "strong_focus"],
  },
  {
    id: "screen-reader",
    label: "Screen reader",
    needs: ["screen_reader_labels", "form_support"],
  },
  {
    id: "low-vision",
    label: "Low vision",
    needs: ["high_contrast", "large_targets", "strong_focus"],
  },
  {
    id: "motion-sensitive",
    label: "Motion sensitive",
    needs: ["reduced_motion"],
  },
];