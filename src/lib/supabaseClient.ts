import { createClient } from "@supabase/supabase-js";
import type { DiseaseReport } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface Farmer {
  id: number;
  dif_code: string;
  dizmatrix: number;
  farmer_name?: string;
  farmer_dif?: string;
}

/** Validate a 4-char alphanumeric DIF code and return the farmer row. */
export async function loginWithDifCode(code: string): Promise<Farmer | null> {
  const { data, error } = await supabase
    .from("farmers")
    .select("*")
    .eq("dif_code", code.toUpperCase())
    .single();

  if (error || !data) return null;
  return data as Farmer;
}

/** Decrement the dizmatrix counter for a farmer by 1 and return updated count. */
export async function decrementScanCredit(
  farmerId: number
): Promise<number> {
  // Get the current count
  const { data: current, error: fetchError } = await supabase
    .from("farmers")
    .select("dizmatrix")
    .eq("id", farmerId)
    .single();

  if (fetchError) {
    console.error("Failed to get current scan count:", fetchError);
    throw fetchError;
  }

  if (!current) {
    throw new Error("Farmer not found");
  }

  const currentCount = Number(current.dizmatrix ?? 0);

  if (currentCount <= 0) {
    throw new Error("No scans remaining");
  }

  const newCount = currentCount - 1;

  // Update Supabase
  const { data, error: updateError } = await supabase
    .from("farmers")
    .update({ dizmatrix: newCount })
    .eq("id", farmerId)
    .select("dizmatrix")
    .single();

  if (updateError) {
    console.error("Failed to decrement scan count:", updateError);
    throw updateError;
  }

  if (!data) {
    throw new Error("Supabase did not return the updated scan count");
  }

  const updatedCount = Number(data.dizmatrix);

  console.log("Scan count updated:", updatedCount);

  return updatedCount;
}

/**
 * Fetch disease outbreak reports inside a rough lat/lng bounding box.
 *
 * Disease outbreak data comes from the "outbreak_reports" table.
 */
export async function fetchReportsInBoundingBox(bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): Promise<DiseaseReport[]> {
  const { data, error } = await supabase
    .from("outbreak_reports")
    .select(
      "id, disease_class, crop, disease, confidence, farmer_name, farmer_dif, farm_geojson, center_lat, center_lng, notes, language, reported_at"
    )
    .gte("center_lat", bounds.minLat)
    .lte("center_lat", bounds.maxLat)
    .gte("center_lng", bounds.minLng)
    .lte("center_lng", bounds.maxLng)
    .order("reported_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("Error fetching outbreak reports:", error);
    throw error;
  }

  // Map outbreak_reports columns to DiseaseReport shape
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    disease_class: row.disease_class ?? null,
    crop: row.crop ?? null,
    disease: row.disease ?? null,
    confidence: row.confidence ?? null,
    latitude: row.center_lat,
    longitude: row.center_lng,
    farmer_name: row.farmer_name ?? null,
    notes: row.notes ?? null,
    language: row.language ?? null,
    reported_at: row.reported_at ?? null,
  })) as DiseaseReport[];
}