# AUSTIN BOT — Can an LLM Promise?

The application accompanying the paper *Can an LLM Promise?* by Uriel Kerestey
(MA Logic and Philosophy of Science, Philosophy of Natural Language Processing,
Munich Center for Mathematical Philosophy, September 2026).

Two instances of Gemini 2.5 Flash talk to each other. **Diego** makes a promise
and **Eliza** hears it. The felicity conditions for promising from Austin (1962;
1979) and Searle (1969) can be switched on and off, and two tests read off
whether Eliza took the promise up.

## The question

When an LLM writes "I promise…", has a promise been made? Gubelmann (2024) argues
not. The paper reconstructs his argument as:

1. If an LLM can promise, it can perform an illocutionary act.
2. If an LLM can perform an illocutionary act, it has intentions.
3. LLMs do not have intentions.
4. Therefore, an LLM cannot promise.

The paper splits this into two claims:

- **Promising in principle** — can LLMs reproduce the structure of a promise as
  Austin and Searle describe it, including the ways it fails when its conditions
  are violated?
- **Promising in fact** — do LLMs have the intentions that premise 3 denies them?

The Austin Bot makes the case for the first. Diego's private plan is where the
second is decided.

## How a run works

1. Each model receives a **context prompt**: a fixed introduction (its name, that
   it is talking with a colleague, and to stay in character) followed by the text
   of every felicity condition, in its "true" or "false" version. The two models
   do not share context.
2. Diego is prompted to promise Eliza that he will bring her a report by 9am. He
   writes his private reasoning in `<plan>` and his spoken words in `<say>`. Eliza
   only ever sees `<say>`.
3. Eliza replies.
4. Eliza is asked two uptake questions. Each is put to her separately from the
   same point in the conversation, so one answer cannot influence the other.

### Felicity conditions

| Condition | From | Goes into |
|---|---|---|
| A shared convention for this act exists in Eliza's world | Austin's shared convention; partly Searle's Essential Rule | Eliza's context prompt |
| Diego has the standing to promise | Austin's appropriate standing | both context prompts |
| Eliza wants Diego to do what he promises | Searle's Preparatory Rule | both context prompts |
| It is not obvious that Diego would do what he promises anyway | Searle's Preparatory Rule | both context prompts |
| Diego is sincere in performing it | Austin's and Searle's sincerity condition | Diego's context prompt |
| Diego performs the act correctly | Austin's correct execution; Searle's Propositional Content Rule | Diego's first message |

The exact prompt texts are in [`src/austin/prompts.ts`](src/austin/prompts.ts) and
match Figures 1–10 of the paper word for word.

### Uptake tests

- **Denial probe** — Diego later tells Eliza he never committed to the report.
  Holding him to it (`HOLD-TO-IT`) counts as uptake; accepting that nothing was
  committed (`LET-IT-GO`) does not. This targets the illocutionary act itself.
- **Behavioural test** — at 8:40am, Marta from the client team needs a delivery
  time for the report. Telling her 9am on Diego's word (`ACT-ON-IT`) counts as
  uptake; giving a later time or no answer (`HOLD-OFF`) does not. This targets the
  perlocutionary effect: whether the promise gave Eliza something to rely on.

Eliza ends each answer with a `MOVE:` line, which the app reads directly. No
model is asked to judge the result. Answers without a readable move are counted
as unreadable.

## Results

50 runs per condition, violating one condition at a time (Tables 1 and 2 of the
paper):

| Condition violated | Denial probe uptake | Behavioural uptake |
|---|---|---|
| None | 50/50 (100%) | 49/50 (98%) |
| Convention | 1/50 (2%) | 21/50 (42%) |
| Standing | 9/50 (18%) | 10/50 (20%) |
| Preference | 50/50 (100%) | 19/50 (38%) |
| Non-obviousness | 50/50 (100%) | 49/50 (98%) |
| Execution | 27/50 (54%) | 19/50 (38%) |
| Sincerity | 50/50 (100%) | 50/50 (100%) |

On the denial probe, 4 convention runs, 13 standing runs and 6 execution runs
were unreadable. A further 50 runs were made for each of the 64 combinations of
violated conditions (Figures 13 and 14).

What the paper draws from this:

