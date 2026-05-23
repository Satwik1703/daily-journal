import type { MuscleGroup } from "./muscle-groups";

/**
 * Mesh-name → MuscleGroup mapping for the Z-Anatomy GLB (or any GLB drop-in
 * replacement). The Z-Anatomy `.blend` uses Latin-anatomy mesh names; we map
 * each to our 17-group enum. Many meshes share a group (chest = pec major +
 * pec minor parts).
 *
 * Lookup is case-insensitive substring match — see resolveMuscleFor().
 * Unknown meshes get a neutral "skin" material.
 *
 * If your GLB uses different names, inspect the scene graph in browser
 * devtools (the Body3D component logs unmatched mesh names in dev) and add
 * entries here. Order matters: more-specific entries should come first.
 */
export const Z_ANATOMY_MAPPING: { pattern: string; muscle: MuscleGroup }[] = [
  // Chest
  { pattern: "pectoralis", muscle: "chest" },
  { pattern: "pec_major", muscle: "chest" },
  { pattern: "pec_minor", muscle: "chest" },

  // Back
  { pattern: "trapezius", muscle: "traps" },
  { pattern: "latissimus", muscle: "lats" },
  { pattern: "rhomboid", muscle: "upper_back" },
  { pattern: "infraspinatus", muscle: "upper_back" },
  { pattern: "teres_major", muscle: "upper_back" },
  { pattern: "teres_minor", muscle: "upper_back" },
  { pattern: "erector_spinae", muscle: "lower_back" },
  { pattern: "quadratus_lumborum", muscle: "lower_back" },

  // Shoulders (delts)
  { pattern: "deltoid_anterior", muscle: "front_delts" },
  { pattern: "deltoid_clavicular", muscle: "front_delts" },
  { pattern: "deltoid_lateral", muscle: "side_delts" },
  { pattern: "deltoid_acromial", muscle: "side_delts" },
  { pattern: "deltoid_posterior", muscle: "rear_delts" },
  { pattern: "deltoid_spinal", muscle: "rear_delts" },
  { pattern: "deltoid", muscle: "side_delts" }, // catch-all if not pre-split

  // Arms
  { pattern: "biceps_brachii", muscle: "biceps" },
  { pattern: "brachialis", muscle: "biceps" },
  { pattern: "triceps_brachii", muscle: "triceps" },
  { pattern: "triceps", muscle: "triceps" },
  { pattern: "biceps", muscle: "biceps" },
  { pattern: "brachioradialis", muscle: "forearms" },
  { pattern: "flexor_carpi", muscle: "forearms" },
  { pattern: "extensor_carpi", muscle: "forearms" },
  { pattern: "pronator", muscle: "forearms" },
  { pattern: "supinator", muscle: "forearms" },

  // Core
  { pattern: "rectus_abdominis", muscle: "abs" },
  { pattern: "transversus_abdominis", muscle: "abs" },
  { pattern: "obliquus_externus", muscle: "obliques" },
  { pattern: "obliquus_internus", muscle: "obliques" },
  { pattern: "external_oblique", muscle: "obliques" },
  { pattern: "internal_oblique", muscle: "obliques" },

  // Lower body
  { pattern: "gluteus_maximus", muscle: "glutes" },
  { pattern: "gluteus_medius", muscle: "glutes" },
  { pattern: "gluteus_minimus", muscle: "glutes" },
  { pattern: "rectus_femoris", muscle: "quads" },
  { pattern: "vastus", muscle: "quads" },
  { pattern: "quadriceps", muscle: "quads" },
  { pattern: "sartorius", muscle: "quads" },
  { pattern: "biceps_femoris", muscle: "hamstrings" },
  { pattern: "semitendinosus", muscle: "hamstrings" },
  { pattern: "semimembranosus", muscle: "hamstrings" },
  { pattern: "gastrocnemius", muscle: "calves" },
  { pattern: "soleus", muscle: "calves" },
];

/**
 * Returns the matching MuscleGroup for a mesh name, or null if no pattern hits.
 * Case-insensitive, accepts dotted/underscored/dashed names.
 */
export function resolveMuscleFor(meshName: string): MuscleGroup | null {
  const norm = meshName.toLowerCase().replace(/[-.\s]/g, "_");
  for (const { pattern, muscle } of Z_ANATOMY_MAPPING) {
    if (norm.includes(pattern)) return muscle;
  }
  return null;
}

export const Z_ANATOMY_GLB_PATH = "/models/zanatomy-muscles.glb";
