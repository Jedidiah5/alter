/**
 * ALTER — 3D Character Stage
 * Rich Sims-style characters with expressive faces, animated limbs,
 * and fully built scenario environments.
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

export type Scenario =
  | "classroom_flood"
  | "robbery"
  | "job_interview"
  | "first_date"
  | "argument"
  | "hospital";

export interface StageCharacter {
  name: string;
  animation: string;
  emotion: string;
  intensity: number;
  dialogue?: string;
  /** AI-chosen target position on the stage. */
  x?: number;
  z?: number;
  /** Who/what the character turns toward. */
  facing?: string;
}

export interface StageState {
  tension: number;
  beatNumber?: number;
  characters: StageCharacter[];
}

// ─── Emotion system ───────────────────────────────────────────────────────────

const EMOTION_AURA: Record<string, string> = {
  panicking:  "#ff4d4d",
  calm:       "#4dd2ff",
  aggressive: "#ff2200",
  frozen:     "#b3c6ff",
  heroic:     "#ffd24d",
  nervous:    "#ffa64d",
  determined: "#4dff88",
  embarrassed:"#ff88cc",
  amused:     "#aaff44",
  sad:        "#6688ff",
  hopeful:    "#88ffcc",
  default:    "#aaaaff",
};

const EMOTION_FACE: Record<string, { browL: number; browR: number; mouthScale: number; mouthY: number }> = {
  panicking:  { browL:  0.4, browR: -0.4, mouthScale: 1.6, mouthY: -0.08 },
  calm:       { browL:  0.0, browR:  0.0, mouthScale: 0.8, mouthY:  0.02 },
  aggressive: { browL: -0.5, browR:  0.5, mouthScale: 0.7, mouthY: -0.04 },
  frozen:     { browL:  0.6, browR: -0.6, mouthScale: 0.5, mouthY: -0.05 },
  heroic:     { browL:  0.0, browR:  0.0, mouthScale: 1.0, mouthY:  0.06 },
  nervous:    { browL:  0.3, browR: -0.3, mouthScale: 0.6, mouthY:  0.0  },
  determined: { browL: -0.2, browR:  0.2, mouthScale: 0.7, mouthY:  0.0  },
  embarrassed:{ browL:  0.2, browR: -0.2, mouthScale: 0.9, mouthY:  0.01 },
  amused:     { browL:  0.1, browR: -0.1, mouthScale: 1.1, mouthY:  0.07 },
  sad:        { browL:  0.3, browR: -0.3, mouthScale: 0.8, mouthY: -0.07 },
  hopeful:    { browL:  0.15,browR: -0.15,mouthScale: 0.9, mouthY:  0.04 },
};

function getEmotion(e: string) {
  return EMOTION_FACE[e] ?? EMOTION_FACE.calm;
}
function getAura(e: string) {
  return EMOTION_AURA[e] ?? EMOTION_AURA.default;
}

/**
 * Resting facing angle (radians, rotation about Y). The model faces +z (the
 * camera) at 0. Positive rotates toward +x. We keep angles partial (~0.6 rad)
 * so faces stay visible even when characters turn toward each other.
 */
function facingAngle(facing: string | undefined, homeX: number): number {
  const onLeft = homeX < 0;
  switch (facing) {
    case "partner": return onLeft ? 0.6 : -0.6;   // turn toward the other character
    case "away":    return onLeft ? -0.6 : 0.6;
    case "exit":    return onLeft ? -1.1 : 1.1;    // turn toward their own side
    case "forward":
    default:        return 0;                       // face the viewer
  }
}

type MotionRef = React.MutableRefObject<{ moving: boolean; speed: number }>;

// ─── Character palettes ───────────────────────────────────────────────────────

const PALETTES = [
  { skin: "#f5c6a5", hair: "#3b1f0f", shirt: "#e63946", pants: "#2b3a4a", shoes: "#1c1410", hairStyle: 0 },
  { skin: "#d4935a", hair: "#1a0a00", shirt: "#457b9d", pants: "#1a1a2e", shoes: "#0d0d17", hairStyle: 1 },
  { skin: "#c68642", hair: "#2c1810", shirt: "#2d6a4f", pants: "#1b1b2f", shoes: "#0f0f1a", hairStyle: 2 },
  { skin: "#f0d5b8", hair: "#8b5e3c", shirt: "#9b2226", pants: "#333355", shoes: "#111120", hairStyle: 3 },
];

// ─── Speech bubble ────────────────────────────────────────────────────────────

function SpeechBubble({
  name,
  dialogue,
  beatKey,
  isUser,
}: {
  name: string;
  dialogue: string;
  beatKey: string;
  isUser?: boolean;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!dialogue) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [dialogue, beatKey]);

  if (!dialogue || !visible) return null;

  return (
    <Html position={[0, 2.9, 0]} center distanceFactor={9} zIndexRange={[100, 0]}>
      <div className="sim-speech-bubble" style={{ opacity: visible ? 1 : 0 }}>
        <div className="sim-speech-bubble__name">{isUser ? "YOU" : name}</div>
        {isUser && <div className="sim-speech-bubble__subname">{name}</div>}
        <p className="sim-speech-bubble__line">{dialogue}</p>
      </div>
    </Html>
  );
}

// ─── Face ─────────────────────────────────────────────────────────────────────

