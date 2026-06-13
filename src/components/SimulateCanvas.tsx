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

function parseScenarioFromText(text: string): SimScenario | null {
  const t = text.toLowerCase();
  if (
    t.includes("robbery") ||
    t.includes("robber") ||
    t.includes("convenience store") ||
    t.includes("armed")
  ) {
    return "robbery";
  }
  if (t.includes("flood") || t.includes("classroom")) {
    return "classroom_flood";
  }
  return null;
}

function useSimScenario(channel: string): Scenario {
  const { agent } = useAgent({ agentId: channel });
  const [scenario, setScenario] = useState<Scenario>("classroom_flood");

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
    <div className="a2ui-surface rounded-xl border border-white/10 bg-black/45 backdrop-blur-md p-4 md:p-5 shadow-2xl">
      <A2UIRenderer surfaceId={surfaceId} />
    </div>
  );
}

function SimulateCanvasInner({
  channel,
  emptyState,
}: {
  channel: string;
  emptyState: React.ReactNode;
}) {
  const stageState = useStageState(channel);
  const scenario = useSimScenario(channel);
  const [hasSurface, setHasSurface] = useState(
    () => !!surfaceBus.snapshot(channel).surfaceId,
  );

  useEffect(() => {
    return surfaceBus.subscribe(channel, (snap) => {
      setHasSurface(!!snap.surfaceId);
    });
  }, [channel]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <CharacterStage stageState={stageState} scenario={scenario} />
      </div>

      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
        {!hasSurface && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md px-6 py-5 max-w-md text-center">
              {emptyState}
            </div>
          </div>
        )}

        {hasSurface && (
          <div className="mt-auto max-h-[58%] overflow-y-auto pointer-events-auto p-4 md:p-5">
            <A2UIOverlay channel={channel} />
          </div>
        )}
      </div>
    </div>
  );
}

export function SimulateCanvas({
  channel,
  emptyState,
}: {
  channel: string;
  emptyState: React.ReactNode;
}) {
  const { agent } = useAgent({ agentId: channel });

  return (
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
      <SimulateCanvasInner channel={channel} emptyState={emptyState} />
    </A2UIProvider>
  );
}
