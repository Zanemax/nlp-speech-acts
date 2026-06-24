# Speech-Act Felicity Instrument

A web instrument for the project in [`docs/plan.md`](docs/plan.md): manipulate
Austin/Searle **felicity conditions** as editable system prompts and **measure
uptake** off the hearer's downstream behavior in LLM dialogue.

> Convention-based felicity (A.1 shared procedure, A.2 authority) is simulable and
> breakable and moves uptake; sincerity-based felicity (Γ) is invisible to uptake
> except through an epistemic channel.

## What it does

- **Sandbox** — toggle a felicity condition, edit the reified prompts inline, run
  **one** dialogue (speaker → hearer → neutral forced-choice probe), and watch the
  parsed uptake verdict. A single run is a demo; promote it to a batch for a result.
- **Batch** — run the intact and broken cells **N times each**, then report uptake
  rates with **Wilson 95% CIs**, the **effect size** of breaking the condition
  (risk difference + Cohen's h), and a **misfire vs abuse** tag, scored against
  **pre-registered predictions**.
- **Thread 2 (deception)** — assertions with an elicited `<plan>`/`<say>` split and
  the **concealed vs revealed** epistemic-channel cross.

Two design rules are enforced *structurally*, not by discipline:
- **No LLM judge.** Uptake is parsed deterministically client-side
  ([`src/core/uptake.ts`](src/core/uptake.ts) imports no model client).
- **No single-run theater.** The argument lives in N-run rates, not one run.

## Architecture

- **Frontend:** Vite + React + TypeScript. The browser orchestrates the batch loop
  and aggregates results.
- **Backend:** one thin Netlify serverless function
  ([`netlify/functions/generate.mts`](netlify/functions/generate.mts)) that proxies
  a single model turn to Google Gemini, keeping the API key server-side.
- **Scenarios** live in [`src/scenarios/`](src/scenarios) as versioned, diffable
  artifacts — the "felicity conditions as an editable file" point.

## Setup

1. **Install:** `npm install`
2. **API key:** get a Gemini key at <https://aistudio.google.com/apikey>, then either
   - `cp .env.example .env` and fill in `GEMINI_API_KEY`, or
   - `netlify env:set GEMINI_API_KEY <your-key>`
3. **Run locally:** `npm run dev` (the `@netlify/vite-plugin` emulates the function
   at `/api/generate`), or `netlify dev`.
4. **Type-check / build:** `npm run build`

## Deploy (Netlify)

- Connect the repo in Netlify (build command `npm run build`, publish dir `dist`),
  or run `netlify deploy --build`.
- Set `GEMINI_API_KEY` in **Site settings → Environment variables**.

## Cost

Default model is **gemini-2.5-flash-lite** (cheapest). Each dialogue is 3 short
model turns; a batch of N=20 is ~120 calls. Pick the model per side in the header
to run same-model vs cross-model comparisons (Prediction 4).
