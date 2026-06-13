/**
 * ALTER — Custom A2UI Component Definitions
 * ------------------------------------------
 * Drop-in additions for the hackathon starter's A2UI catalog.
 *
 * WIRING (Seam §4 in the starter):
 *   1. Paste these definitions into  src/a2ui/catalog/definitions.ts
 *   2. Paste the matching renderers (renderers.tsx) into src/a2ui/catalog/renderers.tsx
 *   3. Mirror each component's prompt summary into  agent/src/catalog.py
 *      (so the Gemini agent knows these components exist and can emit them)
 *
 * These follow the A2UI v0.9 model: the agent emits a component instance with
 * `componentType` + `props`, and the renderer materialises it into React.
 * The agent NEVER renders the 3D scene — it emits these reactive surfaces that
 * sit beside / over the Three.js stage. The 3D stage reads the same data model.
 */

export interface A2UIComponentDefinition {
  componentType: string;
  description: string; // used by the agent to know when to emit it
  props: Record<
    string,
    { type: string; description: string; required?: boolean }
  >;
}

export const ALTER_COMPONENTS: A2UIComponentDefinition[] = [
  {
    componentType: "CharacterPsycheCard",
    description:
      "Shows a single character's live internal state during a scenario: current emotion, what they're privately thinking, and their stress level. Emit one per character whenever their psychological state shifts.",
    props: {
      characterName: { type: "string", description: "Character's name", required: true },
      emotion: {
        type: "string",
        description:
          "One of: panicking | calm | aggressive | frozen | heroic | nervous | determined",
        required: true,
      },
      thought: {
        type: "string",
        description: "The character's private inner monologue this beat",
        required: true,
      },
      stress: {
        type: "number",
        description: "0-100 internal stress level",
        required: true,
      },
      accentColor: {
        type: "string",
        description: "Hex color matching the emotion, drives the card's glow",
      },
    },
  },
  {
    componentType: "TensionMeter",
    description:
      "A live gauge of overall scene tension from 0-100. Emit/update every beat so the UI visibly escalates with the scenario.",
    props: {
      tension: { type: "number", description: "0-100 overall tension", required: true },
      label: { type: "string", description: "Short phase label e.g. 'Escalating'" },
    },
  },
  {
    componentType: "ScenarioBeat",
    description:
      "A narrative callout describing what just physically happened this beat — the cause-and-effect of the two characters' actions. Emit one per beat.",
    props: {
      beatNumber: { type: "number", description: "Which beat this is", required: true },
      headline: { type: "string", description: "One-line summary of the moment", required: true },
      detail: { type: "string", description: "1-2 sentences of what unfolded", required: true },
      outcome: {
        type: "string",
        description: "Optional: escalation | de-escalation | turning_point | resolution",
      },
    },
  },
  {
    componentType: "DecisionFork",
    description:
      "Presents 2-3 branching choices for how the scenario could continue, that the user can pick from to steer the sim. Emit at key turning points.",
    props: {
      prompt: { type: "string", description: "The question posed to the user", required: true },
      options: {
        type: "array",
        description:
          "Array of { id, label, consequence } — the branches the user can pick",
        required: true,
      },
    },
  },
  {
    componentType: "FactInjection",
    description:
      "Surfaces a real-world fact pulled via web search (Linkup) that grounds a character's behaviour — e.g. a real emergency protocol. Emit when a character acts on real knowledge.",
    props: {
      sourceLabel: { type: "string", description: "Where the fact came from", required: true },
      fact: { type: "string", description: "The grounded fact, kept short", required: true },
      appliedBy: { type: "string", description: "Which character used this knowledge" },
    },
  },
];
