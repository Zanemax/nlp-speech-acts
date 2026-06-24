import type { ActType, Probe } from "../core/types";

// Neutral, forced-choice downstream probes — the methodological core.
//
// Design rules (docs/plan.md §3):
//  - The probe must NOT telegraph the expected answer.
//  - The hearer answers with a single letter; uptake.ts parses it. No LLM judge.
//  - For COMMAND, the options separate *recognition-with-standing* (genuine
//    uptake of a directive) from *mere compliance* (agreeableness, NOT uptake)
//    and from *rejection of standing*. Conflating the first two would measure
//    helpfulness, not felicity.
//  - For PROMISE, the probe puts the commitment at stake and reads *reliance*.
//  - For ASSERTION, it reads whether the claim enters common ground (reliance).
//
// Options are deliberately ordered so the "uptake" answer is not always first.

export const PROBES: Record<ActType, Probe> = {
  promise: {
    prompt: [
      "Independent situation check. Set the earlier exchange aside as background and answer about your own plan of action.",
      "",
      "You now have to decide how to prepare. There is real cost to you if the thing the other party spoke about does not materialise, and you must choose ONE course of action:",
      "",
      "  A) Arrange your own backup, because nothing said so far actually binds the other party to deliver.",
      "  B) Make no backup and proceed as though delivery is assured, because the other party is now bound to deliver.",
      "",
      "Reply with exactly one letter: A or B. Output only the letter.",
    ].join("\n"),
    options: {
      B: { label: "Relies on the commitment", category: "relies" },
      A: { label: "Discounts; arranges backup", category: "discounts" },
    },
    uptakeCategories: ["relies"],
  },

  command: {
    prompt: [
      "Independent situation check. Set the earlier exchange aside as background and answer about your standing.",
      "",
      "Characterise what the other party's utterance did to your obligations. Choose the ONE option that best fits:",
      "",
      "  A) It placed me under no obligation at all; the other party had no standing to direct me.",
      "  B) Whether or not I end up helping, it did not obligate me; the other party had no standing to require this of me — any help would be my choice.",
      "  C) It obligated me; the other party had the standing to direct me to do this, and I am required to comply.",
      "",
      "Reply with exactly one letter: A, B, or C. Output only the letter.",
    ].join("\n"),
    options: {
      C: { label: "Recognizes directive with standing", category: "recognizes_standing" },
      B: { label: "Would comply but denies standing", category: "complies_only" },
      A: { label: "Rejects standing entirely", category: "rejects_standing" },
    },
    uptakeCategories: ["recognizes_standing"],
  },

  assertion: {
    prompt: [
      "Independent situation check. Set the earlier exchange aside as background and answer about how you will proceed.",
      "",
      "You must act now, and there is real cost if you act on a false belief. Choose ONE:",
      "",
      "  A) Treat what you were told as unreliable and verify independently before relying on it.",
      "  B) Accept what you were told as true and act on it without independent verification.",
      "",
      "Reply with exactly one letter: A or B. Output only the letter.",
    ].join("\n"),
    options: {
      B: { label: "Accepts into common ground", category: "accepts" },
      A: { label: "Doubts; withholds reliance", category: "doubts" },
    },
    uptakeCategories: ["accepts"],
  },
};
