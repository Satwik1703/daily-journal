export type StrokePoint = { x: number; y: number; t?: number };
export type Stroke = StrokePoint[];

export const SAMPLE_COUNT = 64;
export const DTW_BAND = 8;
export const MATCH_THRESHOLD = 0.85;

function strokeLength(stroke: Stroke): number {
  let total = 0;
  for (let i = 1; i < stroke.length; i++) {
    const dx = stroke[i].x - stroke[i - 1].x;
    const dy = stroke[i].y - stroke[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

export function resampleStroke(stroke: Stroke, n = SAMPLE_COUNT): Stroke {
  if (stroke.length === 0) return [];
  if (stroke.length === 1) return Array.from({ length: n }, () => stroke[0]);
  const total = strokeLength(stroke);
  if (total === 0) return Array.from({ length: n }, () => stroke[0]);
  const step = total / (n - 1);
  const out: Stroke = [stroke[0]];
  let acc = 0;
  let i = 1;
  let prev = stroke[0];
  while (out.length < n && i < stroke.length) {
    const cur = stroke[i];
    const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc + segLen >= step) {
      const t = (step - acc) / segLen;
      const newPoint: StrokePoint = {
        x: prev.x + t * (cur.x - prev.x),
        y: prev.y + t * (cur.y - prev.y),
      };
      out.push(newPoint);
      prev = newPoint;
      acc = 0;
    } else {
      acc += segLen;
      prev = cur;
      i++;
    }
  }
  while (out.length < n) out.push(stroke[stroke.length - 1]);
  return out;
}

export function normalizeStroke(stroke: Stroke): Stroke {
  if (stroke.length === 0) return stroke;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of stroke) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = Math.max(w, h);
  if (scale === 0) return stroke.map(() => ({ x: 0, y: 0 }));
  return stroke.map((p) => ({
    x: (p.x - minX) / scale,
    y: (p.y - minY) / scale,
  }));
}

export function flattenStrokes(strokes: Stroke[]): Stroke {
  const flat: Stroke = [];
  for (const s of strokes) {
    for (const p of s) flat.push({ x: p.x, y: p.y });
  }
  return flat;
}

export function prepareForCompare(strokes: Stroke[]): Stroke {
  const flat = flattenStrokes(strokes);
  if (flat.length < 2) return [];
  return normalizeStroke(resampleStroke(flat, SAMPLE_COUNT));
}

export function serializeStrokes(strokes: Stroke[]): string {
  const prepared = prepareForCompare(strokes);
  return JSON.stringify(prepared);
}

export function deserializeStroke(json: string | null): Stroke | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    const out: Stroke = [];
    for (const p of arr) {
      if (
        p &&
        typeof p === "object" &&
        typeof (p as { x: unknown }).x === "number" &&
        typeof (p as { y: unknown }).y === "number"
      ) {
        out.push({ x: (p as StrokePoint).x, y: (p as StrokePoint).y });
      }
    }
    return out.length === SAMPLE_COUNT ? out : null;
  } catch {
    return null;
  }
}

export function dtwDistance(a: Stroke, b: Stroke): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  const band = Math.max(DTW_BAND, Math.abs(n - m));
  const INF = Number.POSITIVE_INFINITY;
  const cols = m + 1;
  const d = new Float64Array(cols * (n + 1));
  for (let i = 0; i < d.length; i++) d[i] = INF;
  d[0] = 0;
  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - band);
    const jEnd = Math.min(m, i + band);
    for (let j = jStart; j <= jEnd; j++) {
      const dx = a[i - 1].x - b[j - 1].x;
      const dy = a[i - 1].y - b[j - 1].y;
      const cost = Math.hypot(dx, dy);
      const prev = Math.min(
        d[(i - 1) * cols + j],
        d[i * cols + (j - 1)],
        d[(i - 1) * cols + (j - 1)],
      );
      d[i * cols + j] = cost + prev;
    }
  }
  const raw = d[n * cols + m];
  return raw / Math.max(n, m);
}

export function isMatch(savedJson: string | null, candidate: Stroke[]): boolean {
  const saved = deserializeStroke(savedJson);
  if (!saved) return false;
  const prepared = prepareForCompare(candidate);
  if (prepared.length === 0) return false;
  const dist = dtwDistance(saved, prepared);
  return dist <= MATCH_THRESHOLD;
}
