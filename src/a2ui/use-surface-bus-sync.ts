"use client";

import { useEffect, useRef } from "react";
import {
  UseAgentUpdate,
  useAgent,
} from "@copilotkit/react-core/v2";
import { surfaceBus, type A2UIOp } from "./surface-bus";

function extractA2UIOps(content: unknown): A2UIOp[] | null {
  if (content == null) return null;

  let parsed: unknown = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const ops = (parsed as { a2ui_operations?: A2UIOp[] }).a2ui_operations;
  return Array.isArray(ops) && ops.length ? ops : null;
}

/**
 * Forwards A2UI activity messages from the agent thread into surfaceBus.
 * Needed when CopilotChat is hidden — MirrorRenderer only runs when chat
 * messages are actually mounted in the DOM.
 */
export function useSurfaceBusSync(channel: string) {
  const { agent } = useAgent({
    agentId: channel,
    updates: [UseAgentUpdate.OnMessagesChanged],
  });
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const m of agent.messages ?? []) {
      if (processedRef.current.has(m.id)) continue;

      let ops: A2UIOp[] | null = null;

      if (m.role === "activity" && m.activityType === "a2ui-surface") {
        ops = extractA2UIOps(m.content);
      } else if (m.role === "tool") {
        ops = extractA2UIOps(m.content);
      }

      if (!ops?.length) continue;

      processedRef.current.add(m.id);
      console.log(
        `[surface-bus-sync] channel=${channel} +${ops.length} ops from msg=${m.id}`,
      );
      surfaceBus.push(channel, ops);
    }
  }, [agent.messages, channel]);
}
