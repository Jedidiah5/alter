/**
 * ALTER — Custom A2UI Renderers
 * -----------------------------
 * Paste into src/a2ui/catalog/renderers.tsx and register each in the catalog's
 * renderer map (the starter maps componentType -> renderer function).
 *
 * Each renderer takes the props emitted by the agent and returns React. Styling
 * uses CSS classes defined in alter.css (also in this module) — namespaced
 * `alt-` so they don't collide with the starter's pdf-analyst styles.
 */

import React from "react";

const EMOTION_COLORS: Record<string, string> = {
  panicking: "#ff4d4d",
  calm: "#4dd2ff",
  aggressive: "#ff1a1a",
  frozen: "#b3c6ff",
  heroic: "#ffd24d",
  nervous: "#ffa64d",
  determined: "#4dff88",
};

export function CharacterPsycheCard(props: {
  characterName: string;
  emotion: string;
  thought: string;
  stress: number;
  accentColor?: string;
}) {
  const accent = props.accentColor || EMOTION_COLORS[props.emotion] || "#4dd2ff";
  return (
    <div className="alt-psyche" style={{ ["--alt-accent" as any]: accent }}>
      <div className="alt-psyche__head">
        <span className="alt-psyche__name">{props.characterName}</span>
        <span className="alt-psyche__emotion">{props.emotion}</span>
      </div>
      <p className="alt-psyche__thought">“{props.thought}”</p>
      <div className="alt-psyche__stress">
        <span>STRESS</span>
        <div className="alt-psyche__bar">
          <div
            className="alt-psyche__fill"
            style={{ width: `${Math.min(100, Math.max(0, props.stress))}%` }}
          />
        </div>
        <span>{props.stress}</span>
      </div>
    </div>
  );
}

export function TensionMeter(props: { tension: number; label?: string }) {
  const t = Math.min(100, Math.max(0, props.tension));
  const color = t > 70 ? "#ff3b3b" : t > 40 ? "#ffa63b" : "#3bd1ff";
  return (
    <div className="alt-tension" style={{ ["--alt-accent" as any]: color }}>
      <div className="alt-tension__top">
        <span>TENSION</span>
        {props.label && <span className="alt-tension__label">{props.label}</span>}
        <span className="alt-tension__val">{t}</span>
      </div>
      <div className="alt-tension__track">
        <div className="alt-tension__fill" style={{ width: `${t}%` }} />
      </div>
    </div>
  );
}

export function ScenarioBeat(props: {
  beatNumber: number;
  headline: string;
  detail: string;
  outcome?: string;
}) {
  return (
    <div className={`alt-beat alt-beat--${props.outcome || "neutral"}`}>
      <div className="alt-beat__num">BEAT {props.beatNumber}</div>
      <div className="alt-beat__headline">{props.headline}</div>
      <div className="alt-beat__detail">{props.detail}</div>
      {props.outcome && (
        <div className="alt-beat__tag">{props.outcome.replace("_", " ")}</div>
      )}
    </div>
  );
}

export function DecisionFork(props: {
  prompt: string;
  options: { id: string; label: string; consequence?: string }[];
  onPick?: (id: string) => void; // wire to a frontend tool / dataModel update
}) {
  return (
    <div className="alt-fork">
      <div className="alt-fork__prompt">{props.prompt}</div>
      <div className="alt-fork__options">
        {props.options?.map((o) => (
          <button
            key={o.id}
            className="alt-fork__opt"
            onClick={() => props.onPick?.(o.id)}
          >
            <span className="alt-fork__label">{o.label}</span>
            {o.consequence && (
              <span className="alt-fork__consequence">{o.consequence}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FactInjection(props: {
  sourceLabel: string;
  fact: string;
  appliedBy?: string;
}) {
  return (
    <div className="alt-fact">
      <div className="alt-fact__src">🔎 {props.sourceLabel}</div>
      <div className="alt-fact__body">{props.fact}</div>
      {props.appliedBy && (
        <div className="alt-fact__by">applied by {props.appliedBy}</div>
      )}
    </div>
  );
}

/** Register these in the starter's renderer map, e.g.:
 *
 *   export const ALTER_RENDERERS = {
 *     CharacterPsycheCard,
 *     TensionMeter,
 *     ScenarioBeat,
 *     DecisionFork,
 *     FactInjection,
 *   };
 *
 * then spread ALTER_RENDERERS into the catalog's component registry.
 */
