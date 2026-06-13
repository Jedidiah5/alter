"use client";

import { useCallback, useEffect, useState } from "react";
import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import {
  SimulateCanvas,
  buildNextBeatMessage,
  buildStartMessage,
  type SimSetup,
} from "@/components/SimulateCanvas";
import { surfaceBus } from "@/a2ui/surface-bus";
import { useSurfaceBusSync } from "@/a2ui/use-surface-bus-sync";
import type { SimScenario, StageState } from "@/a2ui/surface-bus";
import { DEMO_SCRIPTS, type DemoBeat } from "./demo-scripts";
import type { DemoHudData } from "@/components/DemoHud";
import "./simulate.css";

const AGENT_ID = "simulate_agent";

/**
 * Each scenario ships with a pre-made NPC foil. The user only describes
 * themselves (Character 1); the app supplies Character 2.
 */
const SCENARIOS: Array<{
  key: SimScenario;
  label: string;
  icon: string;
  desc: string;
  npcName: string;
  npcPersonality: string;
}> = [
  {
    key: "classroom_flood",
    label: "Classroom Flood",
    icon: "🌊",
    desc: "Water rising fast in a locked classroom. One window. No exits.",
    npcName: "Mr. Torres",
    npcPersonality: "A strict but caring teacher who takes charge in emergencies",
  },
  {
    key: "robbery",
    label: "Robbery",
    icon: "🔫",
    desc: "An armed robber bursts into the store and pulls a gun. Every second counts.",
    npcName: "Sam",
    npcPersonality: "A nervous cashier who has never been in danger before",
  },
  {
    key: "job_interview",
    label: "Job Interview",
    icon: "💼",
    desc: "High-stakes interview. An unexpected personal question just dropped.",
    npcName: "Diane Cole",
    npcPersonality: "A sharp, no-nonsense hiring director who probes for weaknesses",
  },
  {
    key: "first_date",
    label: "First Date",
    icon: "🕯️",
    desc: "Cozy restaurant. The chemistry is uncertain and the silence is loud.",
    npcName: "Alex",
    npcPersonality: "A charming but guarded date who reveals little and watches closely",
  },
  {
    key: "argument",
    label: "The Argument",
    icon: "💥",
    desc: "Living room. A secret just came out. It just got very personal.",
    npcName: "Jordan",
    npcPersonality: "Your partner — hurt, demanding the truth, and refusing to let it go",
  },
  {
    key: "hospital",
    label: "Hospital Wait",
    icon: "🏥",
    desc: "Waiting room. The doctor is walking over with your results.",
    npcName: "Casey",
    npcPersonality: "Your closest friend, trying to keep you calm while you wait",
  },
];

const DEFAULT_SCENARIO = SCENARIOS[0];

const DEFAULT_SETUP: SimSetup = {
  c1Name: "",
  c1Personality: "",
  c2Name: DEFAULT_SCENARIO.npcName,
  c2Personality: DEFAULT_SCENARIO.npcPersonality,
  scenario: DEFAULT_SCENARIO.key,
};

/** Convert a scripted demo beat into the StageState the 3D stage consumes. */
function demoToStage(
  beat: DemoBeat,
  youName: string,
  npcName: string,
  beatNumber: number,
): StageState {
  const names = [youName, npcName];
  return {
    tension: beat.tension,
    beatNumber,
    characters: beat.chars.map((c, i) => ({
      name: names[i],
      animation: c.animation,
      emotion: c.emotion,
      intensity: c.stress / 100,
      dialogue: c.dialogue,
      x: c.x,
      z: c.z,
      facing: c.facing,
    })),
  };
}

const DEMO_BEAT_MS = 6000;

