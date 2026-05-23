"use client";

import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { MuscleGroup } from "@/lib/muscle-groups";
import { HumanoidMesh } from "./HumanoidMesh";
import { ZAnatomyMesh } from "./ZAnatomyMesh";
import { LoadingMesh } from "./LoadingMesh";

export type Body3DProps = {
  fillFor: (m: MuscleGroup) => string;
  onMuscleClick?: (m: MuscleGroup) => void;
  height?: number;
  spin?: boolean;
  /** Default tries Z-Anatomy GLB first, silently falls back to "lowpoly". */
  variant?: "lowpoly" | "zanatomy";
};

/**
 * Stylized 3D body. Two variants:
 *   - "zanatomy": loads /models/zanatomy-muscles.glb (real anatomy meshes).
 *     Suspends while fetching, error-boundary swaps to "lowpoly" on failure
 *     (missing file, decode error, etc).
 *   - "lowpoly": primitive humanoid built from capsules/spheres/boxes (no fetch).
 *
 * Both expose the same MuscleGroup-keyed coloring API via `fillFor`.
 */
export default function Body3D({
  fillFor,
  onMuscleClick,
  height = 360,
  spin = true,
  variant = "zanatomy",
}: Body3DProps) {
  const useZAnatomy = variant === "zanatomy";

  return (
    <div className="w-full" style={{ height }}>
      <Canvas
        shadows
        camera={{ position: [0, 0.7, useZAnatomy ? 4.2 : 3.6], fov: 38 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0f1419"]} />
        {/* Soft fill — keeps shadows readable but not muddy */}
        <ambientLight intensity={0.35} />
        {/* Warm sky / cool ground hemisphere for organic skin shading */}
        <hemisphereLight
          color="#f7e2cf"
          groundColor="#1a1f2a"
          intensity={0.55}
        />
        {/* Key light: top-front-right, warm, casts shadow */}
        <directionalLight
          position={[2.5, 4, 3]}
          intensity={1.15}
          color="#fff1e0"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        {/* Fill: opposite side, cool, lower intensity */}
        <directionalLight position={[-3, 2, -1]} intensity={0.35} color="#dde8ff" />
        {/* Rim from behind — defines muscle silhouettes */}
        <directionalLight position={[0, 1.5, -4]} intensity={0.7} color="#ffd7b8" />

        {useZAnatomy ? (
          <FallbackBoundary
            fallback={
              <HumanoidMesh
                fillFor={fillFor}
                onMuscleClick={onMuscleClick}
                spin={spin}
              />
            }
          >
            <Suspense fallback={<LoadingMesh />}>
              <ZAnatomyMesh
                fillFor={fillFor}
                onMuscleClick={onMuscleClick}
                spin={spin}
              />
            </Suspense>
          </FallbackBoundary>
        ) : (
          <HumanoidMesh fillFor={fillFor} onMuscleClick={onMuscleClick} spin={spin} />
        )}

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

/**
 * React error boundary that swaps in the lowpoly fallback if the Z-Anatomy
 * GLB fails to load (missing file, decode error, etc). Logged once.
 */
class FallbackBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[Body3D] Z-Anatomy load failed, using low-poly fallback:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
