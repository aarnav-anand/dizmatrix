import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { reportMarkerLevel } from "../lib/risk";
import type { LatLng, RiskLevel, ScoredReport } from "../types";
import Legend from "./Legend";

const LEVEL_HEX: Record<RiskLevel, string> = {
  low: "#8cc63f",
  moderate: "#e3a537",
  high: "#b23a2e",
  critical: "#d9503f",
};

// Fallback centre roughly over the user's region (Karjan, Gujarat) so the
// map opens somewhere useful before a farm is drawn.
const DEFAULT_CENTER: LatLng = { lat: 22.11, lng: 73.18 };
const DEFAULT_ZOOM = 13;
const LOCATE_ZOOM = 15;

export interface MapCanvasHandle {
  clear: () => void;
}

interface Props {
  onPolygonChange: (polygon: LatLng[] | null) => void;
  scoredReports: ScoredReport[];
  radiusKm: number;
  farmPolygon: LatLng[] | null;
}

const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  { onPolygonChange, scoredReports, radiusKm, farmPolygon },
  ref
) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const farmLayerRef = useRef<L.Layer | null>(null);
  const reportsLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.Circle | null>(null);
  const locationLayerRef = useRef<L.LayerGroup | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  onPolygonChangeRef.current = onPolygonChange;

  const extractLatLngs = (layer: L.Layer): LatLng[] => {
    const latlngs = (layer as L.Polygon).getLatLngs()[0] as L.LatLng[];
    return latlngs.map((p) => ({ lat: p.lat, lng: p.lng }));
  };

  const removeFarmLayer = () => {
    if (farmLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(farmLayerRef.current);
    }
    farmLayerRef.current = null;
  };

  // Map + Geoman draw control setup — runs once. Geoman (unlike
  // Leaflet.draw) tracks its own internal drawing state per-map and
  // re-enables cleanly after a shape is finished or removed, which is what
  // was getting stuck on mobile browsers before.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const reportsLayer = L.layerGroup().addTo(map);
    reportsLayerRef.current = reportsLayer;

    const pm = (map as any).pm;

    // Only the polygon tool + edit/drag/remove — everything else hidden.
    pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    // Global options tuned for touch drawing: snapping is switched off so
    // a tap landing near the start vertex on a small phone screen doesn't
    // prematurely auto-close the polygon after just a couple of points.
    // Shapes are finished either by tapping the first vertex deliberately
    // or via the "Finish" action button Geoman shows automatically while
    // drawing — not by a double-tap gesture, which is unreliable on touch.
    pm.setGlobalOptions({
      snappable: false,
      allowSelfIntersection: false,
      templineStyle: { color: "#8cc63f" },
      hintlineStyle: { color: "#8cc63f", dashArray: [4, 4] },
      pathOptions: { color: "#8cc63f", weight: 2, fillOpacity: 0.12 },
    });

    map.on("pm:create", (e: any) => {
      // Only one farm boundary at a time — replace any existing shape.
      removeFarmLayer();
      farmLayerRef.current = e.layer;
      e.layer.on("pm:edit", () => {
        onPolygonChangeRef.current(extractLatLngs(e.layer));
      });
      e.layer.on("pm:dragend", () => {
        onPolygonChangeRef.current(extractLatLngs(e.layer));
      });
      e.layer.on("pm:remove", () => {
        farmLayerRef.current = null;
        onPolygonChangeRef.current(null);
      });
      onPolygonChangeRef.current(extractLatLngs(e.layer));
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      locationLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose imperative clear() to the parent's "clear & redraw" button.
  useImperativeHandle(ref, () => ({
    clear: () => {
      const map = mapRef.current;
      removeFarmLayer();
      if (map) {
        const pm = (map as any).pm;
        // Make sure Geoman isn't left mid-draw from a previous attempt.
        pm.Draw?.Polygon?.disable();
      }
      onPolygonChangeRef.current(null);
    },
  }));

  // Redraw the search-radius circle whenever the farm polygon or radius changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (radiusLayerRef.current) {
      map.removeLayer(radiusLayerRef.current);
      radiusLayerRef.current = null;
    }

    if (farmPolygon && farmPolygon.length >= 3) {
      const lat =
        farmPolygon.reduce((s, p) => s + p.lat, 0) / farmPolygon.length;
      const lng =
        farmPolygon.reduce((s, p) => s + p.lng, 0) / farmPolygon.length;

      const circle = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "#4f8ec7",
        weight: 1,
        fillOpacity: 0.03,
        dashArray: "4 6",
      }).addTo(map);
      radiusLayerRef.current = circle;

      const bounds = circle.getBounds();
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [farmPolygon, radiusKm]);

  // Redraw report markers whenever the scored set changes.
  useEffect(() => {
    const layer = reportsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const r of scoredReports) {
      const level = reportMarkerLevel(r.weight);
      const color = LEVEL_HEX[level];
      const marker = L.circleMarker([r.latitude, r.longitude], {
        radius: r.insidePolygon ? 8 : 6,
        color,
        weight: r.insidePolygon ? 2.5 : 1.5,
        fillColor: color,
        fillOpacity: r.insidePolygon ? 0.85 : 0.55,
      });

      const dateStr = r.reported_at
        ? new Date(r.reported_at).toLocaleDateString()
        : "—";
      const confidencePct =
        r.confidence != null
          ? `${Math.round((r.confidence > 1 ? r.confidence : r.confidence * 100))}%`
          : "—";

      marker.bindPopup(
        `<div class="map-popup">
          <b>${escapeHtml(r.disease ?? r.disease_class ?? "—")}</b><br/>
          ${escapeHtml(r.crop ?? "—")}<br/>
          ${dateStr} · ${confidencePct} confidence<br/>
          ${r.distanceKm.toFixed(1)} km away
          <div class="risk-tag" style="color:${color}">${t(
          `risk.${level}`
        )}</div>
        </div>`
      );

      marker.addTo(layer);
    }
  }, [scoredReports, t]);

  // Centre the map on the browser's reported position, marking it with a dot
  // plus a circle showing the accuracy radius.
  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!navigator.geolocation) {
      setLocateError(t("map.locateUnsupported"));
      return;
    }

    setLocateError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        if (!mapRef.current) return;

        const { latitude, longitude, accuracy } = position.coords;

        if (locationLayerRef.current) {
          mapRef.current.removeLayer(locationLayerRef.current);
        }

        const layer = L.layerGroup([
          L.circleMarker([latitude, longitude], {
            radius: 6,
            color: "#4f8ec7",
            weight: 2,
            fillColor: "#4f8ec7",
            fillOpacity: 0.9,
          }),
          L.circle([latitude, longitude], {
            radius: Math.max(accuracy, 30),
            color: "#4f8ec7",
            weight: 1,
            fillOpacity: 0.08,
          }),
        ]).addTo(mapRef.current);
        locationLayerRef.current = layer;

        mapRef.current.setView([latitude, longitude], LOCATE_ZOOM);
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED
            ? t("map.locateDenied")
            : t("map.locateFailed")
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [t]);

  return (
    <div className="map-area">
      <div ref={containerRef} className="leaflet-map" role="application" />
      <div className="map-locate">
        <button
          type="button"
          className="btn btn-locate"
          onClick={handleLocate}
          disabled={locating}
        >
          {locating ? t("map.locating") : t("map.locate")}
        </button>
        {locateError && <p className="map-locate-error">{locateError}</p>}
      </div>
      <Legend />
    </div>
  );
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default MapCanvas;
