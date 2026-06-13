# ALTER — Build Guide (drop-in for the London A2UI starter)

This module turns the hackathon starter into **Alter** — two AI characters who
autonomously act out a crisis scenario, with the reactive UI (psyche cards,
tension meter, beat callouts, decision forks) **emitted by the agent as real
A2UI**, and a Three.js 3D stage rendering the characters beside the chat.

You compete hard on **originality + technical difficulty** (the 3D sim) and
clear the bar on **CopilotKit/AG-UI/A2UI integration** (the agent emits real
A2UI surfaces, and typing in the chat re-steers the sim live).

---

## 0. First — get the starter running UNTOUCHED (do not skip)

```bash
git clone <your-fork-url> alter
cd alter
pnpm install            # also installs the Python agent via uv
cp .env.example .env
# set GEMINI_API_KEY  (free key, no card: https://aistudio.google.com/apikey)
pnpm run doctor         # preflight
pnpm dev                # Next.js + FastAPI agent (:8123) together
```

Confirm the PDF-analyst demo fires A2UI surfaces before you change anything. If
the chat doesn't respond, it's almost always the GEMINI_API_KEY / the :8123
Python agent — check that pane. **Don't touch code until this works.**

---

## 1. Files in this module → where they go in the starter

| This module | Starter destination | Seam |
|---|---|---|
| `components/definitions.ts` | merge into `src/a2ui/catalog/definitions.ts` | §4 |
| `components/renderers.tsx` | merge into `src/a2ui/catalog/renderers.tsx` + register in the renderer map | §4 |
| `components/alter.css` | import from `src/a2ui/theme.css` | §1 |
| `agent/character_sim.py` | new file in `agent/src/`, wired as a graph in `agent/main.py` | §5 |
| `agent/catalog_summary.py` | append `CATALOG_SUMMARY` into `agent/src/catalog.py` | §4 |
| `stage/CharacterStage.tsx` | new component mounted in the canvas area | — |

Add the 3D deps: `pnpm add three @react-three/fiber @react-three/drei`

---

## 2. Build order (≈6 hrs, ruthless)

**Hour 1 — Starter green + components registered.**
Get the starter running. Paste the 5 component definitions + renderers, register
them, import the CSS. Verify they render by hardcoding one in `/catalog`.

**Hour 2 — Agent emits your components.**
Wire `character_sim.py` as a graph. Append `CATALOG_SUMMARY`. Hardcode two test
characters + the classroom scenario. Goal: type "start" in chat → agent streams
a TensionMeter + 2 PsycheCards + a ScenarioBeat. **This alone satisfies the
A2UI integration criterion.** Screenshot it the moment it works.

**Hour 3 — The 3D stage.**
Mount `CharacterStage` in the canvas. Feed it the agent's dataModel
(`sim_to_stage_state`). Confirm characters change animation as beats stream.

**Hour 4 — The loop + steering.**
Auto-advance beats (or a "Next beat" control). Make typing in chat work:
"make the robber pull a knife" → agent re-simulates → both the A2UI surfaces
and the 3D stage respond. This is your money demo moment.

**Hour 5 — Polish the one thing judges see.**
Pick ONE: smooth the tension→colour transition across stage + surfaces, OR add
the DecisionFork at a turning point, OR add Ready Player Me characters. Don't
do all three. (Chanel rule: take one accessory off.)

**Hour 6 — STOP BUILDING. Record + write.**
Demo video, social post, repo public. See §4. Leave a full hour — you
historically keep building past the deadline; this is the redirect.

**LinkUp (if any time):** give the agent a Linkup tool so a "knowledgeable"
character pulls a real emergency protocol → emit a FactInjection. Thin but it
ticks the third required integration.

---

## 3. What clears each judging criterion

- **Originality** — autonomous 3D character sim is unlike any dashboard demo. ✅ strong
- **Technical difficulty** — Three.js + LangGraph agent + A2UI streaming + live steering. ✅ strong
- **Creative use of Gen UI + A2UI** — the UI *interprets a live simulation*, not a static doc. The agent emits psyche/tension/beat surfaces that escalate. ✅ solid
- **CopilotKit + AG-UI + A2UI integration** — real catalog components, real envelopes, chat re-steers the sim. ✅ cleared
- **A2UI required** — yes, your custom catalog components. ✅
- **LinkUp required** — FactInjection via Linkup tool. ⚠️ add if time; flag in video if thin.

---

## 4. Submission checklist (don't lose points here)

- [ ] **Public GitHub repo** — push your fork, README with your concept + stack
- [ ] **Demo video** — 2-3 min. Script below.
- [ ] **Social post** — this IS your "Debugging My Life" content. Post the build + the demo.

**Demo video script (lead with the provocation):**
1. "Two AI characters. Your personalities. One crisis. Nobody controls them." (10s)
2. Show setup → start the classroom flood. Characters move; psyche cards + tension meter stream in as real A2UI. (45s)
3. Type into chat: "the leader panics now" → watch BOTH the 3D stage and the A2UI surfaces react live. (45s)
4. Hit a DecisionFork, pick a branch, show divergence. (30s)
5. "Every surface you saw was emitted by the agent as A2UI. The characters decided everything themselves." End on tension peak. (20s)

---

## 5. Honest risk notes

- **Python/LangGraph is the real risk**, not the 3D. De-risk it in Hour 1-2. If the agent fights you, fall back: keep emitting A2UI but drive the sim from a simpler Python loop rather than a full multi-node graph.
- **A2UI v0.9 envelope order matters**: surfaceUpdate → dataModelUpdate → beginRendering. The starter handles this; match its existing emit pattern rather than rolling your own.
- **Scope creep is your known failure mode.** Two scenarios, two characters, one polished loop. That's the whole deliverable. Everything else is post-demo.
