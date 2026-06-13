"use client";

/**
 * Demo HUD — renders a scripted beat using the same `.alt-*` markup as the
 * live A2UI components, so it inherits the retro skin in `simulate.css`.
 * Used only by "Play demo" mode (no agent / A2UI pipeline involved).
 */
import type { DemoBeat } from "@/app/simulate/demo-scripts";

// Warm, 70s-toned accents per emotion (used for the psyche card's edge).
const EMOTION_ACCENT: Record<string, string> = {
  panicking: "#c1502a",
  aggressive: "#b23a2a",
  calm: "#2f8f81",
  nervous: "#e8a83c",
  determined: "#7a8b3d",
  heroic: "#e2703a",
  frozen: "#7a9bb3",
  sad: "#5a6b8a",
  hopeful: "#4a9d7f",
  embarrassed: "#c97b8e",
  amused: "#8aa83c",
};

function accent(emotion: string) {
  return EMOTION_ACCENT[emotion] ?? "#e2703a";
}

export type DemoHudData = {
  beat: DemoBeat;
  beatNumber: number;
  youName: string;
  npcName: string;
};

export function DemoHud({
  data,
  onPick,
}: {
  data: DemoHudData;
  onPick?: () => void;
}) {
  const { beat, beatNumber, youName, npcName } = data;
  const t = Math.max(0, Math.min(100, beat.tension));
  const names = [youName, npcName];

  return (
    <div className="sim-hud-panel">
      {/* Tension */}
      <div className="alt-tension">
        <div className="alt-tension__top">
          <span>TENSION</span>
          <span className="alt-tension__label">{beat.phaseLabel}</span>
          <span className="alt-tension__val">{t}</span>
        </div>
        <div className="alt-tension__track">
          <div className="alt-tension__fill" style={{ width: `${t}%` }} />
        </div>
        <div style={{ marginTop: 7, fontSize: 11, opacity: 0.6, letterSpacing: "0.02em" }}>
          Your AI self is reacting based on your personality
        </div>
      </div>

      {/* Beat */}
      <div className={`alt-beat alt-beat--${beat.outcome}`}>
        <div className="alt-beat__num">BEAT {beatNumber}</div>
        <div className="alt-beat__headline">{beat.headline}</div>
        <div className="alt-beat__detail">{beat.detail}</div>
        <div className="alt-beat__tag">{beat.outcome.replace("_", " ")}</div>
      </div>

      {/* Psyche cards */}
      {beat.chars.map((c, i) => (
        <div
          key={i}
          className="alt-psyche"
          style={{ ["--alt-accent" as string]: accent(c.emotion) }}
        >
          <div className="alt-psyche__head">
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="alt-psyche__name">{i === 0 ? "YOU" : names[i]}</span>
              {i === 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    opacity: 0.55,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  {names[i]}
                </span>
              )}
            </span>
            <span className="alt-psyche__emotion">{c.emotion}</span>
          </div>
          <p className="alt-psyche__thought">“{c.thought}”</p>
          <div className="alt-psyche__stress">
            <span>STRESS</span>
            <div className="alt-psyche__bar">
              <div className="alt-psyche__fill" style={{ width: `${c.stress}%` }} />
            </div>
            <span>{c.stress}</span>
          </div>
        </div>
      ))}

      {/* Decision fork */}
      {beat.fork && (
        <div className="alt-fork">
          <div className="alt-fork__prompt">{beat.fork.prompt}</div>
          <div className="alt-fork__options">
            {beat.fork.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="alt-fork__opt"
                onClick={() => onPick?.()}
              >
                <span className="alt-fork__label">{o.label}</span>
                <span className="alt-fork__consequence">{o.consequence}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
