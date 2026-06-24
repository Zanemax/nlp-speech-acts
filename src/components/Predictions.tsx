import type { ConditionId, EpistemicChannel } from "../core/types";
import {
  LARGE_EFFECT_THRESHOLD,
  PREDICTIONS,
  type Prediction,
} from "../scenarios/predictions";

// Shows the pre-registered predictions and, when a result is in, scores the
// relevant one against the measured risk difference. Registering predictions up
// front is what keeps the result honest (docs/plan.md §4).

export function Predictions({
  activeCondition,
  activeChannel,
  measuredRiskDifference,
}: {
  activeCondition?: ConditionId;
  activeChannel?: EpistemicChannel;
  measuredRiskDifference?: number;
}) {
  return (
    <div className="panel">
      <h2>Pre-registered predictions</h2>
      <p className="sub">
        Registered before running. Effect = uptake(intact) − uptake(broken); “large” means ≥{" "}
        {LARGE_EFFECT_THRESHOLD} in risk-difference units.
      </p>
      {PREDICTIONS.map((p) => {
        const isActive =
          p.condition === activeCondition &&
          (p.channel ? p.channel === activeChannel : true) &&
          measuredRiskDifference !== undefined;
        return (
          <PredictionRow
            key={p.id}
            p={p}
            isActive={!!isActive}
            measured={isActive ? measuredRiskDifference : undefined}
          />
        );
      })}
    </div>
  );
}

function PredictionRow({
  p,
  isActive,
  measured,
}: {
  p: Prediction;
  isActive: boolean;
  measured?: number;
}) {
  let score: { cls: string; text: string } = { cls: "pending", text: "not yet measured" };
  if (isActive && measured !== undefined) {
    const large = Math.abs(measured) >= LARGE_EFFECT_THRESHOLD;
    const pass = p.expect === "large_drop" ? large && measured > 0 : !large;
    score = {
      cls: pass ? "pass" : "fail",
      text: `${pass ? "✓ supported" : "✗ not supported"} — measured effect ${(measured * 100).toFixed(0)} pts`,
    };
  }
  return (
    <div className="prediction">
      <div className="ptitle">{p.title}</div>
      <div className="pdetail">{p.detail}</div>
      <div className={`pscore ${score.cls}`}>{score.text}</div>
    </div>
  );
}
