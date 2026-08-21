import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EmptyState from "./components/EmptyState";
import Header from "./components/Header";
import LoginPage from "./components/LoginPage";
import CreditBadge from "./components/CreditBadge";
import MapCanvas, { type MapCanvasHandle } from "./components/MapCanvas";
import RadiusControl from "./components/RadiusControl";
import RiskPanel from "./components/RiskPanel";
import { boundingBoxAround, centroid, isPolygonOnWater } from "./lib/geo";
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
  const [hasRun, setHasRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync credits from farmer on login
  useEffect(() => {
    if (farmer) setCredits(farmer.dizmatrix ?? 0);
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
    setHasRun(false);
  };

  const handleRun = async () => {
    if (!farmer) return;
    if (credits <= 0) return;

    if (!farmPolygon || farmPolygon.length < 3) return;

    setLoading(true);
    setError(null);
    try {
      // Water check — must pass before any credit is consumed.
      const onWater = await isPolygonOnWater(farmPolygon);
      if (onWater) {
        setError(t("errors.polygonOnWater"));
        return; // Do NOT decrement credit — user must redraw on land.
      }

      const c = centroid(farmPolygon);
      const box = boundingBoxAround(c, radiusKm);
      const reports = await fetchReportsInBoundingBox(box);
      setRawReports(reports);
      setHasRun(true);

      // Scan completed successfully — now decrement the credit.
      const updated = await decrementScanCredit(farmer.id);
      if (updated !== null) setCredits(updated);
    } catch (err) {
      console.error(err);
      setError(t("errors.fetchFailed"));
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

          {creditsExhausted && (
            <div className="instructions-card card" style={{ color: "var(--color-red-bright)", textAlign: "center" }}>
              <p>
                Please visit{" "}
                <a
                  href="https://agrifusion-hub.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", fontWeight: 600 }}
                >
                  agrifusion-hub.vercel.app
                </a>{" "}
                to purchase more credits.
              </p>
            </div>
          )}

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
                  {loading ? t("controls.running") : t("controls.run")}
                </button>
              )}

              {error && <p className="no-reports-note">{error}</p>}

              {!farmPolygon && <EmptyState />}

              {farmPolygon && hasRun && assessment && !loading && (
                <RiskPanel assessment={assessment} radiusKm={radiusKm} />
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