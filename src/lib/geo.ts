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

/**
 * OSM Nominatim feature classes / types that indicate a water body.
 * The reverse-geocode endpoint returns `{ class, type, ... }` for the
 * nearest named feature.  If the dominant feature is water we reject the
 * polygon so the user is asked to redraw on land.
 */
const WATER_CLASSES = new Set(["waterway", "water", "natural"]);
const WATER_TYPES = new Set([
  "water",
  "sea",
  "ocean",
  "bay",
  "strait",
  "river",
  "stream",
  "canal",
  "lake",
  "reservoir",
  "pond",
  "lagoon",
  "wetland",
  "coastline",
]);

async function reverseGeocode(
  point: LatLng
): Promise<{ class: string; type: string } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${point.lat}&lon=${point.lng}` +
      `&format=jsonv2&zoom=10`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { class: json.class ?? "", type: json.type ?? "" };
  } catch {
    return null;
  }
}

function isWaterFeature(feature: { class: string; type: string }): boolean {
  return (
    WATER_CLASSES.has(feature.class) && WATER_TYPES.has(feature.type)
  );
}

/**
 * Returns `true` when the **majority** of sampled polygon points appear to
 * fall on a water body according to OSM Nominatim reverse-geocoding.
 *
 * We sample the centroid plus up to four evenly-spaced vertices.  If most
 * sampled points resolve to a water feature the polygon is considered to be
 * on water.  On network failure we return `false` (fail open) so a
 * connectivity issue never permanently blocks the user.
 */
export async function isPolygonOnWater(polygon: LatLng[]): Promise<boolean> {
  if (polygon.length < 3) return false;

  const c = centroid(polygon);

  // Pick up to 4 evenly-spaced vertices in addition to the centroid.
  const step = Math.max(1, Math.floor(polygon.length / 4));
  const sampleVertices: LatLng[] = [];
  for (let i = 0; i < polygon.length && sampleVertices.length < 4; i += step) {
    sampleVertices.push(polygon[i]);
  }

  const points: LatLng[] = [c, ...sampleVertices];

  // Run all requests concurrently.
  const results = await Promise.all(points.map(reverseGeocode));

  const valid = results.filter((r): r is { class: string; type: string } => r !== null);
  if (valid.length === 0) return false; // network failure — fail open

  const waterCount = valid.filter(isWaterFeature).length;

  // Majority rule: more than half the successfully-resolved points are water.
  return waterCount > valid.length / 2;
}