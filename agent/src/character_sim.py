"""ALTER — Character Simulation Agent.

Two AI characters autonomously act out a crisis scenario. Each beat emits
A2UI surfaces: TensionMeter, CharacterPsycheCard x2, ScenarioBeat, and
optionally DecisionFork at turning points.
"""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.parse import urlparse

from copilotkit import CopilotKitMiddleware, a2ui
from linkup import LinkupClient, LinkupSourcedAnswer
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import MemorySaver

from src.catalog import CATALOG_ID, CATALOG_PROMPT
from src.llm import chat_model

SURFACE = "alter-sim"

SIM_SYSTEM_PROMPT = """You are ALTER, a personal crisis simulator. You reveal how a
real person would react in a crisis by simulating their "crisis self".

CHARACTER 1 is the USER'S AI SELF. The personality text is how the user describes
THEMSELVES. Your job is to simulate, honestly and realistically, how someone with
that exact personality would GENUINELY react in this scenario. Do NOT flatter them.
Do NOT make them the hero by default. If their personality says they freeze, panic,
overthink, or crumble — show that truthfully. If they're genuinely steady, show that
too. The point is an honest mirror, not wish-fulfilment.

CHARACTER 2 is a pre-made NPC — a foil. Play them so they create interesting,
revealing dynamics with the user's personality: pressure them, contrast them, force
decisions, or test them. The NPC should make the user's true nature surface.

Simulate, beat by beat, how these two behave, move, speak, and react TO EACH OTHER.
Users do not puppet the characters — you decide what each does, grounded entirely
in their personality.

Hard rules:
- React to each other. What one does changes what the other does next.
- Behaviour must follow personality precisely. A shy person freezes; a leader
  takes charge; an anxious person spirals; a calm person de-escalates.
- Dialogue is short and natural — max 1-2 sentences per character per beat.
- Tension should climb toward a peak, then resolve. For non-crisis scenarios
  (date, interview) tension represents social pressure, not physical danger.
- Never break character. Begin mid-action — skip preamble.
- Make the physical detail vivid and specific to the environment.

MOVEMENT — this is critical. The characters are on a 3D stage and MUST physically
move around it. Every beat, decide where each character goes using "x" and "z":
  • x = left/right position, float from -3.0 (far left) to 3.0 (far right).
  • z = depth, float from -1.0 (back, away from viewer) to 1.0 (front, toward viewer).
Drive movement from behaviour:
  • Confronting / approaching someone → move your x CLOSE to theirs (close the gap).
  • Fleeing / cowering / backing away → move toward an edge (x near -3 or 3).
  • A leader stepping in front to shield someone → move between the other char and the danger.
  • Reconciling on a date → drift x toward each other. Storming off in an argument → x to an edge.
Do NOT leave a character at the same x,z two beats in a row unless they are
literally frozen in place. They start around x=-1.7 and x=1.7.
Also set "facing": who/what they turn toward — "partner" (the other character),
"away", "exit", or "forward" (toward the viewer).

EMOTION options (pick the best fit):
  panicking | calm | aggressive | frozen | heroic | nervous | determined |
  embarrassed | amused | sad | hopeful

ANIMATION options — the character's in-place body action (movement is handled
separately by x/z above):
  idle | run | crouch | wave | point | help | freeze | talk |
  hands_up | sit | hug_self
Use "run" when a character is moving fast/urgently to their new x,z.

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
      "x": <float -3.0 to 3.0: where they move to this beat>,
      "z": <float -1.0 to 1.0: depth>,
      "facing": "partner | away | exit | forward",
      "dialogue": "<exactly what they say out loud, or empty string if silent>",
      "thought": "<private inner monologue — what they're really thinking>",
      "stress": <int 0-100>,
      "action": "<short description of physical action, e.g. 'backs toward the window', 'slams folder on desk'>"
    },
    { "<char2, same shape>" }
  ],
  "offer_fork": <true if this is a turning point where player input would matter>,
  "fact_injection": {
    "appliedBy": "<only when a real fact is supplied: the character name who acts on the fact>"
  },
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
    real_fact: dict[str, str] | None = None,
) -> str:
    fact_instruction = ""
    if real_fact:
        fact_instruction = f"""
This is a LinkUp-sourced real-world fact for this beat:
Source: {real_fact["sourceLabel"]}
Fact: {real_fact["fact"]}

Beat {beat} MUST show exactly one character acting on this fact in a grounded,
natural way. Include "fact_injection": {{"appliedBy": "<that character's name>"}}.
The character may say the fact aloud in natural dialogue, e.g. "Emergency guidance
says..." but must not sound like a lecture."""

    return f"""Character 1: {c1['name']} — {c1['personality']}
Character 2: {c2['name']} — {c2['personality']}
Scenario: {SCENARIOS.get(scenario_key, scenario_key)}
Beat: {beat}
{f'Recent beats:\n{history}' if history else 'This is the opening moment.'}
{fact_instruction}

Simulate the next beat."""


