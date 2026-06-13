"""
ALTER — Character Simulation Agent
----------------------------------
Drop-in logic for the starter's LangGraph agent (Seam §5).

Replace the PDF-extraction flow in agent/src/dynamic_agent.py (or add a new
graph alongside it served from agent/main.py) with this character-sim loop.

The agent:
  1. Takes two character personalities + a scenario + current beat
  2. Asks Gemini to simulate the next beat (autonomous behaviour for both chars)
  3. Emits A2UI envelopes for the reactive UI: CharacterPsycheCard x2,
     TensionMeter, ScenarioBeat, and at turning points a DecisionFork
  4. Returns a structured `sim_state` the Three.js stage consumes to drive
     animations (emotion -> animation, stress -> motion intensity)

The default LLM in the starter is Gemini 3.5 Flash via langchain-google-genai.
Keep that — do NOT swap providers during the build window (see FROZEN.md).
"""

import json
from typing import Any

# In the starter these come from the existing agent scaffolding:
# from langchain_google_genai import ChatGoogleGenerativeAI
# from .a2ui import emit_surface, emit_data_model, begin_rendering

SIM_SYSTEM_PROMPT = """You are ALTER, a character simulation engine.

You are given two characters (each a name + a user-written personality) and a
crisis scenario. Simulate, beat by beat, how these two characters autonomously
behave, move, speak, and react TO EACH OTHER. Users do not puppet the
characters — you decide what each does, grounded entirely in their personality.

Hard rules:
- React to each other. What one does changes what the other does next.
- Behaviour must follow personality precisely. A shy person freezes; a leader
  takes charge; an anxious person spirals; a calm person de-escalates.
- Dialogue is short and natural — max 1-2 sentences per character per beat.
- Tension should generally climb as the scenario escalates, then resolve.
- Never break character. Begin mid-action — skip preamble.

You must respond with ONLY a JSON object in this exact shape (no markdown):

{
  "tension": <int 0-100>,
  "phase_label": "<short label e.g. Escalating>",
  "beat": {
    "headline": "<one line>",
    "detail": "<1-2 sentences of what physically unfolded>",
    "outcome": "escalation | de_escalation | turning_point | resolution | neutral"
  },
  "characters": [
    {
      "name": "<char1 name>",
      "emotion": "panicking|calm|aggressive|frozen|heroic|nervous|determined",
      "animation": "idle|run|crouch|wave|point|help|freeze|talk",
      "dialogue": "<what they say>",
      "thought": "<private inner monologue>",
      "stress": <int 0-100>,
      "action": "<short description of physical action>"
    },
    { "<char2, same shape>" }
  ],
  "offer_fork": <true|false>,
  "fork": {
    "prompt": "<only if offer_fork true: a question to steer the sim>",
    "options": [
      {"id": "a", "label": "<choice>", "consequence": "<hint>"},
      {"id": "b", "label": "<choice>", "consequence": "<hint>"}
    ]
  }
}
"""

SCENARIOS = {
    "classroom_flood": "Water is rising fast in a locked classroom. Exits are blocked. There is one window.",
    "robbery": "Two people are in a convenience store when an armed robber walks in and demands everyone get on the floor.",
}


def build_user_prompt(c1: dict, c2: dict, scenario_key: str, beat: int, history: str) -> str:
    return f"""Character 1: {c1['name']} — {c1['personality']}
Character 2: {c2['name']} — {c2['personality']}
Scenario: {SCENARIOS.get(scenario_key, scenario_key)}
Beat: {beat}
{f'Recent beats:\n{history}' if history else 'This is the opening moment.'}

Simulate the next beat."""


def parse_sim(raw: str) -> dict:
    """Defensive JSON parse — Gemini sometimes wraps in fences."""
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "tension": 50,
            "phase_label": "—",
            "beat": {"headline": "…", "detail": "", "outcome": "neutral"},
            "characters": [],
            "offer_fork": False,
        }


def sim_to_a2ui_envelopes(sim: dict) -> list[dict[str, Any]]:
    """
    Convert one simulated beat into A2UI component instances.
    These are what the starter streams to the frontend renderer.

    Returns a list of {componentType, props} dicts. In the starter you wrap
    these into a surfaceUpdate envelope (see CopilotKit/generative-ui:
    surfaceUpdate -> dataModelUpdate -> beginRendering).
    """
    envelopes: list[dict[str, Any]] = []

    # Tension meter
    envelopes.append({
        "componentType": "TensionMeter",
        "props": {"tension": sim.get("tension", 0), "label": sim.get("phase_label", "")},
    })

    # One psyche card per character
    for ch in sim.get("characters", []):
        envelopes.append({
            "componentType": "CharacterPsycheCard",
            "props": {
                "characterName": ch.get("name", "?"),
                "emotion": ch.get("emotion", "calm"),
                "thought": ch.get("thought", ""),
                "stress": ch.get("stress", 0),
            },
        })

    # Beat callout
    beat = sim.get("beat", {})
    envelopes.append({
        "componentType": "ScenarioBeat",
        "props": {
            "beatNumber": sim.get("_beat_number", 1),
            "headline": beat.get("headline", ""),
            "detail": beat.get("detail", ""),
            "outcome": beat.get("outcome", "neutral"),
        },
    })

    # Optional decision fork at turning points
    if sim.get("offer_fork") and sim.get("fork"):
        envelopes.append({
            "componentType": "DecisionFork",
            "props": {
                "prompt": sim["fork"].get("prompt", ""),
                "options": sim["fork"].get("options", []),
            },
        })

    return envelopes


def sim_to_stage_state(sim: dict) -> dict:
    """
    The slimmer payload the Three.js stage consumes (via a dataModelUpdate or a
    shared store). Maps each character to an animation + motion intensity.
    """
    return {
        "tension": sim.get("tension", 0),
        "characters": [
            {
                "name": ch.get("name"),
                "animation": ch.get("animation", "idle"),
                "emotion": ch.get("emotion", "calm"),
                "intensity": ch.get("stress", 0) / 100.0,
            }
            for ch in sim.get("characters", [])
        ],
    }


# ---- Example node body (adapt to the starter's LangGraph node signature) ----
#
# def simulate_beat_node(state):
#     llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.9)
#     prompt = build_user_prompt(state["c1"], state["c2"], state["scenario"],
#                                state["beat"], state["history"])
#     resp = llm.invoke([("system", SIM_SYSTEM_PROMPT), ("human", prompt)])
#     sim = parse_sim(resp.content)
#     sim["_beat_number"] = state["beat"]
#
#     for env in sim_to_a2ui_envelopes(sim):
#         emit_surface(env)          # surfaceUpdate
#     emit_data_model(sim_to_stage_state(sim))   # dataModelUpdate -> stage
#     begin_rendering()              # beginRendering
#
#     state["history"] += f"\nBeat {state['beat']}: {sim['beat']['headline']}"
#     state["beat"] += 1
#     return state
