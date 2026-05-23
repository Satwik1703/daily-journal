"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { MuscleGroup } from "@/lib/muscle-groups";
import { HumanoidMesh } from "./HumanoidMesh";

export type Body3DProps = {
  fillFor: (m: MuscleGroup) => string;
  onMuscleClick?: (m: MuscleGroup) => void;
  height?: number;
  spin?: boolean;
};

/**
 * Stylized low-poly 3D body. Each muscle group is one or more meshes whose
 * color comes from `fillFor`. P10 will swap HumanoidMesh for a Z-Anatomy GLB
 * with the same fillFor API — caller code stays unchanged.
 */
export default function Body3D({
  fillFor,
  onMuscleClick,
  height = 360,
  spin = true,
}: Body3DProps) {
  return (
    <div className="w-full" style={{ height }}>
      <Canvas
        shadows
        camera={{ position: [0, 0.6, 3.4], fov: 38 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0f1419"]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[2, 4, 3]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-3, 2, -2]} intensity={0.3} />
        <HumanoidMesh fillFor={fillFor} onMuscleClick={onMuscleClick} spin={spin} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  );
}
