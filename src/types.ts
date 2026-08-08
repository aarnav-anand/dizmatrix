export interface DiseaseReport {
  id: number;
  disease_class: string | null;
  crop: string | null;
  disease: string | null;
  confidence: number | null;
  latitude: number;
  longitude: number;
  farmer_name: string | null;
  notes: string | null;
  language: string | null;
  reported_at: string | null;
}

export type LatLng = { lat: number; lng: number };

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface ScoredReport extends DiseaseReport {
  distanceKm: number;
  insidePolygon: boolean;
  weight: number;
}

export interface DiseaseRiskSummary {
  crop: string;
  disease: string;
  score: number;
  level: RiskLevel;
  reportCount: number;
  insideCount: number;
  nearestKm: number;
  avgConfidence: number;
  mostRecent: string | null;
}

export interface FarmAssessment {
  overallScore: number;
  overallLevel: RiskLevel;
  totalReportsConsidered: number;
  areaHectares: number;
  diseases: DiseaseRiskSummary[];
}
