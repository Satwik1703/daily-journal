// Phase 16 · Calorie Tracker — seed foods
// Idempotent: skips rows already present (matched on lowercase name + null user_id).
// Adds ~60 rows: user's 3-week menu items + core ingredients.
//
// Usage:
//   node scripts/seed-foods.mjs local
//   node scripts/seed-foods.mjs prod    # requires TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env
//
// Nutrition values are estimates from public sources (USDA + IFCT). Not medical.

import { createClient } from "@libsql/client/node";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

const mode = process.argv[2] === "prod" ? "prod" : "local";
const url =
  mode === "prod"
    ? process.env.TURSO_DATABASE_URL
    : `file:${process.cwd().replace(/\\/g, "/")}/local.db`;
const authToken = mode === "prod" ? process.env.TURSO_AUTH_TOKEN : undefined;
if (mode === "prod" && (!url || !authToken)) {
  console.error("Prod requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in env.");
  process.exit(1);
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) });

// name, category, servingUnit, servingSize (in the unit above),
// kcal, protein_g, carbs_g, fat_g
const SEEDS = [
  // --- Full-plate Indian dishes from the user's 3-week menu ---
  ["Chicken Curry", "Non-veg curry", "cup", 1, 293, 26, 8, 17],
  ["Roti / Chapati (wheat)", "Indian bread", "piece", 1, 71, 3, 15, 0.4],
  ["Dosa (plain)", "South Indian", "piece", 1, 133, 3, 22, 4],
  ["Masala Dosa", "South Indian", "piece", 1, 250, 5, 40, 8],
  ["Coconut Chutney", "Side / condiment", "serving", 1, 60, 1, 3, 5],
  ["Peanut Chutney", "Side / condiment", "serving", 1, 90, 4, 3, 8],
  ["Ginger Chutney", "Side / condiment", "serving", 1, 55, 1, 6, 3],
  ["Sambar", "South Indian", "cup", 1, 130, 7, 22, 2],
  ["Veg Mushroom Pasta", "Pasta", "serving", 1, 420, 12, 55, 16],
  ["Chicken Pasta", "Pasta", "serving", 1, 480, 28, 50, 18],
  ["Rajma Masala", "Indian curry", "cup", 1, 240, 12, 32, 8],
  ["Chole (Chickpea Masala)", "Indian curry", "cup", 1, 240, 12, 32, 8],
  ["Black Chana Masala", "Indian curry", "cup", 1, 220, 12, 28, 7],
  ["Jeera Rice", "Rice", "cup", 1, 210, 4, 40, 4],
  ["Steamed Rice", "Rice", "cup", 1, 205, 4, 45, 0.5],
  ["Moong Dal (dry)", "Dal", "cup", 1, 170, 10, 22, 4],
  ["Chicken Hakka Noodles", "Indo-Chinese", "serving", 1, 450, 22, 45, 20],
  ["Chicken Schezwan Noodles", "Indo-Chinese", "serving", 1, 460, 22, 50, 18],
  ["Chilli Soya", "Indo-Chinese", "cup", 1, 220, 18, 12, 12],
  ["Chilli Paneer", "Indo-Chinese", "cup", 1, 320, 18, 15, 22],
  ["Chicken Biryani", "Biryani", "plate", 1, 550, 32, 65, 20],
  ["Raita", "Side / condiment", "cup", 1, 90, 5, 8, 4],
  ["Chicken Fried Rice", "Rice", "plate", 1, 480, 24, 55, 18],
  ["Egg Fried Rice", "Rice", "plate", 1, 420, 15, 55, 15],
  ["Palak Paneer", "Indian curry", "cup", 1, 280, 14, 12, 20],
  ["Paneer Butter Masala", "Indian curry", "cup", 1, 350, 16, 12, 27],
  ["Kadai Paneer", "Indian curry", "cup", 1, 300, 15, 12, 22],
  ["Kadai Chicken", "Indian curry", "cup", 1, 300, 30, 10, 16],
  ["Garlic Pepper Chicken", "Non-veg dry", "serving", 1, 280, 30, 4, 16],
  ["Chicken Tikka", "Non-veg dry", "serving", 1, 260, 32, 4, 12],
  ["Paneer Tikka", "Veg dry", "serving", 1, 320, 22, 8, 22],
  ["Paneer Sandwich", "Sandwich", "serving", 1, 320, 14, 32, 15],
  ["Chicken Sandwich", "Sandwich", "serving", 1, 340, 22, 28, 14],
  ["Grilled Veg & Cheese Sandwich", "Sandwich", "serving", 1, 350, 12, 38, 16],
  ["Paneer Wrap", "Wrap", "serving", 1, 380, 16, 42, 18],
  ["Soya Keema", "Indian curry", "cup", 1, 240, 22, 12, 10],
  ["Soya Pulao", "Rice", "plate", 1, 380, 15, 55, 12],
  ["Aloo Matar", "Indian curry", "cup", 1, 200, 6, 30, 7],
  ["Besan Cheela", "Snack / meal", "piece", 1, 110, 5, 11, 5],
  ["Bhindi Masala", "Indian curry", "cup", 1, 160, 4, 14, 10],
  ["Chole Bhature", "Indian meal", "plate", 1, 650, 18, 78, 28],
  ["Mixed Salad", "Salad", "cup", 1, 40, 2, 8, 0.5],

  // --- Core ingredients (100g portions where practical) ---
  ["Paneer", "Dairy", "g", 100, 265, 18, 6, 20],
  ["Chicken Breast (cooked)", "Non-veg", "g", 100, 165, 31, 0, 3.6],
  ["Chicken Thigh (cooked)", "Non-veg", "g", 100, 209, 26, 0, 11],
  ["Egg (whole, boiled)", "Non-veg", "piece", 1, 78, 6, 0.6, 5],
  ["Egg White (1)", "Non-veg", "piece", 1, 17, 3.6, 0.2, 0.1],
  ["Bread Slice (white)", "Bread", "piece", 1, 65, 2, 12, 1],
  ["Bread Slice (whole-wheat)", "Bread", "piece", 1, 69, 3.6, 11.6, 1.1],
  ["Idli", "South Indian", "piece", 1, 40, 1.5, 8, 0.2],
  ["Milk (full-fat)", "Dairy", "ml", 100, 60, 3, 5, 3],
  ["Milk (skim)", "Dairy", "ml", 100, 34, 3.4, 5, 0.1],
  ["Curd / Yogurt (plain)", "Dairy", "g", 100, 60, 4, 5, 3],
  ["Ghee", "Fat", "serving", 1, 45, 0, 0, 5],
  ["Oil (any)", "Fat", "serving", 1, 45, 0, 0, 5],
  ["Butter", "Fat", "g", 10, 72, 0.1, 0.1, 8.1],
  ["Almonds (10)", "Nuts", "piece", 10, 70, 3, 3, 6],
  ["Peanuts (roasted)", "Nuts", "g", 30, 170, 8, 5, 14],
  ["Banana (medium)", "Fruit", "piece", 1, 105, 1, 27, 0.4],
  ["Apple (medium)", "Fruit", "piece", 1, 95, 0.5, 25, 0.3],
  ["Orange (medium)", "Fruit", "piece", 1, 62, 1.2, 15.4, 0.2],
  ["Whey Protein Scoop", "Supplement", "serving", 1, 120, 24, 3, 1.5],
  ["Coffee (black)", "Drink", "cup", 1, 2, 0.3, 0, 0],
  ["Tea (with milk + sugar)", "Drink", "cup", 1, 80, 2, 12, 3],
  ["Water", "Drink", "ml", 250, 0, 0, 0, 0],
];

async function main() {
  console.log(`[seed-foods] Target: ${mode} (${url})`);

  // Existing seed names to dedup on.
  const existing = await client.execute({
    sql: "SELECT lower(name) AS lname FROM foods WHERE user_id IS NULL",
    args: [],
  });
  const seenNames = new Set(existing.rows.map((r) => String(r.lname)));

  let inserted = 0;
  let skipped = 0;
  for (const [name, category, unit, size, kcal, p, c, f] of SEEDS) {
    if (seenNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    await client.execute({
      sql: `INSERT INTO foods (id, user_id, name, brand, category, serving_unit, serving_size, kcal, protein_g, carbs_g, fat_g, source, is_favorite)
            VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'seed', 0)`,
      args: [nanoid(), name, category, unit, size, kcal, p, c, f],
    });
    inserted++;
  }

  console.log(`[seed-foods] Inserted ${inserted}, skipped ${skipped} (already present).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
