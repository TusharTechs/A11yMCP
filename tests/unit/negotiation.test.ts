import { describe, expect, it } from "vitest";
import { negotiateProfile } from "@/lib/accessibility/negotiation";

describe("capability negotiation", () => {
  it("accepts supported capabilities", () => {
    const profile = negotiateProfile(["keyboard_only", "strong_focus"]);
    expect(profile.accepted.map((a) => a.capability).sort()).toEqual([
      "focus_management",
      "keyboard_navigation",
    ]);
    expect(profile.rejected).toHaveLength(0);
  });

  it("marks accessible names as partial with a limitation", () => {
    const profile = negotiateProfile(["screen_reader_labels"]);
    expect(profile.accepted[0].status).toBe("partial");
    expect(profile.accepted[0].limitation).toBeTruthy();
  });

  it("rejects undeclared capabilities honestly", () => {
    const profile = negotiateProfile([
      "high_contrast",
      "reduced_motion",
      "large_targets",
    ]);
    expect(profile.accepted).toHaveLength(0);
    expect(profile.rejected).toHaveLength(3);
  });
});