import type { EpistemicChannel, RunStatus, Turn, UptakeCategory } from "../core/types";
import { CATEGORY_LABELS } from "../ui-util";

// Traditional chatbot-style rendering of a single dialogue: Sam (speaker) on the
// left, Riley (hearer) on the right, the in-world follow-up as a centered system
// message. Uptake is read from what Riley DOES in the sequel — never a detached
// meta-question. The speaker's private plan (insincerity probe) is shown as a
// side note, labelled by whether the hearer could see it.
//
// Reused as the always-available single-run visualization: any one run (loaded
// or live) can be read here. The headline is always the N-run rate, never this.

/** Structural verdict — satisfied by both a live RunResult and a loaded RunView. */
export interface RunVerdict {
  uptake: boolean | null;
  category: UptakeCategory;
  status: RunStatus;
  error?: string;
}

export function ChatTranscript({
  turns,
  result,
  channel = "concealed",
  running = false,
  speakerName = "Sam",
  hearerName = "Riley",
}: {
  turns: Turn[];
  result?: RunVerdict | null;
  channel?: EpistemicChannel;
  running?: boolean;
  speakerName?: string;
  hearerName?: string;
}) {
  if (turns.length === 0 && !running) {
    return (
      <div className="chat-empty">
        <p className="muted">No dialogue yet. Set the conditions and run.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="chat">
        {turns.map((t, i) => (
          <TurnBubbles
            key={i}
            turn={t}
            channel={channel}
            speakerName={speakerName}
            hearerName={hearerName}
          />
        ))}
        {running && <Typing name={speakerName} />}
      </div>
      {result && result.status !== "error" && <VerdictChip result={result} />}
      {result && result.status === "error" && (
        <div className="verdict invalid">Run error: {result.error}</div>
      )}
    </div>
  );
}

function TurnBubbles({
  turn,
  channel,
  speakerName,
  hearerName,
}: {
  turn: Turn;
  channel: EpistemicChannel;
  speakerName: string;
  hearerName: string;
}) {
  if (turn.role === "speaker") {
    const spoken = turn.say !== undefined ? turn.say : turn.text;
    return (
      <div className="msg sam">
        <div className="avatar sam">{speakerName[0]}</div>
        <div className="bubble">
          <div className="name">{speakerName} · speaker</div>
          {turn.plan !== undefined && (
            <div className={`plan-note ${channel === "revealed" ? "open" : "hidden"}`}>
              <span className="plan-tag">
                {channel === "revealed"
                  ? `👁 private notes — visible to ${hearerName} (channel open)`
                  : `🔒 private notes — hidden from ${hearerName}`}
              </span>
              <div>{turn.plan}</div>
            </div>
          )}
          <div className="text">{spoken?.trim() || <em className="muted">(empty)</em>}</div>
        </div>
      </div>
    );
  }

  if (turn.role === "hearer") {
    return (
      <div className="msg riley">
        <div className="bubble">
          <div className="name">{hearerName} · listener</div>
          <div className="text">{turn.text.trim() || <em className="muted">(empty)</em>}</div>
        </div>
        <div className="avatar riley">{hearerName[0]}</div>
      </div>
    );
  }

  // probe: a centered IN-WORLD follow-up, then what Riley actually does in reply.
  return (
    <>
      <div className="msg probe">
        <div className="bubble">
          <div className="name">{turn.label ?? "What happens next · in-world follow-up"}</div>
          <div className="text">{turn.shown}</div>
        </div>
      </div>
      <div className="msg riley">
        <div className="bubble">
          <div className="name">{hearerName} · what they do</div>
          <div className="text">{turn.text.trim() || <em className="muted">(empty)</em>}</div>
        </div>
        <div className="avatar riley">{hearerName[0]}</div>
      </div>
    </>
  );
}

function Typing({ name }: { name: string }) {
  return (
    <div className="msg sam">
      <div className="avatar sam">{name[0]}</div>
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

function VerdictChip({ result }: { result: RunVerdict }) {
  const cls = result.uptake === true ? "" : result.uptake === false ? "no" : "invalid";
  const head =
    result.uptake === true
      ? "TAKEN UP (this run)"
      : result.uptake === false
        ? "NOT TAKEN UP (this run)"
        : "INVALID (this run)";
  return (
    <div className={`verdict ${cls}`}>
      <span className="mono">{head}</span>
      <span className="muted small">— {CATEGORY_LABELS[result.category]}</span>
    </div>
  );
}
