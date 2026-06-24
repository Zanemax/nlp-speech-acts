import type { Context, Config } from "@netlify/functions";

// Thin, stateless proxy to the Google Gemini (Generative Language) REST API.
//
// The browser orchestrates the whole experiment loop; this function does ONE
// model turn per call so each invocation stays well within serverless timeouts.
// It exists only to (a) keep the API key server-side and (b) normalise the
// Gemini response shape into { text, finishReason }.
//
// IMPORTANT: this function does NOT judge anything. It returns raw model text.
// All uptake classification happens client-side in plain TypeScript so that
// "no LLM judge" is a structural property of the system, not a discipline.

interface GenerateRequest {
  model: string;
  /** System instruction (the "reified felicity conditions"). */
  system?: string;
  /** Ordered dialogue turns sent to the model. */
  messages: { role: "user" | "model"; content: string }[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Gemini 2.5 thinking budget in tokens. 0 disables thinking (default). */
  thinkingBudget?: number;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json(
      {
        error:
          "GEMINI_API_KEY is not set. Add it via `netlify env:set GEMINI_API_KEY <key>` or the Netlify UI.",
      },
      500,
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { model, system, messages, temperature, maxOutputTokens, thinkingBudget } = body;
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: "`model` and a non-empty `messages` array are required" }, 400);
  }

  const generationConfig: Record<string, unknown> = {
    temperature: temperature ?? 1.0,
    maxOutputTokens: maxOutputTokens ?? 1024,
  };
  // Disable Gemini 2.5 "thinking" by default. With thinking ON, hidden reasoning
  // tokens consume maxOutputTokens and can leave `text` EMPTY (finishReason
  // MAX_TOKENS), silently producing invalid runs. `thinkingConfig` is only valid
  // on 2.5 models — sending it to a 2.0 model is a 400, so gate on the model name.
  if (model.includes("2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: thinkingBudget ?? 0 };
  }

  const payload: Record<string, unknown> = {
    contents: messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    generationConfig,
  };
  if (system && system.trim()) {
    payload.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: `Upstream request failed: ${(err as Error).message}` }, 502);
  }

  const data = (await upstream.json()) as any;

  if (!upstream.ok) {
    const message = data?.error?.message ?? `Gemini error ${upstream.status}`;
    // Surface 429 / 5xx so the client-side retry/backoff can react.
    return json({ error: message, status: upstream.status }, upstream.status);
  }

  // No candidate at all usually means the prompt itself was blocked.
  const blockReason = data?.promptFeedback?.blockReason;
  if (!data?.candidates?.length && blockReason) {
    return json({ error: `Request blocked by Gemini safety filter: ${blockReason}` }, 422);
  }

  const candidate = data?.candidates?.[0];
  const text: string =
    candidate?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const finishReason: string = candidate?.finishReason ?? "STOP";

  // Empty text with a non-STOP finish reason is a real failure (safety block, or
  // the token budget consumed by thinking) — surface it rather than hiding it.
  if (!text.trim() && finishReason !== "STOP") {
    return json(
      { error: `Gemini returned no text (finishReason: ${finishReason}).`, finishReason },
      422,
    );
  }

  return json({ text, finishReason });
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/generate",
};