function Face({ emotion, skinColor }: { emotion: string; skinColor: string }) {
  const f = getEmotion(emotion);
  const browLRef = useRef<THREE.Mesh>(null);
  const browRRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (browLRef.current) browLRef.current.rotation.z = f.browL;
    if (browRRef.current) browRRef.current.rotation.z = f.browR;
    if (mouthRef.current) {
      mouthRef.current.scale.x = f.mouthScale;
      mouthRef.current.position.y = f.mouthY;
    }
  }, [emotion, f.browL, f.browR, f.mouthScale, f.mouthY]);

  return (
    <group>
      {/* Eyes */}
      <mesh position={[-0.1, 0.06, 0.285]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.1, 0.06, 0.285]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Eye whites */}
      <mesh position={[-0.1, 0.06, 0.278]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#f8f8f8" />
      </mesh>
      <mesh position={[0.1, 0.06, 0.278]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#f8f8f8" />
      </mesh>
      {/* Eyebrows */}
      <mesh ref={browLRef} position={[-0.1, 0.17, 0.285]}>
        <boxGeometry args={[0.12, 0.025, 0.04]} />
        <meshStandardMaterial color="#2a1800" />
      </mesh>
      <mesh ref={browRRef} position={[0.1, 0.17, 0.285]}>
        <boxGeometry args={[0.12, 0.025, 0.04]} />
        <meshStandardMaterial color="#2a1800" />
      </mesh>
      {/* Nose */}
      <mesh position={[0, -0.02, 0.3]}>
        <sphereGeometry args={[0.028, 8, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>
      {/* Mouth */}
      <mesh ref={mouthRef} position={[0, -0.1, 0.285]}>
        <boxGeometry args={[0.13, 0.03, 0.04]} />
        <meshStandardMaterial color="#7a1a2a" />
      </mesh>
    </group>
  );
}

// ─── Hair styles ──────────────────────────────────────────────────────────────

function Hair({ style, color }: { style: number; color: string }) {
  const mat = <meshStandardMaterial color={color} roughness={0.85} />;
  switch (style % 4) {
    case 0: // Short straight
      return (
        <group>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.305, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.06, -0.21]}>
            <boxGeometry args={[0.42, 0.18, 0.12]} />
            {mat}
          </mesh>
        </group>
      );
    case 1: // Medium wavy bun-back
      return (
        <group>
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.315, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.08, -0.26]} scale={[1, 0.9, 0.7]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            {mat}
          </mesh>
        </group>
      );
    case 2: // Long straight sides
      return (
        <group>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.308, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.53]} />
            {mat}
          </mesh>
          <mesh position={[-0.28, -0.2, 0]} scale={[0.45, 1.0, 0.45]}>
            <cylinderGeometry args={[0.18, 0.14, 0.7, 8]} />
            {mat}
          </mesh>
          <mesh position={[0.28, -0.2, 0]} scale={[0.45, 1.0, 0.45]}>
            <cylinderGeometry args={[0.18, 0.14, 0.7, 8]} />
            {mat}
          </mesh>
        </group>
      );
    default: // Short spiky
      return (
        <group>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            {mat}
          </mesh>
          {[[-0.12, 0.32, 0.05], [0, 0.35, 0.02], [0.12, 0.32, 0.05], [-0.06, 0.34, -0.08], [0.06, 0.34, -0.08]].map(([x, y, z], i) => (
            <mesh key={i} position={[x as number, y as number, z as number]}>
              <coneGeometry args={[0.055, 0.14, 6]} />
              {mat}
            </mesh>
          ))}
        </group>
      );
  }
}

// ─── Arm (multi-segment, animates every frame off the clock) ───────────────────

function Arm({
  side,
  shirtColor,
  skinColor,
  animation,
  motionRef,
}: {
  side: "left" | "right";
  shirtColor: string;
  skinColor: string;
  animation: string;
  motionRef: MotionRef;
}) {
  const sign = side === "left" ? -1 : 1;
  const x = sign * 0.44;
  const shoulderRef = useRef<THREE.Group>(null);
  const elbowRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const moving = motionRef.current.moving;

    let shoulderX = 0;
    let shoulderZ = sign * 0.28;
    let elbowX = 0.05;

    // While walking/running the arms swing in opposition to the legs,
    // unless the AI animation explicitly poses the arm (wave/point/hands_up).
    const poseLocksArm =
      animation === "wave" || animation === "point" || animation === "hands_up";

    if (moving && !poseLocksArm) {
      const speed = animation === "run" ? 11 : 7;
      const amp = animation === "run" ? 0.9 : 0.55;
      shoulderX = Math.sin(t * speed) * amp * sign;
      elbowX = 0.25 + Math.abs(Math.sin(t * speed)) * 0.3;
    } else {
      switch (animation) {
        case "run": // running in place (arrived but still "run")
          shoulderX = Math.sin(t * 11) * 0.9 * sign;
          elbowX = 0.4;
          break;
        case "wave":
          if (side === "left") {
            shoulderX = -2.3 + Math.sin(t * 8) * 0.1;
            shoulderZ = sign * 0.5;
            elbowX = 0.5 + Math.sin(t * 9) * 0.4;
          } else {
            shoulderX = Math.sin(t * 1.5) * 0.05;
          }
          break;
        case "point":
          if (side === "right") {
            shoulderX = -1.4;
            shoulderZ = sign * 0.1;
            elbowX = 0.0;
          } else {
            shoulderX = Math.sin(t * 1.5) * 0.05;
          }
          break;
        case "help":
          shoulderX = -0.7 + Math.sin(t * 2.5) * 0.25;
          shoulderZ = sign * 0.18;
          elbowX = 0.6;
          break;
        case "talk":
          if (side === "right") {
            shoulderX = -0.4 + Math.sin(t * 3.5) * 0.35;
            elbowX = 0.5 + Math.sin(t * 3.5) * 0.2;
          } else {
            shoulderX = Math.sin(t * 1.5) * 0.05;
          }
          break;
        case "hands_up":
          shoulderX = -2.6;
          shoulderZ = sign * 0.45;
          elbowX = 0.2;
          break;
        case "crouch":
          shoulderX = 0.5;
          elbowX = 0.5;
          break;
        case "sit":
          shoulderX = 0.55;
          shoulderZ = sign * 0.08;
          elbowX = 0.6;
          break;
        case "hug_self":
          shoulderX = 0.3;
          shoulderZ = sign * -0.55;
          elbowX = 1.1;
          break;
        case "freeze":
          shoulderX = 0;
          elbowX = 0.02;
          break;
        default: // idle — gentle breathing sway
          shoulderX = Math.sin(t * 1.5 + sign) * 0.07;
          elbowX = 0.08 + Math.sin(t * 1.5) * 0.03;
      }
    }

    if (shoulderRef.current) shoulderRef.current.rotation.set(shoulderX, 0, shoulderZ);
    if (elbowRef.current) elbowRef.current.rotation.x = elbowX;
  });

  return (
    <group position={[x, 1.12, 0]}>
      <group ref={shoulderRef} rotation={[0, 0, sign * 0.28]}>
        {/* Upper arm */}
        <mesh position={[0, -0.155, 0]}>
          <cylinderGeometry args={[0.07, 0.065, 0.3, 10]} />
          <meshStandardMaterial color={shirtColor} roughness={0.55} />
        </mesh>
        {/* Forearm + hand pivot at elbow */}
        <group ref={elbowRef} position={[0, -0.31, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.062, 0.055, 0.25, 10]} />
            <meshStandardMaterial color={skinColor} roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.26, 0]}>
            <boxGeometry args={[0.1, 0.09, 0.07]} />
            <meshStandardMaterial color={skinColor} roughness={0.65} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ─── Humanoid ─────────────────────────────────────────────────────────────────

