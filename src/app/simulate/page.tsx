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

const DEFAULT_SETUP: SimSetup = {
  c1Name: "Maya",
  c1Personality: "An anxious teacher who freezes under pressure",
  c2Name: "Jordan",
  c2Personality: "A calm natural leader",
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

      {!started && (
        <div className="sim-setup">
          <div className="sim-setup__card">
            <h1 className="sim-setup__title">ALTER Simulation</h1>
            <p className="sim-setup__sub">
              Configure two characters and pick a scenario to begin.
            </p>

            <div className="sim-setup__field">
              <label className="sim-setup__label" htmlFor="c1-name">
                Character 1 — Name
              </label>
              <input
                id="c1-name"
                className="sim-setup__input"
                value={setup.c1Name}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, c1Name: e.target.value }))
                }
                placeholder="Maya"
              />
            </div>
            <div className="sim-setup__field">
              <label className="sim-setup__label" htmlFor="c1-personality">
                Character 1 — Personality
              </label>
              <input
                id="c1-personality"
                className="sim-setup__input"
                value={setup.c1Personality}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, c1Personality: e.target.value }))
                }
                placeholder="An anxious teacher who freezes under pressure"
              />
            </div>

            <div className="sim-setup__field">
              <label className="sim-setup__label" htmlFor="c2-name">
                Character 2 — Name
              </label>
              <input
                id="c2-name"
                className="sim-setup__input"
                value={setup.c2Name}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, c2Name: e.target.value }))
                }
                placeholder="Jordan"
              />
            </div>
            <div className="sim-setup__field">
              <label className="sim-setup__label" htmlFor="c2-personality">
                Character 2 — Personality
              </label>
              <input
                id="c2-personality"
                className="sim-setup__input"
                value={setup.c2Personality}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, c2Personality: e.target.value }))
                }
                placeholder="A calm natural leader"
              />
            </div>

            <span className="sim-setup__label">Scenario</span>
            <div className="sim-setup__scenarios">
              <button
                type="button"
                className={`sim-setup__scenario${setup.scenario === "classroom_flood" ? " sim-setup__scenario--active" : ""}`}
                onClick={() =>
                  setSetup((s) => ({
                    ...s,
                    scenario: "classroom_flood" as SimScenario,
                  }))
                }
              >
                Classroom Flood
              </button>
              <button
                type="button"
                className={`sim-setup__scenario${setup.scenario === "robbery" ? " sim-setup__scenario--active" : ""}`}
                onClick={() =>
                  setSetup((s) => ({
                    ...s,
                    scenario: "robbery" as SimScenario,
                  }))
                }
              >
                Robbery
              </button>
            </div>

            <button
              type="button"
              className="sim-setup__begin"
              disabled={
                running ||
                !setup.c1Name.trim() ||
                !setup.c2Name.trim()
              }
              onClick={() => void handleBegin()}
            >
              {running ? "Starting…" : "Begin"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
