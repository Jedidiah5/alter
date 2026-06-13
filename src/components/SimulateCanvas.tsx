"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { useAgent } from "@copilotkit/react-core/v2";
import { catalog } from "@/a2ui/catalog";
import {
  surfaceBus,
  type SimScenario,
  type StageState,
} from "@/a2ui/surface-bus";
import type { Scenario } from "@/components/CharacterStage";

const CharacterStage = dynamic(() => import("@/components/CharacterStage"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a12] text-[var(--muted)] text-sm">
      Loading 3D stage…
    </div>
  ),
});

export type SimSetup = {
  c1Name: string;
  c1Personality: string;
  c2Name: string;
  c2Personality: string;
  scenario: SimScenario;
};

function parseScenarioFromText(text: string): SimScenario | null {
  const t = text.toLowerCase();
  if (t.includes("robbery") || t.includes("robber") || t.includes("convenience store") || t.includes("armed")) return "robbery";
  if (t.includes("flood") || t.includes("classroom")) return "classroom_flood";
  if (t.includes("job_interview") || t.includes("interview") || t.includes("interviewer")) return "job_interview";
  if (t.includes("first_date") || t.includes("first date") || t.includes("restaurant") || t.includes("candle")) return "first_date";
  if (t.includes("argument") || t.includes("living room") || t.includes("fight")) return "argument";
  if (t.includes("hospital") || t.includes("waiting room") || t.includes("doctor") || t.includes("medical")) return "hospital";
  return null;
}

function useSimScenario(
  channel: string,
  setupScenario?: SimScenario,
): Scenario {
  const { agent } = useAgent({ agentId: channel });
  const [scenario, setScenario] = useState<Scenario>(
    setupScenario ?? "classroom_flood",
  );

  useEffect(() => {
    if (setupScenario) setScenario(setupScenario);
  }, [setupScenario]);

  useEffect(() => {
    const fromBus = surfaceBus.snapshot(channel).scenario;
    if (fromBus) setScenario(fromBus);
    return surfaceBus.subscribe(channel, (snap) => {
      if (snap.scenario) setScenario(snap.scenario);
    });
  }, [channel]);

  useEffect(() => {
    const msgs = agent.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role !== "user") continue;
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((c) =>
                  typeof c === "string"
                    ? c
                    : c && typeof c === "object" && "text" in c
                      ? String((c as { text?: string }).text ?? "")
                      : "",
                )
                .join(" ")
            : "";
      const parsed = parseScenarioFromText(text);
      if (parsed) {
        setScenario(parsed);
        break;
      }
    }
  }, [agent.messages]);

  return scenario;
}

function useStageState(channel: string): StageState | undefined {
  const [stageState, setStageState] = useState<StageState | undefined>();

  useEffect(() => {
    const initial = surfaceBus.snapshot(channel).stageState;
    if (initial) setStageState(initial);
    return surfaceBus.subscribe(channel, (snap) => {
      if (snap.stageState) setStageState(snap.stageState);
    });
  }, [channel]);

  return stageState;
}

