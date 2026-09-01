import type { ScenarioIntent, ScenarioId } from "@/types/agent";

/**
 * Deterministic intent parsing.
 *
 * Each scenario maps a natural-language utterance to a structured intent.
 * No LLM is required; an optional LLM layer can later map free text onto
 * these same structured intents without changing the workflow.
 */
export const SCENARIOS: ScenarioIntent[] = [
  {
    id: "keyboard-checkout",
    label: "Keyboard-only checkout",
    utterance: "I use keyboard-only navigation. Help me buy these shoes.",
    needs: ["keyboard_only", "strong_focus"],
    productQuery: "runner",
    productId: "noma-runner",
    size: "9",
    checkoutValues: {
      email: "alex@example.com",
      fullName: "Alex Sharma",
      address: "12 Lake Street",
      city: "Bengaluru",
      postalCode: "560001",
    },
  },
  {
    id: "screen-reader-checkout",
    label: "Screen reader checkout",
    utterance: "I use a screen reader. Help me buy these shoes.",
    needs: ["screen_reader_labels", "form_support"],
    productQuery: "runner",
    productId: "noma-runner",
    size: "9",
    checkoutValues: {
      email: "alex@example.com",
      fullName: "Alex Sharma",
      address: "12 Lake Street",
      city: "Bengaluru",
      postalCode: "560001",
    },
  },
  {
    id: "low-vision-checkout",
    label: "Low vision checkout",
    utterance: "I have low vision. Make it readable and help me buy these shoes.",
    needs: ["high_contrast", "large_targets", "strong_focus"],
    productQuery: "runner",
    productId: "noma-runner",
    size: "9",
    checkoutValues: {
      email: "alex@example.com",
      fullName: "Alex Sharma",
      address: "12 Lake Street",
      city: "Bengaluru",
      postalCode: "560001",
    },
  },
];

/**
 * Judge mode's run. Kept out of {@link SCENARIOS} so it does not appear in
 * the scenario picker, and it asks for one need this site does not declare
 * (`high_contrast`) so the honest rejection is on screen in every run.
 */
export const JUDGE_SCENARIO: ScenarioIntent = {
  id: "judge-run",
  label: "Judge run",
  utterance:
    "I can only use a keyboard, and I have low vision. Help me buy the NOMA Runner in size 9.",
  needs: ["keyboard_only", "strong_focus", "high_contrast"],
  productQuery: "runner",
  productId: "noma-runner",
  size: "9",
  checkoutValues: {
    email: "alex@example.com",
    fullName: "Alex Sharma",
    address: "12 Lake Street",
    city: "Bengaluru",
    postalCode: "560001",
  },
};

export function getScenario(id: ScenarioId): ScenarioIntent {
  if (id === JUDGE_SCENARIO.id) return JUDGE_SCENARIO;
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}