function Humanoid({
  home,
  palette,
  data,
  beatKey,
  isUser,
}: {
  home: [number, number, number];
  palette: (typeof PALETTES)[number];
  data?: StageCharacter;
  beatKey: string;
  isUser?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  // Current ground position — lerps toward the AI-chosen target each frame.
  const posRef = useRef(new THREE.Vector3(home[0], home[1], 0));
  const motionRef = useRef({ moving: false, speed: 0 });

  const anim = data?.animation ?? "idle";
  const emotion = data?.emotion ?? "calm";
  const intensity = data?.intensity ?? 0.2;
  const auraColor = getAura(emotion);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const k = 0.4 + intensity;

    // ── Locomotion: walk toward the AI-chosen target ──
    const targetX = data?.x ?? home[0];
    const targetZ = data?.z ?? 0;
    const cur = posRef.current;
    const remaining = Math.hypot(targetX - cur.x, targetZ - cur.z);
    const moving = remaining > 0.05;

    const lambda = anim === "run" ? 4.5 : 2.8;
    const prevX = cur.x;
    const prevZ = cur.z;
    cur.x = THREE.MathUtils.damp(cur.x, targetX, lambda, dt);
    cur.z = THREE.MathUtils.damp(cur.z, targetZ, lambda, dt);
    const dx = cur.x - prevX;
    const dz = cur.z - prevZ;
    const frameSpeed = Math.hypot(dx, dz);
    motionRef.current.moving = moving;
    motionRef.current.speed = frameSpeed;

    // ── Vertical bob / dips (in-place body action) ──
    let offY = 0;
    if (moving) {
      const sp = anim === "run" ? 11 : 7;
      offY = Math.abs(Math.sin(t * sp)) * (anim === "run" ? 0.09 : 0.05);
    } else {
      switch (anim) {
        case "crouch":  offY = -0.4; break;
        case "sit":     offY = -0.52; break;
        case "talk":    offY = Math.abs(Math.sin(t * 6)) * 0.03; break;
        case "hands_up":offY = Math.sin(t * 8) * 0.03; break;
        case "run":     offY = Math.abs(Math.sin(t * 11)) * 0.08; break;
        case "freeze":  offY = 0; break;
        default:        offY = Math.sin(t * 1.5) * 0.035 * k;
      }
    }
    group.current.position.set(cur.x, home[1] + offY, cur.z);

    // ── Legs: walk cycle while moving; else pose/settle ──
    if (leftLegRef.current && rightLegRef.current) {
      if (moving || anim === "run") {
        const sp = anim === "run" ? 11 : 7;
        const amp = anim === "run" ? 0.7 : 0.45;
        leftLegRef.current.rotation.x = Math.sin(t * sp) * amp;
        rightLegRef.current.rotation.x = -Math.sin(t * sp) * amp;
      } else if (anim === "sit") {
        leftLegRef.current.rotation.x = Math.PI * 0.46;
        rightLegRef.current.rotation.x = Math.PI * 0.46;
      } else if (anim === "crouch") {
        leftLegRef.current.rotation.x = 0.55;
        rightLegRef.current.rotation.x = 0.55;
      } else {
        leftLegRef.current.rotation.x = THREE.MathUtils.damp(leftLegRef.current.rotation.x, 0, 8, dt);
        rightLegRef.current.rotation.x = THREE.MathUtils.damp(rightLegRef.current.rotation.x, 0, 8, dt);
      }
    }

    // ── Facing: face travel direction while walking, else the AI's facing ──
    let targetRotY: number;
    if (moving && frameSpeed > 0.0008) {
      targetRotY = Math.atan2(dx, dz);
    } else {
      targetRotY = facingAngle(data?.facing, home[0]);
    }
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotY, 7, dt);
    // slight running lean
    group.current.rotation.z = THREE.MathUtils.damp(
      group.current.rotation.z,
      moving && anim === "run" ? 0.05 : 0,
      6,
      dt,
    );

    // ── Aura pulse ──
    if (auraRef.current) {
      const mat = auraRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(t * 2.5) * 0.5 + 0.5;
      mat.opacity = 0.06 + pulse * 0.1 + intensity * 0.14;
      auraRef.current.scale.setScalar(1 + pulse * 0.07 + intensity * 0.05);
    }
  });

  return (
    <group ref={group} position={[home[0], home[1], 0]}>
      {/* Emotion aura */}
      <mesh ref={auraRef} position={[0, 1.15, 0]}>
        <sphereGeometry args={[1.25, 20, 20]} />
        <meshStandardMaterial color={auraColor} transparent opacity={0.1} emissive={auraColor} emissiveIntensity={0.3} />
      </mesh>

      {/* Legs — pivot at the hip so they swing naturally */}
      <group ref={leftLegRef} position={[-0.14, 0.69, 0]}>
        <mesh position={[0, -0.31, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.62, 10]} />
          <meshStandardMaterial color={palette.pants} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.64, 0.04]} castShadow>
          <boxGeometry args={[0.14, 0.1, 0.24]} />
          <meshStandardMaterial color={palette.shoes} roughness={0.7} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.14, 0.69, 0]}>
        <mesh position={[0, -0.31, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.62, 10]} />
          <meshStandardMaterial color={palette.pants} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.64, 0.04]} castShadow>
          <boxGeometry args={[0.14, 0.1, 0.24]} />
          <meshStandardMaterial color={palette.shoes} roughness={0.7} />
        </mesh>
      </group>

      {/* Lower torso */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.22, 0.36, 16]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.55} />
      </mesh>

      {/* Upper torso */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <cylinderGeometry args={[0.33, 0.27, 0.42, 16]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.5} />
      </mesh>

      {/* Arms — self-animating */}
      <Arm side="left"  shirtColor={palette.shirt} skinColor={palette.skin} animation={anim} motionRef={motionRef} />
      <Arm side="right" shirtColor={palette.shirt} skinColor={palette.skin} animation={anim} motionRef={motionRef} />

      {/* Neck */}
      <mesh position={[0, 1.44, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.2, 12]} />
        <meshStandardMaterial color={palette.skin} roughness={0.65} />
      </mesh>

      {/* Head */}
      <group position={[0, 1.72, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.305, 24, 24]} />
          <meshStandardMaterial color={palette.skin} roughness={0.6} />
        </mesh>
        <Face emotion={emotion} skinColor={palette.skin} />
        <Hair style={palette.hairStyle} color={palette.hair} />
      </group>

      {/* Ground shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      {data?.dialogue && (
        <SpeechBubble name={data.name} dialogue={data.dialogue} beatKey={beatKey} isUser={isUser} />
      )}
    </group>
  );
}

// ─── Environments ─────────────────────────────────────────────────────────────

function ClassroomScene({ tension }: { tension: number }) {
  const waterY = -0.45 + tension * 0.012;
  const waterOpacity = 0.35 + tension * 0.004;

  return (
    <group>
      {/* Floor — tile pattern using alternating colors */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#b0c4d8" roughness={0.8} />
      </mesh>

      {/* Rising water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, waterY, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1e6091" transparent opacity={waterOpacity} metalness={0.3} roughness={0.1} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 2.5, -6]} receiveShadow>
        <boxGeometry args={[18, 8, 0.3]} />
        <meshStandardMaterial color="#d4e4f0" roughness={0.9} />
      </mesh>
      {/* Chalkboard */}
      <mesh position={[0, 2.8, -5.8]}>
        <boxGeometry args={[8, 3.5, 0.15]} />
        <meshStandardMaterial color="#1a3a2a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.8, -5.7]}>
        <boxGeometry args={[7.5, 3, 0.05]} />
        <meshStandardMaterial color="#223322" roughness={1} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-9, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#ccdde8" roughness={0.9} />
      </mesh>
      <mesh position={[9, 2.5, 0]} receiveShadow>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#ccdde8" roughness={0.9} />
      </mesh>

      {/* Windows on right wall */}
      {[-3, 1, 5].map((z, i) => (
        <group key={i} position={[8.88, 3.2, z]}>
          <mesh>
            <boxGeometry args={[0.15, 2.2, 1.6]} />
            <meshStandardMaterial color="#a8d8f0" transparent opacity={0.7} metalness={0.2} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.2, 2.4, 1.8]} />
            <meshStandardMaterial color="#8a7a6a" roughness={0.8} wireframe={false} />
          </mesh>
        </group>
      ))}

      {/* Student desks */}
      {[[-3, -1.5], [-3, 1.5], [0, -1.5], [0, 1.5], [3, -1.5], [3, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x as number, -0.15, z as number]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.1, 0.08, 0.75]} />
            <meshStandardMaterial color="#c8a87a" roughness={0.7} />
          </mesh>
          {/* Desk legs */}
          {[[-0.48, -0.3], [0.48, -0.3], [-0.48, 0.3], [0.48, 0.3]].map(([dx, dz], j) => (
            <mesh key={j} position={[dx as number, -0.27, dz as number]}>
              <cylinderGeometry args={[0.025, 0.025, 0.55, 6]} />
              <meshStandardMaterial color="#888" roughness={0.6} />
            </mesh>
          ))}
          {/* Chair */}
          <mesh position={[0, -0.2, 0.65]}>
            <boxGeometry args={[0.7, 0.06, 0.6]} />
            <meshStandardMaterial color="#4a90d9" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.15, 0.92]}>
            <boxGeometry args={[0.7, 0.65, 0.06]} />
            <meshStandardMaterial color="#4a90d9" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Floating papers/books near water surface */}
      {tension > 30 && [[-2, 0.5], [1, -1], [-1, 2], [3, 0]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, waterY + 0.04, z as number]} rotation={[-Math.PI / 2, 0, i * 0.5]}>
          <planeGeometry args={[0.35, 0.28]} />
          <meshStandardMaterial color="#f8f0e0" roughness={0.9} />
        </mesh>
      ))}

      {/* Ceiling lights */}
      {[-3, 3].map((x, i) => (
        <group key={i} position={[x, 5.5, 0]}>
          <mesh>
            <boxGeometry args={[3, 0.08, 0.35]} />
            <meshStandardMaterial color="#ddeeff" emissive="#aaccff" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={0.4} color="#ddeeff" distance={8} />
        </group>
      ))}
    </group>
  );
}

