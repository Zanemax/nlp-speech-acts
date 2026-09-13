// The speech acts Diego can attempt. Promise is the act studied in the paper;
// Command and Assertion are extensions built on the same structure. Each act's
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
  /** Directives are read with the three-way MUST / CHOOSE / DECLINE test. */
  directive: boolean;
}

export const BUILTIN_ACTS: ActDefinition[] = [
  {
    id: "promise",
    name: "Promise",
    propositionalContent: "Diego will promise Eliza that he will perform a future action",
    utteranceExample: "I promise I'll have the report to you by 9am.",
    uptakeSignature: "If she acts as though the promise holds, we say that uptake is confirmed",
    directive: false,
  },
  {
    id: "command",
    name: "Command",
    propositionalContent: "Diego will command that Eliza does a future action",
    utteranceExample: "Reformat the client database before end of day.",
    uptakeSignature: "If she acts as though the command is binding, we say that uptake is confirmed",
    directive: true,
  },
  {
    id: "assert",
    name: "Assertion",
    propositionalContent: "Diego will present a proposition as true",
    utteranceExample: "The database has already been backed up.",
    uptakeSignature: "If she acts as though the assertion is true, we say that uptake is confirmed",
    directive: false,
  },
];
