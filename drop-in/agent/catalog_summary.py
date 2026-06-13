"""
ALTER — Catalog prompt summaries (Python side)
----------------------------------------------
Mirror of the custom A2UI components, in the form the agent reads.

Append CATALOG_SUMMARY into the starter's agent/src/catalog.py so Gemini knows
which components it's allowed to emit and what each is for. The starter already
has a pattern for this — match its existing string format if it differs.
"""

CATALOG_SUMMARY = """
Available custom UI components you may emit (componentType + props):

- CharacterPsycheCard: one character's live internal state.
    props: characterName (str), emotion (str), thought (str), stress (int 0-100)
    Emit one per character each beat, when their psychological state shifts.

- TensionMeter: overall scene tension gauge.
    props: tension (int 0-100), label (str, short phase name)
    Emit/update every beat so the UI escalates visibly.

- ScenarioBeat: narrative callout of what just happened.
    props: beatNumber (int), headline (str), detail (str),
           outcome (escalation|de_escalation|turning_point|resolution|neutral)
    Emit one per beat.

- DecisionFork: 2-3 branching choices for the user to steer the sim.
    props: prompt (str), options (array of {id, label, consequence})
    Emit only at genuine turning points.

- FactInjection: a real-world fact (from Linkup web search) grounding behaviour.
    props: sourceLabel (str), fact (str), appliedBy (str)
    Emit when a character acts on real knowledge (e.g. an emergency protocol).
"""
