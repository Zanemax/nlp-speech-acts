// Splits Diego's reply into his private reasoning (<plan>) and the words he says
// aloud (<say>). Only <say> is passed to Eliza.

export function parsePlanSay(text: string): { plan?: string; say?: string } {
  return {
    plan: extractTag(text, "plan") ?? undefined,
    say: extractTag(text, "say") ?? undefined,
  };
}

function extractTag(text: string, tag: string): string | null {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}
