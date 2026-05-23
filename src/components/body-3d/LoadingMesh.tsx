"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export function LoadingMesh() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.8;
    ref.current.rotation.x += dt * 0.5;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 12, 12]} />
      <meshStandardMaterial wireframe color="#888" />
    </mesh>
  );
}
