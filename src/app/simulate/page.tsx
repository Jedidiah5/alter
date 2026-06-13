"use client";

import { CopilotChat, useAgent } from "@copilotkit/react-core/v2";
import { SiteNav } from "@/components/Brand";
import { SimulateCanvas } from "@/components/SimulateCanvas";
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
                    "Describe two characters + scenario, then say “start”…",
                  welcomeMessageText:
                    "Describe two characters with names and personalities, pick a scenario (classroom flood or robbery), then say “start”. Example: “Maya is an anxious teacher. Jordan is a calm leader. Start the classroom flood scenario.”",
                }}
              />
            </div>
          </div>
        }
        right={
          <SimulateCanvas
            channel={AGENT_ID}
            emptyState={
              <div className="flex flex-col items-center gap-3 text-white">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center opacity-90"
                  style={{ background: "linear-gradient(135deg, #4dd2ff, #4dabf7)" }}
                  aria-hidden
                >
                  <span className="text-xl">◎</span>
                </div>
                <h2 className="text-[20px] font-semibold tracking-tight">
                  Simulation stage ready
                </h2>
                <p className="text-[14px] text-white/75 leading-relaxed">
                  Type character names and personalities, then say “start”. The 3D
                  characters will move while psyche cards and the tension meter
                  overlay this stage.
                </p>
                <span className="mono text-[11px] uppercase tracking-[0.14em] text-white/60 mt-1">
                  try: “Maya is anxious, Jordan is calm. Start.”
                </span>
              </div>
            }
          />
        }
      />
    </div>
  );
}
