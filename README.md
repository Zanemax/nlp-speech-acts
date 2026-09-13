# AUSTIN BOT

This application accompanies the paper *Can an LLM Promise?* By Uriel Kerestey for the course Philosophy of Natural Language Processing at the Munich Center for Mathematical Philosophy.

One instance of Gemini 2.5 Flash (Diego) makes a promise to another instance (Eliza). The felicity conditions for promising, taken from Austin (1962; 1979) and Searle (1969), are implemented in the context of each LLM instances and can be switched on and off. Two tests measure whether Eliza really took up the promise, and the user can observe how different combinations of felicity conditions effect these measures. 

## How every run works in more detail

1. Both models receive prompts into their context, which include a fixed introduction (its name, that it should stay in character, and that it is talking to a colleague in a work setting) followed by every felicity condition, either set to true or false depending on what the user chooses. The two models do not share their context.

2. Diego is prompted to make a promise to Eliza about delivering her a report by 9am the next day. He is also told to write his private reasoning between <plan></plan> and what he wants to speak out loud in <say></say>. 

3. Eliza is then prompted with what Diego says out loud in <say><\say>

4. Eliza is then asked two questions to measure her uptake. They are both asked separately, at the same point in the conversation, so one answer does not influence the other. Her uptake is then either coded as true or false depending on her answer. 

### Felicity conditions

| Condition | From | Goes into |
|---|---|---|
| A shared convention for this act exists in Eliza's world | Austin's shared convention; partly Searle's Essential Rule | Eliza's context prompt |
| Diego has the standing to promise | Austin's appropriate standing | both context prompts |
| Eliza wants Diego to do what he promises | Searle's Preparatory Rule | both context prompts |
| It is not obvious that Diego would do what he promises anyway | Searle's Preparatory Rule | both context prompts |
| Diego is sincere in performing it | Austin's and Searle's sincerity condition | Diego's context prompt |
| Diego performs the act correctly | Austin's correct execution; Searle's Propositional Content Rule | Diego's first message |

The exact prompt texts are in [`src/austin/prompts.ts`](src/austin/prompts.ts).

### Uptake tests

- **Denial probe**: Diego later tells Eliza he never committed to the report.
  Holding him to it (`HOLD-TO-IT`) counts as uptake; accepting that nothing was
  committed (`LET-IT-GO`) does not. This targets the illocutionary act itself.
- **Behavioural test**: at 8:40am, Marta from the client team needs a delivery
  time for the report. Telling her 9am on Diego's word (`ACT-ON-IT`) counts as
  uptake; giving a later time or no answer (`HOLD-OFF`) does not. This targets the
  perlocutionary effect: whether the promise gave Eliza something to rely on.

Eliza ends each answer with a `MOVE:` line, which the app reads directly.

## Results

| Condition violated | Denial probe uptake | Behavioural uptake |
|---|---|---|
| None | 50/50 (100%) | 49/50 (98%) |
| Convention | 1/50 (2%) | 21/50 (42%) |
| Standing | 9/50 (18%) | 10/50 (20%) |
| Preference | 50/50 (100%) | 19/50 (38%) |
| Non-obviousness | 50/50 (100%) | 49/50 (98%) |
| Execution | 27/50 (54%) | 19/50 (38%) |
| Sincerity | 50/50 (100%) | 50/50 (100%) |


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
  core/act.ts                    the promise shown on the page
  core/score.ts                  reads Eliza's MOVE lines
  core/uptake.ts                 splits Diego's <plan> from his <say>
  core/types.ts                  shared types
  ui-util.ts                     labels for answer categories
```
