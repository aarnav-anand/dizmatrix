import type {
  DiseaseReport,
  DiseaseRiskSummary,
  FarmAssessment,
  LatLng,
  RiskLevel,
  ScoredReport,
} from "../types";
import { areaHectares, centroid, haversineKm, isPointInPolygon } from "./geo";

const RECENCY_HALF_LIFE_DAYS = 60; // a report loses half its recency weight every ~2 months

function recencyWeight(reportedAt: string | null): number {
  if (!reportedAt) return 0.5;
  const days = (Date.now() - new Date(reportedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return 0.5;
  return Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
}

function distanceWeight(distanceKm: number, insidePolygon: boolean, radiusKm: number): number {
  if (insidePolygon) return 1;
  if (distanceKm <= 0) return 1;
  // Absolute decay: a report 15km away always has the same weight
  return 0.15 + 0.85 * Math.exp(-distanceKm / 20);
}
function levelFromScore(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 40) return "high";
  if (score >= 15) return "moderate";
  return "low";
}

export function scoreReports(
  reports: DiseaseReport[],
  farmPolygon: LatLng[],
  radiusKm: number
): ScoredReport[] {
  const farmCentroid = centroid(farmPolygon);

  return reports
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .filter((r) => {
      const diseaseName = (r.disease ?? r.disease_class ?? "").toLowerCase();
      return !diseaseName.includes("healthy");
    })
    .map((r): ScoredReport => {
      const point: LatLng = { lat: r.latitude, lng: r.longitude };
      const inside = farmPolygon.length >= 3 ? isPointInPolygon(point, farmPolygon) : false;
      const distanceKm = haversineKm(farmCentroid, point);
      const confidence = clamp01(r.confidence ?? 0.5);
      const dWeight = distanceWeight(distanceKm, inside, radiusKm);
      const rWeight = recencyWeight(r.reported_at);
      const weight = dWeight * rWeight * (0.35 + 0.65 * confidence);

      return { ...r, distanceKm, insidePolygon: inside, weight };
    })
    .filter((r) => r.insidePolygon || r.distanceKm <= radiusKm);
}

export function buildAssessment(
  scored: ScoredReport[],
  farmPolygon: LatLng[],
  radiusKm: number
): FarmAssessment {
  const groups = new Map<string, ScoredReport[]>();
  for (const r of scored) {
    const crop = (r.crop ?? "Unknown crop").trim();
    const disease = (r.disease ?? r.disease_class ?? "Unspecified issue").trim();
    const key = `${crop}::${disease}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Normalise raw weighted sums onto a 0-100 scale using a saturating curve,
  // so a handful of very close, very recent, high-confidence hits reads as
  // "critical" without requiring dozens of reports to max out.
  const diseases: DiseaseRiskSummary[] = Array.from(groups.entries())
    .map(([key, group]) => {
      const [crop, disease] = key.split("::");
      const rawSum = group.reduce((s, r) => s + r.weight, 0);
      const score = 100 * (1 - Math.exp(-rawSum / 1.6));
      const insideCount = group.filter((r) => r.insidePolygon).length;
      const nearestKm = Math.min(...group.map((r) => r.distanceKm));
      const avgConfidence =
        group.reduce((s, r) => s + clamp01(r.confidence ?? 0.5), 0) / group.length;
      const mostRecent = group
        .map((r) => r.reported_at)
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null;

      return {
        crop,
        disease,
        score: Math.round(score * 10) / 10,
        level: levelFromScore(score),
        reportCount: group.length,
        insideCount,
        nearestKm: Math.round(nearestKm * 10) / 10,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        mostRecent,
      };
    })
    .sort((a, b) => b.score - a.score);

  const overallScore = diseases.length
    ? Math.round(
        (diseases[0].score * 0.6 +
          (diseases.slice(1).reduce((s, d) => s + d.score, 0) /
            Math.max(1, diseases.length - 1)) *
            0.4) *
          10
      ) / 10
    : 0;

  return {
    overallScore,
    overallLevel: levelFromScore(overallScore),
    totalReportsConsidered: scored.length,
    areaHectares: Math.round(areaHectares(farmPolygon) * 100) / 100,
    diseases,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  // Confidence in the source table may be stored as 0-1 or 0-100; normalise either.
  const v = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, v));
}

/** Buckets an individual scored report's weight into a marker colour level. */
export function reportMarkerLevel(weight: number): RiskLevel {
  if (weight >= 0.55) return "critical";
  if (weight >= 0.3) return "high";
  if (weight >= 0.12) return "moderate";
  return "low";
}

export { levelFromScore };