import type { LatLng, WeatherConditions, WeatherForecast } from "../types";

/**
 * Fetch 7-day weather forecast from Open-Meteo API (free, no key required).
 * Returns temperature, humidity, precipitation, and wind speed.
 */
export async function fetchWeatherForecast(
  coordinates: LatLng
): Promise<WeatherForecast | null> {
  try {
    const params = new URLSearchParams({
      latitude: coordinates.lat.toString(),
      longitude: coordinates.lng.toString(),
      daily:
        "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max,wind_speed_10m_max",
      temperature_unit: "celsius",
      precipitation_unit: "mm",
      windspeed_unit: "kmh",
      forecast_days: "7",
      timezone: "auto",
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`
    );

    if (!response.ok) {
      console.error("Open-Meteo API error:", response.statusText);
      return null;
    }

    const data = (await response.json()) as {
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        relative_humidity_2m_max: number[];
        precipitation_sum: number[];
        wind_speed_10m_max: number[];
      };
    };

    const forecast: WeatherConditions[] = data.daily.time.map((date, idx) => ({
      date,
      temperature: (data.daily.temperature_2m_max[idx] + data.daily.temperature_2m_min[idx]) / 2,
      humidity: data.daily.relative_humidity_2m_max[idx],
      precipitation: data.daily.precipitation_sum[idx],
      windSpeed: data.daily.wind_speed_10m_max[idx],
    }));

    return {
      coordinates,
      fetchedAt: new Date().toISOString(),
      forecast,
      current: forecast[0], // First day is today/soonest
    };
  } catch (err) {
    console.error("Failed to fetch weather forecast:", err);
    return null;
  }
}

/**
 * Check if upcoming days match a disease condition profile.
 * Returns number of consecutive days matching the ideal conditions.
 */
export function countMatchingDays(
  forecast: WeatherConditions[],
  idealTempMin: number,
  idealTempMax: number,
  idealHumidityMin: number,
  idealHumidityMax: number,
  minPrecipitation: number = 0
): number {
  let consecutiveDays = 0;

  for (const day of forecast) {
    const tempMatch =
      day.temperature >= idealTempMin && day.temperature <= idealTempMax;
    const humidityMatch =
      day.humidity >= idealHumidityMin && day.humidity <= idealHumidityMax;
    const precipMatch = day.precipitation >= minPrecipitation;

    if (tempMatch && humidityMatch && precipMatch) {
      consecutiveDays++;
    } else {
      break; // Break on first non-matching day (we want consecutive)
    }
  }

  return consecutiveDays;
}

/**
 * Get a summary of current conditions (emoji + text for UI display).
 */
export function summarizeWeather(conditions: WeatherConditions): string {
  const { temperature, humidity, precipitation } = conditions;

  if (precipitation > 5) return `🌧️ Heavy rain (${precipitation}mm)`;
  if (precipitation > 1) return `🌧️ Light rain (${precipitation}mm)`;
  if (humidity > 85) return `💧 Very humid (${humidity}%)`;
  if (temperature > 30) return `☀️ Hot (${temperature}°C)`;
  if (temperature < 5) return `❄️ Cold (${temperature}°C)`;
  return `🌤️ Moderate (${temperature}°C, ${humidity}%)`;
}

/**
 * Determine if the forecast is favorable for disease development.
 */
export function isFavorableForDisease(
  forecast: WeatherConditions[],
  minConsecutiveDays: number,
  idealTempMin: number,
  idealTempMax: number,
  idealHumidityMin: number,
  idealHumidityMax: number
): boolean {
  return (
    countMatchingDays(
      forecast,
      idealTempMin,
      idealTempMax,
      idealHumidityMin,
      idealHumidityMax
    ) >= minConsecutiveDays
  );
}