export default function SimulatePage() {
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [
      UseAgentUpdate.OnMessagesChanged,
      UseAgentUpdate.OnRunStatusChanged,
    ],
  });

  useSurfaceBusSync(AGENT_ID);

  const [started, setStarted] = useState(false);
  const [beatNumber, setBeatNumber] = useState(0);
  const [setup, setSetup] = useState<SimSetup>(DEFAULT_SETUP);
  const [error, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  // Scripted demo mode — plays canned beats with no LLM calls (for recording).
  const [demoMode, setDemoMode] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoPaused, setDemoPaused] = useState(false);

  const running = agent.isRunning;
  const activeScenario =
    SCENARIOS.find((s) => s.key === setup.scenario) ?? DEFAULT_SCENARIO;

  // Auto-advance the scripted demo, holding on the final beat.
  useEffect(() => {
    if (!demoMode || demoPaused) return;
    const script = DEMO_SCRIPTS[setup.scenario];
    if (demoIndex >= script.length - 1) return;
    const t = setTimeout(() => setDemoIndex((i) => i + 1), DEMO_BEAT_MS);
    return () => clearTimeout(t);
  }, [demoMode, demoPaused, demoIndex, setup.scenario]);

  const runAgent = useCallback(
    async (message: string) => {
      setError(null);
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: message,
      });
      try {
        await agent.runAgent();
      } catch (err) {
        console.error("[simulate] runAgent failed:", err);
        const msg = err instanceof Error ? err.message : "Simulation failed";
        if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
          setError(
            "Gemini API quota exceeded. Wait a minute and retry, or update GEMINI_API_KEY in agent/.env.",
          );
        } else {
          setError(msg);
        }
      }
    },
    [agent],
  );

  const handleBegin = useCallback(async () => {
    if (!setup.c1Name.trim() || !setup.c1Personality.trim()) return;
    surfaceBus.reset(AGENT_ID);
    setStarted(true);
    setBeatNumber(1);
    await runAgent(buildStartMessage(setup));
  }, [setup, runAgent]);

  const handleStartDemo = useCallback(() => {
    surfaceBus.reset(AGENT_ID);
    setError(null);
    setDemoIndex(0);
    setDemoPaused(false);
    setDemoMode(true);
    setStarted(true);
  }, []);

  const handleNextBeat = useCallback(async () => {
    if (demoMode) {
      const script = DEMO_SCRIPTS[setup.scenario];
      // Advance, or loop back to the start once past the final beat.
      setDemoIndex((i) => (i >= script.length - 1 ? 0 : i + 1));
      return;
    }
    if (!setup || running) return;
    const next = beatNumber + 1;
    await runAgent(buildNextBeatMessage(setup, next));
    setBeatNumber(next);
  }, [demoMode, setup, beatNumber, running, runAgent]);

  const toggleAutoPlay = useCallback(() => {
    if (autoPlay) {
      if (autoTimer) clearInterval(autoTimer);
      setAutoTimer(null);
      setAutoPlay(false);
    } else {
      setAutoPlay(true);
      const timer = setInterval(() => {
        if (!running) {
          void handleNextBeat();
        }
      }, 7000);
      setAutoTimer(timer);
    }
  }, [autoPlay, autoTimer, running, handleNextBeat]);

  // Picking a scenario swaps in that scenario's pre-made NPC (Character 2).
  const selectScenario = (s: typeof SCENARIOS[0]) => {
    setSetup((prev) => ({
      ...prev,
      scenario: s.key,
      c2Name: s.npcName,
      c2Personality: s.npcPersonality,
    }));
  };

  // ── Derive the scripted-demo stage + HUD for the current beat ──
  const demoScript = demoMode ? DEMO_SCRIPTS[setup.scenario] : null;
  const demoBeat: DemoBeat | null = demoScript
    ? demoScript[Math.min(demoIndex, demoScript.length - 1)]
    : null;
  const youName = setup.c1Name.trim() || "You";
  const demoStage = demoBeat
    ? demoToStage(demoBeat, youName, setup.c2Name, demoIndex + 1)
    : undefined;
  const demoHud: DemoHudData | null = demoBeat
    ? { beat: demoBeat, beatNumber: demoIndex + 1, youName, npcName: setup.c2Name }
    : null;
  const demoAtEnd = !!demoScript && demoIndex >= demoScript.length - 1;
  const nextLabel = demoMode
    ? demoAtEnd
      ? "↻ Replay demo"
      : `Next Beat (${demoIndex + 2})`
    : undefined;

  return (
    <div className="sim-root">
      <div className="sim-stage">
        <SimulateCanvas
          channel={AGENT_ID}
          started={started}
          setup={setup}
          beatNumber={beatNumber}
          running={running}
          onNextBeat={handleNextBeat}
          demoStage={demoStage}
          demoHud={demoHud}
          nextLabel={nextLabel}
        />
      </div>

      {/* Analog atmosphere — warm vignette + film grain over the 3D stage */}
      <div className="sim-vignette" aria-hidden />
      <div className="sim-grain" aria-hidden />

      {error && started && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-900/80 text-white text-sm border border-red-500/40">
          {error}
        </div>
      )}

      {started && demoMode && (
        <button
          type="button"
          className={`sim-autoplay-btn${!demoPaused ? " sim-autoplay-btn--active" : ""}`}
          onClick={() => setDemoPaused((p) => !p)}
          title={demoPaused ? "Resume demo" : "Pause demo"}
        >
          {demoPaused ? "▶ Play" : "⏸ Pause"}
        </button>
      )}

      {started && !demoMode && !running && (
        <button
          type="button"
          className={`sim-autoplay-btn${autoPlay ? " sim-autoplay-btn--active" : ""}`}
          onClick={toggleAutoPlay}
          title={autoPlay ? "Stop auto-play" : "Auto-advance beats every 7 s"}
        >
          {autoPlay ? "⏸ Auto" : "▶ Auto"}
        </button>
      )}

      {started && demoMode && (
        <div className="sim-demo-badge">▶ Scripted demo</div>
      )}

      {!started && (
        <div className="sim-setup">
          <div className="sim-setup__card">
            <h1 className="sim-setup__title">ALTER</h1>
            <p className="sim-setup__sub">
              Discover your crisis personality — find out how <em>you</em> would
              really react.
            </p>

            {/* Scenario grid */}
            <span className="sim-setup__label">Choose a scenario</span>
            <div className="sim-setup__scenario-grid">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`sim-setup__scenario-card${setup.scenario === s.key ? " sim-setup__scenario-card--active" : ""}`}
                  onClick={() => selectScenario(s)}
                >
                  <span className="sim-setup__scenario-icon">{s.icon}</span>
                  <span className="sim-setup__scenario-name">{s.label}</span>
                  <span className="sim-setup__scenario-desc">{s.desc}</span>
                </button>
              ))}
            </div>

            {/* Describe yourself — the only character the user controls */}
            <span className="sim-setup__label">Describe yourself</span>
            <div className="sim-setup__you">
              <input
                className="sim-setup__input"
                value={setup.c1Name}
                onChange={(e) => setSetup((s) => ({ ...s, c1Name: e.target.value }))}
                placeholder="Your name"
              />
              <textarea
                className="sim-setup__textarea"
                value={setup.c1Personality}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, c1Personality: e.target.value }))
                }
                placeholder="e.g. I'm usually calm but I freeze under real pressure, and I overthink everything…"
                rows={3}
              />
            </div>

            {/* The pre-made NPC the user will be dropped in with */}
            <div className="sim-setup__npc">
              <span className="sim-setup__npc-label">You&apos;ll be dropped in with</span>
              <span className="sim-setup__npc-name">{activeScenario.npcName}</span>
              <span className="sim-setup__npc-desc">{activeScenario.npcPersonality}</span>
            </div>

            <button
              type="button"
              className="sim-setup__begin"
              disabled={
                running || !setup.c1Name.trim() || !setup.c1Personality.trim()
              }
              onClick={() => void handleBegin()}
            >
              {running ? "Starting…" : "Drop me in"}
            </button>

            <button
              type="button"
              className="sim-setup__demo"
              onClick={handleStartDemo}
              title="Play a pre-scripted run of this scenario — no AI or API key needed"
            >
              ▶ Play scripted demo · no AI needed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
