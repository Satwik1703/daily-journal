"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { MuscleGroup } from "@/lib/muscle-groups";

type Props = {
  fillFor: (m: MuscleGroup) => string;
  onMuscleClick?: (m: MuscleGroup) => void;
  spin?: boolean;
};

// Stylized low-poly humanoid built from primitives. All units in meters.
// The whole figure stands ~2.4 units tall, centered on the origin.
export function HumanoidMesh({ fillFor, onMuscleClick, spin = true }: Props) {
  const root = useRef<Group>(null);

  useFrame((_, dt) => {
    if (!spin || !root.current) return;
    root.current.rotation.y += dt * 0.25;
  });

  const handleClick = (m: MuscleGroup) => (e: { stopPropagation: () => void }) => {
    if (!onMuscleClick) return;
    e.stopPropagation();
    onMuscleClick(m);
  };

  // Skin (non-muscle background)
  const skinColor = "#3a3f47";

  return (
    <group ref={root} position={[0, -0.2, 0]}>
      {/* Head */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.36, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.08, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>

      {/* Torso back (skin layer) */}
      <mesh position={[0, 0.95, -0.05]}>
        <boxGeometry args={[0.5, 0.66, 0.22]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>

      {/* Chest (front) */}
      <group position={[0, 1.15, 0.12]} onClick={handleClick("chest")}>
        <Slab muscle="chest" pos={[-0.13, 0, 0]} size={[0.22, 0.22, 0.08]} fillFor={fillFor} />
        <Slab muscle="chest" pos={[0.13, 0, 0]} size={[0.22, 0.22, 0.08]} fillFor={fillFor} />
      </group>

      {/* Abs */}
      <group position={[0, 0.85, 0.13]} onClick={handleClick("abs")}>
        <Slab muscle="abs" pos={[0, 0, 0]} size={[0.22, 0.32, 0.07]} fillFor={fillFor} />
      </group>

      {/* Obliques */}
      <group position={[0, 0.85, 0.05]} onClick={handleClick("obliques")}>
        <Slab muscle="obliques" pos={[-0.2, 0, 0]} size={[0.08, 0.32, 0.16]} fillFor={fillFor} />
        <Slab muscle="obliques" pos={[0.2, 0, 0]} size={[0.08, 0.32, 0.16]} fillFor={fillFor} />
      </group>

      {/* Traps (top of torso, both sides of neck) */}
      <group position={[0, 1.3, -0.05]} onClick={handleClick("traps")}>
        <Slab muscle="traps" pos={[-0.12, 0, 0]} size={[0.16, 0.1, 0.18]} fillFor={fillFor} />
        <Slab muscle="traps" pos={[0.12, 0, 0]} size={[0.16, 0.1, 0.18]} fillFor={fillFor} />
      </group>

      {/* Upper back */}
      <group position={[0, 1.1, -0.13]} onClick={handleClick("upper_back")}>
        <Slab muscle="upper_back" pos={[0, 0, 0]} size={[0.4, 0.2, 0.06]} fillFor={fillFor} />
      </group>

      {/* Lats (wider, lower) */}
      <group position={[0, 0.9, -0.13]} onClick={handleClick("lats")}>
        <Slab muscle="lats" pos={[-0.18, 0, 0]} size={[0.12, 0.26, 0.08]} fillFor={fillFor} />
        <Slab muscle="lats" pos={[0.18, 0, 0]} size={[0.12, 0.26, 0.08]} fillFor={fillFor} />
      </group>

      {/* Lower back */}
      <group position={[0, 0.68, -0.13]} onClick={handleClick("lower_back")}>
        <Slab muscle="lower_back" pos={[0, 0, 0]} size={[0.28, 0.16, 0.06]} fillFor={fillFor} />
      </group>

      {/* Front delts */}
      <group position={[0, 1.25, 0.06]} onClick={handleClick("front_delts")}>
        <Sphere muscle="front_delts" pos={[-0.28, 0, 0]} r={0.1} fillFor={fillFor} />
        <Sphere muscle="front_delts" pos={[0.28, 0, 0]} r={0.1} fillFor={fillFor} />
      </group>
      {/* Side delts (lateral) */}
      <group position={[0, 1.22, 0]} onClick={handleClick("side_delts")}>
        <Sphere muscle="side_delts" pos={[-0.34, 0, 0]} r={0.09} fillFor={fillFor} />
        <Sphere muscle="side_delts" pos={[0.34, 0, 0]} r={0.09} fillFor={fillFor} />
      </group>
      {/* Rear delts */}
      <group position={[0, 1.25, -0.08]} onClick={handleClick("rear_delts")}>
        <Sphere muscle="rear_delts" pos={[-0.28, 0, 0]} r={0.09} fillFor={fillFor} />
        <Sphere muscle="rear_delts" pos={[0.28, 0, 0]} r={0.09} fillFor={fillFor} />
      </group>

      {/* Biceps (front of upper arm) */}
      <group position={[0, 1.0, 0.04]} onClick={handleClick("biceps")}>
        <Capsule muscle="biceps" pos={[-0.38, 0, 0]} r={0.06} length={0.22} fillFor={fillFor} />
        <Capsule muscle="biceps" pos={[0.38, 0, 0]} r={0.06} length={0.22} fillFor={fillFor} />
      </group>
      {/* Triceps (back of upper arm) */}
      <group position={[0, 1.0, -0.04]} onClick={handleClick("triceps")}>
        <Capsule muscle="triceps" pos={[-0.38, 0, 0]} r={0.06} length={0.22} fillFor={fillFor} />
        <Capsule muscle="triceps" pos={[0.38, 0, 0]} r={0.06} length={0.22} fillFor={fillFor} />
      </group>

      {/* Forearms */}
      <group position={[0, 0.7, 0]} onClick={handleClick("forearms")}>
        <Capsule muscle="forearms" pos={[-0.4, 0, 0]} r={0.055} length={0.22} fillFor={fillFor} />
        <Capsule muscle="forearms" pos={[0.4, 0, 0]} r={0.055} length={0.22} fillFor={fillFor} />
      </group>

      {/* Hips / pelvis (skin) */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.22]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>

      {/* Glutes (back of pelvis) */}
      <group position={[0, 0.5, -0.1]} onClick={handleClick("glutes")}>
        <Slab muscle="glutes" pos={[-0.12, 0, 0]} size={[0.18, 0.18, 0.08]} fillFor={fillFor} />
        <Slab muscle="glutes" pos={[0.12, 0, 0]} size={[0.18, 0.18, 0.08]} fillFor={fillFor} />
      </group>

      {/* Quads (front of thigh) */}
      <group position={[0, 0.22, 0.05]} onClick={handleClick("quads")}>
        <Capsule muscle="quads" pos={[-0.13, 0, 0]} r={0.085} length={0.32} fillFor={fillFor} />
        <Capsule muscle="quads" pos={[0.13, 0, 0]} r={0.085} length={0.32} fillFor={fillFor} />
      </group>
      {/* Hamstrings (back of thigh) */}
      <group position={[0, 0.22, -0.05]} onClick={handleClick("hamstrings")}>
        <Capsule muscle="hamstrings" pos={[-0.13, 0, 0]} r={0.075} length={0.32} fillFor={fillFor} />
        <Capsule muscle="hamstrings" pos={[0.13, 0, 0]} r={0.075} length={0.32} fillFor={fillFor} />
      </group>

      {/* Calves */}
      <group position={[0, -0.2, -0.02]} onClick={handleClick("calves")}>
        <Capsule muscle="calves" pos={[-0.13, 0, 0]} r={0.065} length={0.26} fillFor={fillFor} />
        <Capsule muscle="calves" pos={[0.13, 0, 0]} r={0.065} length={0.26} fillFor={fillFor} />
      </group>

      {/* Feet */}
      <mesh position={[-0.13, -0.42, 0.05]}>
        <boxGeometry args={[0.1, 0.06, 0.18]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>
      <mesh position={[0.13, -0.42, 0.05]}>
        <boxGeometry args={[0.1, 0.06, 0.18]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Slab({
  muscle,
  pos,
  size,
  fillFor,
}: {
  muscle: MuscleGroup;
  pos: [number, number, number];
  size: [number, number, number];
  fillFor: (m: MuscleGroup) => string;
}) {
  const ref = useRef<Mesh>(null);
  return (
    <mesh ref={ref} position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={fillFor(muscle)} roughness={0.5} />
    </mesh>
  );
}

function Sphere({
  muscle,
  pos,
  r,
  fillFor,
}: {
  muscle: MuscleGroup;
  pos: [number, number, number];
  r: number;
  fillFor: (m: MuscleGroup) => string;
}) {
  return (
    <mesh position={pos} castShadow>
      <sphereGeometry args={[r, 18, 18]} />
      <meshStandardMaterial color={fillFor(muscle)} roughness={0.55} />
    </mesh>
  );
}

function Capsule({
  muscle,
  pos,
  r,
  length,
  fillFor,
}: {
  muscle: MuscleGroup;
  pos: [number, number, number];
  r: number;
  length: number;
  fillFor: (m: MuscleGroup) => string;
}) {
  return (
    <mesh position={pos} castShadow>
      <capsuleGeometry args={[r, length, 6, 12]} />
      <meshStandardMaterial color={fillFor(muscle)} roughness={0.55} />
    </mesh>
  );
}
