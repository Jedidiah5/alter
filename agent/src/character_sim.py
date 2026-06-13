"""ALTER — Character Simulation Agent.

Two AI characters autonomously act out a crisis scenario. Each beat emits
A2UI surfaces: TensionMeter, CharacterPsycheCard x2, ScenarioBeat, and
optionally DecisionFork at turning points.
"""

from __future__ import annotations

import json
from typing import Any

from copilotkit import CopilotKitMiddleware, a2ui
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import MemorySaver

from src.catalog import CATALOG_ID, CATALOG_PROMPT
from src.llm import chat_model

SURFACE = "alter-sim"

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

DEFAULT_C1 = {
    "name": "Maya",
    "personality": "Anxious teacher who freezes under pressure but cares deeply about students.",
}
DEFAULT_C2 = {
    "name": "Jordan",
    "personality": "Calm natural leader who takes charge and keeps others focused.",
}


def build_user_prompt(
    c1: dict[str, str],
    c2: dict[str, str],
    scenario_key: str,
    beat: int,
    history: str,
) -> str:
    return f"""Character 1: {c1['name']} — {c1['personality']}
Character 2: {c2['name']} — {c2['personality']}
Scenario: {SCENARIOS.get(scenario_key, scenario_key)}
Beat: {beat}
{f'Recent beats:\n{history}' if history else 'This is the opening moment.'}

Simulate the next beat."""


def parse_sim(raw: str) -> dict[str, Any]:
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


def sim_to_stage_state(sim: dict[str, Any]) -> dict[str, Any]:
    """Payload for a future Three.js stage (not wired in Hour 1-2)."""
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


def sim_to_a2ui_components(sim: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert one simulated beat into A2UI v0.9 flat component array."""
    child_ids: list[str] = ["tension"]
    components: list[dict[str, Any]] = [
        {"id": "root", "component": "Stack", "gap": "md", "children": child_ids},
        {
            "id": "tension",
            "component": "TensionMeter",
            "tension": sim.get("tension", 0),
            "label": sim.get("phase_label", ""),
        },
    ]

    beat = sim.get("beat", {})
    components.append(
        {
            "id": "beat",
            "component": "ScenarioBeat",
            "beatNumber": sim.get("_beat_number", 1),
            "headline": beat.get("headline", ""),
            "detail": beat.get("detail", ""),
            "outcome": beat.get("outcome", "neutral"),
        }
    )
    child_ids.append("beat")

    for i, ch in enumerate(sim.get("characters", [])):
        cid = f"psyche-{i}"
        child_ids.append(cid)
        components.append(
            {
                "id": cid,
                "component": "CharacterPsycheCard",
                "characterName": ch.get("name", "?"),
                "emotion": ch.get("emotion", "calm"),
                "thought": ch.get("thought", ""),
                "stress": ch.get("stress", 0),
            }
        )

    if sim.get("offer_fork") and sim.get("fork"):
        components.append(
            {
                "id": "fork",
                "component": "DecisionFork",
                "prompt": sim["fork"].get("prompt", ""),
                "options": sim["fork"].get("options", []),
            }
        )
        child_ids.append("fork")

    components[0]["children"] = child_ids
    return components


@tool
def simulate_beat(
    character1_name: str = DEFAULT_C1["name"],
    character1_personality: str = DEFAULT_C1["personality"],
    character2_name: str = DEFAULT_C2["name"],
    character2_personality: str = DEFAULT_C2["personality"],
    scenario: str = "classroom_flood",
    beat_number: int = 1,
    history: str = "",
) -> str:
    """Simulate the next beat of the crisis scenario and render A2UI surfaces.

    Call ONCE per turn. Pass character names/personalities from the user's
    message, or use defaults (Maya + Jordan, classroom flood).
    """
    c1 = {"name": character1_name, "personality": character1_personality}
    c2 = {"name": character2_name, "personality": character2_personality}

    prompt = build_user_prompt(c1, c2, scenario, beat_number, history)
    llm = chat_model(temperature=0.9)
    resp = llm.invoke([("system", SIM_SYSTEM_PROMPT), ("human", prompt)])

    content = resp.content
    if isinstance(content, list):
        content = " ".join(
            block.get("text", str(block)) if isinstance(block, dict) else str(block)
            for block in content
        )
    sim = parse_sim(str(content))
    sim["_beat_number"] = beat_number

    components = sim_to_a2ui_components(sim)
    return a2ui.render(
        operations=[
            a2ui.create_surface(SURFACE, catalog_id=CATALOG_ID),
            a2ui.update_components(SURFACE, components),
            a2ui.update_data_model(SURFACE, {"stage": sim_to_stage_state(sim)}),
        ]
    )


SYSTEM_PROMPT = f"""\
You are ALTER, orchestrating a live character crisis simulation.

When the user describes two characters (names + personalities) and asks to start
(or says "start", "simulate", "begin"), call `simulate_beat` ONCE with their
details extracted from the message.

Defaults if not specified:
- Character 1: Maya — anxious teacher who freezes under pressure
- Character 2: Jordan — calm natural leader
- Scenario: classroom_flood

After `simulate_beat` returns, give a brief 1-2 sentence chat summary of what
unfolded. Do NOT call simulate_beat twice in one turn.

{CATALOG_PROMPT}
"""


def build_character_sim_agent():
    return create_agent(
        model=chat_model(),
        tools=[simulate_beat],
        middleware=[CopilotKitMiddleware()],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=MemorySaver(),
    )


graph = build_character_sim_agent()
