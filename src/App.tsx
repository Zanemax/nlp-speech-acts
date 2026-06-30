import { AustinBot } from "./components/AustinBot";

// AUSTIN BOT — the forward-facing app: a friendly demonstration of speech acts
// through a dialogue between Diego (speaker) and Eliza (listener).
// (The earlier research Explorer is kept in the repo, set to one side.)

export function App() {
  return (
    <div className="app">
      <AustinBot />
    </div>
  );
}
