"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { MuscleGroup } from "@/lib/muscle-groups";

type Props = {
  fillFor: (m: MuscleGroup) => string;
  onMuscleClick?: (m: MuscleGroup) => void;
  spin?: boolean;
};

// Warm skin tone for non-muscle surfaces (neck, head, hands, feet).
const SKIN = "#c79a82";

// Smoother sphere/capsule segments — bigger perf hit but ~17 primitives total
// so still fine on mobile.
const SPHERE_SEG = 32;
const CAPSULE_SEG = 18;

export function HumanoidMesh({ fillFor, onMuscleClick, spin = true }: Props) {
  const root = useRef<Group>(null);

  useFrame((_, dt) => {
    if (!spin || !root.current) return;
    root.current.rotation.y += dt * 0.25;
  });

  const handleClick =
    (m: MuscleGroup) => (e: { stopPropagation: () => void }) => {
      if (!onMuscleClick) return;
      e.stopPropagation();
      onMuscleClick(m);
    };

  return (
    <group ref={root} position={[0, -0.4, 0]}>
      {/* ---------- Head & neck ---------- */}
      <mesh position={[0, 1.78, 0]} castShadow>
        <sphereGeometry args={[0.2, SPHERE_SEG, SPHERE_SEG]} />
        <meshStandardMaterial color={SKIN} roughness={0.55} />
      </mesh>
      {/* Jaw shadow */}
      <mesh position={[0, 1.65, 0.04]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#a87c69" roughness={0.7} />
      </mesh>
      {/* Neck (sternocleidomastoid implied) */}
      <mesh position={[0, 1.48, 0]}>
        <capsuleGeometry args={[0.075, 0.1, 6, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.65} />
      </mesh>

      {/* ---------- Torso "skin" base ---------- */}
      {/* Ribcage taper: wider at top, narrower waist */}
      <mesh position={[0, 1.13, -0.04]}>
        <boxGeometry args={[0.54, 0.46, 0.26]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* Waist */}
      <mesh position={[0, 0.78, -0.04]}>
        <boxGeometry args={[0.42, 0.18, 0.22]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* Sternum groove */}
      <mesh position={[0, 1.18, 0.13]}>
        <boxGeometry args={[0.04, 0.32, 0.02]} />
        <meshStandardMaterial color="#a87060" roughness={0.8} />
      </mesh>
      {/* Collarbones */}
      <mesh position={[-0.13, 1.36, 0.1]} rotation={[0, 0, 0.25]}>
        <capsuleGeometry args={[0.022, 0.18, 4, 10]} />
        <meshStandardMaterial color="#d9b09a" roughness={0.6} />
      </mesh>
      <mesh position={[0.13, 1.36, 0.1]} rotation={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.022, 0.18, 4, 10]} />
        <meshStandardMaterial color="#d9b09a" roughness={0.6} />
      </mesh>

      {/* ---------- Chest (pectoralis major: 2 sculpted slabs) ---------- */}
      <group onClick={handleClick("chest")}>
        <PecMass muscle="chest" pos={[-0.13, 1.21, 0.16]} fillFor={fillFor} />
        <PecMass muscle="chest" pos={[0.13, 1.21, 0.16]} fillFor={fillFor} />
      </group>

      {/* ---------- Abs (rectus abdominis - segmented 6-pack) ---------- */}
      <group onClick={handleClick("abs")}>
        {/* 3 rows of 2 cubes for the segmented look */}
        <AbsCell muscle="abs" pos={[-0.06, 1.0, 0.17]} fillFor={fillFor} />
        <AbsCell muscle="abs" pos={[0.06, 1.0, 0.17]} fillFor={fillFor} />
        <AbsCell muscle="abs" pos={[-0.06, 0.91, 0.17]} fillFor={fillFor} />
        <AbsCell muscle="abs" pos={[0.06, 0.91, 0.17]} fillFor={fillFor} />
        <AbsCell muscle="abs" pos={[-0.06, 0.82, 0.17]} fillFor={fillFor} />
        <AbsCell muscle="abs" pos={[0.06, 0.82, 0.17]} fillFor={fillFor} />
        {/* Transversus base */}
        <mesh position={[0, 0.7, 0.16]}>
          <boxGeometry args={[0.22, 0.12, 0.05]} />
          <meshStandardMaterial color={fillFor("abs")} roughness={0.6} />
        </mesh>
      </group>

      {/* ---------- Obliques (angled side slabs) ---------- */}
      <group onClick={handleClick("obliques")}>
        <mesh position={[-0.19, 0.92, 0.1]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.06, 0.32, 0.16]} />
          <meshStandardMaterial color={fillFor("obliques")} roughness={0.55} />
        </mesh>
        <mesh position={[0.19, 0.92, 0.1]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.06, 0.32, 0.16]} />
          <meshStandardMaterial color={fillFor("obliques")} roughness={0.55} />
        </mesh>
      </group>

      {/* ---------- Traps (yoke from neck to delts) ---------- */}
      <group onClick={handleClick("traps")}>
        <mesh position={[0, 1.42, -0.06]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.34, 0.14, 0.14]} />
          <meshStandardMaterial color={fillFor("traps")} roughness={0.55} />
        </mesh>
        {/* Mid-traps panel */}
        <mesh position={[0, 1.25, -0.16]}>
          <boxGeometry args={[0.38, 0.18, 0.05]} />
          <meshStandardMaterial color={fillFor("traps")} roughness={0.6} />
        </mesh>
      </group>

      {/* ---------- Upper back (rhomboids + infraspinatus) ---------- */}
      <group onClick={handleClick("upper_back")}>
        <mesh position={[-0.1, 1.1, -0.16]}>
          <boxGeometry args={[0.18, 0.2, 0.06]} />
          <meshStandardMaterial color={fillFor("upper_back")} roughness={0.6} />
        </mesh>
        <mesh position={[0.1, 1.1, -0.16]}>
          <boxGeometry args={[0.18, 0.2, 0.06]} />
          <meshStandardMaterial color={fillFor("upper_back")} roughness={0.6} />
        </mesh>
      </group>

      {/* ---------- Lats (V-taper: wide top, narrow at waist) ---------- */}
      <group onClick={handleClick("lats")}>
        <mesh position={[-0.22, 0.95, -0.1]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[0.1, 0.34, 0.16]} />
          <meshStandardMaterial color={fillFor("lats")} roughness={0.55} />
        </mesh>
        <mesh position={[0.22, 0.95, -0.1]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[0.1, 0.34, 0.16]} />
          <meshStandardMaterial color={fillFor("lats")} roughness={0.55} />
        </mesh>
      </group>

      {/* ---------- Lower back (erector spinae columns) ---------- */}
      <group onClick={handleClick("lower_back")}>
        <mesh position={[-0.05, 0.74, -0.14]}>
          <capsuleGeometry args={[0.04, 0.12, 4, 12]} />
          <meshStandardMaterial color={fillFor("lower_back")} roughness={0.6} />
        </mesh>
        <mesh position={[0.05, 0.74, -0.14]}>
          <capsuleGeometry args={[0.04, 0.12, 4, 12]} />
          <meshStandardMaterial color={fillFor("lower_back")} roughness={0.6} />
        </mesh>
      </group>

      {/* ---------- Deltoids (3 heads each shoulder) ---------- */}
      <group onClick={handleClick("front_delts")}>
        <DeltHead muscle="front_delts" pos={[-0.3, 1.32, 0.08]} fillFor={fillFor} />
        <DeltHead muscle="front_delts" pos={[0.3, 1.32, 0.08]} fillFor={fillFor} />
      </group>
      <group onClick={handleClick("side_delts")}>
        <DeltHead muscle="side_delts" pos={[-0.36, 1.3, 0]} fillFor={fillFor} />
        <DeltHead muscle="side_delts" pos={[0.36, 1.3, 0]} fillFor={fillFor} />
      </group>
      <group onClick={handleClick("rear_delts")}>
        <DeltHead muscle="rear_delts" pos={[-0.3, 1.32, -0.1]} fillFor={fillFor} />
        <DeltHead muscle="rear_delts" pos={[0.3, 1.32, -0.1]} fillFor={fillFor} />
      </group>

      {/* ---------- Biceps (capsule + peak bulge) ---------- */}
      <group onClick={handleClick("biceps")}>
        <ArmCapsule muscle="biceps" side={-1} z={0.05} fillFor={fillFor} />
        <ArmCapsule muscle="biceps" side={1} z={0.05} fillFor={fillFor} />
        {/* Peak bulges */}
        <mesh position={[-0.4, 1.12, 0.07]}>
          <sphereGeometry args={[0.058, 18, 18]} />
          <meshStandardMaterial color={fillFor("biceps")} roughness={0.5} />
        </mesh>
        <mesh position={[0.4, 1.12, 0.07]}>
          <sphereGeometry args={[0.058, 18, 18]} />
          <meshStandardMaterial color={fillFor("biceps")} roughness={0.5} />
        </mesh>
      </group>

      {/* ---------- Triceps (lateral + long head split) ---------- */}
      <group onClick={handleClick("triceps")}>
        <ArmCapsule muscle="triceps" side={-1} z={-0.05} fillFor={fillFor} />
        <ArmCapsule muscle="triceps" side={1} z={-0.05} fillFor={fillFor} />
        {/* Lateral head bumps */}
        <mesh position={[-0.43, 1.05, -0.04]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color={fillFor("triceps")} roughness={0.55} />
        </mesh>
        <mesh position={[0.43, 1.05, -0.04]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color={fillFor("triceps")} roughness={0.55} />
        </mesh>
      </group>

      {/* ---------- Forearms (tapered, brachioradialis bump) ---------- */}
      <group onClick={handleClick("forearms")}>
        <mesh position={[-0.42, 0.78, 0]} rotation={[0, 0, -0.05]}>
          <capsuleGeometry args={[0.055, 0.24, 6, CAPSULE_SEG]} />
          <meshStandardMaterial color={fillFor("forearms")} roughness={0.55} />
        </mesh>
        <mesh position={[0.42, 0.78, 0]} rotation={[0, 0, 0.05]}>
          <capsuleGeometry args={[0.055, 0.24, 6, CAPSULE_SEG]} />
          <meshStandardMaterial color={fillFor("forearms")} roughness={0.55} />
        </mesh>
        {/* Brachioradialis bulge near elbow */}
        <mesh position={[-0.41, 0.89, 0.04]}>
          <sphereGeometry args={[0.04, 14, 14]} />
          <meshStandardMaterial color={fillFor("forearms")} roughness={0.55} />
        </mesh>
        <mesh position={[0.41, 0.89, 0.04]}>
          <sphereGeometry args={[0.04, 14, 14]} />
          <meshStandardMaterial color={fillFor("forearms")} roughness={0.55} />
        </mesh>
      </group>

      {/* Hands */}
      <mesh position={[-0.43, 0.55, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.05]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0.43, 0.55, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.05]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>

      {/* ---------- Pelvis / hips ---------- */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.46, 0.18, 0.24]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>

      {/* ---------- Glutes (rounded hemispheres) ---------- */}
      <group onClick={handleClick("glutes")}>
        <mesh position={[-0.12, 0.52, -0.13]}>
          <sphereGeometry args={[0.13, 22, 22]} />
          <meshStandardMaterial color={fillFor("glutes")} roughness={0.55} />
        </mesh>
        <mesh position={[0.12, 0.52, -0.13]}>
          <sphereGeometry args={[0.13, 22, 22]} />
          <meshStandardMaterial color={fillFor("glutes")} roughness={0.55} />
        </mesh>
      </group>

      {/* ---------- Quads (rectus femoris + vastus lat + vastus med per leg) ---------- */}
      <group onClick={handleClick("quads")}>
        {/* Left leg */}
        <mesh position={[-0.13, 0.28, 0.07]}>
          <capsuleGeometry args={[0.08, 0.32, 6, CAPSULE_SEG]} />
          <meshStandardMaterial color={fillFor("quads")} roughness={0.55} />
        </mesh>
        <mesh position={[-0.18, 0.28, 0.04]}>
          <capsuleGeometry args={[0.058, 0.3, 5, 14]} />
          <meshStandardMaterial color={fillFor("quads")} roughness={0.6} />
        </mesh>
        <mesh position={[-0.08, 0.18, 0.06]}>
          <capsuleGeometry args={[0.05, 0.18, 5, 14]} />
          <meshStandardMaterial color={fillFor("quads")} roughness={0.6} />
        </mesh>
        {/* Right leg */}
        <mesh position={[0.13, 0.28, 0.07]}>
          <capsuleGeometry args={[0.08, 0.32, 6, CAPSULE_SEG]} />
          <meshStandardMaterial color={fillFor("quads")} roughness={0.55} />
        </mesh>
        <mesh position={[0.18, 0.28, 0.04]}>
          <capsuleGeometry args={[0.058, 0.3, 5, 14]} />
          <meshStandardMaterial color={fillFor("quads")} roughness={0.6} />
        </mesh>
        <mesh position={[0.08, 0.18, 0.06]}>
          <capsuleGeometry args={[0.05, 0.18, 5, 14]} />
          <meshStandardMaterial color={fillFor("quads")} roughness={0.6} />
        </mesh>
      </group>

      {/* ---------- Hamstrings (biceps femoris + semi each leg) ---------- */}
      <group onClick={handleClick("hamstrings")}>
        <mesh position={[-0.16, 0.28, -0.07]}>
          <capsuleGeometry args={[0.062, 0.3, 5, 14]} />
          <meshStandardMaterial color={fillFor("hamstrings")} roughness={0.55} />
        </mesh>
        <mesh position={[-0.1, 0.28, -0.07]}>
          <capsuleGeometry args={[0.062, 0.3, 5, 14]} />
          <meshStandardMaterial color={fillFor("hamstrings")} roughness={0.55} />
        </mesh>
        <mesh position={[0.16, 0.28, -0.07]}>
          <capsuleGeometry args={[0.062, 0.3, 5, 14]} />
          <meshStandardMaterial color={fillFor("hamstrings")} roughness={0.55} />
        </mesh>
        <mesh position={[0.1, 0.28, -0.07]}>
          <capsuleGeometry args={[0.062, 0.3, 5, 14]} />
          <meshStandardMaterial color={fillFor("hamstrings")} roughness={0.55} />
        </mesh>
      </group>

      {/* ---------- Calves (gastroc medial + lateral heads + soleus base) ---------- */}
      <group onClick={handleClick("calves")}>
        <mesh position={[-0.16, -0.12, -0.02]}>
          <sphereGeometry args={[0.07, 18, 18]} />
          <meshStandardMaterial color={fillFor("calves")} roughness={0.55} />
        </mesh>
        <mesh position={[-0.1, -0.12, -0.02]}>
          <sphereGeometry args={[0.07, 18, 18]} />
          <meshStandardMaterial color={fillFor("calves")} roughness={0.55} />
        </mesh>
        <mesh position={[-0.13, -0.26, -0.02]}>
          <capsuleGeometry args={[0.052, 0.18, 5, 14]} />
          <meshStandardMaterial color={fillFor("calves")} roughness={0.6} />
        </mesh>
        <mesh position={[0.16, -0.12, -0.02]}>
          <sphereGeometry args={[0.07, 18, 18]} />
          <meshStandardMaterial color={fillFor("calves")} roughness={0.55} />
        </mesh>
        <mesh position={[0.1, -0.12, -0.02]}>
          <sphereGeometry args={[0.07, 18, 18]} />
          <meshStandardMaterial color={fillFor("calves")} roughness={0.55} />
        </mesh>
        <mesh position={[0.13, -0.26, -0.02]}>
          <capsuleGeometry args={[0.052, 0.18, 5, 14]} />
          <meshStandardMaterial color={fillFor("calves")} roughness={0.6} />
        </mesh>
      </group>

      {/* ---------- Lower-leg skin (shin) ---------- */}
      <mesh position={[-0.13, -0.18, 0.05]}>
        <capsuleGeometry args={[0.058, 0.32, 5, 14]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0.13, -0.18, 0.05]}>
        <capsuleGeometry args={[0.058, 0.32, 5, 14]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>

      {/* Feet */}
      <mesh position={[-0.13, -0.46, 0.06]}>
        <boxGeometry args={[0.12, 0.06, 0.22]} />
        <meshStandardMaterial color="#8a5a48" roughness={0.85} />
      </mesh>
      <mesh position={[0.13, -0.46, 0.06]}>
        <boxGeometry args={[0.12, 0.06, 0.22]} />
        <meshStandardMaterial color="#8a5a48" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---------- Reusable muscle primitives ----------

function PecMass({
  muscle,
  pos,
  fillFor,
}: {
  muscle: MuscleGroup;
  pos: [number, number, number];
  fillFor: (m: MuscleGroup) => string;
}) {
  return (
    <group position={pos}>
      {/* Main slab */}
      <mesh>
        <sphereGeometry args={[0.13, SPHERE_SEG, SPHERE_SEG]} />
        <meshStandardMaterial color={fillFor(muscle)} roughness={0.5} />
      </mesh>
      {/* Inner taper to sternum */}
      <mesh position={[0, -0.04, 0]} scale={[0.85, 0.65, 0.8]}>
        <sphereGeometry args={[0.12, 18, 18]} />
        <meshStandardMaterial color={fillFor(muscle)} roughness={0.55} />
      </mesh>
    </group>
  );
}

function AbsCell({
  muscle,
  pos,
  fillFor,
}: {
  muscle: MuscleGroup;
  pos: [number, number, number];
  fillFor: (m: MuscleGroup) => string;
}) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.058, 18, 18]} />
      <meshStandardMaterial color={fillFor(muscle)} roughness={0.5} />
    </mesh>
  );
}

function DeltHead({
  muscle,
  pos,
  fillFor,
}: {
  muscle: MuscleGroup;
  pos: [number, number, number];
  fillFor: (m: MuscleGroup) => string;
}) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.095, 22, 22]} />
      <meshStandardMaterial color={fillFor(muscle)} roughness={0.5} />
    </mesh>
  );
}

function ArmCapsule({
  muscle,
  side,
  z,
  fillFor,
}: {
  muscle: MuscleGroup;
  side: -1 | 1;
  z: number;
  fillFor: (m: MuscleGroup) => string;
}) {
  return (
    <mesh position={[side * 0.4, 1.08, z]}>
      <capsuleGeometry args={[0.065, 0.24, 6, CAPSULE_SEG]} />
      <meshStandardMaterial color={fillFor(muscle)} roughness={0.55} />
    </mesh>
  );
}
