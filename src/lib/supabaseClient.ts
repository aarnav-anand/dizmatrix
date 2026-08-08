import { createClient } from "@supabase/supabase-js";
import type { DiseaseReport } from "../types";

// Falls back to the project's own credentials if no env vars are set, so the
// app works out of the box. For production, prefer setting VITE_SUPABASE_URL
// and VITE_SUPABASE_ANON_KEY as real environment variables on your host.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://rmohiyytogusbkhmabpb.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtb2hpeXl0b2d1c2JraG1hYnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNDYwMTIsImV4cCI6MjEwMTcyMjAxMn0.KPYVJJ5RQBGonWom-RK2QNpyUmNnu9JfD5q6ZqiTSK4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetch disease reports inside a rough lat/lng bounding box. The box is
 * intentionally generous (computed from the farm centroid + search radius);
 * exact distance filtering happens client-side afterwards, since the table
 * only stores plain latitude/longitude columns rather than a PostGIS point.
 */
export async function fetchReportsInBoundingBox(bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): Promise<DiseaseReport[]> {
  const { data, error } = await supabase
    .from("disease_reports")
    .select("*")
    .gte("latitude", bounds.minLat)
    .lte("latitude", bounds.maxLat)
    .gte("longitude", bounds.minLng)
    .lte("longitude", bounds.maxLng)
    .order("reported_at", { ascending: false })
    .limit(2000);

  if (error) throw error;
  return (data ?? []) as DiseaseReport[];
}
