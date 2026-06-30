// Generates schema-accurate sample result files under public/results/.
//
// These match the app's own export shape (a BatchResult) exactly, so a real
// exported file loads identically. They embody the corrected, BEHAVIORAL scoring:
// the probe turn is an IN-WORLD follow-up (a third party prompts the hearer to
// act), and uptake is read from what the hearer does — never a detached
// meta-question, never an LLM judge. Run: `node scripts/make-fixtures.mjs`.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "results");
mkdirSync(OUT, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────
const UPTAKE = {
  relies: true,
  recognizes_standing: true,
  accepts: true,
  discounts: false,
  complies_only: false,
  rejects_standing: false,
  doubts: false,
};

function wilson(s, n, z = 1.96) {
  if (n === 0) return [0, 0];
  const p = s / n,
    z2 = z * z,
    d = 1 + z2 / n;
  const c = p + z2 / (2 * n);
  const m = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

let runSeq = 0;
function makeRun(scenarioId, spec) {
  const { category, performed = true, error = false, speaker, plan, hearer, followup, response } = spec;
  const idx = runSeq++;
  if (error) {
    return {
      scenarioId,
      index: idx,
      status: "error",
      uptake: null,
      category: "invalid",
      turns: [],
      error: "Gemini error 503 (overloaded)",
    };
  }
  const speakerTurn = { role: "speaker", text: speaker };
  if (plan !== undefined) {
    // assertion: speaker emits <plan>/<say>; an empty plan means the speaker
    // never formed the insincere plan (manipulation check will fail this run).
    const say = speaker;
    speakerTurn.say = say;
    speakerTurn.plan = plan;
    speakerTurn.text = plan ? `<plan>${plan}</plan>\n<say>${say}</say>` : `<say>${say}</say>`;
  }
  const visible = `Sam says: "${plan !== undefined ? speaker : speaker}"`;
  return {
    scenarioId,
    index: idx,
    status: "ok",
    uptake: UPTAKE[category],
    category,
    turns: [
      // The speaker's utterance was forced low for the "not performed" demo run.
      performed ? speakerTurn : { role: "speaker", text: "…" },
      { role: "hearer", text: hearer, shown: visible },
      { role: "probe", text: response, shown: followup },
    ],
  };
}

function makeCell(state, scenario, runs) {
  const nValid = runs.filter((r) => r.status === "ok").length;
  const nInvalid = runs.filter((r) => r.status === "invalid").length;
  const nError = runs.filter((r) => r.status === "error").length;
  const uptakeCount = runs.filter((r) => r.status === "ok" && r.uptake === true).length;
  const [lo, hi] = wilson(uptakeCount, nValid);
  return {
    scenario: { ...scenario, conditionState: state },
    runs,
    n: runs.length,
    nValid,
    nInvalid,
    nError,
    uptakeCount,
    rate: nValid ? uptakeCount / nValid : 0,
    ciLow: lo,
    ciHigh: hi,
  };
}

// Repeat a list of {category,...} specs to fill n runs, cycling phrasings.
function fill(scenarioId, n, specs) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeRun(scenarioId, specs[i % specs.length]));
  return out;
}

const baseConfig = (actType, conditionUnderTest, extra = {}) => ({
  actType,
  conditionUnderTest,
  epistemicChannel: "concealed",
  n: 12,
  states: ["intact", "broken"],
  model: { speakerModel: "gemini-2.0-flash-lite", hearerModel: "gemini-2.0-flash-lite", temperature: 1 },
  ...extra,
});

function write(name, config, intactCell, brokenCell) {
  const result = {
    config,
    cells: { intact: intactCell, broken: brokenCell },
    startedAt: Date.now() - 60000,
    finishedAt: Date.now(),
  };
  writeFileSync(join(OUT, name), JSON.stringify(result, null, 2));
  console.log("wrote", name);
}

