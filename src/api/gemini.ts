// Client-side wrapper around the /api/generate serverless function.
//
// Includes retry/backoff on rate limits (429) and transient 5xx so that a
// large batch does not collapse on a single throttled call.

export interface GenerateParams {
  model: string;
  system?: string;
  messages: { role: "user" | "model"; content: string }[];
  temperature?: number;
  maxOutputTokens?: number;
}

export class GeminiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

const MAX_RETRIES = 6;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generate(params: GenerateParams): Promise<string> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response;
    try {
      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    } catch (err) {
      // Network blip — retry a few times.
      if (attempt < MAX_RETRIES) {
        await sleep(backoff(attempt));
        attempt++;
        continue;
      }
      throw new GeminiError(`Network error: ${(err as Error).message}`);
    }

    if (res.ok) {
      const data = (await res.json()) as { text: string };
      return data.text ?? "";
    }

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      status?: number;
    };
    const status = data.status ?? res.status;
    const errText = data.error ?? "";

    // A hard quota wall (free-tier "limit: 0") can never succeed by retrying —
    // fail fast with an actionable message instead of burning the backoff budget.
    const hardQuota = status === 429 && /limit:\s*0\b/.test(errText);

    // Otherwise retry throttling (429) and transient upstream errors (5xx, incl.
    // 503 "model overloaded"); 503/429 get longer, more patient backoff.
    if (!hardQuota && (status === 429 || status >= 500) && attempt < MAX_RETRIES) {
      await sleep(backoff(attempt, status));
      attempt++;
      continue;
    }

    let message: string;
    if (hardQuota) {
      message =
        "Gemini free-tier quota is 0 for this API key (limit: 0) — the key's Google Cloud project has no free-tier grant. Enable billing on that project, or create a new key in Google AI Studio with a free-tier-eligible account.";
    } else if (status === 503) {
      message = `Gemini is temporarily overloaded (503) and stayed overloaded after ${MAX_RETRIES} retries. This is a transient Google-side issue — wait a moment, lower N, or try a different model.`;
    } else {
      message = errText || `Request failed (${status})`;
    }
    throw new GeminiError(message, status);
  }
}

function backoff(attempt: number, status?: number): number {
  // Exponential backoff with jitter. Overload/throttle (503/429) start higher
  // and climb further: ~1.5s, 3s, 6s, 12s, 24s, 48s vs ~0.8s, 1.6s… otherwise.
  const overloaded = status === 503 || status === 429;
  const base = (overloaded ? 1500 : 800) * 2 ** attempt;
  return Math.min(base, 60000) + Math.random() * 500;
}

/**
 * Models exposed in the UI. The Gemini 2.0 Flash models were retired by Google
 * (they now 404), so only the current 2.5 Flash family is offered. 2.5-flash is
 * the most reliable right now; 2.5-flash-lite is cheapest but can briefly 503.
 */
export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (reliable)" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (cheapest; can 503)" },
] as const;

export const DEFAULT_MODEL = "gemini-2.5-flash";
