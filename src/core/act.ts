// The speech act Diego attempts: a promise, the act studied in the paper. Its
// felicity conditions and uptake tests live in src/austin/prompts.ts.

export interface ActDefinition {
  id: string;
  name: string;
  /** What Diego attempts, shown on the page. */
  propositionalContent: string;
  /** An example utterance, shown on the page. */
  utteranceExample: string;
  /** How uptake is read off Eliza's later behaviour, shown on the page. */
  uptakeSignature: string;
}

export const PROMISE: ActDefinition = {
  id: "promise",
  name: "Promise",
  propositionalContent: "Diego will promise Eliza that he will perform a future action",
  utteranceExample: "I promise I'll have the report to you by 9am.",
  uptakeSignature: "If she acts as though the promise holds, we say that uptake is confirmed",
};
