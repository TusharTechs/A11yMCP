import type {
  AccessibilityNeed,
  RemediationCategory,
  UserProfile,
} from "@/types/accessibility";

export const NEED_TO_CAPABILITY: Record<
  AccessibilityNeed,
  RemediationCategory | null
> = {
  keyboard_only: "keyboard_navigation",
  strong_focus: "focus_management",
  screen_reader_labels: "accessible_names",
  form_support: "form_association",
  high_contrast: null,
  reduced_motion: "reduced_motion",
  large_targets: null,
};

export const APPLY_ORDER: RemediationCategory[] = [
  "keyboard_navigation",
  "focus_management",
  "accessible_names",
  "form_association",
  "reduced_motion",
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