import type { CellResult, RunResult, Scenario } from "./types";

// Aggregation: per-cell uptake rates with Wilson 95% CIs, and the effect of
// breaking a condition as a risk difference + Cohen's h (docs/plan.md §4).

export function summarizeCell(scenario: Scenario, runs: RunResult[]): CellResult {
  const nValid = runs.filter((r) => r.status === "ok").length;
  const nInvalid = runs.filter((r) => r.status === "invalid").length;
  const nError = runs.filter((r) => r.status === "error").length;
  const uptakeCount = runs.filter((r) => r.status === "ok" && r.uptake === true).length;
  const rate = nValid > 0 ? uptakeCount / nValid : 0;
  const [ciLow, ciHigh] = wilson(uptakeCount, nValid);

  return {
    scenario,
    runs,
    n: runs.length,
    nValid,
    nInvalid,
    nError,
    uptakeCount,
    rate,
    ciLow,
    ciHigh,
  };
}

/** Wilson score interval for a binomial proportion at 95% (z = 1.96). */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const phat = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const low = (centre - margin) / denom;
  const high = (centre + margin) / denom;
  return [Math.max(0, low), Math.min(1, high)];
}

export interface EffectSize {
  riskDifference: number; // rate_intact − rate_broken
  cohensH: number; // arcsine-based effect size for two proportions
  magnitude: "negligible" | "small" | "medium" | "large";
}

export function effectSize(rateIntact: number, rateBroken: number): EffectSize {
  const riskDifference = rateIntact - rateBroken;
  const phi = (p: number) => 2 * Math.asin(Math.sqrt(clamp01(p)));
  const cohensH = phi(rateIntact) - phi(rateBroken);
  const abs = Math.abs(cohensH);
  // Cohen's conventional bands for h.
  const magnitude =
    abs < 0.2 ? "negligible" : abs < 0.5 ? "small" : abs < 0.8 ? "medium" : "large";
  return { riskDifference, cohensH, magnitude };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Misfire (act void) vs abuse (act hollow) tag for the headline. */
export function felicityVerdict(
  conditionUnderTest: string,
  riskDifference: number,
  threshold: number,
): { tag: "misfire" | "abuse" | "inconclusive"; gloss: string } {
  const big = Math.abs(riskDifference) >= threshold;
  if (conditionUnderTest === "GAMMA") {
    return big
      ? { tag: "misfire", gloss: "Uptake collapsed — the act was voided (visible insincerity)." }
      : { tag: "abuse", gloss: "Uptake held — the act stands but is hollow (insincerity invisible to uptake)." };
  }
  // A.1 / A.2 / B
  return big
    ? { tag: "misfire", gloss: "Uptake collapsed — breaking the condition voided the act (misfire)." }
    : {
        tag: "inconclusive",
        gloss: "Uptake held despite the broken condition — possible promiscuous uptake (weak felicity immune system).",
      };
}
