/**
 * ALTER — 3D Character Stage with Sims-style speech bubbles
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Html,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";

export type Scenario = "classroom_flood" | "robbery";

export interface StageCharacter {
  name: string;
  animation: string;
  emotion: string;
  intensity: number;
  dialogue?: string;
}

export interface StageState {
  tension: number;
  beatNumber?: number;
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

const PALETTES = [
  { skin: "#f5c6a5", shirt: "#e63946", pants: "#4a3728", shoes: "#1c1410" },
  { skin: "#d4a574", shirt: "#457b9d", pants: "#2b2d42", shoes: "#141820" },
];

function SpeechBubble({
  name,
  dialogue,
  beatKey,
}: {
  name: string;
  dialogue: string;
  beatKey: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!dialogue) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const fade = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(fade);
  }, [dialogue, beatKey]);

  if (!dialogue || !visible) return null;

  return (
    <Html position={[0, 2.55, 0]} center distanceFactor={9} zIndexRange={[100, 0]}>
      <div
        className="sim-speech-bubble"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="sim-speech-bubble__name">{name}</div>
        <p className="sim-speech-bubble__line">{dialogue}</p>
      </div>
    </Html>
  );
}

function Humanoid({
  position,
  palette,
  data,
  beatKey,
}: {
  position: [number, number, number];
  palette: (typeof PALETTES)[number];
  data?: StageCharacter;
  beatKey: string;
}) {
  const group = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const anim = data?.animation ?? "idle";
  const intensity = data?.intensity ?? 0.2;
  const auraColor = EMOTION_COLORS[data?.emotion ?? "calm"] ?? "#4dd2ff";

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const k = 0.4 + intensity;

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
        group.current.position.y = position[1] - 0.35;
        break;
      case "wave":
      case "point":
        group.current.rotation.y = Math.sin(t * 4) * 0.25;
        break;
      case "talk":
        group.current.position.y =
          position[1] + Math.abs(Math.sin(t * 8)) * 0.05;
        break;
      case "help":
        group.current.position.x = position[0] + Math.sin(t * 2) * 0.2;
        break;
      default:
        group.current.position.y =
          position[1] + Math.sin(t * 1.5) * 0.05 * k;
    }

    if (auraRef.current) {
      const mat = auraRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(t * 2.2) * 0.5 + 0.5;
      mat.opacity = 0.06 + pulse * 0.1 + intensity * 0.12;
      const scale = 1 + pulse * 0.08 + intensity * 0.05;
      auraRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={group} position={position}>
      {/* Emotion aura */}
      <mesh ref={auraRef} position={[0, 1.05, 0]}>
        <sphereGeometry args={[1.2, 20, 20]} />
        <meshStandardMaterial
          color={auraColor}
          transparent
          opacity={0.1}
          emissive={auraColor}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.68, 0]} castShadow>
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial color={palette.skin} roughness={0.65} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.42, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.18, 12]} />
        <meshStandardMaterial color={palette.skin} roughness={0.65} />
      </mesh>

      {/* Upper torso — wider shoulders */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 0.38, 16]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.55} />
      </mesh>

      {/* Lower torso — narrower waist */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.36, 16]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.55} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.42, 1.05, 0]} rotation={[0, 0, 0.35]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.55, 10]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.55} />
      </mesh>
      <mesh position={[0.42, 1.05, 0]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.55, 10]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.55} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.13, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.08, 0.62, 10]} />
        <meshStandardMaterial color={palette.pants} roughness={0.6} />
      </mesh>
      <mesh position={[0.13, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.08, 0.62, 10]} />
        <meshStandardMaterial color={palette.pants} roughness={0.6} />
      </mesh>

      {/* Shoes */}
      <mesh position={[-0.13, 0.06, 0.04]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.22]} />
        <meshStandardMaterial color={palette.shoes} roughness={0.7} />
      </mesh>
      <mesh position={[0.13, 0.06, 0.04]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.22]} />
        <meshStandardMaterial color={palette.shoes} roughness={0.7} />
      </mesh>

      {/* Ground shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>

      {data?.dialogue && (
        <SpeechBubble
          name={data.name}
          dialogue={data.dialogue}
          beatKey={beatKey}
        />
      )}
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
  const beatKey = String(stageState?.beatNumber ?? 0);

  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 2.2, 7.5], fov: 48 }}>
        <color attach="background" args={[background(scenario, tension)]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <Environment preset="city" />

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial
            color={scenario === "classroom_flood" ? "#2a4d69" : "#1a1a1a"}
          />
        </mesh>

        {scenario === "classroom_flood" && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.49 + tension * 0.015, 0]}
          >
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#1e6091" transparent opacity={0.5} />
          </mesh>
        )}

        <ContactShadows
          position={[0, -0.48, 0]}
          opacity={0.35}
          scale={14}
          blur={2.8}
          far={4}
        />

        <Humanoid
          position={[-1.5, 0, 0]}
          palette={PALETTES[0]}
          data={chars[0]}
          beatKey={`${beatKey}-0`}
        />
        <Humanoid
          position={[1.5, 0, 0]}
          palette={PALETTES[1]}
          data={chars[1]}
          beatKey={`${beatKey}-1`}
        />

        <OrbitControls enablePan={false} minDistance={4.5} maxDistance={14} />
      </Canvas>
    </div>
  );
}
