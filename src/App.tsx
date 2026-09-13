import { AustinBot } from "./components/AustinBot";

// AUSTIN BOT — two instances of Gemini, Diego (speaker) and Eliza (listener),
// used to test whether an LLM promise comes off under Austin's and Searle's
// felicity conditions.

export function App() {
  return (
    <div className="app">
      <AustinBot />
    </div>
  );
}