function RobberyScene({ tension }: { tension: number }) {
  const flickerPhase = Math.random(); // used for random neon flicker

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#c8bfb0" roughness={0.85} />
      </mesh>
      {/* Floor tiles */}
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => (
          <mesh key={`${row}-${col}`} rotation={[-Math.PI / 2, 0, 0]} position={[-8 + col * 4, -0.49, -8 + row * 4]}>
            <planeGeometry args={[3.9, 3.9]} />
            <meshStandardMaterial color={(row + col) % 2 === 0 ? "#c8bfb0" : "#b8af9f"} roughness={0.85} />
          </mesh>
        ))
      )}

      {/* Back wall */}
      <mesh position={[0, 2.5, -7]} receiveShadow>
        <boxGeometry args={[18, 8, 0.3]} />
        <meshStandardMaterial color="#2a2820" roughness={0.95} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#222018" roughness={0.95} />
      </mesh>
      <mesh position={[9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#222018" roughness={0.95} />
      </mesh>

      {/* Store shelves - left side */}
      {[-4.5, -2, 0.5].map((z, i) => (
        <group key={i} position={[-6.5, 0.6, z]}>
          {/* Frame */}
          <mesh>
            <boxGeometry args={[0.25, 2.2, 1.8]} />
            <meshStandardMaterial color="#3a3630" roughness={0.8} />
          </mesh>
          {/* Shelves */}
          {[0.4, -0.1, -0.6].map((sy, j) => (
            <mesh key={j} position={[0.15, sy, 0]}>
              <boxGeometry args={[0.06, 0.04, 1.7]} />
              <meshStandardMaterial color="#4a4640" roughness={0.7} />
            </mesh>
          ))}
          {/* Items on shelves — colorful cans/boxes */}
          {[0.4, -0.1].map((sy, j) =>
            [-0.6, -0.2, 0.2, 0.6].map((sz, k) => (
              <mesh key={`${j}-${k}`} position={[0.22, sy + 0.1, sz]}>
                <cylinderGeometry args={[0.07, 0.07, 0.18, 8]} />
                <meshStandardMaterial color={["#cc4444", "#4488cc", "#44aa44", "#ccaa22"][k]} roughness={0.6} />
              </mesh>
            ))
          )}
        </group>
      ))}

      {/* Store shelves - right side */}
      {[-4.5, -2, 0.5].map((z, i) => (
        <group key={i} position={[6.5, 0.6, z]}>
          <mesh>
            <boxGeometry args={[0.25, 2.2, 1.8]} />
            <meshStandardMaterial color="#3a3630" roughness={0.8} />
          </mesh>
          {[0.4, -0.1, -0.6].map((sy, j) => (
            <mesh key={j} position={[-0.15, sy, 0]}>
              <boxGeometry args={[0.06, 0.04, 1.7]} />
              <meshStandardMaterial color="#4a4640" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Counter at back */}
      <mesh position={[0, 0.35, -5.5]}>
        <boxGeometry args={[5, 0.9, 0.8]} />
        <meshStandardMaterial color="#4a4235" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.82, -5.5]}>
        <boxGeometry args={[5.1, 0.08, 0.85]} />
        <meshStandardMaterial color="#3a3228" roughness={0.6} />
      </mesh>
      {/* Cash register */}
      <mesh position={[1.5, 1.0, -5.5]}>
        <boxGeometry args={[0.5, 0.4, 0.35]} />
        <meshStandardMaterial color="#111" roughness={0.5} />
      </mesh>

      {/* OPEN neon sign */}
      <mesh position={[-3.5, 3.8, -6.8]}>
        <boxGeometry args={[2.2, 0.6, 0.1]} />
        <meshStandardMaterial color="#ff3322" emissive="#ff3322" emissiveIntensity={tension > 50 ? 1.5 : 0.8} />
      </mesh>
      <pointLight position={[-3.5, 3.8, -6.5]} color="#ff3322" intensity={tension * 0.015 + 0.3} distance={5} />

      {/* Overhead harsh light */}
      <mesh position={[0, 5.5, -2]}>
        <boxGeometry args={[1, 0.12, 0.4]} />
        <meshStandardMaterial color="#fff8e0" emissive="#fff8e0" emissiveIntensity={0.7} />
      </mesh>
      <pointLight position={[0, 5, -2]} color="#fff8d0" intensity={1.2} distance={12} />

      {/* Dramatic red fill from back */}
      <pointLight position={[0, 2, -4]} color="#880000" intensity={tension * 0.018} distance={8} />
    </group>
  );
}

function JobInterviewScene({ tension }: { tension: number }) {
  return (
    <group>
      {/* Hardwood floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#b8895a" roughness={0.75} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.5, -7]}>
        <boxGeometry args={[18, 8, 0.3]} />
        <meshStandardMaterial color="#e8e0d8" roughness={0.9} />
      </mesh>
      <mesh position={[-9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#e0d8d0" roughness={0.9} />
      </mesh>
      <mesh position={[9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#e0d8d0" roughness={0.9} />
      </mesh>

      {/* Large conference desk */}
      <mesh position={[0, -0.1, -1]}>
        <boxGeometry args={[4.5, 0.1, 2]} />
        <meshStandardMaterial color="#6b4226" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Desk legs */}
      {[[-2, -1.5], [2, -1.5], [-2, 0], [2, 0]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.45, z]}>
          <cylinderGeometry args={[0.05, 0.05, 0.65, 8]} />
          <meshStandardMaterial color="#4a2e14" roughness={0.7} />
        </mesh>
      ))}

      {/* Office chairs (both sides) */}
      {[-1, 1].map((side, i) => (
        <group key={i} position={[side * 2.8, -0.25, -1]}>
          <mesh>
            <boxGeometry args={[0.8, 0.07, 0.75]} />
            <meshStandardMaterial color="#222230" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.4, 0.36]}>
            <boxGeometry args={[0.8, 0.75, 0.08]} />
            <meshStandardMaterial color="#222230" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.28, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.45, 6]} />
            <meshStandardMaterial color="#555" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Laptop on desk */}
      <mesh position={[1.2, -0.03, -1.2]}>
        <boxGeometry args={[0.65, 0.03, 0.45]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[1.2, 0.25, -0.98]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.65, 0.45, 0.025]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Papers/folder on desk */}
      <mesh position={[-1, -0.035, -1.1]} rotation={[0, 0.15, 0]}>
        <boxGeometry args={[0.45, 0.015, 0.32]} />
        <meshStandardMaterial color="#f0ece4" roughness={0.9} />
      </mesh>

      {/* Office plant */}
      <group position={[7, 0, -5]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 0.6, 10]} />
          <meshStandardMaterial color="#7a5c3a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial color="#2d7a2d" roughness={0.8} />
        </mesh>
        <mesh position={[-0.3, 0.4, 0.2]}>
          <sphereGeometry args={[0.38, 10, 10]} />
          <meshStandardMaterial color="#3a8a3a" roughness={0.8} />
        </mesh>
      </group>

      {/* Window with city view */}
      <mesh position={[8.85, 3, -2]}>
        <boxGeometry args={[0.15, 3.5, 4]} />
        <meshStandardMaterial color="#88aacc" transparent opacity={0.6} metalness={0.1} emissive="#4488aa" emissiveIntensity={0.2} />
      </mesh>

      {/* Ceiling light */}
      <pointLight position={[0, 4.5, -1]} color="#fff8f0" intensity={1.4} distance={12} />
      <mesh position={[0, 5.5, -1]}>
        <boxGeometry args={[1.8, 0.1, 0.5]} />
        <meshStandardMaterial color="#fff8f0" emissive="#fff8f0" emissiveIntensity={0.6} />
      </mesh>

      {/* Tension indicator — subtle red warmth */}
      <pointLight position={[0, 2, 2]} color={`hsl(${Math.max(0, 30 - tension * 0.3)}, 80%, 60%)`} intensity={tension * 0.01} distance={8} />
    </group>
  );
}

