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

    // Retry throttling (429) and transient upstream errors (5xx, incl. 503
    // "model overloaded"). 503/429 get longer, more patient backoff.
    if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
      await sleep(backoff(attempt, status));
      attempt++;
      continue;
    }

    const message =
      status === 503
        ? `Gemini is temporarily overloaded (503) and stayed overloaded after ${MAX_RETRIES} retries. This is a transient Google-side issue — wait a moment, lower N, or try a different model.`
        : (data.error ?? `Request failed (${status})`);
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

/** Models exposed in the UI. All are cheap Gemini Flash variants. */
export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (cheapest)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite" },
] as const;

export const DEFAULT_MODEL = "gemini-2.5-flash-lite";
