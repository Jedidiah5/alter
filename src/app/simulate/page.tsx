"use client";

import { useCallback, useState } from "react";
import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import {
  SimulateCanvas,
  buildNextBeatMessage,
  buildStartMessage,
  type SimSetup,
} from "@/components/SimulateCanvas";
import { surfaceBus } from "@/a2ui/surface-bus";
import { useSurfaceBusSync } from "@/a2ui/use-surface-bus-sync";
import type { SimScenario } from "@/a2ui/surface-bus";
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

  const running = agent.isRunning;
  const activeScenario =
    SCENARIOS.find((s) => s.key === setup.scenario) ?? DEFAULT_SCENARIO;

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

  const handleNextBeat = useCallback(async () => {
    if (!setup || running) return;
    const next = beatNumber + 1;
    await runAgent(buildNextBeatMessage(setup, next));
    setBeatNumber(next);
  }, [setup, beatNumber, running, runAgent]);

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
        />
      </div>

      {error && started && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-900/80 text-white text-sm border border-red-500/40">
          {error}
        </div>
      )}

      {started && !running && (
        <button
          type="button"
          className={`sim-autoplay-btn${autoPlay ? " sim-autoplay-btn--active" : ""}`}
          onClick={toggleAutoPlay}
          title={autoPlay ? "Stop auto-play" : "Auto-advance beats every 7 s"}
        >
          {autoPlay ? "⏸ Auto" : "▶ Auto"}
        </button>
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
          </div>
        </div>
      )}
    </div>
  );
}
