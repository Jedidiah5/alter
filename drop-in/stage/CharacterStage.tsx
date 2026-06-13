/**
 * ALTER — 3D Character Stage
 * --------------------------
 * The Three.js / React Three Fiber scene that mounts into the starter's CANVAS
 * area (beside the CopilotKit chat). This is the part judges remember and your
 * originality + technical-difficulty story.
 *
 * It reads `stageState` — the slim payload the Python agent emits via
 * dataModelUpdate (see character_sim.sim_to_stage_state). Each character's
 * `animation` + `intensity` drives motion. The A2UI surfaces (psyche cards,
 * tension meter) render separately, in the chat/canvas surface area.
 *
 * DEPENDENCIES (add to the starter): three, @react-three/fiber, @react-three/drei
 *   pnpm add three @react-three/fiber @react-three/drei
 *
 * WIRING:
 *   - Mount <CharacterStage stageState={...} scenario={...} /> in the canvas.
 *   - Feed it the agent's latest dataModel. If the starter exposes the A2UI
 *     dataModel via a hook, read it there; otherwise lift it into a small store.
 *
 * UPGRADE PATH (do in Cursor if time):
 *   - Replace the placeholder capsule meshes with Ready Player Me GLBs
 *     (useGLTF) and Mixamo clips (useAnimations), switching clip by `animation`.
 */

"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Text } from "@react-three/drei";
import * as THREE from "three";

type Scenario = "classroom_flood" | "robbery";

interface StageCharacter {
  name: string;
  animation: string;
  emotion: string;
  intensity: number; // 0..1, from stress
}

interface StageState {
  tension: number;
  characters: StageCharacter[];
}

const EMOTION_COLORS: Record<string, string> = {
  panicking: "#ff4d4d",
  calm: "#4dd2ff",
  aggressive: "#ff1a1a",
  frozen: "#b3c6ff",
  heroic: "#ffd24d",
  nervous: "#ffa64d",
  determined: "#4dff88",
};

function Actor({
  position,
  color,
  data,
}: {
  position: [number, number, number];
  color: string;
  data?: StageCharacter;
}) {
  const group = useRef<THREE.Group>(null);
  const anim = data?.animation ?? "idle";
  const intensity = data?.intensity ?? 0.2;

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const k = 0.4 + intensity; // more stress -> bigger motion

    switch (anim) {
      case "run":
        group.current.position.x = position[0] + Math.sin(t * 6) * 0.5 * k;
        group.current.rotation.y = Math.sin(t * 6) * 0.3;
        break;
      case "freeze":
        group.current.position.set(position[0], position[1], position[2]);
        group.current.rotation.y = 0;
        break;
      case "crouch":
        group.current.position.y = position[1] - 0.4;
        break;
      case "wave":
      case "point":
        group.current.rotation.y = Math.sin(t * 4) * 0.25;
        break;
      case "talk":
        group.current.position.y = position[1] + Math.abs(Math.sin(t * 8)) * 0.05;
        break;
      case "help":
        group.current.position.x = position[0] + Math.sin(t * 2) * 0.2;
        break;
      default: // idle
        group.current.position.y = position[1] + Math.sin(t * 1.5) * 0.05 * k;
    }
  });

  const aura = EMOTION_COLORS[data?.emotion ?? "calm"] ?? "#4dd2ff";

  return (
    <group ref={group} position={position}>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.35, 0.45, 1.4, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[1.15, 16, 16]} />
        <meshStandardMaterial color={aura} transparent opacity={0.12} />
      </mesh>
      <Text position={[0, 2.35, 0]} fontSize={0.3} color="white" anchorX="center">
        {data?.name ?? ""}
      </Text>
    </group>
  );
}

function background(scenario: Scenario, tension: number): string {
  if (scenario === "classroom_flood") {
    const d = Math.max(10, 40 - tension * 0.3);
    return `rgb(${d}, ${d + 20}, ${60 + tension * 0.6})`;
  }
  const r = Math.min(120, 30 + tension);
  return `rgb(${r}, 15, 20)`;
}

export default function CharacterStage({
  stageState,
  scenario = "classroom_flood",
}: {
  stageState?: StageState;
  scenario?: Scenario;
}) {
  const tension = stageState?.tension ?? 0;
  const chars = stageState?.characters ?? [];

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 420 }}>
      <Canvas camera={{ position: [0, 2, 7], fov: 50 }}>
        <color attach="background" args={[background(scenario, tension)]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial
            color={scenario === "classroom_flood" ? "#2a4d69" : "#1a1a1a"}
          />
        </mesh>

        {scenario === "classroom_flood" && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.5 + tension * 0.015, 0]}
          >
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#1e6091" transparent opacity={0.5} />
          </mesh>
        )}

        <Actor position={[-1.5, 0, 0]} color="#ff6b6b" data={chars[0]} />
        <Actor position={[1.5, 0, 0]} color="#4dabf7" data={chars[1]} />

        <OrbitControls enablePan={false} minDistance={4} maxDistance={12} />
      </Canvas>
    </div>
  );
}
