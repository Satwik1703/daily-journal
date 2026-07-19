import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { searchFoods } from "@/db/queries/food";
import type { Food } from "@/lib/food-meta";

export const dynamic = "force-dynamic";

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: {
    "energy-kcal_serving"?: number | string;
    "energy-kcal_100g"?: number | string;
    proteins_serving?: number | string;
    proteins_100g?: number | string;
    carbohydrates_serving?: number | string;
    carbohydrates_100g?: number | string;
    fat_serving?: number | string;
    fat_100g?: number | string;
    fiber_serving?: number | string;
    fiber_100g?: number | string;
    sugars_serving?: number | string;
    sugars_100g?: number | string;
  };
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize an OFF search result into our Food shape. Prefer per-serving
 *  values; fall back to per-100g. Assume 100g if no serving info. */
function normalizeOff(p: OffProduct): Food | null {
  const name = (p.product_name ?? "").trim();
  if (!name) return null;
  const brand = (p.brands ?? "").split(",")[0]?.trim() || null;
  const n = p.nutriments ?? {};

  const perServingKcal = num(n["energy-kcal_serving"]);
  const per100Kcal = num(n["energy-kcal_100g"]);
  const kcal = perServingKcal ?? per100Kcal ?? 0;
  if (kcal <= 0) return null;
  const usedServing = perServingKcal != null;

  const proteinG = num(usedServing ? n.proteins_serving : n.proteins_100g) ?? 0;
  const carbsG = num(usedServing ? n.carbohydrates_serving : n.carbohydrates_100g) ?? 0;
  const fatG = num(usedServing ? n.fat_serving : n.fat_100g) ?? 0;
  const fiberG = num(usedServing ? n.fiber_serving : n.fiber_100g);
  const sugarG = num(usedServing ? n.sugars_serving : n.sugars_100g);

  const servingQty = num(p.serving_quantity);
  const servingSize = usedServing && servingQty ? servingQty : 100;
  const servingUnit: Food["servingUnit"] = usedServing ? "serving" : "g";

  return {
    id: `off-${p.code ?? name.slice(0, 12)}`,
    userId: null,
    name,
    brand,
    category: null,
    servingUnit,
    servingSize,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    sugarG,
    sodiumMg: null,
    source: "off",
    offBarcode: p.code ?? null,
    isFavorite: false,
  };
}

/**
 * Search all foods available to the user. Order of results:
 *   1. Local matches (user's customs + global seed rows), scored by prefix.
 *   2. Open Food Facts external hits (rate limited to 15).
 *
 * The client uses a debounced onChange to call this. Cached by the client
 * per-query for the session.
 */
export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ local: [], off: [] });

  const localHits = await searchFoods(session.user.id, q, 20);

  // Skip external search for very short queries — too noisy and OFF returns
  // massive junk for 1-2 char terms.
  let offHits: Food[] = [];
  if (q.length >= 3) {
    try {
      const offUrl =
        `https://world.openfoodfacts.org/api/v2/search?` +
        new URLSearchParams({
          search_terms: q,
          fields:
            "code,product_name,brands,serving_size,serving_quantity,nutriments",
          page_size: "15",
          sort_by: "popularity_key",
        }).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(offUrl, {
        headers: {
          "User-Agent": "HabitLog-CalorieTracker/1.0 (self-host, personal use)",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const body = (await res.json()) as { products?: OffProduct[] };
        offHits = (body.products ?? [])
          .map(normalizeOff)
          .filter((f): f is Food => f != null)
          .slice(0, 15);
      }
    } catch {
      // Network dead, timeout, JSON parse — degrade to local-only silently.
      offHits = [];
    }
  }

  return NextResponse.json({ local: localHits, off: offHits });
}