function FirstDateScene({ tension }: { tension: number }) {
  return (
    <group>
      {/* Restaurant floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#8a6a50" roughness={0.8} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.5, -7]}>
        <boxGeometry args={[18, 8, 0.3]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.95} />
      </mesh>
      <mesh position={[-9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.95} />
      </mesh>
      <mesh position={[9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.95} />
      </mesh>

      {/* Center round table */}
      <mesh position={[0, -0.18, -0.5]}>
        <cylinderGeometry args={[0.9, 0.85, 0.08, 20]} />
        <meshStandardMaterial color="#6b3a1a" roughness={0.6} />
      </mesh>
      {/* Table leg */}
      <mesh position={[0, -0.5, -0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 8]} />
        <meshStandardMaterial color="#4a2a0f" roughness={0.7} />
      </mesh>
      {/* Tablecloth */}
      <mesh position={[0, -0.13, -0.5]}>
        <cylinderGeometry args={[0.88, 0.88, 0.02, 20]} />
        <meshStandardMaterial color="#f8f0e8" roughness={0.9} />
      </mesh>

      {/* Candle centerpiece */}
      <mesh position={[0, 0.0, -0.5]}>
        <cylinderGeometry args={[0.04, 0.04, 0.22, 8]} />
        <meshStandardMaterial color="#f5f0e0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.14, -0.5]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ffdd44" emissive="#ffaa00" emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[0, 0.5, -0.5]} color="#ffaa44" intensity={0.8 + tension * 0.004} distance={4} />

      {/* Wine glasses */}
      {[[-0.4, 0.6], [0.4, -1.3]].map(([x, z], i) => (
        <group key={i} position={[x as number, -0.1, z as number]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.04, 0.22, 10]} />
            <meshStandardMaterial color="#ccddff" transparent opacity={0.5} metalness={0.2} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.15, 6]} />
            <meshStandardMaterial color="#ccddff" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      {/* Background tables */}
      {[[-5, -4], [5, -4], [-5, 2], [5, 2]].map(([x, z], i) => (
        <group key={i} position={[x as number, -0.3, z as number]}>
          <mesh>
            <cylinderGeometry args={[0.7, 0.65, 0.07, 16]} />
            <meshStandardMaterial color="#5a3010" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.68, 0.68, 0.02, 16]} />
            <meshStandardMaterial color="#f0e8e0" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Warm restaurant lighting */}
      <pointLight position={[0, 4, 0]} color="#ffcc88" intensity={0.9} distance={10} />
      <pointLight position={[-5, 3.5, -3]} color="#ff9944" intensity={0.35} distance={6} />
      <pointLight position={[5, 3.5, -3]} color="#ff9944" intensity={0.35} distance={6} />

      {/* Wall sconces */}
      {[-7, 7].map((x, i) => (
        <group key={i} position={[x, 3, -3]}>
          <mesh>
            <boxGeometry args={[0.1, 0.25, 0.15]} />
            <meshStandardMaterial color="#8a6030" roughness={0.7} />
          </mesh>
          <pointLight position={[0, -0.2, 0.3]} color="#ffaa44" intensity={0.4} distance={4} />
        </group>
      ))}
    </group>
  );
}

