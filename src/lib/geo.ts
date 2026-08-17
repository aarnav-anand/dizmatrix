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