def _scenario_description(scenario: str) -> str:
    return SCENARIOS.get(scenario, scenario)


def _source_label(name: str, url: str) -> str:
    if name:
        return name

    host = urlparse(url).netloc
    return host or "LinkUp web search"


def search_real_facts(scenario_description: str) -> dict[str, str]:
    api_key = os.environ.get("LINKUP_API_KEY")
    if not api_key:
        return {}

    try:
        client = LinkupClient(api_key=api_key)
        response = client.search(
            (
                "Find one authoritative real-world emergency protocol or survival "
                f"tip that applies to this crisis scenario: {scenario_description}. "
                "Return one concise actionable fact."
            ),
            depth="standard",
            output_type="sourcedAnswer",
            include_sources=True,
            timeout=10,
        )
    except Exception:
        return {}

    if not isinstance(response, LinkupSourcedAnswer):
        return {}

    fact = " ".join(response.answer.split())
    if not fact:
        return {}

    source_label = "LinkUp web search"
    if response.sources:
        source = response.sources[0]
        source_label = _source_label(source.name, source.url)

    return {
        "sourceLabel": source_label,
        "fact": fact,
        "appliedBy": "",
    }


def _fact_for_beat(scenario: str, beat_number: int) -> dict[str, str] | None:
    if beat_number % 3 != 0:
        return None

    fact = search_real_facts(_scenario_description(scenario))
    return fact or None


def _apply_fact_to_sim(
    sim: dict[str, Any],
    real_fact: dict[str, str] | None,
) -> None:
    if not real_fact:
        return

    applied_by = ""
    fact_injection = sim.get("fact_injection")
    if isinstance(fact_injection, dict):
        value = fact_injection.get("appliedBy")
        if isinstance(value, str):
            applied_by = value

    if not applied_by:
        for character in sim.get("characters", []):
            if isinstance(character, dict):
                name = character.get("name")
                if isinstance(name, str) and name:
                    applied_by = name
                    break

    sim["fact_injection"] = {
        "sourceLabel": real_fact["sourceLabel"],
        "fact": real_fact["fact"],
        "appliedBy": applied_by,
    }


def parse_sim(raw: str) -> dict[str, Any]:
    """Defensive JSON parse.

    Gemini frequently wraps the JSON in markdown fences or adds a sentence of
    commentary before/after it. We strip fences, then fall back to extracting
    the outermost {...} block so a stray word doesn't blank out the whole beat.
    """
    cleaned = raw.replace("```json", "").replace("```", "").strip()

    # 1) Straight parse.
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 2) Extract the outermost JSON object and parse that.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass

    # 3) Give up — surface a visible parse-failure beat rather than silence.
    return {
        "tension": 50,
        "phase_label": "Parse error",
        "beat": {
            "headline": "The simulation hiccuped",
            "detail": "The AI's response wasn't valid JSON. Try the next beat again.",
            "outcome": "neutral",
        },
        "characters": [],
        "offer_fork": False,
    }


def _clamp(v: Any, lo: float, hi: float, default: float) -> float:
    """Coerce an LLM-supplied number into range, falling back if missing/garbage."""
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


# Where each character starts if the model doesn't specify a position.
HOME_X = (-1.7, 1.7)


def sim_to_stage_state(sim: dict[str, Any]) -> dict[str, Any]:
    """Payload consumed by the Three.js CharacterStage."""
    chars = sim.get("characters", [])
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
                "x": _clamp(ch.get("x"), -3.0, 3.0, HOME_X[i] if i < len(HOME_X) else 0.0),
                "z": _clamp(ch.get("z"), -1.0, 1.0, 0.0),
                "facing": ch.get("facing", "partner"),
            }
            for i, ch in enumerate(chars)
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
            "subtitle": "Your AI self is reacting based on your personality",
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

    fact_injection = sim.get("fact_injection")
    if isinstance(fact_injection, dict) and fact_injection.get("fact"):
        components.append(
            {
                "id": "fact",
                "component": "FactInjection",
                "sourceLabel": fact_injection.get("sourceLabel", "LinkUp web search"),
                "fact": fact_injection.get("fact", ""),
                "appliedBy": fact_injection.get("appliedBy", ""),
            }
        )
        child_ids.append("fact")

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
                "isUser": i == 0,
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

    real_fact = _fact_for_beat(scenario, beat_number)
    prompt = build_user_prompt(c1, c2, scenario, beat_number, history, real_fact)
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
    _apply_fact_to_sim(sim, real_fact)

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
