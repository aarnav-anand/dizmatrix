import type { EpidemiologicalRisk, WeatherForecast } from "../types";
import { countMatchingDays } from "./weather";

/**
 * Database of well-known agricultural diseases and their environmental triggers.
 * Thresholds based on agricultural research and epidemiological studies.
 *
 * References:
 * - Fungal diseases thrive in high humidity (>80%) + moderate warmth (15-25°C)
 * - Bacterial diseases prefer warm (>15°C) + moist conditions
 * - Viral diseases often transmitted via vectors (humidity + temperature dependent)
 */
const DISEASE_DATABASE: Record<string, EpidemiologicalRisk> = {
  // ========================================================================
  // FUNGAL DISEASES (most weather-sensitive)
  // ========================================================================

  powdery_mildew: {
    name: "Powdery Mildew",
    scientificName: "Erysiphales",
    severity: "high",
    conditions: {
      idealTemperatureMin: 15,
      idealTemperatureMax: 25,
      idealHumidityMin: 50, // Lower humidity threshold than downy mildew
      idealHumidityMax: 100,
      minPrecipitation: 0, // Can occur in low humidity; prefers dry leaves
      daysRequired: 3,
    },
    affectedCrops: ["Wheat", "Barley", "Grapes", "Cucumber", "Tomato", "Melons"],
    preventionTips: ["improve_ventilation", "avoid_crowding", "remove_infected_leaves"],
    matchingDays: 0,
    weatherBoost: 1.0,
  },

  downy_mildew: {
    name: "Downy Mildew",
    scientificName: "Phytophthora infestans",
    severity: "high",
    conditions: {
      idealTemperatureMin: 12,
      idealTemperatureMax: 18,
      idealHumidityMin: 80, // High humidity critical
      idealHumidityMax: 100,
      minPrecipitation: 1, // Requires moisture
      daysRequired: 3,
    },
    affectedCrops: ["Potato", "Tomato", "Grapes", "Lettuce", "Onion", "Spinach"],
    preventionTips: ["improve_ventilation", "reduce_leaf_wetness", "fungicide_spray"],
    matchingDays: 0,
    weatherBoost: 1.0,
  },

  early_blight: {
    name: "Early Blight",
    scientificName: "Alternaria solani",
    severity: "high",
    conditions: {
      idealTemperatureMin: 18,
      idealTemperatureMax: 28,
      idealHumidityMin: 85, // High humidity critical
      idealHumidityMax: 100,
      minPrecipitation: 2,
      daysRequired: 2,
    },
    affectedCrops: ["Tomato", "Potato", "Eggplant"],
    preventionTips: ["remove_lower_leaves", "improve_ventilation", "fungicide_spray"],
    matchingDays: 0,
    weatherBoost: 1.0,
  },

  late_blight: {
    name: "Late Blight",
    scientificName: "Phytophthora infestans",
    severity: "critical",
    conditions: {
      idealTemperatureMin: 10,
      idealTemperatureMax: 20,
      idealHumidityMin: 85,
      idealHumidityMax: 100,
      minPrecipitation: 2,
      daysRequired: 3, // Requires 3+ days of ideal conditions
    },
    affectedCrops: ["Potato", "Tomato"],
    preventionTips: [
      "apply_fungicide",
      "remove_infected_plants",
      "improve_ventilation",
      "plant_resistant_variety",
    ],
    matchingDays: 0,
    weatherBoost: 1.5,
  },

  rust: {
    name: "Rust Diseases",
    scientificName: "Puccinia spp.",
    severity: "high",
    conditions: {
      idealTemperatureMin: 10,
      idealTemperatureMax: 20,
      idealHumidityMin: 80,
      idealHumidityMax: 100,
      minPrecipitation: 0.5,
      daysRequired: 2,
    },
    affectedCrops: ["Wheat", "Barley", "Beans", "Corn", "Coffee"],
    preventionTips: ["plant_resistant_variety", "fungicide_spray", "improve_ventilation"],
    matchingDays: 0,
    weatherBoost: 1.2,
  },

  septoria_leaf_blotch: {
    name: "Septoria Leaf Blotch",
    scientificName: "Septoria tritici",
    severity: "moderate",
    conditions: {
      idealTemperatureMin: 15,
      idealTemperatureMax: 25,
      idealHumidityMin: 85,
      idealHumidityMax: 100,
      minPrecipitation: 1,
      daysRequired: 2,
    },
    affectedCrops: ["Wheat", "Barley"],
    preventionTips: ["remove_infected_leaves", "fungicide_spray", "crop_rotation"],
    matchingDays: 0,
    weatherBoost: 1.1,
  },

  anthracnose: {
    name: "Anthracnose",
    scientificName: "Colletotrichum spp.",
    severity: "high",
    conditions: {
      idealTemperatureMin: 20,
      idealTemperatureMax: 28,
      idealHumidityMin: 80,
      idealHumidityMax: 100,
      minPrecipitation: 2,
      daysRequired: 3,
    },
    affectedCrops: ["Beans", "Peas", "Grapes", "Melons", "Cucumber"],
    preventionTips: ["remove_infected_plants", "improve_ventilation", "fungicide_spray"],
    matchingDays: 0,
    weatherBoost: 1.3,
  },

  // ========================================================================
  // BACTERIAL DISEASES
  // ========================================================================

  bacterial_blight: {
    name: "Bacterial Blight",
    scientificName: "Xanthomonas spp.",
    severity: "high",
    conditions: {
      idealTemperatureMin: 24,
      idealTemperatureMax: 32,
      idealHumidityMin: 80,
      idealHumidityMax: 100,
      minPrecipitation: 2,
      daysRequired: 2,
    },
    affectedCrops: ["Rice", "Beans", "Corn", "Cotton"],
    preventionTips: ["use_resistant_variety", "remove_infected_plants", "copper_spray"],
    matchingDays: 0,
    weatherBoost: 1.2,
  },

  bacterial_wilt: {
    name: "Bacterial Wilt",
    scientificName: "Ralstonia solanacearum",
    severity: "critical",
    conditions: {
      idealTemperatureMin: 25,
      idealTemperatureMax: 32,
      idealHumidityMin: 70,
      idealHumidityMax: 100,
      minPrecipitation: 1,
      daysRequired: 2,
    },
    affectedCrops: ["Tomato", "Potato", "Eggplant", "Chili", "Banana"],
    preventionTips: ["use_resistant_variety", "remove_infected_plants", "quarantine"],
    matchingDays: 0,
    weatherBoost: 1.4,
  },

  // ========================================================================
  // VIRAL DISEASES (usually spread by vectors; weather affects vector populations)
  // ========================================================================

  mosaic_virus: {
    name: "Mosaic Virus",
    scientificName: "Potyvirus / Tobamovirus",
    severity: "high",
    conditions: {
      idealTemperatureMin: 20,
      idealTemperatureMax: 28,
      idealHumidityMin: 70,
      idealHumidityMax: 100,
      minPrecipitation: 0,
      daysRequired: 2,
    },
    affectedCrops: ["Tomato", "Pepper", "Lettuce", "Cucumber", "Bean"],
    preventionTips: ["control_aphids", "use_resistant_variety", "remove_infected_plants"],
    matchingDays: 0,
    weatherBoost: 1.1,
  },

  leaf_curl: {
    name: "Leaf Curl Disease",
    scientificName: "Whitefly-transmitted begomovirus",
    severity: "high",
    conditions: {
      idealTemperatureMin: 25,
      idealTemperatureMax: 35,
      idealHumidityMin: 70,
      idealHumidityMax: 90,
      minPrecipitation: 0,
      daysRequired: 2,
    },
    affectedCrops: ["Tomato", "Potato", "Okra", "Chili"],
    preventionTips: ["control_whiteflies", "use_netting", "remove_infected_plants"],
    matchingDays: 0,
    weatherBoost: 1.2,
  },

  // ========================================================================
  // ADDITIONAL IMPORTANT DISEASES
  // ========================================================================

  grey_mold: {
    name: "Grey Mold (Botrytis)",
    scientificName: "Botrytis cinerea",
    severity: "high",
    conditions: {
      idealTemperatureMin: 15,
      idealTemperatureMax: 25,
      idealHumidityMin: 85,
      idealHumidityMax: 100,
      minPrecipitation: 2,
      daysRequired: 3,
    },
    affectedCrops: ["Grapes", "Strawberry", "Tomato", "Lettuce", "Flowers"],
    preventionTips: ["improve_ventilation", "reduce_leaf_wetness", "remove_infected_flowers"],
    matchingDays: 0,
    weatherBoost: 1.3,
  },

  powdery_scab: {
    name: "Powdery Scab",
    scientificName: "Spongospora subterranea f. sp. subterranea",
    severity: "moderate",
    conditions: {
      idealTemperatureMin: 12,
      idealTemperatureMax: 20,
      idealHumidityMin: 75,
      idealHumidityMax: 100,
      minPrecipitation: 3,
      daysRequired: 2,
    },
    affectedCrops: ["Potato"],
    preventionTips: ["improve_drainage", "plant_resistant_variety", "quarantine_seed"],
    matchingDays: 0,
    weatherBoost: 1.0,
  },

  damping_off: {
    name: "Damping Off",
    scientificName: "Pythium / Rhizoctonia spp.",
    severity: "moderate",
    conditions: {
      idealTemperatureMin: 18,
      idealTemperatureMax: 28,
      idealHumidityMin: 80,
      idealHumidityMax: 100,
      minPrecipitation: 2,
      daysRequired: 2,
    },
    affectedCrops: ["Seedlings", "Vegetables", "Ornamentals"],
    preventionTips: ["improve_drainage", "use_well_draining_soil", "avoid_overcrowding"],
    matchingDays: 0,
    weatherBoost: 1.1,
  },
};

