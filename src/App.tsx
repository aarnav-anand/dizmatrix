import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EmptyState from "./components/EmptyState";
import Header from "./components/Header";
import LoginPage from "./components/LoginPage";
import CreditBadge from "./components/CreditBadge";
import MapCanvas, { type MapCanvasHandle } from "./components/MapCanvas";
import RadiusControl from "./components/RadiusControl";
import RiskPanel from "./components/RiskPanel";
import { boundingBoxAround, centroid } from "./lib/geo";
import {
  fetchReportsInBoundingBox,
  decrementScanCredit,
  type Farmer,
} from "./lib/supabaseClient";
import { buildAssessment, scoreReports } from "./lib/risk";
import type {
  DiseaseReport,
  FarmAssessment,
  LatLng,
  ScoredReport,
} from "./types";

export default function App() {
  const { t } = useTranslation();
  const mapRef = useRef<MapCanvasHandle>(null);

  // Auth state
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [credits, setCredits] = useState<number>(0);

  // Map / assessment state
  const [farmPolygon, setFarmPolygon] = useState<LatLng[] | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [rawReports, setRawReports] = useState<DiseaseReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync credits from farmer on login
  useEffect(() => {
    if (farmer) {
      setCredits(farmer.dizmatrix ?? 0);
    }
  }, [farmer]);

  const scored: ScoredReport[] = useMemo(() => {
    if (!farmPolygon || farmPolygon.length < 3) return [];

    return scoreReports(rawReports, farmPolygon, radiusKm);
  }, [rawReports, farmPolygon, radiusKm]);

  const assessment: FarmAssessment | null = useMemo(() => {
    if (!farmPolygon || farmPolygon.length < 3) return null;

    return buildAssessment(scored, farmPolygon, radiusKm);
  }, [scored, farmPolygon, radiusKm]);

  const handleClear = () => {
    mapRef.current?.clear();
    setFarmPolygon(null);
    setRawReports([]);
    setError(null);
  };

  const handleRun = async () => {
    if (!farmer) return;

    if (credits <= 0) {
      setError("No scans remaining.");
      return;
    }

    if (!farmPolygon || farmPolygon.length < 3) {
      setError("Please draw your farm area first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Calculate the search area
      const c = centroid(farmPolygon);
      const box = boundingBoxAround(c, radiusKm);

      // 2. Fetch the disease outbreak data
      const reports = await fetchReportsInBoundingBox(box);

      // 3. Display the newly fetched results
      setRawReports(reports);

      // 4. ONLY AFTER THE SCAN/FETCH SUCCEEDS,
      //    decrement the farmer's scan credit.
      const updatedCredits = await decrementScanCredit(farmer.id);

      // 5. Update the app with the value confirmed by Supabase.
      setCredits(updatedCredits);

      console.log(
        `Scan completed successfully. Credits remaining: ${updatedCredits}`
      );
    } catch (err) {
      console.error("Scan failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "The scan could not be completed."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!farmer) {
    return <LoginPage onLogin={setFarmer} />;
  }

  const creditsExhausted = credits <= 0;

  return (
    <div className="app-shell">
      <Header credits={credits} farmerName={farmer.farmer_name} />

      <div className="app-body">
        <aside className="sidebar">
          <CreditBadge credits={credits} />

          {!creditsExhausted && (
            <>
              <div className="instructions-card card">
                <p>{t("map.instructions")}</p>
                <p>{t("map.editHint")}</p>
              </div>

              <RadiusControl
                radiusKm={radiusKm}
                onChange={setRadiusKm}
                disabled={loading}
              />

              {farmPolygon && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleClear}
                  disabled={loading}
                >
                  {t("map.redraw")}
                </button>
              )}

              {farmPolygon && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={handleRun}
                >
                  {loading
                    ? t("controls.running")
                    : t("controls.run")}
                </button>
              )}

              {error && (
                <p className="no-reports-note">
                  {error}
                </p>
              )}

              {!farmPolygon && <EmptyState />}

              {farmPolygon && assessment && !loading && (
                <RiskPanel
                  assessment={assessment}
                  radiusKm={radiusKm}
                />
              )}
            </>
          )}
        </aside>

        <MapCanvas
          ref={mapRef}
          onPolygonChange={setFarmPolygon}
          scoredReports={scored}
          radiusKm={radiusKm}
          farmPolygon={farmPolygon}
        />
      </div>
    </div>
  );
}