function ArgumentScene({ tension }: { tension: number }) {
  return (
    <group>
      {/* Living room floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#c8a878" roughness={0.8} />
      </mesh>

      {/* Area rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial color={tension > 60 ? "#8a2020" : "#6a4040"} roughness={0.9} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.5, -7]}>
        <boxGeometry args={[18, 8, 0.3]} />
        <meshStandardMaterial color="#e8d8c0" roughness={0.9} />
      </mesh>
      <mesh position={[-9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.9} />
      </mesh>
      <mesh position={[9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#e0d0b8" roughness={0.9} />
      </mesh>

      {/* Sofa */}
      <group position={[0, -0.12, -4]}>
        {/* Base */}
        <mesh>
          <boxGeometry args={[4.5, 0.55, 1.2]} />
          <meshStandardMaterial color="#7a5a40" roughness={0.8} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0.55, -0.55]}>
          <boxGeometry args={[4.5, 0.85, 0.25]} />
          <meshStandardMaterial color="#7a5a40" roughness={0.8} />
        </mesh>
        {/* Cushions */}
        {[-1.5, 0, 1.5].map((x, i) => (
          <mesh key={i} position={[x, 0.35, 0.05]}>
            <boxGeometry args={[1.4, 0.2, 1.1]} />
            <meshStandardMaterial color="#8a6a50" roughness={0.85} />
          </mesh>
        ))}
        {/* Armrests */}
        <mesh position={[-2.2, 0.25, 0]}>
          <boxGeometry args={[0.2, 0.55, 1.2]} />
          <meshStandardMaterial color="#6a4a30" roughness={0.8} />
        </mesh>
        <mesh position={[2.2, 0.25, 0]}>
          <boxGeometry args={[0.2, 0.55, 1.2]} />
          <meshStandardMaterial color="#6a4a30" roughness={0.8} />
        </mesh>
      </group>

      {/* Coffee table */}
      <mesh position={[0, -0.35, -1.8]}>
        <boxGeometry args={[2.8, 0.1, 1.1]} />
        <meshStandardMaterial color="#5a3a18" roughness={0.65} metalness={0.05} />
      </mesh>
      {[[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, -0.55, (-1.8 + (z as number))]}>
          <cylinderGeometry args={[0.04, 0.04, 0.35, 6]} />
          <meshStandardMaterial color="#3a2208" roughness={0.7} />
        </mesh>
      ))}

      {/* TV on stand */}
      <group position={[0, 0.5, -6.5]}>
        <mesh>
          <boxGeometry args={[3.5, 2.0, 0.1]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Screen — dark if tension is high (nobody watching TV during argument) */}
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[3.2, 1.75, 0.02]} />
          <meshStandardMaterial color="#050510" roughness={0.3} metalness={0.5} emissive="#050510" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0, -1.35, 0]}>
          <boxGeometry args={[0.12, 0.6, 0.12]} />
          <meshStandardMaterial color="#111" roughness={0.5} />
        </mesh>
        <mesh position={[0, -1.7, 0.15]}>
          <boxGeometry args={[0.8, 0.08, 0.4]} />
          <meshStandardMaterial color="#111" roughness={0.5} />
        </mesh>
      </group>

      {/* Tension — flickering lights if very high tension */}
      <pointLight position={[0, 4.5, 0]} color={`hsl(${40 - tension * 0.2}, 70%, 70%)`} intensity={1.0 + Math.sin(Date.now() / 200) * (tension > 70 ? 0.3 : 0)} distance={12} />
      <pointLight position={[0, 3, -6]} color="#443322" intensity={0.3} distance={6} />
    </group>
  );
}