/**
 * Compute epidemiological risks for a given location and weather forecast.
 * Returns diseases that have favorable conditions in the forecast.
 */
export function assessEpidemiologicalRisks(
  weatherForecast: WeatherForecast | undefined,
  preferredCrops?: string[]
): EpidemiologicalRisk[] {
  if (!weatherForecast || !weatherForecast.forecast || weatherForecast.forecast.length === 0) {
    return [];
  }

  const risks: EpidemiologicalRisk[] = [];

  for (const disease of Object.values(DISEASE_DATABASE)) {
    const { conditions } = disease;
    const matchingDays = countMatchingDays(
      weatherForecast.forecast,
      conditions.idealTemperatureMin,
      conditions.idealTemperatureMax,
      conditions.idealHumidityMin,
      conditions.idealHumidityMax,
      conditions.minPrecipitation
    );

    if (matchingDays >= conditions.daysRequired) {
      const riskCopy = { ...disease };
      riskCopy.matchingDays = matchingDays;

      // Boost risk if matching more days than required
      const extraDays = Math.max(0, matchingDays - conditions.daysRequired);
      riskCopy.weatherBoost = disease.weatherBoost * (1 + extraDays * 0.1);

      // Filter by crop if provided
      if (preferredCrops) {
        const hasMatchingCrop = riskCopy.affectedCrops.some((crop) =>
          preferredCrops.some(
            (preferred) =>
              crop.toLowerCase().includes(preferred.toLowerCase()) ||
              preferred.toLowerCase().includes(crop.toLowerCase())
          )
        );

        if (hasMatchingCrop) {
          risks.push(riskCopy);
        }
      } else {
        risks.push(riskCopy);
      }
    }
  }

  // Sort by severity and matching days
  return risks.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const aSev = severityOrder[a.severity as keyof typeof severityOrder];
    const bSev = severityOrder[b.severity as keyof typeof severityOrder];

    if (aSev !== bSev) return aSev - bSev;
    return b.matchingDays - a.matchingDays;
  });
}

/**
 * Get a specific disease definition by name (normalized).
 */
export function getDiseaseProfile(
  diseaseName: string
): EpidemiologicalRisk | undefined {
  const normalized = diseaseName.toLowerCase().replace(/\s+/g, "_");
  return DISEASE_DATABASE[normalized];
}

/**
 * Suggest common disease names based on affected crops.
 */
export function suggestCommonDiseases(crops: string[]): EpidemiologicalRisk[] {
  return assessEpidemiologicalRisks(undefined, crops);
}

/**
 * Get epidemiological risk factors as a human-readable summary.
 */
export function summarizeRiskFactors(risks: EpidemiologicalRisk[]): string[] {
  if (risks.length === 0) return ["No concerning weather patterns detected"];

  return risks.slice(0, 3).map((r) => {
    const daysText = r.matchingDays > r.conditions.daysRequired ? "+" : "";
    return `${r.name}: ${r.matchingDays}${daysText} favorable days (boost: ${(r.weatherBoost * 100 - 100).toFixed(0)}%)`;
  });
}
