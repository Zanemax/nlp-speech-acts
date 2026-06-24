import type { ConditionId, EpistemicChannel } from "../core/types";

// Pre-registered predictions (docs/plan.md §4). Registering these BEFORE running
// is what makes a result honest rather than a post-hoc story. The dashboard
// scores measured effects against them automatically.

export interface Prediction {
  id: string;
  title: string;
  detail: string;
  /** Applies to which condition. */
  condition: ConditionId;
  /** For GAMMA, which channel this prediction is about. */
  channel?: EpistemicChannel;
  /**
   * Direction/magnitude of the expected effect of BREAKING the condition,
   * expressed as expected risk difference (rate_intact − rate_broken).
   *   "large_drop"  → expect a big positive risk difference (uptake collapses)
   *   "null"        → expect ~0 (uptake unchanged)
   */
  expect: "large_drop" | "null";
}

export const PREDICTIONS: Prediction[] = [
  {
    id: "P1-A1",
    title: "A.1 breaking → large, clean effect",
    detail:
      "Stripping the hearer's concept of the act (no shared procedure) should void the act: uptake collapses. This is a misfire.",
    condition: "A1",
    expect: "large_drop",
  },
  {
    id: "P1-A2",
    title: "A.2 breaking → large, clean effect",
    detail:
      "Removing the speaker's authority/standing should void the act: uptake collapses. This is a misfire (forging A.2 is the jailbreak case).",
    condition: "A2",
    expect: "large_drop",
  },
  {
    id: "P2-GAMMA-concealed",
    title: "Γ concealed → weak/null effect (the headline)",
    detail:
      "An insincere assertion whose deceptive plan stays private should leave uptake essentially unchanged — the act stands but is hollow. This is an ABUSE, not a misfire, and it is the central asymmetry.",
    condition: "GAMMA",
    channel: "concealed",
    expect: "null",
  },
  {
    id: "P2-GAMMA-revealed",
    title: "Γ revealed → uptake breaks retroactively",
    detail:
      "Once the hearer can read the deceptive plan (the epistemic channel is open), uptake should collapse. Sincerity becomes visible to uptake only through this channel.",
    condition: "GAMMA",
    channel: "revealed",
    expect: "large_drop",
  },
];

/** Threshold (in risk-difference units) above which we call an effect "large". */
export const LARGE_EFFECT_THRESHOLD = 0.25;

export function findPrediction(
  condition: ConditionId,
  channel?: EpistemicChannel,
): Prediction | undefined {
  return PREDICTIONS.find(
    (p) => p.condition === condition && (p.channel ? p.channel === channel : true),
  );
}
