/**
 * Scripted demo beats — used by "Play demo" mode so the simulation can be
 * recorded without any live LLM calls (Gemini quota / network independent).
 *
 * Each scenario is a 5-beat arc (setup → escalation → turning point → climax →
 * resolution) with full movement (x/z), facing, animation, emotion, dialogue,
 * inner thought, stress, and an optional decision fork. Character slot 0 is the
 * user ("YOU"); slot 1 is the scenario's pre-made NPC.
 */
import type { SimScenario } from "@/a2ui/surface-bus";

export type DemoCharacter = {
  emotion: string;
  animation: string;
  x: number;
  z: number;
  facing: string;
  dialogue: string;
  thought: string;
  stress: number;
};

export type DemoFork = {
  prompt: string;
  options: { id: string; label: string; consequence: string }[];
};

export type DemoBeat = {
  tension: number;
  phaseLabel: string;
  headline: string;
  detail: string;
  outcome: "escalation" | "de_escalation" | "turning_point" | "resolution" | "neutral";
  chars: [DemoCharacter, DemoCharacter];
  fork?: DemoFork;
};

export const DEMO_SCRIPTS: Record<SimScenario, DemoBeat[]> = {
  classroom_flood: [
    {
      tension: 30,
      phaseLabel: "The water rises",
      headline: "Water floods in under the door",
      detail: "Cold water pools around their ankles as the lights flicker. The only way out is a narrow window high on the wall.",
      outcome: "neutral",
      chars: [
        { emotion: "nervous", animation: "freeze", x: -1.7, z: 0, facing: "partner", dialogue: "Wait — where is all this water coming from?!", thought: "This can't be happening, not now.", stress: 45 },
        { emotion: "determined", animation: "point", x: 1.2, z: 0, facing: "partner", dialogue: "Stay calm. We move to that window — right now.", thought: "Keep them focused or we both panic.", stress: 25 },
      ],
    },
    {
      tension: 52,
      phaseLabel: "Knee-deep",
      headline: "The door won't open",
      detail: "The water is at their knees. The exit is jammed shut against the pressure.",
      outcome: "escalation",
      chars: [
        { emotion: "panicking", animation: "run", x: 0, z: 0.3, facing: "forward", dialogue: "The door's stuck — it won't budge!", thought: "We're trapped in here.", stress: 65 },
        { emotion: "heroic", animation: "help", x: 2.2, z: 0, facing: "partner", dialogue: "Forget the door. Get to the window — I'll lift you.", thought: "One of us gets out, then the other.", stress: 35 },
      ],
    },
    {
      tension: 70,
      phaseLabel: "The choice",
      headline: "A hand, cupped and waiting",
      detail: "Torres braces against the wall, hands cupped low. The water keeps climbing.",
      outcome: "turning_point",
      chars: [
        { emotion: "frozen", animation: "freeze", x: 0.6, z: 0.1, facing: "partner", dialogue: "I—I can't reach it!", thought: "What if I slip?", stress: 80 },
        { emotion: "determined", animation: "help", x: 2.4, z: 0, facing: "partner", dialogue: "Step on my hands. Trust me — on three.", thought: "She has to move now.", stress: 45 },
      ],
      fork: {
        prompt: "The water's at your chest. What do you do?",
        options: [
          { id: "a", label: "Climb onto Torres' hands", consequence: "You commit and go for the window" },
          { id: "b", label: "Freeze up", consequence: "Panic wins and you lose precious seconds" },
        ],
      },
    },
    {
      tension: 82,
      phaseLabel: "The boost",
      headline: "Up and over",
      detail: "She plants a foot in his hands and he heaves her toward the window ledge.",
      outcome: "escalation",
      chars: [
        { emotion: "determined", animation: "run", x: 2.0, z: 0, facing: "exit", dialogue: "Okay — okay, I'm going!", thought: "Don't look down, just climb.", stress: 60 },
        { emotion: "heroic", animation: "help", x: 2.4, z: 0, facing: "partner", dialogue: "That's it! Push — almost there!", thought: "Hold steady, hold steady.", stress: 50 },
      ],
    },
    {
      tension: 22,
      phaseLabel: "Out",
      headline: "Through the window",
      detail: "She tumbles onto the ledge, gulps the night air, and reaches back down for him.",
      outcome: "resolution",
      chars: [
        { emotion: "hopeful", animation: "wave", x: 2.6, z: 0.5, facing: "partner", dialogue: "I'm through! Give me your hand!", thought: "We made it. We actually made it.", stress: 20 },
        { emotion: "calm", animation: "point", x: 2.3, z: 0, facing: "partner", dialogue: "Good. Now we both get out of here.", thought: "Told you we'd be fine.", stress: 15 },
      ],
    },
  ],

  robbery: [
    {
      tension: 42,
      phaseLabel: "Gun drawn",
      headline: "The robber pulls a weapon",
      detail: "The door slams open. A masked figure levels a pistol and screams at everyone to get down.",
      outcome: "neutral",
      chars: [
        { emotion: "nervous", animation: "hands_up", x: -1.7, z: 0, facing: "forward", dialogue: "Okay — okay. Nobody do anything stupid.", thought: "Stay quiet. Stay alive.", stress: 55 },
        { emotion: "panicking", animation: "freeze", x: 1.7, z: 0, facing: "forward", dialogue: "Oh god, oh god—", thought: "I'm going to die behind this counter.", stress: 75 },
      ],
    },
    {
      tension: 62,
      phaseLabel: "Locked up",
      headline: "Sam can't move",
      detail: "The cashier is frozen at the register, hands trembling over the keys.",
      outcome: "escalation",
      chars: [
        { emotion: "calm", animation: "hands_up", x: -1.1, z: 0, facing: "partner", dialogue: "Sam — look at me. Just open the register.", thought: "If I keep him calm, we both walk out.", stress: 60 },
        { emotion: "frozen", animation: "freeze", x: 1.7, z: 0, facing: "forward", dialogue: "M-my hands won't move—", thought: "Why won't they move?!", stress: 85 },
      ],
    },
    {
      tension: 76,
      phaseLabel: "Stepping in",
      headline: "You move toward the counter",
      detail: "You inch forward, putting yourself between Sam and the barrel of the gun.",
      outcome: "turning_point",
      chars: [
        { emotion: "determined", animation: "crouch", x: -0.4, z: 0.2, facing: "forward", dialogue: "I'll get the drawer. Stay behind me.", thought: "Slow hands. No sudden moves.", stress: 65 },
        { emotion: "nervous", animation: "crouch", x: 1.4, z: 0, facing: "partner", dialogue: "Don't — he'll see you!", thought: "Please don't get yourself shot.", stress: 80 },
      ],
      fork: {
        prompt: "The gun swings toward you. What do you do?",
        options: [
          { id: "a", label: "Open the register slowly", consequence: "Calm, deliberate — you defuse the moment" },
          { id: "b", label: "Stay frozen", consequence: "The standoff drags and tension spikes" },
        ],
      },
    },
    {
      tension: 84,
      phaseLabel: "The handover",
      headline: "Cash on the counter",
      detail: "You ease the drawer open and slide the cash across, palms visible the whole way.",
      outcome: "escalation",
      chars: [
        { emotion: "nervous", animation: "crouch", x: 0, z: 0.3, facing: "forward", dialogue: "Here — it's all here. Take it and go.", thought: "Just take it. Just leave.", stress: 70 },
        { emotion: "panicking", animation: "crouch", x: 1.2, z: 0, facing: "partner", dialogue: "Please just take it—", thought: "Don't look at me, don't look at me.", stress: 80 },
      ],
    },
    {
      tension: 20,
      phaseLabel: "He's gone",
      headline: "The door swings shut",
      detail: "The robber bolts with the cash. The store falls silent except for two ragged breaths.",
      outcome: "resolution",
      chars: [
        { emotion: "calm", animation: "idle", x: -1.0, z: 0, facing: "partner", dialogue: "He's gone. It's over. You're okay, Sam.", thought: "We're alive. That's all that matters.", stress: 25 },
        { emotion: "sad", animation: "sit", x: 1.5, z: 0, facing: "partner", dialogue: "I froze… I completely froze.", thought: "You'd have died waiting on me.", stress: 40 },
      ],
    },
  ],

  job_interview: [
    {
      tension: 25,
      phaseLabel: "Pleasantries",
      headline: "The interview begins",
      detail: "Two chairs, one desk. Diane sets her pen down and studies you over the rim of her glasses.",
      outcome: "neutral",
      chars: [
        { emotion: "nervous", animation: "sit", x: -1.5, z: 0, facing: "partner", dialogue: "Thanks for having me. I've really admired the team.", thought: "Don't ramble. Do not ramble.", stress: 40 },
        { emotion: "calm", animation: "sit", x: 1.5, z: 0, facing: "partner", dialogue: "Let's skip the pleasantries. Why did you really leave your last job?", thought: "Let's see who's actually in the room.", stress: 15 },
      ],
    },
    {
      tension: 46,
      phaseLabel: "The probe",
      headline: "She sees the rehearsed answer",
      detail: "Your polished line lands flat. She doesn't blink.",
      outcome: "escalation",
      chars: [
        { emotion: "nervous", animation: "talk", x: -1.5, z: 0, facing: "partner", dialogue: "It was… a difficult environment. I wanted to grow.", thought: "She sees right through me.", stress: 55 },
        { emotion: "determined", animation: "point", x: 1.5, z: 0, facing: "partner", dialogue: "That's the rehearsed answer. I want the true one.", thought: "Push and watch what surfaces.", stress: 20 },
      ],
    },
    {
      tension: 60,
      phaseLabel: "The truth",
      headline: "You drop the script",
      detail: "Something in you decides honesty is the only card left to play.",
      outcome: "turning_point",
      chars: [
        { emotion: "embarrassed", animation: "sit", x: -1.4, z: 0, facing: "partner", dialogue: "Honestly? I was passed over. Twice. It stung.", thought: "Well — no taking that back now.", stress: 60 },
        { emotion: "amused", animation: "sit", x: 1.5, z: 0, facing: "partner", dialogue: "Now we're talking. Honesty I can work with.", thought: "Finally, a real person.", stress: 15 },
      ],
      fork: {
        prompt: "She's leaning in. How far do you go?",
        options: [
          { id: "a", label: "Tell the whole truth", consequence: "Vulnerable, but it earns her respect" },
          { id: "b", label: "Deflect with a joke", consequence: "Safe, but the moment slips away" },
        ],
      },
    },
    {
      tension: 38,
      phaseLabel: "Common ground",
      headline: "You own it",
      detail: "You straighten up, steadier now that the mask is off.",
      outcome: "de_escalation",
      chars: [
        { emotion: "hopeful", animation: "talk", x: -1.2, z: 0, facing: "partner", dialogue: "I'm not perfect. But I learn fast and I own my mistakes.", thought: "This is the real pitch.", stress: 45 },
        { emotion: "calm", animation: "sit", x: 1.5, z: 0, facing: "partner", dialogue: "That's more than most people in that chair manage.", thought: "Promising. Genuinely.", stress: 12 },
      ],
    },
    {
      tension: 15,
      phaseLabel: "We'll be in touch",
      headline: "A handshake",
      detail: "She stands and extends a hand — a small, real smile this time.",
      outcome: "resolution",
      chars: [
        { emotion: "hopeful", animation: "wave", x: -1.0, z: 0.2, facing: "partner", dialogue: "Thank you — really.", thought: "I think… I think that went well.", stress: 25 },
        { emotion: "amused", animation: "point", x: 1.2, z: 0.2, facing: "partner", dialogue: "We'll be in touch. Don't rehearse next time.", thought: "Hire that one.", stress: 10 },
      ],
    },
  ],

  first_date: [
    {
      tension: 20,
      phaseLabel: "Bold opener",
      headline: "Candlelight and nerves",
      detail: "Two people, one small table, a candle flickering between them.",
      outcome: "neutral",
      chars: [
        { emotion: "nervous", animation: "sit", x: -1.4, z: 0, facing: "partner", dialogue: "So… you said you hate small talk. Bold opener.", thought: "Why did I lead with that?", stress: 40 },
        { emotion: "amused", animation: "sit", x: 1.4, z: 0, facing: "partner", dialogue: "I do. Let's see if you can keep up.", thought: "Okay, you've got my attention.", stress: 20 },
      ],
    },
    {
      tension: 34,
      phaseLabel: "Awkward spill",
      headline: "Water everywhere",
      detail: "A nervous gesture knocks the glass; water runs across the menu.",
      outcome: "escalation",
      chars: [
        { emotion: "embarrassed", animation: "talk", x: -1.4, z: 0, facing: "partner", dialogue: "I just — soaked the menu. Great start.", thought: "Smooth. Real smooth.", stress: 50 },
        { emotion: "amused", animation: "talk", x: 1.4, z: 0, facing: "partner", dialogue: "Relax. The clumsy thing is kind of working for you.", thought: "That was actually adorable.", stress: 18 },
      ],
    },
    {
      tension: 44,
      phaseLabel: "Honesty",
      headline: "A small confession",
      detail: "You lean in, deciding to risk something real.",
      outcome: "turning_point",
      chars: [
        { emotion: "hopeful", animation: "talk", x: -1.2, z: 0.1, facing: "partner", dialogue: "Can I be honest? I almost cancelled tonight.", thought: "Too much? Too soon?", stress: 45 },
        { emotion: "calm", animation: "sit", x: 1.4, z: 0, facing: "partner", dialogue: "…Me too. Funny how that works.", thought: "Maybe we're the same kind of scared.", stress: 25 },
      ],
      fork: {
        prompt: "The air shifts. What do you say?",
        options: [
          { id: "a", label: "Admit you're glad you came", consequence: "Honest and warm — the walls come down" },
          { id: "b", label: "Joke to hide", consequence: "Funny, but you keep them at arm's length" },
        ],
      },
    },
    {
      tension: 24,
      phaseLabel: "Warming up",
      headline: "The walls come down",
      detail: "The nervous edge melts into something easier between you.",
      outcome: "de_escalation",
      chars: [
        { emotion: "hopeful", animation: "talk", x: -1.1, z: 0.1, facing: "partner", dialogue: "I'm really glad I didn't cancel.", thought: "There it is. I said it.", stress: 30 },
        { emotion: "hopeful", animation: "talk", x: 1.3, z: 0.1, facing: "partner", dialogue: "Careful — say things like that and I'll want a second date.", thought: "…I really would.", stress: 20 },
      ],
    },
    {
      tension: 12,
      phaseLabel: "Same time next week",
      headline: "A second date",
      detail: "You both stand, neither quite ready for the night to end.",
      outcome: "resolution",
      chars: [
        { emotion: "amused", animation: "wave", x: -1.0, z: 0.3, facing: "partner", dialogue: "So… same place next week?", thought: "Please say yes.", stress: 22 },
        { emotion: "hopeful", animation: "wave", x: 1.1, z: 0.3, facing: "partner", dialogue: "It's a date. Try not to spill anything.", thought: "I can't stop smiling.", stress: 15 },
      ],
    },
  ],

  argument: [
    {
      tension: 45,
      phaseLabel: "On the edge",
      headline: "The accusation lands",
      detail: "The living room is too quiet. Jordan stands rigid by the couch.",
      outcome: "neutral",
      chars: [
        { emotion: "nervous", animation: "idle", x: -1.6, z: 0, facing: "partner", dialogue: "Jordan, can we just talk about this calmly?", thought: "Please don't blow up.", stress: 50 },
        { emotion: "aggressive", animation: "point", x: 1.6, z: 0, facing: "partner", dialogue: "Calmly? You lied to me. For months.", thought: "How long was I supposed to be a fool?", stress: 65 },
      ],
    },
    {
      tension: 66,
      phaseLabel: "It gets personal",
      headline: "Voices rise",
      detail: "Jordan closes the distance, the hurt sharpening into anger.",
      outcome: "escalation",
      chars: [
        { emotion: "sad", animation: "hug_self", x: -1.6, z: 0, facing: "partner", dialogue: "I didn't lie. I just didn't know how to tell you.", thought: "I was protecting us. Wasn't I?", stress: 70 },
        { emotion: "aggressive", animation: "talk", x: 1.0, z: 0, facing: "partner", dialogue: "That's the same thing and you know it!", thought: "Why does this always happen.", stress: 75 },
      ],
    },
    {
      tension: 80,
      phaseLabel: "The breaking point",
      headline: "Everything stops",
      detail: "The shouting collapses into a hard, fragile silence.",
      outcome: "turning_point",
      chars: [
        { emotion: "frozen", animation: "freeze", x: -1.6, z: 0, facing: "away", dialogue: "Maybe I was scared of exactly this.", thought: "Of losing you over the truth.", stress: 80 },
        { emotion: "sad", animation: "idle", x: 0.8, z: 0, facing: "partner", dialogue: "…I'm not the enemy here. I never was.", thought: "I just wanted to be let in.", stress: 65 },
      ],
      fork: {
        prompt: "The silence is unbearable. What do you do?",
        options: [
          { id: "a", label: "Reach out to Jordan", consequence: "You close the gap and start to repair it" },
          { id: "b", label: "Walk away", consequence: "You protect yourself but the rift widens" },
        ],
      },
    },
    {
      tension: 54,
      phaseLabel: "Reaching across",
      headline: "A step toward each other",
      detail: "You cross the room, the anger draining out of both of you.",
      outcome: "de_escalation",
      chars: [
        { emotion: "hopeful", animation: "talk", x: -0.4, z: 0.1, facing: "partner", dialogue: "I'm sorry. I should have trusted you with it.", thought: "I don't want to lose this.", stress: 55 },
        { emotion: "sad", animation: "talk", x: 0.6, z: 0.1, facing: "partner", dialogue: "I just needed you to let me in.", thought: "That's all it ever was.", stress: 45 },
      ],
    },
    {
      tension: 20,
      phaseLabel: "Starting over",
      headline: "Something mends",
      detail: "They end up side by side, the distance finally gone.",
      outcome: "resolution",
      chars: [
        { emotion: "hopeful", animation: "idle", x: -0.1, z: 0.2, facing: "partner", dialogue: "Can we start over? For real this time.", thought: "I mean it this time.", stress: 30 },
        { emotion: "hopeful", animation: "idle", x: 0.4, z: 0.2, facing: "partner", dialogue: "Yeah. Yeah, let's start over.", thought: "Okay. Okay, we try again.", stress: 25 },
      ],
    },
  ],

  hospital: [
    {
      tension: 40,
      phaseLabel: "The wait",
      headline: "Hour three in the waiting room",
      detail: "Fluorescent hum, a clock that won't move, two coffees gone cold.",
      outcome: "neutral",
      chars: [
        { emotion: "nervous", animation: "sit", x: -1.5, z: 0, facing: "forward", dialogue: "What's taking so long? They said an hour.", thought: "Something's wrong. I know it.", stress: 55 },
        { emotion: "calm", animation: "sit", x: 1.5, z: 0, facing: "partner", dialogue: "Hey. Breathe. No news isn't bad news.", thought: "I have to keep them steady.", stress: 25 },
      ],
    },
    {
      tension: 56,
      phaseLabel: "Can't sit still",
      headline: "Pacing the floor",
      detail: "You're on your feet, unable to stay in the chair another second.",
      outcome: "escalation",
      chars: [
        { emotion: "panicking", animation: "talk", x: -1.0, z: 0.1, facing: "partner", dialogue: "I can't just sit here, Casey. I can't.", thought: "My heart is going to give out first.", stress: 70 },
        { emotion: "calm", animation: "help", x: 1.0, z: 0.1, facing: "partner", dialogue: "Then we pace together. I'm right here.", thought: "Whatever they need, that's what I do.", stress: 30 },
      ],
    },
    {
      tension: 70,
      phaseLabel: "The doctor appears",
      headline: "Footsteps in the hallway",
      detail: "A doctor rounds the corner, chart in hand, walking straight toward you.",
      outcome: "turning_point",
      chars: [
        { emotion: "frozen", animation: "freeze", x: -0.9, z: 0, facing: "forward", dialogue: "The doctor's coming over. Oh god, this is it.", thought: "Whatever it is, please let me handle it.", stress: 80 },
        { emotion: "determined", animation: "idle", x: -0.2, z: 0, facing: "partner", dialogue: "Whatever it is — you're not hearing it alone.", thought: "I've got you. I've got you.", stress: 35 },
      ],
      fork: {
        prompt: "The doctor opens the chart. What do you do?",
        options: [
          { id: "a", label: "Hold Casey's hand", consequence: "You face it together, steadier for it" },
          { id: "b", label: "Brace alone", consequence: "You armor up and shut everyone out" },
        ],
      },
    },
    {
      tension: 44,
      phaseLabel: "The word 'benign'",
      headline: "The breath you've held for hours",
      detail: "The doctor's expression softens. The word lands like sunlight.",
      outcome: "de_escalation",
      chars: [
        { emotion: "hopeful", animation: "talk", x: -0.6, z: 0.1, facing: "partner", dialogue: "…Benign. She said it's benign.", thought: "Is this real? Say it again.", stress: 40 },
        { emotion: "hopeful", animation: "wave", x: -0.2, z: 0.1, facing: "partner", dialogue: "See? I told you. I told you!", thought: "Thank god. Thank god.", stress: 20 },
      ],
    },
    {
      tension: 15,
      phaseLabel: "Let's go home",
      headline: "Out into the daylight",
      detail: "The weight lifts off both of them at once.",
      outcome: "resolution",
      chars: [
        { emotion: "hopeful", animation: "idle", x: -0.5, z: 0.2, facing: "partner", dialogue: "I don't think I could've done that without you.", thought: "I really couldn't have.", stress: 22 },
        { emotion: "calm", animation: "idle", x: 0, z: 0.2, facing: "partner", dialogue: "You'll never have to. C'mon, let's get out of here.", thought: "That's what I'm here for.", stress: 12 },
      ],
    },
  ],
};