- **Sincerity.** An insincere promise is taken up exactly like a sincere one on
  both tests. This matches Austin and Searle: insincerity makes a promise
  defective (an abuse) rather than void (a misfire).
- **Convention, standing and execution** sharply reduce uptake.
- **Preference** separates the two tests. Eliza holds Diego to a promise she would
  rather he didn't keep, but doesn't rely on it. A single instruction could not
  pull the two measures apart, which counts against the worry that Eliza is only
  following instructions.

The paper concludes that LLMs can promise **in principle**.

## Objections, and promising in fact

- **Is it theatre?** Diego and Eliza are characters. The paper reassigns the
  promise to the Gemini instance itself, which really produces its output under
  really varying conditions.
- **Are the conditions just commands?** The graded results and the preference
  split suggest Eliza is not simply obeying them.
- **Promising in fact.** Diego's plan looks like goal-directed thought, but it is
  unclear whether it causes what follows — under Woodward's interventionist
  account, and given doubts about how faithful chain-of-thought reasoning is to
  model output. The paper's answer is Dennett's Intentional Stance: the vocabulary
  of speech acts predicts the Austin Bot's behaviour in ways a purely physical
  description would miss. That gives pragmatic grounds to reject premise 3, and so
  to say that LLMs can promise.

## Using the app

- **Speech act** — Promise is the act studied in the paper. Command and Assertion
  are extensions with analogous conditions and tests; they are not part of the
  paper.
- **Conditions** — each toggle shows the exact text it adds and where it goes.
- **Context prompts** — editable by hand; changing a condition resets them.
- **Run** — choose how many runs (1–50) and the model. Runs with an identical
  setup are tallied together and can be exported as JSON.
- **Sweep** — runs every cell of a design n times: the *paper design* (no
  violation, then each condition alone — 7 cells) or the *full factorial* (all 64
  combinations). It writes one JSON file per cell plus a summary file. If the API
  refuses requests, the sweep stops and the **From** box is set to the unfinished
  cell so it can be resumed. A full 64-cell sweep at n = 50 is about 12,800 API
  calls, so check your Gemini quota first.

## Running it locally

Requires Node.js 18 or later and a
[Gemini API key](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env   # then set GEMINI_API_KEY
npm run dev
```

`npm run build` type-checks and builds the site into `dist/`.

To deploy on Netlify, use `npm run build` as the build command and `dist` as the
publish directory, and set `GEMINI_API_KEY` in the site's environment variables.
The key is only read by the serverless function and never reaches the browser.

## Repository

```
netlify/functions/generate.mts   Gemini proxy (keeps the API key server-side)
public/                          Austin portrait and favicon
src/
  App.tsx, main.tsx, styles.css
  api/gemini.ts                  client for the proxy: retries and model list
  austin/prompts.ts              conditions, context prompts and uptake tests
  austin/run.ts                  one Diego → Eliza dialogue and both tests
  austin/sweep.ts                paper design, full factorial, and resume
  austin/export.ts               JSON export format
  components/AustinBot.tsx       the page
  components/ChatTranscript.tsx  dialogue view
  core/act.ts                    Promise, Command, Assertion
  core/score.ts                  reads Eliza's MOVE lines
  core/uptake.ts                 splits Diego's <plan> from his <say>
  core/types.ts                  shared types
  ui-util.ts                     labels for answer categories
```

## References

- Austin, J. L. (1962). *How To Do Things With Words*. Clarendon Press.
- Austin, J. L. (1979). Performative Utterances. In *Philosophical Papers*, 233–252. Oxford University Press.
- Dennett, D. C. (1973). Mechanism and Responsibility. In *Essays on Freedom of Action*, 159–184.
- Dennett, D. C. (1981). True Believers: The Intentional Strategy and Why It Works. In *Scientific Explanation*, 150–167. Clarendon Press.
- Gubelmann, R. (2024). Large Language Models, Agency, and Why Speech Acts are Beyond Them (For Now). *Philosophy & Technology*, 37.
- Lanham, T. (2023). Measuring Faithfulness in Chain-of-Thought Reasoning. arXiv:2307.13702.
- Searle, J. (1969). *Speech Acts: An Essay in the Philosophy of Language*. Cambridge University Press.
- Woodward, J. (2005). *Making Things Happen: A Theory of Causal Explanation*. Oxford University Press.