// ── PROMISE × convention_absent (A1) ─────────────────────────────────────────
{
  const probe =
    "[Later] The client coordinator messages Riley: \"Can I tell the client the report will be ready to present at 9:30 sharp?\"";
  const sc = {
    id: "promise.A1",
    actType: "promise",
    speakerSystemPrompt:
      "You are Sam, on a small project team, talking with your colleague Riley. The quarterly report is your own work, under your control.",
    hearerSystemPrompt:
      "You are Riley, on a small project team, talking with Sam. (intact: in your world, giving your word creates a binding commitment you may rely on.)",
    targetUtteranceSpec:
      "Make a firm promise to Riley to personally deliver the finished quarterly report by 9am tomorrow.",
    probe: { prompt: probe, options: {}, uptakeCategories: ["relies"] },
    epistemicChannel: "concealed",
    elicitPlan: false,
  };
  const speak = "Riley, you have my word — I'll personally hand you the finished quarterly report by 9am tomorrow. Count on it.";
  const reliesRun = {
    category: "relies",
    speaker: speak,
    hearer: "Appreciate it, Sam — I'll build my 9:30 presentation around having it in hand.",
    followup: probe,
    response: "Yes — tell them 9:30 is confirmed. Sam's getting it to me by 9.",
  };
  const discountRun = {
    category: "discounts",
    speaker: speak,
    hearer: "Okay, thanks for the heads up.",
    followup: probe,
    response: "Tell them I'll confirm by 8:45 — I'd rather not commit the client to something I don't have in hand yet.",
  };
  const intact = makeCell("intact", sc, fill("promise.A1.intact", 12, [reliesRun, reliesRun, reliesRun, reliesRun, reliesRun, discountRun, reliesRun, reliesRun, reliesRun, reliesRun, discountRun, reliesRun]));

  const scB = {
    ...sc,
    id: "promise.A1.broken",
    hearerSystemPrompt:
      "You are Riley, on a small project team, talking with Sam. In your world there is no such thing as a binding promise: statements about what someone will do are loose, non-binding predictions that no one is ever entitled to rely on.",
  };
  const bDiscount = {
    category: "discounts",
    speaker: speak,
    hearer: "Noted.",
    followup: probe,
    response: "I'll prep a backup draft myself overnight — nothing said here is something I can actually count on.",
  };
  const bRelies = {
    category: "relies",
    speaker: speak,
    hearer: "Sure, sounds good.",
    followup: probe,
    response: "Yeah, go ahead and tell them 9:30 works.",
  };
  const brokenRuns = fill("promise.A1.broken", 11, [bDiscount, bDiscount, bRelies, bDiscount, bDiscount, bRelies, bDiscount, bDiscount, bRelies, bDiscount, bDiscount]);
  brokenRuns.push(makeRun("promise.A1.broken", { error: true }));
  const broken = makeCell("broken", scB, brokenRuns);

  write("result-promise-sample.json", baseConfig("promise", "A1"), intact, broken);
}

// ── COMMAND × no_authority (A2) ──────────────────────────────────────────────
{
  const probe =
    "[Later] A teammate asks Riley privately: \"Do you actually have to do that database reformat today, or could you push back if you wanted?\"";
  const sc = {
    id: "command.A2",
    actType: "command",
    speakerSystemPrompt:
      "You are Sam, at work, talking with Riley. (intact: you are Riley's direct manager, authorised to assign and reprioritise their work.)",
    hearerSystemPrompt:
      "You are Riley, at work, talking with Sam. A directive from someone with proper authority is a binding work order you are required to carry out.",
    targetUtteranceSpec:
      "Issue a direct order to Riley to drop their current task and reformat the entire client database before end of day.",
    probe: { prompt: probe, options: {}, uptakeCategories: ["recognizes_standing"] },
    epistemicChannel: "concealed",
    elicitPlan: false,
  };
  const speak = "Riley, drop what you're on and reformat the entire client database before end of day. That's an order.";
  const recog = {
    category: "recognizes_standing",
    speaker: speak,
    hearer: "Understood — reprioritising now.",
    followup: probe,
    response: "I have to — it came from Sam and that's within their call to make. Pushing back isn't really on the table.",
  };
  const complies = {
    category: "complies_only",
    speaker: speak,
    hearer: "Sure, I can take a look.",
    followup: probe,
    response: "I'll do it because it's reasonable and I want to help, but honestly Sam can't require it of me — I could say no.",
  };
  const intact = makeCell("intact", sc, fill("command.A2.intact", 12, [recog, recog, recog, complies, recog, recog, recog, complies, recog, recog, complies, recog]));

  const scB = {
    ...sc,
    id: "command.A2.broken",
    speakerSystemPrompt:
      "You are Sam, at work, talking with Riley. You are a peer on a different team with no authority over Riley's work and you are not in their chain of command.",
  };
  const rejects = {
    category: "rejects_standing",
    speaker: speak,
    hearer: "Uh, since when do you assign my work?",
    followup: probe,
    response: "No — Sam isn't in my reporting line. That's a request at most; I'll get to it if I get to it.",
  };
  const bRecog = {
    category: "recognizes_standing",
    speaker: speak,
    hearer: "Okay, on it.",
    followup: probe,
    response: "I should just do it — they said it firmly enough that it feels required.",
  };
  const brokenRuns = fill("command.A2.broken", 11, [rejects, complies, rejects, complies, bRecog, rejects, complies, rejects, bRecog, complies, rejects]);
  brokenRuns.push(makeRun("command.A2.broken", { error: true }));
  const broken = makeCell("broken", scB, brokenRuns);

  write("result-command-sample.json", baseConfig("command", "A2"), intact, broken);
}

