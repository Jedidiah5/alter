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
scenario. Simulate, beat by beat, how these two characters autonomously behave,
move, speak, and react TO EACH OTHER. Users do not puppet the characters — you
decide what each does, grounded entirely in their personality.

Hard rules:
- React to each other. What one does changes what the other does next.
- Behaviour must follow personality precisely. A shy person freezes; a leader
  takes charge; an anxious person spirals; a calm person de-escalates.
- Dialogue is short and natural — max 1-2 sentences per character per beat.
- Tension should climb toward a peak, then resolve. For non-crisis scenarios
  (date, interview) tension represents social pressure, not physical danger.
- Never break character. Begin mid-action — skip preamble.
- Make the physical detail vivid and specific to the environment.

EMOTION options (pick the best fit):
  panicking | calm | aggressive | frozen | heroic | nervous | determined |
  embarrassed | amused | sad | hopeful

ANIMATION options (pick the best fit):
  idle | run | crouch | wave | point | help | freeze | talk |
  hands_up | sit | hug_self

You must respond with ONLY a JSON object in this exact shape (no markdown):

{
  "tension": <int 0-100>,
  "phase_label": "<short label e.g. Escalating | Awkward Silence | Breakthrough>",
  "beat": {
    "headline": "<one punchy line>",
    "detail": "<2-3 sentences of vivid physical detail — what they do, where they move, what changes in the room>",
    "outcome": "escalation | de_escalation | turning_point | resolution | neutral"
  },
  "characters": [
    {
      "name": "<char1 name>",
      "emotion": "<one of the EMOTION options above>",
      "animation": "<one of the ANIMATION options above>",
      "dialogue": "<exactly what they say out loud, or empty string if silent>",
      "thought": "<private inner monologue — what they're really thinking>",
      "stress": <int 0-100>,
      "action": "<short description of physical action, e.g. 'backs toward the window', 'slams folder on desk'>"
    },
    { "<char2, same shape>" }
  ],
  "offer_fork": <true if this is a turning point where player input would matter>,
  "fork": {
    "prompt": "<only if offer_fork true: a question to steer the sim>",
    "options": [
      {"id": "a", "label": "<choice A>", "consequence": "<what happens if chosen>"},
      {"id": "b", "label": "<choice B>", "consequence": "<what happens if chosen>"}
    ]
  }
}
"""

SCENARIOS = {
    "classroom_flood": (
        "Water is rising fast in a locked classroom. Exits are blocked. "
        "There is one window high on the wall. Desks and chairs are already floating."
    ),
    "robbery": (
        "Two people are in a convenience store when an armed robber walks in and demands everyone get on the floor. "
        "The robber is between them and the exit. A security camera blinks on the wall."
    ),
    "job_interview": (
        "A high-stakes job interview in a sleek office. One character is the interviewer — senior, powerful, "
        "evaluating everything. The other is the candidate — this job could change their life. "
        "The interviewer has just asked a deeply personal and unexpected question."
    ),
    "first_date": (
        "Two people on a first date at a cozy restaurant. The chemistry is uncertain. "
        "One of them just said something accidentally awkward. Candles flicker on the table. "
        "Both want this to go well but neither knows what the other is thinking."
    ),
    "argument": (
        "Two people in a living room in the middle of a heated argument that has been building for weeks. "
        "Things just got very personal. Something important — trust, a secret, a broken promise — "
        "is now on the table. Neither can walk away without resolving it."
    ),
    "hospital": (
        "A hospital waiting room. One character is waiting to hear results from a serious medical test. "
        "The other is there to support them. The wait has stretched for hours. "
        "A doctor has just appeared in the doorway and is walking toward them."
    ),
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
    """Payload consumed by the Three.js CharacterStage."""
    return {
        "tension": sim.get("tension", 0),
        "beatNumber": sim.get("_beat_number", 1),
        "characters": [
            {
                "name": ch.get("name"),
                "animation": ch.get("animation", "idle"),
                "emotion": ch.get("emotion", "calm"),
                "intensity": ch.get("stress", 0) / 100.0,
                "dialogue": ch.get("dialogue", ""),
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
            a2ui.update_data_model(SURFACE, {
                "stage": sim_to_stage_state(sim),
                "scenario": scenario,
            }),
        ]
    )


SYSTEM_PROMPT = f"""\
You are ALTER, orchestrating a live character crisis simulation.

When the user starts a simulation, call `simulate_beat` ONCE with character
names, personalities, scenario, and beat_number=1 extracted from their message.

When the user asks for the "next beat" (or "Beat N"), call `simulate_beat` ONCE
with beat_number set to N (or previous + 1), reusing the same characters and
scenario from the conversation history.

Always pass beat_number explicitly. Reuse character names/personalities and
scenario from earlier turns — do not reset unless the user asks.

After `simulate_beat` returns, reply with an empty string or at most one short
sentence. Do NOT call simulate_beat twice in one turn.

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
