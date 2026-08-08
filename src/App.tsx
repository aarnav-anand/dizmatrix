import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EmptyState from "./components/EmptyState";
import Header from "./components/Header";
import MapCanvas, { type MapCanvasHandle } from "./components/MapCanvas";
import RadiusControl from "./components/RadiusControl";
import RiskPanel from "./components/RiskPanel";
import { boundingBoxAround, centroid } from "./lib/geo";
import { fetchReportsInBoundingBox } from "./lib/supabaseClient";
import { buildAssessment, scoreReports } from "./lib/risk";
import type { DiseaseReport, FarmAssessment, LatLng, ScoredReport } from "./types";

export default function App() {
  const { t } = useTranslation();
  const mapRef = useRef<MapCanvasHandle>(null);

  const [farmPolygon, setFarmPolygon] = useState<LatLng[] | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [rawReports, setRawReports] = useState<DiseaseReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runToken, setRunToken] = useState(0);

  // Fetch a fresh batch of nearby reports whenever the farm boundary,
  // search radius, or manual re-run trigger changes.
  useEffect(() => {
    if (!farmPolygon || farmPolygon.length < 3) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const c = centroid(farmPolygon);
        const box = boundingBoxAround(c, radiusKm);
        const reports = await fetchReportsInBoundingBox(box);
        if (!cancelled) setRawReports(reports);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(t("errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmPolygon, radiusKm, runToken]);

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
  };

  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <aside className="sidebar">
          <div className="instructions-card card">
            <p>{t("map.instructions")}</p>
            <p>{t("map.editHint")}</p>
          </div>

          <RadiusControl radiusKm={radiusKm} onChange={setRadiusKm} disabled={loading} />

          {farmPolygon && (
            <button type="button" className="btn btn-ghost" onClick={handleClear}>
              {t("map.redraw")}
            </button>
          )}

          {farmPolygon && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => setRunToken((n) => n + 1)}
            >
              {loading ? t("controls.running") : t("controls.run")}
            </button>
          )}

          {error && <p className="no-reports-note">{error}</p>}

          {!farmPolygon && <EmptyState />}

          {farmPolygon && assessment && !loading && (
            <RiskPanel assessment={assessment} radiusKm={radiusKm} />
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