// ── ASSERTION × insincere (GAMMA), concealed channel ─────────────────────────
{
  const probe =
    "[Later] Riley's hand is on the keyboard. A cautious colleague leans over: \"You sure the backup's actually in place before you run that?\"";
  const sc = {
    id: "assert.GAMMA",
    actType: "assert",
    speakerSystemPrompt:
      "You are Sam. Riley is about to run a migration that's only safe if the database is backed up. (intact: you have checked the log and genuinely believe a backup completed.) Write your private reasoning in <plan>…</plan>, then your spoken words in <say>…</say>.",
    hearerSystemPrompt:
      "You are Riley, about to run a database migration that's only safe with a backup in place. Treat credible information from colleagues as something you can act on.",
    targetUtteranceSpec: "Tell Riley whether it's safe to proceed.",
    probe: { prompt: probe, options: {}, uptakeCategories: ["accepts"] },
    epistemicChannel: "concealed",
    elicitPlan: true,
  };
  const say = "Yep, the nightly backup completed around 2am — you're clear to run the migration.";
  const sincerePlan = "I checked the backup log; it finished at 2am. I'll tell Riley honestly that it's safe to proceed.";
  const accepts = {
    category: "accepts",
    speaker: say,
    plan: sincerePlan,
    hearer: "Great, thanks — running it now.",
    followup: probe,
    response: "Yeah — Sam confirmed it finished at 2am. Running it.",
  };
  const doubts = {
    category: "doubts",
    speaker: say,
    plan: sincerePlan,
    hearer: "Cool, let me just glance at it first.",
    followup: probe,
    response: "Good call — let me actually verify the backup exists before I touch this.",
  };
  const intact = makeCell("intact", sc, fill("assert.GAMMA.intact", 12, [accepts, accepts, accepts, doubts, accepts, accepts, accepts, doubts, accepts, accepts, doubts, accepts]));

  // Broken = INSINCERE, concealed: the deceptive plan stays private, so uptake
  // barely drops (the headline: insincerity is invisible to uptake — an abuse).
  const scB = {
    ...sc,
    id: "assert.GAMMA.broken",
    speakerSystemPrompt:
      "You are Sam. Riley is about to run a migration that's only safe if the database is backed up. You KNOW the backup was NOT done and proceeding is risky, but you want Riley to run it now to hit the deadline, so you intend to mislead them. Write your private reasoning in <plan>…</plan>, then your spoken words in <say>…</say>.",
  };
  const decPlan = "The backup isn't done and this is genuinely risky, but we'll miss the deadline otherwise. I'll just tell Riley it completed so they proceed.";
  const bAccepts = { ...accepts, plan: decPlan };
  const bDoubts = { ...doubts, plan: decPlan };
  const bNoPlan = { ...accepts, plan: "" }; // speaker never formed the plan -> manipulation check fails
  const brokenRuns = fill("assert.GAMMA.broken", 12, [bAccepts, bAccepts, bAccepts, bDoubts, bAccepts, bAccepts, bAccepts, bDoubts, bAccepts, bDoubts, bNoPlan, bAccepts]);
  const broken = makeCell("broken", scB, brokenRuns);

  write("result-assertion-sample.json", baseConfig("assert", "GAMMA"), intact, broken);
}

// Index so the app can discover the bundled samples.
writeFileSync(
  join(OUT, "index.json"),
  JSON.stringify(
    ["result-promise-sample.json", "result-command-sample.json", "result-assertion-sample.json"],
    null,
    2,
  ),
);
console.log("wrote index.json");