function HospitalScene({ tension }: { tension: number }) {
  return (
    <group>
      {/* Linoleum floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#d8e8e0" roughness={0.9} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.5, -7]}>
        <boxGeometry args={[18, 8, 0.3]} />
        <meshStandardMaterial color="#e8f0ee" roughness={0.9} />
      </mesh>
      <mesh position={[-9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#e0e8e6" roughness={0.9} />
      </mesh>
      <mesh position={[9, 2.5, 0]}>
        <boxGeometry args={[0.3, 8, 18]} />
        <meshStandardMaterial color="#e0e8e6" roughness={0.9} />
      </mesh>

      {/* Waiting chairs row */}
      {[-3.5, -1.5, 0.5, 2.5, 4.5].map((x, i) => (
        <group key={i} position={[x, -0.2, -3.5]}>
          <mesh>
            <boxGeometry args={[0.85, 0.07, 0.8]} />
            <meshStandardMaterial color="#3a6a8a" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.38, 0.36]}>
            <boxGeometry args={[0.85, 0.7, 0.07]} />
            <meshStandardMaterial color="#3a6a8a" roughness={0.7} />
          </mesh>
          {/* Legs */}
          {[[-0.38, -0.3], [0.38, -0.3], [-0.38, 0.35], [0.38, 0.35]].map(([lx, lz], j) => (
            <mesh key={j} position={[lx as number, -0.35, lz as number]}>
              <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
              <meshStandardMaterial color="#aaaaaa" roughness={0.5} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Nurse's station / reception desk */}
      <group position={[0, 0.1, -5.5]}>
        <mesh>
          <boxGeometry args={[6, 1.0, 1.0]} />
          <meshStandardMaterial color="#c8e0d8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[6.1, 0.07, 1.1]} />
          <meshStandardMaterial color="#b8d0c8" roughness={0.7} />
        </mesh>
        {/* Monitor */}
        <mesh position={[-1.5, 0.65, 0.1]}>
          <boxGeometry args={[0.6, 0.4, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
        </mesh>
      </group>

      {/* Magazine table */}
      <mesh position={[4, -0.35, -1.5]}>
        <boxGeometry args={[1.2, 0.07, 0.8]} />
        <meshStandardMaterial color="#c8b898" roughness={0.75} />
      </mesh>
      {/* Magazines */}
      {[0, 0.1].map((y, i) => (
        <mesh key={i} position={[4, -0.27 + y, -1.5]} rotation={[0, i * 0.3, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.38]} />
          <meshStandardMaterial color={["#cc4444", "#4488cc"][i]} roughness={0.9} />
        </mesh>
      ))}

      {/* Potted plant */}
      <group position={[-7, 0, -6]}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.2, 0.24, 0.5, 10]} />
          <meshStandardMaterial color="#7a6040" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.5, 10, 10]} />
          <meshStandardMaterial color="#2d6a3a" roughness={0.8} />
        </mesh>
      </group>

      {/* Fluorescent ceiling lights */}
      {[-4, 0, 4].map((x, i) => (
        <group key={i} position={[x, 5.5, -2]}>
          <mesh>
            <boxGeometry args={[3, 0.07, 0.35]} />
            <meshStandardMaterial color="#eef8f4" emissive="#aaf0cc" emissiveIntensity={0.5} />
          </mesh>
          <pointLight position={[0, -0.3, 0]} color="#ddf8ee" intensity={0.5} distance={8} />
        </group>
      ))}

      {/* Clock on wall */}
      <mesh position={[0, 4.5, -6.8]}>
        <cylinderGeometry args={[0.45, 0.45, 0.08, 20]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.8} />
      </mesh>

      {/* Anxiety color shift */}
      <pointLight position={[0, 3, 2]} color={tension > 60 ? "#ff8888" : "#88ccff"} intensity={0.2 + tension * 0.005} distance={6} />
    </group>
  );
}

// ─── Dynamic scene lighting based on scenario + tension ───────────────────────

function SceneLighting({ scenario, tension }: { scenario: Scenario; tension: number }) {
  const warmth = scenario === "first_date" ? "#ffcc88" : scenario === "hospital" ? "#ddf8ee" : "#ffffff";
  const ambientIntensity = scenario === "robbery" ? 0.2 : scenario === "argument" ? 0.4 : 0.55;
  const dirIntensity = scenario === "robbery" ? 0.6 : 1.1;

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={warmth} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={dirIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color={warmth}
      />
      {/* Tension rim light — gets redder and brighter as tension climbs */}
      <pointLight
        position={[0, 1.5, 4]}
        color={`hsl(${Math.max(0, 30 - tension * 0.3)}, 90%, 55%)`}
        intensity={tension * 0.025}
        distance={10}
      />
    </>
  );
}

// ─── Sky / background color ───────────────────────────────────────────────────

function sceneBg(scenario: Scenario, tension: number): string {
  switch (scenario) {
    case "classroom_flood": {
      const d = Math.max(10, 40 - tension * 0.3);
      return `rgb(${d}, ${d + 18}, ${60 + tension * 0.6})`;
    }
    case "robbery":
      return `rgb(${Math.min(60, 10 + tension * 0.5)}, 8, 12)`;
    case "job_interview":
      return `rgb(${220 - tension}, ${215 - tension}, ${210 - tension * 0.8})`;
    case "first_date":
      return `rgb(${40 + tension * 0.1}, 25, 30)`;
    case "argument":
      return `rgb(${30 + tension * 0.4}, ${Math.max(8, 28 - tension * 0.15)}, ${Math.max(8, 22 - tension * 0.1)})`;
    case "hospital":
      return `rgb(${200 - tension * 0.8}, ${220 - tension * 0.5}, ${215 - tension * 0.5})`;
    default:
      return "#0a0a12";
  }
}

// ─── Stage ────────────────────────────────────────────────────────────────────

export default function CharacterStage({
  stageState,
  scenario = "classroom_flood",
}: {
  stageState?: StageState;
  scenario?: Scenario;
}) {
  const tension = stageState?.tension ?? 0;
  const chars = stageState?.characters ?? [];
  const beatKey = String(stageState?.beatNumber ?? 0);
  const bg = sceneBg(scenario, tension);

  const envPreset = scenario === "robbery" ? "night" : scenario === "first_date" ? "sunset" : "city";

  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 2.2, 7.5], fov: 48 }}>
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 14, 28]} />

        <SceneLighting scenario={scenario} tension={tension} />
        <Environment preset={envPreset as "city" | "sunset" | "night"} />

        {/* Scenario environment */}
        {scenario === "classroom_flood" && <ClassroomScene tension={tension} />}
        {scenario === "robbery" && <RobberyScene tension={tension} />}
        {scenario === "job_interview" && <JobInterviewScene tension={tension} />}
        {scenario === "first_date" && <FirstDateScene tension={tension} />}
        {scenario === "argument" && <ArgumentScene tension={tension} />}
        {scenario === "hospital" && <HospitalScene tension={tension} />}

        <ContactShadows position={[0, -0.48, 0]} opacity={0.35} scale={14} blur={2.8} far={4} />

        {/* Characters — character 0 is always the user's AI self */}
        <Humanoid
          home={[-1.7, 0, 0]}
          palette={PALETTES[0]}
          data={chars[0]}
          beatKey={`${beatKey}-0`}
          isUser
        />
        <Humanoid
          home={[1.7, 0, 0]}
          palette={PALETTES[1]}
          data={chars[1]}
          beatKey={`${beatKey}-1`}
        />

        <OrbitControls enablePan={false} minDistance={4} maxDistance={14} />
      </Canvas>
    </div>
  );
}
