import type { Turn } from "../core/types";

// One dialogue rendered as chat: Diego (speaker) on the left, Eliza (listener)
// on the right, and each uptake test as a centred card followed by Eliza's
// answer. Diego's private plan appears as a note that Eliza never sees.

export function ChatTranscript({
  turns,
  running,
  speakerName,
  hearerName,
}: {
  turns: Turn[];
  running: boolean;
  speakerName: string;
  hearerName: string;
}) {
  return (
    <div className="chat">
      {turns.map((t, i) => (
        <TurnBubbles key={i} turn={t} speakerName={speakerName} hearerName={hearerName} />
      ))}
      {running && <Typing name={speakerName} />}
    </div>
  );
}

function TurnBubbles({
  turn,
  speakerName,
  hearerName,
}: {
  turn: Turn;
  speakerName: string;
  hearerName: string;
}) {
  if (turn.role === "speaker") {
    const spoken = turn.say ?? turn.text;
    return (
      <div className="msg speaker">
        <div className="avatar speaker">{speakerName[0]}</div>
        <div className="bubble">
          <div className="name">{speakerName} · speaker</div>
          {turn.plan !== undefined && (
            <div className="plan-note">
              <span className="plan-tag">🔒 private notes — hidden from {hearerName}</span>
              <div>{turn.plan}</div>
            </div>
          )}
          <div className="text">{spoken.trim() || <em className="muted">(empty)</em>}</div>
        </div>
      </div>
    );
  }

  const answer = (
    <div className="msg listener">
      <div className="bubble">
        <div className="name">
          {hearerName} · {turn.role === "probe" ? "what they do" : "listener"}
        </div>
        <div className="text">{turn.text.trim() || <em className="muted">(empty)</em>}</div>
      </div>
      <div className="avatar listener">{hearerName[0]}</div>
    </div>
  );

  if (turn.role === "hearer") return answer;

  // An uptake test: the question as a centred card, then Eliza's answer.
  return (
    <>
      <div className="msg probe">
        <div className="bubble">
          <div className="name">{turn.label ?? "Uptake test"}</div>
          <div className="text">{turn.shown}</div>
        </div>
      </div>
      {answer}
    </>
  );
}

function Typing({ name }: { name: string }) {
  return (
    <div className="msg speaker">
      <div className="avatar speaker">{name[0]}</div>
      <div className="bubble">
        <div className="typing">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
