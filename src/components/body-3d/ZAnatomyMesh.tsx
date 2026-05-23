"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import type { MuscleGroup } from "@/lib/muscle-groups";
import {
  Z_ANATOMY_GLB_PATH,
  resolveMuscleFor,
} from "@/lib/z-anatomy-mapping";

const SKIN_COLOR = "#e6c9b8";

type Props = {
  fillFor: (m: MuscleGroup) => string;
  onMuscleClick?: (m: MuscleGroup) => void;
  spin?: boolean;
};

/**
 * Loads /models/zanatomy-muscles.glb and recolors meshes that match the
 * Z-Anatomy naming mapping. Suspends until the GLB resolves; failures bubble
 * up to the parent Suspense boundary in Body3D which falls back to low-poly.
 *
 * IMPORTANT: each mesh's material is CLONED on load so coloring per-instance
 * doesn't mutate the shared GLTF material. Subsequent color changes are
 * cheap (just material.color.set).
 */
export function ZAnatomyMesh({ fillFor, onMuscleClick, spin = true }: Props) {
  const gltf = useGLTF(Z_ANATOMY_GLB_PATH);
  const root = useRef<Group>(null);

  // Walk the scene graph once, clone materials, attach muscle group userData.
  const meshGroups = useMemo(() => {
    const groups = new Map<MuscleGroup | "skin", Mesh[]>();
    gltf.scene.traverse((obj: Object3D) => {
      if (!(obj as Mesh).isMesh) return;
      const mesh = obj as Mesh;
      const muscle = resolveMuscleFor(mesh.name);
      const tag: MuscleGroup | "skin" = muscle ?? "skin";

      // Clone material so this instance is independently colorable.
      const baseMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const clone = (baseMat as MeshStandardMaterial).clone();
      clone.color = new Color(muscle ? fillFor(muscle) : SKIN_COLOR);
      clone.roughness = 0.65;
      clone.metalness = 0.05;
      mesh.material = clone;

      mesh.userData.muscle = muscle ?? null;
      const arr = groups.get(tag) ?? [];
      arr.push(mesh);
      groups.set(tag, arr);
    });
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene]);

  // Whenever fillFor changes (mode toggle, new sets logged), recolor in place.
  useEffect(() => {
    for (const [tag, meshes] of meshGroups) {
      if (tag === "skin") continue;
      const color = fillFor(tag as MuscleGroup);
      for (const m of meshes) {
        const mat = m.material as MeshStandardMaterial;
        mat.color.set(color);
      }
    }
  }, [fillFor, meshGroups]);

  useFrame((_, dt) => {
    if (!spin || !root.current) return;
    root.current.rotation.y += dt * 0.2;
  });

  function handleClick(e: { stopPropagation: () => void; object: Object3D }) {
    if (!onMuscleClick) return;
    e.stopPropagation();
    let cur: Object3D | null = e.object;
    while (cur) {
      const muscle = cur.userData?.muscle as MuscleGroup | undefined | null;
      if (muscle) {
        onMuscleClick(muscle);
        return;
      }
      cur = cur.parent;
    }
  }

  return (
    <group ref={root} onClick={handleClick}>
      <primitive object={gltf.scene} />
    </group>
  );
}

useGLTF.preload(Z_ANATOMY_GLB_PATH);
