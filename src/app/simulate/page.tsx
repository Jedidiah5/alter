"use client";

import { CopilotChat, useAgent } from "@copilotkit/react-core/v2";
import { SiteNav } from "@/components/Brand";
import { SurfaceCanvas, CanvasEmptyState } from "@/components/SurfaceCanvas";
import { FilteredUserMessage } from "@/components/FilteredUserMessage";
import { FilteredAssistantMessage } from "@/components/FilteredAssistantMessage";
import { Split } from "@/components/Split";

const AGENT_ID = "simulate_agent";

export default function SimulatePage() {
  useAgent({ agentId: AGENT_ID });

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      <SiteNav active="simulate" />

      <Split
        persistKey="simulate.split"
        initialLeftFraction={0.32}
        left={
          <div className="h-full flex flex-col copilot-chat-wrapper">
            <div className="flex-1 min-h-0">
              <CopilotChat
                agentId={AGENT_ID}
                chatView={{
                  messageView: {
                    userMessage: FilteredUserMessage,
                    assistantMessage: FilteredAssistantMessage,
                  },
                }}
                labels={{
                  chatInputPlaceholder:
                    "Describe two characters, then say “start”…",
                  welcomeMessageText:
                    "Describe two characters with names and personalities, then say “start”. Example: “Maya is an anxious teacher. Jordan is a calm leader. Start the classroom flood scenario.”",
                }}
              />
            </div>
          </div>
        }
        right={
          <SurfaceCanvas
            channel={AGENT_ID}
            emptyState={
              <CanvasEmptyState
                title="Simulation canvas is empty"
                subtitle="Type character names and personalities in the chat, then say “start”. The agent will stream TensionMeter, PsycheCards, and ScenarioBeat surfaces here."
                hint={
                  <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)]">
                    try: “Maya is anxious, Jordan is calm. Start.”
                  </span>
                }
              />
            }
          />
        }
      />
    </div>
  );
}
