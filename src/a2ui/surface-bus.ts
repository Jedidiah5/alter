/**
 * A tiny event bus that mirrors A2UI surface ops from the chat's
 * activity-message stream into the workspace `<SurfaceCanvas>`.
 *
 * Activity messages live inside CopilotChat's renderer scope; the canvas
 * lives outside it. The bus lets us forward ops between the two without
 * coupling React contexts.
 *
 * Per-thread (agentId) so /fixed and /dynamic don't fight over the same
 * canvas state.
 */
export type A2UIOp = Record<string, unknown> & { version?: string };

export type StageState = {
  tension: number;
  characters: Array<{
    name: string;
    animation: string;
    emotion: string;
    intensity: number;
  }>;
};

export type SimScenario = "classroom_flood" | "robbery";

type Snapshot = {
  surfaceId: string | null;
  ops: A2UIOp[];
  stageState: StageState | null;
  scenario: SimScenario | null;
};

type Listener = (snap: Snapshot) => void;

const buffers = new Map<string, A2UIOp[]>();
const surfaceIds = new Map<string, string | null>();
const stageStates = new Map<string, StageState | null>();
const scenarios = new Map<string, SimScenario | null>();
const listeners = new Map<string, Set<Listener>>();

function getSurfaceIdFromOp(op: A2UIOp): string | undefined {
  const cs = (op.createSurface as { surfaceId?: string } | undefined)
    ?.surfaceId;
  const uc = (op.updateComponents as { surfaceId?: string } | undefined)
    ?.surfaceId;
  const ud = (op.updateDataModel as { surfaceId?: string } | undefined)
    ?.surfaceId;
  return cs ?? uc ?? ud;
}

function applyDataModel(channel: string, op: A2UIOp) {
  const ud = op.updateDataModel as
    | { value?: { stage?: StageState; scenario?: string } }
    | undefined;
  const value = ud?.value;
  if (!value) return;
  if (value.stage) stageStates.set(channel, value.stage);
  if (value.scenario === "robbery" || value.scenario === "classroom_flood") {
    scenarios.set(channel, value.scenario);
  }
}

const DEBUG = typeof window !== "undefined";

function opSummary(op: A2UIOp): string {
  const kind =
    "createSurface" in op
      ? "createSurface"
      : "updateComponents" in op
        ? "updateComponents"
        : "updateDataModel" in op
          ? "updateDataModel"
          : "deleteSurface" in op
            ? "deleteSurface"
            : "?";
  const sid = getSurfaceIdFromOp(op) ?? "?";
  return `${kind}(${sid})`;
}

function latestFromOps(ops: A2UIOp[]): {
  stageState: StageState | null;
  scenario: SimScenario | null;
} {
  let stageState: StageState | null = null;
  let scenario: SimScenario | null = null;
  for (const op of ops) {
    const ud = op.updateDataModel as
      | { value?: { stage?: StageState; scenario?: string } }
      | undefined;
    const value = ud?.value;
    if (!value) continue;
    if (value.stage) stageState = value.stage;
    if (value.scenario === "robbery" || value.scenario === "classroom_flood") {
      scenario = value.scenario;
    }
  }
  return { stageState, scenario };
}

export const surfaceBus = {
  push(channel: string, ops: A2UIOp[]) {
    const buf = buffers.get(channel) ?? [];
    const before = buf.length;
    buf.push(...ops);
    buffers.set(channel, buf);
    for (const op of ops) {
      const sid = getSurfaceIdFromOp(op);
      if (sid) surfaceIds.set(channel, sid);
      applyDataModel(channel, op);
    }
    const subCount = listeners.get(channel)?.size ?? 0;
    if (DEBUG) {
      console.log(
        `[surface-bus] push channel=${channel} +${ops.length} ops ` +
          `(buf ${before}→${buf.length}, subs=${subCount}) [${ops.map(opSummary).join(", ")}]`,
      );
    }
    const snap = this.snapshot(channel);
    listeners.get(channel)?.forEach((fn) => fn(snap));
  },

  reset(channel: string) {
    buffers.set(channel, []);
    surfaceIds.set(channel, null);
    stageStates.set(channel, null);
    scenarios.set(channel, null);
    if (DEBUG) console.log(`[surface-bus] reset channel=${channel}`);
    const snap = this.snapshot(channel);
    listeners.get(channel)?.forEach((fn) => fn(snap));
  },

  snapshot(channel: string): Snapshot {
    const ops = buffers.get(channel) ?? [];
    const cachedStage = stageStates.get(channel) ?? null;
    const cachedScenario = scenarios.get(channel) ?? null;
    const fromOps = latestFromOps(ops);
    return {
      surfaceId: surfaceIds.get(channel) ?? null,
      ops,
      stageState: cachedStage ?? fromOps.stageState,
      scenario: cachedScenario ?? fromOps.scenario,
    };
  },

  subscribe(channel: string, fn: Listener) {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(fn);
    if (DEBUG)
      console.log(
        `[surface-bus] subscribe channel=${channel} (subs=${listeners.get(channel)!.size})`,
      );
    return () => {
      listeners.get(channel)?.delete(fn);
      if (DEBUG)
        console.log(
          `[surface-bus] unsubscribe channel=${channel} (subs=${listeners.get(channel)?.size ?? 0})`,
        );
    };
  },
};
