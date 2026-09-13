import type { UptakeCategory } from "./core/types";

/** Plain-language names for how Eliza's answers were classified. */
export const CATEGORY_LABELS: Record<UptakeCategory, string> = {
  acts_on_it: "Acts on it — relies / proceeds",
  withholds: "Withholds — verifies or holds off",
  rejects: "Rejects — treats it as having no hold",
  holds_to_it: "Holds him to it — denies the disavowal",
  lets_it_go: "Lets it go — accepts nothing was committed",
  invalid: "Unparseable answer",
};
