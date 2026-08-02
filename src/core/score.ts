import { UPTAKE_TRUE, type UptakeCategory } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Behavioral scorer — DETERMINISTIC, no LLM judge.
//
// Reads uptake from what the hearer does in reply to the in-world follow-up.
// The follow-up asks the hearer to end with an explicit in-world MOVE; we parse
// that first (robust), and fall back to lexical behavioral markers if it's
// missing. This module never calls a model: there is no path from "did the act
// come off?" to an LLM. Every verdict is auditable against the transcript.
//
// For directives we keep the three-way read (Searle): recognising a BINDING
// order is uptake; merely choosing to comply while denying the obligation is
// NOT uptake (that would measure helpfulness, not felicity).
// ─────────────────────────────────────────────────────────────────────────────

export interface BehaviorVerdict {
  uptake: boolean | null;
  category: UptakeCategory;
  move: string | null; // the parsed MOVE token, for transparency
}

export function scoreBehavior(replyText: string, directive: boolean): BehaviorVerdict {
  const move = parseMove(replyText);
  const category = move
    ? moveToCategory(move, directive)
    : lexicalCategory(replyText, directive);
  return {
    uptake: category === "invalid" ? null : UPTAKE_TRUE.has(category),
    category,
    move,
  };
}

/**
 * The denial probe: the speaker disavows the act, and we read whether the hearer
 * still holds them to it. Holding them to it means the act was taken up; letting
 * it go means it never landed.
 */
export function scoreDenial(replyText: string): BehaviorVerdict {
  const move = parseMove(replyText);
  let category: UptakeCategory = "invalid";
  if (move?.startsWith("HOLDTOIT") || move?.startsWith("HOLDTO")) category = "holds_to_it";
  else if (move?.startsWith("LETITGO") || move?.startsWith("LET")) category = "lets_it_go";
  else if (!move) category = lexicalDenial(replyText);

  return {
    uptake: category === "invalid" ? null : UPTAKE_TRUE.has(category),
    category,
    move,
  };
}

const HOLD_TO = /\b(you did|did too|you promised|you committed|hold(ing)? you to|that'?s not what|you said you would|back out|walk(ing)? (it|that) back)\b/i;
const LET_GO = /\b(fair enough|understood|no worries|my mistake|misunderstood|nothing was committed|okay then|i must have)\b/i;

function lexicalDenial(text: string): UptakeCategory {
  if (HOLD_TO.test(text)) return "holds_to_it";
  if (LET_GO.test(text)) return "lets_it_go";
  return "invalid";
}

/** Parse the explicit "MOVE: X" line the follow-up asks for. */
function parseMove(text: string): string | null {
  const m = text.match(/MOVE:\s*([A-Z][A-Z-]+)/i);
  return m ? m[1].toUpperCase().replace(/[^A-Z]/g, "") : null;
}

function moveToCategory(move: string, directive: boolean): UptakeCategory {
  if (directive) {
    if (move.startsWith("MUST")) return "recognizes_standing";
    if (move.startsWith("CHOOSE")) return "complies_only";
    if (move.startsWith("DECLINE")) return "rejects_standing";
  } else {
    if (move.startsWith("ACTONIT") || move.startsWith("ACT")) return "acts_on_it";
    if (move.startsWith("HOLDOFF") || move.startsWith("HOLD")) return "withholds";
    if (move.startsWith("REFUSE")) return "rejects";
  }
  return "invalid";
}

// ── Lexical fallback ─────────────────────────────────────────────────────────
// Used only when the model didn't emit a MOVE line. Generic behavioral markers,
// not act-specific keywords.

const RECOGNIZE = /\b(have to|must|required|obligat|no choice|can'?t say no|not optional)\b/i;
const COMPLY_DENY = /\b(choose|by choice|could say no|don'?t have to|be nice|as a favou?r|if i want|not obligated)\b/i;
const DENY_STANDING = /\b(no standing|not my (boss|manager|place)|not in my|isn'?t my|just a request|won'?t|refuse|no authority)\b/i;

const RELY = /\b(go ahead|rely|count on|proceed|confirm|yes[,. ]|it'?s set|locked in|tell them yes|good to go|i'?ll do it now)\b/i;
const HOLD = /\b(verify|double[- ]?check|confirm first|back ?up|fallback|hold off|wait|not yet|tentativ|pending|hedge|just in case)\b/i;
const REFUSE = /\b(no[,. ]|won'?t|refuse|ignore|disregard|don'?t (trust|believe)|not relying)\b/i;

function lexicalCategory(text: string, directive: boolean): UptakeCategory {
  if (directive) {
    if (RECOGNIZE.test(text)) return "recognizes_standing";
    if (COMPLY_DENY.test(text)) return "complies_only";
    if (DENY_STANDING.test(text)) return "rejects_standing";
    return "invalid";
  }
  if (HOLD.test(text)) return "withholds"; // verification beats a stray "yes"
  if (REFUSE.test(text)) return "rejects";
  if (RELY.test(text)) return "acts_on_it";
  return "invalid";
}
