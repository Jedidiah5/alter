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

const SCENARIOS: Array<{
  key: SimScenario;
  label: string;
  icon: string;
  desc: string;
  defaultC1: string;
  defaultC2: string;
}> = [
  {
    key: "classroom_flood",
    label: "Classroom Flood",
    icon: "🌊",
    desc: "Water rising fast in a locked classroom. One window. No exits.",
    defaultC1: "An anxious teacher who freezes under pressure but deeply cares",
    defaultC2: "A calm natural leader who takes charge in a crisis",
  },
  {
    key: "robbery",
    label: "Robbery",
    icon: "🔫",
    desc: "Armed robber enters a convenience store. Every second counts.",
    defaultC1: "A timid cashier who panics when confronted",
    defaultC2: "A quick-thinking regular customer who stays cold under pressure",
  },
  {
    key: "job_interview",
    label: "Job Interview",
    icon: "💼",
    desc: "High-stakes interview. Unexpected personal question just dropped.",
    defaultC1: "An overqualified candidate hiding their desperation",
    defaultC2: "A sharp interviewer who reads people like books",
  },
  {
    key: "first_date",
    label: "First Date",
    icon: "🕯️",
    desc: "Cozy restaurant. Chemistry uncertain. One just said something awkward.",
    defaultC1: "An over-thinker who second-guesses every word they say",
    defaultC2: "A charming extrovert who talks too much when nervous",
  },
  {
    key: "argument",
    label: "The Argument",
    icon: "💥",
    desc: "Living room. A secret just came out. Things just got very personal.",
    defaultC1: "Someone who shuts down and goes cold when hurt",
    defaultC2: "Someone who fights loudly but means it when they apologise",
  },
  {
    key: "hospital",
    label: "Hospital Wait",
    icon: "🏥",
    desc: "Waiting room. Doctor walking over. Test results about to change everything.",
    defaultC1: "The patient — terrified but trying to stay stoic",
    defaultC2: "The supportive friend who doesn't know what to say",
  },
];

const DEFAULT_SETUP: SimSetup = {
  c1Name: "Maya",
  c1Personality: SCENARIOS[0].defaultC1,
  c2Name: "Jordan",
  c2Personality: SCENARIOS[0].defaultC2,
  scenario: "classroom_flood",
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
    if (!setup.c1Name.trim() || !setup.c2Name.trim()) return;
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

  const selectScenario = (s: typeof SCENARIOS[0]) => {
    setSetup((prev) => ({
      ...prev,
      scenario: s.key,
      c1Personality: s.defaultC1,
      c2Personality: s.defaultC2,
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
              Two AI characters. One scenario. Watch personalities collide.
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

            {/* Characters */}
            <div className="sim-setup__chars">
              <div className="sim-setup__char-col">
                <span className="sim-setup__label">Character 1</span>
                <input
                  className="sim-setup__input"
                  value={setup.c1Name}
                  onChange={(e) => setSetup((s) => ({ ...s, c1Name: e.target.value }))}
                  placeholder="Name"
                />
                <textarea
                  className="sim-setup__textarea"
                  value={setup.c1Personality}
                  onChange={(e) => setSetup((s) => ({ ...s, c1Personality: e.target.value }))}
                  placeholder="Describe their personality…"
                  rows={3}
                />
              </div>
              <div className="sim-setup__char-col">
                <span className="sim-setup__label">Character 2</span>
                <input
                  className="sim-setup__input"
                  value={setup.c2Name}
                  onChange={(e) => setSetup((s) => ({ ...s, c2Name: e.target.value }))}
                  placeholder="Name"
                />
                <textarea
                  className="sim-setup__textarea"
                  value={setup.c2Personality}
                  onChange={(e) => setSetup((s) => ({ ...s, c2Personality: e.target.value }))}
                  placeholder="Describe their personality…"
                  rows={3}
                />
              </div>
            </div>

            <button
              type="button"
              className="sim-setup__begin"
              disabled={running || !setup.c1Name.trim() || !setup.c2Name.trim()}
              onClick={() => void handleBegin()}
            >
              {running ? "Starting…" : "Begin Simulation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
