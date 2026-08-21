import type { LatLng } from "../types";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Ray-casting point-in-polygon test. `polygon` is a closed or open ring. */
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }
  return inside;
}

/** Simple average-of-vertices centroid — accurate enough for farm-plot scale polygons. */
export function centroid(polygon: LatLng[]): LatLng {
  const sum = polygon.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
}

/**
 * Approximate polygon area in hectares using an equirectangular projection
 * centred on the polygon — fine for the small extents a single farm covers.
 */
export function areaHectares(polygon: LatLng[]): number {
  if (polygon.length < 3) return 0;
  const c = centroid(polygon);
  const kmPerDegLat = 110.574;
  const kmPerDegLng = 111.32 * Math.cos(toRad(c.lat));

  const pts = polygon.map((p) => ({
    x: (p.lng - c.lng) * kmPerDegLng,
    y: (p.lat - c.lat) * kmPerDegLat,
  }));

  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  const areaKm2 = Math.abs(area) / 2;
  return areaKm2 * 100; // km^2 -> hectares
}

/** Bounding box around a centroid, padded by a radius in km. */
export function boundingBoxAround(center: LatLng, radiusKm: number) {
  const latPad = radiusKm / 110.574;
  const lngPad = radiusKm / (111.32 * Math.cos(toRad(center.lat)));
  return {
    minLat: center.lat - latPad,
    maxLat: center.lat + latPad,
    minLng: center.lng - lngPad,
    maxLng: center.lng + lngPad,
  };
}

// ---------------------------------------------------------------------------
// Water detection
// ---------------------------------------------------------------------------

/**
 * OSM feature classes that definitively indicate solid land.
 * Nominatim returns these when a point resolves to a named place on land.
 * Open ocean / large water bodies return an error JSON with no class at all.
 */
const LAND_CLASSES = new Set([
  "boundary",
  "place",
  "landuse",
  "highway",
  "building",
  "amenity",
  "shop",
  "leisure",
  "man_made",
  "railway",
  "aeroway",
  "tourism",
  "historic",
  "office",
  "military",
]);

/**
 * Feature classes that explicitly mean water — reject regardless of type.
 */
const WATER_CLASSES = new Set(["waterway", "water"]);

/**
 * Natural types that are water bodies (class === "natural").
 */
const WATER_NATURAL_TYPES = new Set([
  "water",
  "sea",
  "ocean",
  "bay",
  "strait",
  "coastline",
  "wetland",
]);

/**
 * Probe a single coordinate with Nominatim reverse-geocoding.
 *
 * Returns:
 *   "land"    – the point resolves to a named land feature
 *   "water"   – the point resolves to a named water feature
 *   "unknown" – Nominatim returned an error or couldn't geocode (open ocean)
 */
async function probePoint(point: LatLng): Promise<"land" | "water" | "unknown"> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${point.lat}&lon=${point.lng}` +
      `&format=jsonv2&zoom=12`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return "unknown";

    const json = await res.json();

    // Nominatim signals "nothing here" with { "error": "Unable to geocode" }
    if (json.error) return "unknown";

    const cls: string = json.class ?? "";
    const type: string = json.type ?? "";

    if (WATER_CLASSES.has(cls)) return "water";
    if (cls === "natural" && WATER_NATURAL_TYPES.has(type)) return "water";
    if (LAND_CLASSES.has(cls)) return "land";

    // Anything else (e.g. "natural" with a non-water type like "wood") is land.
    return "land";
  } catch {
    return "unknown";
  }
}

/**
 * Returns `true` when the polygon appears to be drawn over water or open
 * ocean, in which case the scan should be rejected and the credit preserved.
 *
 * Strategy: sample the centroid + up to 4 evenly-spaced vertices.
 *
 * Decision rules (designed to be strict about water, lenient on ambiguity):
 *  - If ANY point comes back "water"  → reject (on water).
 *  - If ANY point comes back "land"   → accept (confirmed land).
 *  - If ALL points are "unknown"      → reject (open ocean has no geocode).
 *
 * The "any water beats any land" rule catches polygons straddling a coast
 * that have some vertices on sea.  The "all unknown = reject" rule catches
 * open-ocean drawings where Nominatim returns nothing at all.
 *
 * On a genuine network failure every call will return "unknown", which would
 * falsely reject.  To avoid that we track whether every failure was a fetch
 * exception vs a Nominatim "Unable to geocode" response; but since we can't
 * distinguish the two from the browser reliably, we take the conservative
 * approach: if the user is on a working internet connection (required for the
 * rest of the app anyway), ocean probes will return "unknown" and land probes
 * will return "land".
 */
export async function isPolygonOnWater(polygon: LatLng[]): Promise<boolean> {
  if (polygon.length < 3) return false;

  const c = centroid(polygon);

  // Up to 4 evenly-spaced vertices in addition to the centroid.
  const step = Math.max(1, Math.floor(polygon.length / 4));
  const sampleVertices: LatLng[] = [];
  for (let i = 0; i < polygon.length && sampleVertices.length < 4; i += step) {
    sampleVertices.push(polygon[i]);
  }

  const points: LatLng[] = [c, ...sampleVertices];

  // Run all probes concurrently.
  const results = await Promise.all(points.map(probePoint));

  const hasWater = results.some((r) => r === "water");
  const hasLand = results.some((r) => r === "land");

  if (hasWater) return true;      // At least one vertex on water → reject
  if (hasLand) return false;      // At least one vertex on land (no water) → accept
  return true;                    // All "unknown" → open ocean → reject
}