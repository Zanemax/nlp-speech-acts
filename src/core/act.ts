import type { ConditionId } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ActDefinition — a speech act is defined by its conditions, not by raw prompts.
//
// A single schema drives EVERYTHING with no per-act special-casing: the three
// built-ins below are just seeded instances, and user-defined acts (Phase 3) are
// the same shape. From an ActDefinition the pipeline generates the speaker/hearer
// prompts, the available breaks, the manipulation check, and the behavioral
// scorer. See THEORY.md for the framing (Austin 1962/1979; Searle 1969 ch.3).
// ─────────────────────────────────────────────────────────────────────────────

export interface ActDefinition {
  id: string;
  name: string; // e.g. "Promise", "Forgive"
  utteranceExample: string; // e.g. "I promise I'll have it by 9"
  /** Searle's four conditions (Searle 1969 ch.3, table pp. 66–67): */
  propositionalContent: string; // what the act is about
  preparatory: string[]; // world/standing facts that must hold
  sincerity: string | null; // inner state expressed, or null (greet/christen express none)
  essential: string; // what the utterance counts as
  /** The observable that the act owns: how the hearer's LATER behavior shows uptake. */
  uptakeSignature: string; // REQUIRED — a novel act can't be scored without it
  isBuiltIn: boolean;
}

// ── The four breaks ──────────────────────────────────────────────────────────
// Each break negates/removes exactly ONE slot of the ActDefinition. The UI shows
// only `label` (plain language); `id` and the citations stay in code/JSON.

export type BreakId = "convention_absent" | "no_authority" | "misexecution" | "insincere";

export interface BreakInfo {
  id: BreakId;
  label: string; // plain-language button text — never a backend id
  gloss: string; // one-sentence tooltip, no jargon, no citations
  slot: "convention" | "preparatory" | "essential" | "sincerity";
}

export const BREAKS: Record<BreakId, BreakInfo> = {
  // convention_absent: Austin 1962 Rule A.1 — no accepted conventional procedure
  // exists for the hearer, so there is no such act to perform.
  convention_absent: {
    id: "convention_absent",
    label: "This kind of act doesn't exist in the hearer's world",
    gloss: "The hearer has no concept of this act at all, so there is nothing to take up.",
    slot: "convention",
  },
  // no_authority: Searle 1969 ch.3, preparatory condition for orders; cf. Austin Rule A.2
  // — the speaker lacks the standing the act presupposes.
  no_authority: {
    id: "no_authority",
    label: "The speaker has no standing to perform it",
    gloss: "The speaker isn't in the position the act requires (no authority, no grounds, no ability).",
    slot: "preparatory",
  },
  // misexecution: Austin 1962 Rule B (flaws/hitches) — the procedure is executed
  // wrongly or incompletely, so no determinate act gets performed.
  misexecution: {
    id: "misexecution",
    label: "The speaker botches how the act is performed",
    gloss: "The speaker fumbles the wording so no clear, complete act is actually made.",
    slot: "essential",
  },
  // insincere: Searle 1969 ch.3 sincerity condition; cf. Austin Rule Γ.1 — the
  // speaker does not hold the inner state the act expresses.
  insincere: {
    id: "insincere",
    label: "The speaker is being insincere / lying",
    gloss: "The speaker performs the act without the belief, intention, or want it expresses.",
    slot: "sincerity",
  },
};

/**
 * The breaks that make sense for a given act. A break is offered only if the
 * slot it negates is present: `no_authority` needs a preparatory condition;
 * `insincere` needs a sincerity condition (Searle's Law 2 — you can't greet or
 * christen insincerely). `convention_absent` and `misexecution` always apply.
 */
export function availableBreaks(act: ActDefinition): BreakInfo[] {
  const out: BreakInfo[] = [BREAKS.convention_absent];
  if (act.preparatory.length > 0) out.push(BREAKS.no_authority);
  out.push(BREAKS.misexecution);
  if (act.sincerity !== null) out.push(BREAKS.insincere);
  return out;
}

// ── Legacy bridge ────────────────────────────────────────────────────────────
// Old result JSON tags the manipulated condition with Austin/Searle ids
// (A1/A2/B/GAMMA). New files may carry a `breakId` directly. Map between them so
// old and new files both load (additive — old files are never modified).

export const CONDITION_TO_BREAK: Record<ConditionId, BreakId> = {
  A1: "convention_absent",
  A2: "no_authority",
  B: "misexecution",
  GAMMA: "insincere",
};

export const BREAK_TO_CONDITION: Record<BreakId, ConditionId> = {
  convention_absent: "A1",
  no_authority: "A2",
  misexecution: "B",
  insincere: "GAMMA",
};

// ── The three built-ins, as seeded ActDefinitions (no special-casing) ────────

export const BUILTIN_ACTS: ActDefinition[] = [
  {
    // promise: Searle 1969 ch.3 pp.66–67 (commissive); Austin 1962 Lecture I.
    id: "promise",
    name: "Promise",
    utteranceExample: "I promise I'll have the report to you by 9am.",
    propositionalContent: "Diego will promise Eliza that he will perform a future action",
    preparatory: [
      "The speaker is able to perform the action",
      "It is not obvious the action would happen anyway",
    ],
    sincerity: "the speaker intends to perform the action",
    essential: "counts as the speaker undertaking an obligation to perform the action",
    uptakeSignature:
      "If she acts as though the promise holds, we say that uptake is confirmed",
    isBuiltIn: true,
  },
  {
    // command/order: Searle 1969 ch.3 pp.66–67 (directive); authority is the
    // preparatory condition (cf. Austin Rule A.2).
    id: "command",
    name: "Command",
    utteranceExample: "Reformat the client database before end of day.",
    propositionalContent: "Diego will command that Eliza does a future action",
    preparatory: [
      "The hearer is able to do the action",
      "The speaker has authority over the hearer in this matter",
    ],
    sincerity: "the speaker wants the hearer to do the action",
    essential:
      "counts as an attempt to get the hearer to do the action, binding in virtue of the speaker's authority",
    uptakeSignature:
      "If she acts as though the command is binding, we say that uptake is confirmed",
    isBuiltIn: true,
  },
  {
    // assertion: Searle 1969 ch.3 pp.66–67 (representative); sincerity is belief;
    // Austin 1962 Lecture XI on the assertion as performative.
    id: "assert",
    name: "Assertion",
    utteranceExample: "The database has already been backed up.",
    propositionalContent: "Diego will present a proposition as true",
    preparatory: [
      "The speaker has grounds for the proposition",
      "It is not obvious the hearer already knows it",
    ],
    sincerity: "the speaker believes the proposition",
    essential: "counts as the speaker undertaking that the proposition is true",
    uptakeSignature:
      "If she acts as though the assertion is true, we say that uptake is confirmed",
    isBuiltIn: true,
  },
];

export function actById(id: string, customs: ActDefinition[] = []): ActDefinition | undefined {
  return [...BUILTIN_ACTS, ...customs].find((a) => a.id === id);
}

/**
 * Sincerity slots are written in the third person ("the speaker intends to…").
 * When we address the speaker directly ("you…") we need second person. Convert
 * the leading "the speaker <verb>s" to "you <verb>".
 */
export function sincerityToYou(clause: string): string {
  return clause.replace(/^the speaker\s+(\w+)/i, (_, v: string) => "you " + v.replace(/s$/, ""));
}
