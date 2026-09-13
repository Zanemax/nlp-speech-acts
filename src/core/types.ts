// Shared types for a Diego → Eliza dialogue and how it is scored.

/** How Eliza's answer to an uptake test is classified. */
export type UptakeCategory =
  // behavioural test — promise and assertion
  | "acts_on_it" // relies on it                         -> uptake
  | "withholds" // holds off, verifies, or hedges         -> no uptake
  | "rejects" // treats it as having no hold              -> no uptake
  // behavioural test — command: a binding order is uptake, mere compliance is not
  | "recognizes_standing" //                              -> uptake
  | "complies_only" //                                    -> no uptake
  | "rejects_standing" //                                 -> no uptake
  // denial probe
  | "holds_to_it" // holds Diego to what he said          -> uptake
  | "lets_it_go" // accepts that nothing was committed    -> no uptake
  | "invalid"; // no readable answer

/** Categories that count as the act having been taken up. */
export const UPTAKE_TRUE: ReadonlySet<UptakeCategory> = new Set<UptakeCategory>([
  "acts_on_it",
  "recognizes_standing",
  "holds_to_it",
]);

/** One turn of a dialogue. */
export interface Turn {
  role: "speaker" | "hearer" | "probe";
  /** What the model was shown (for a probe, the uptake question). */
  shown?: string;
  /** Raw model output for this turn. */
  text: string;
  /** Diego's private reasoning (<plan>), never shown to Eliza. */
  plan?: string;
  /** Diego's spoken words (<say>), the only part Eliza sees. */
  say?: string;
  /** Display name for a probe turn, e.g. "Denial probe". */
  label?: string;
}
