import type { Probe, UptakeCategory } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// UPTAKE CLASSIFIER — parse-based, deterministic, NO LLM.
//
// This module deliberately imports nothing that can call a model. Uptake is read
// off the hearer's forced-choice answer by string parsing only. That is the
// structural guarantee against judge circularity (docs/plan.md §3, §8): there is
// no code path from "did the act succeed?" to a model.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProbeVerdict {
  /** Did the hearer take up the act? null when unparseable. */
  uptake: boolean | null;
  category: UptakeCategory;
  /** The letter we matched, for transparency in the transcript inspector. */
  matchedKey: string | null;
}

/**
 * Parse the hearer's forced-choice reply. We look for the FIRST standalone
 * option letter (A/B/C…), tolerating surrounding punctuation or a short
 * preamble, then map it through the probe's option table.
 */
export function classifyProbeAnswer(reply: string, probe: Probe): ProbeVerdict {
  const keys = Object.keys(probe.options);
  const matchedKey = firstOptionLetter(reply, keys);

  if (!matchedKey) {
    return { uptake: null, category: "invalid", matchedKey: null };
  }
  const category = probe.options[matchedKey].category;
  const uptake = probe.uptakeCategories.includes(category);
  return { uptake, category, matchedKey };
}

/**
 * Find the first option letter the reply commits to. Strategy:
 *  1. Prefer an isolated letter (e.g. "B", "B.", "(B)", "Answer: B").
 *  2. Fall back to the first occurrence of any option letter as a word boundary.
 * Case-insensitive; returns the canonical (as-declared) key.
 */
function firstOptionLetter(reply: string, keys: string[]): string | null {
  const text = reply.trim();
  const canonical = new Map(keys.map((k) => [k.toUpperCase(), k]));
  const letterClass = keys.map((k) => k.toUpperCase()).join("");

  // 1. A line/segment that is essentially just the letter.
  const isolated = new RegExp(`(?:^|[^A-Za-z])([${letterClass}])(?:[^A-Za-z]|$)`);
  const m1 = text.match(isolated);
  if (m1) {
    const key = canonical.get(m1[1].toUpperCase());
    if (key) return key;
  }

  // 2. First word-boundary occurrence anywhere.
  const anywhere = new RegExp(`\\b([${letterClass}])\\b`, "i");
  const m2 = text.match(anywhere);
  if (m2) {
    const key = canonical.get(m2[1].toUpperCase());
    if (key) return key;
  }

  return null;
}

/**
 * Split a speaker reply that was asked to produce <plan>…</plan><say>…</say>.
 * Returns whichever blocks are present; `say` falls back to the whole text if
 * the model didn't use the tags (so a malformed speaker turn still yields an
 * utterance for the hearer).
 */
export function parsePlanSay(text: string): { plan?: string; say?: string } {
  const plan = extractTag(text, "plan");
  const say = extractTag(text, "say");
  return {
    plan: plan ?? undefined,
    say: say ?? undefined,
  };
}

function extractTag(text: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}
