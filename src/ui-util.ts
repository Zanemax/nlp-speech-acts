import type { UptakeCategory } from "./core/types";

export const CATEGORY_LABELS: Record<UptakeCategory, string> = {
  relies: "Relies on the commitment",
  discounts: "Discounts — arranges a backup",
  recognizes_standing: "Recognizes directive with standing",
  complies_only: "Would comply, but denies standing (mere compliance)",
  rejects_standing: "Rejects the speaker's standing",
  accepts: "Accepts into common ground",
  doubts: "Doubts — withholds reliance",
  acts_on_it: "Acts on it — relies / proceeds",
  withholds: "Withholds — verifies or holds off",
  rejects: "Rejects — treats it as having no hold",
  invalid: "Unparseable answer",
};

export function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

export function pct1(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