function A2UIOverlay({ channel }: { channel: string }) {
  const actions = useA2UIActions();
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const seenRef = useRef(0);
  const createdSurfacesRef = useRef<Set<string>>(new Set());

  function applyOps(ops: Array<Record<string, unknown>>) {
    if (!ops.length) return;
    const out = ops.filter((op) => {
      const cs = op.createSurface as { surfaceId?: string } | undefined;
      if (cs?.surfaceId) {
        if (createdSurfacesRef.current.has(cs.surfaceId)) return false;
        createdSurfacesRef.current.add(cs.surfaceId);
      }
      return true;
    });
    try {
      actions.processMessages(out);
    } catch (err) {
      console.warn("[simulate-canvas] processMessages threw:", err);
    }
  }

  useEffect(() => {
    const initial = surfaceBus.snapshot(channel);
    if (initial.ops.length) {
      applyOps(initial.ops as never);
      seenRef.current = initial.ops.length;
      setSurfaceId(initial.surfaceId);
    }
    return surfaceBus.subscribe(channel, (snap) => {
      const tail = snap.ops.slice(seenRef.current);
      if (tail.length) applyOps(tail as never);
      seenRef.current = snap.ops.length;
      if (snap.surfaceId) setSurfaceId(snap.surfaceId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, channel]);

  if (!surfaceId) return null;

  return (
    <div className="sim-hud-panel">
      <A2UIRenderer surfaceId={surfaceId} />
    </div>
  );
}

function fallbackStage(setup: SimSetup, beat: number): StageState {
  return {
    tension: 35 + beat * 8,
    beatNumber: beat,
    characters: [
      {
        name: setup.c1Name,
        animation: beat === 1 ? "freeze" : "talk",
        emotion: "nervous",
        intensity: 0.45,
        dialogue:
          beat === 1
            ? "What's happening? The water — it's already at the desks!"
            : "We need to move. Now!",
      },
      {
        name: setup.c2Name,
        animation: "point",
        emotion: "determined",
        intensity: 0.25,
        dialogue:
          beat === 1
            ? "Everyone stay calm. Head for the window — I'll help Maya."
            : "I've got a plan. Follow me.",
      },
    ],
  };
}

function SimulateCanvasInner({
  channel,
  started,
  setup,
  beatNumber,
  running,
  onNextBeat,
}: {
  channel: string;
  started: boolean;
  setup: SimSetup | null;
  beatNumber: number;
  running: boolean;
  onNextBeat: () => void;
}) {
  const stageState = useStageState(channel);
  const scenario = useSimScenario(channel, setup?.scenario);
  const effectiveStage =
    stageState ??
    (started && setup && beatNumber > 0
      ? fallbackStage(setup, beatNumber)
      : undefined);
  const [hasSurface, setHasSurface] = useState(
    () => !!surfaceBus.snapshot(channel).surfaceId,
  );

  useEffect(() => {
    return surfaceBus.subscribe(channel, (snap) => {
      setHasSurface(!!snap.surfaceId);
    });
  }, [channel]);

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden bg-[#0a0a12]">
      <div className="absolute inset-0 z-0 min-h-[300px]">
        <CharacterStage stageState={effectiveStage} scenario={scenario} />
      </div>

      {started && !hasSurface && running && (
        <div className="absolute inset-x-0 top-6 z-10 flex justify-center pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-black/50 text-white/80 text-sm backdrop-blur-md border border-white/10">
            Generating beat…
          </div>
        </div>
      )}

      {started && hasSurface && (
        <div className="absolute inset-x-0 top-0 z-10 p-4 md:p-5 pointer-events-none">
          <div className="sim-hud">
            <A2UIOverlay channel={channel} />
          </div>
        </div>
      )}

      {started && (
        <button
          type="button"
          className="sim-next-beat"
          disabled={running}
          onClick={onNextBeat}
        >
          {running ? "Simulating…" : `Next Beat (${beatNumber + 1})`}
        </button>
      )}
    </div>
  );
}

export function SimulateCanvas({
  channel,
  started,
  setup,
  beatNumber,
  running,
  onNextBeat,
}: {
  channel: string;
  started: boolean;
  setup: SimSetup | null;
  beatNumber: number;
  running: boolean;
  onNextBeat: () => void;
}) {
  const { agent } = useAgent({ agentId: channel });

  return (
    <div className="h-full w-full">
      <A2UIProvider
        catalog={catalog}
        onAction={(message) => {
          const ua = message?.userAction;
          if (ua?.name) {
            agent.addMessage({
              id: crypto.randomUUID(),
              role: "user",
              content: ua.name,
            });
          }
          void agent.runAgent({ forwardedProps: { a2uiAction: message } });
        }}
      >
        <SimulateCanvasInner
          channel={channel}
          started={started}
          setup={setup}
          beatNumber={beatNumber}
          running={running}
          onNextBeat={onNextBeat}
        />
      </A2UIProvider>
    </div>
  );
}

export function buildStartMessage(setup: SimSetup): string {
  return (
    `Start simulation beat 1. ` +
    `Character 1: ${setup.c1Name} — ${setup.c1Personality}. ` +
    `Character 2: ${setup.c2Name} — ${setup.c2Personality}. ` +
    `Scenario: ${setup.scenario}.`
  );
}

export function buildNextBeatMessage(setup: SimSetup, beat: number): string {
  return (
    `Next beat. Beat ${beat}. ` +
    `Continue with Character 1: ${setup.c1Name}, Character 2: ${setup.c2Name}, ` +
    `Scenario: ${setup.scenario}.`
  );
}
