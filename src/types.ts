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

export interface WeatherConditions {
  temperature: number; // Celsius
  humidity: number; // Percentage (0-100)
  precipitation: number; // mm
  windSpeed: number; // km/h
  date: string; // ISO date
}

export interface WeatherForecast {
  coordinates: { lat: number; lng: number };
  fetchedAt: string; // ISO timestamp
  forecast: WeatherConditions[]; // Next 7 days
  current?: WeatherConditions;
}

export interface EpidemiologicalRisk {
  name: string; // Common disease name
  scientificName?: string;
  severity: "low" | "medium" | "high";
  conditions: {
    idealTemperatureMin: number;
    idealTemperatureMax: number;
    idealHumidityMin: number;
    idealHumidityMax: number;
    minPrecipitation: number;
    daysRequired: number; // How many consecutive days of ideal conditions
  };
  matchingDays: number; // Number of forecast days matching conditions
  weatherBoost: number; // Risk score multiplier (0-2)
  affectedCrops: string[]; // Crops at risk
  preventionTips: string[]; // i18n keys for prevention tips
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
  epidemiologicalRisks?: EpidemiologicalRisk[]; // Weather-based disease risks
  weatherBoost?: number; // How much the score was boosted by weather
}

export interface FarmAssessment {
  overallScore: number;
  overallLevel: RiskLevel;
  totalReportsConsidered: number;
  areaHectares: number;
  diseases: DiseaseRiskSummary[];
  weatherForecast?: WeatherForecast;
  riskFactors?: string[]; // Summary of environmental risk factors
}
