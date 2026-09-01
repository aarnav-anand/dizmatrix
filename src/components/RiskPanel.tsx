import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { FarmAssessment, RiskLevel } from "../types";

const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "var(--color-green)",
  moderate: "var(--color-amber)",
  high: "var(--color-red)",
  critical: "var(--color-red-bright)",
};

interface Props {
  assessment: FarmAssessment;
  radiusKm: number;
}

export default function RiskPanel({ assessment, radiusKm }: Props) {
  const { t } = useTranslation();
  const levelColor = LEVEL_COLOR[assessment.overallLevel];

  return (
    <div className="disease-list">
      <p className="panel-label">{t("results.heading")}</p>

      <div
        className="card overall-card"
        style={{ color: levelColor, borderColor: levelColor }}
      >
        <div className="risk-dial" aria-hidden="true">
          {Math.round(assessment.overallScore)}
        </div>
        <div className="overall-meta">
          <p className="overall-level">
            {t("results.overall")}: {t(`risk.${assessment.overallLevel}`)}
          </p>
          <p className="overall-sub">
            {t("results.reportsConsidered")}: {assessment.totalReportsConsidered}
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-value">{assessment.areaHectares}</div>
          <div className="stat-label">
            {t("results.area")} ({t("results.hectares")})
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{radiusKm} km</div>
          <div className="stat-label">{t("controls.searchRadius")}</div>
        </div>
      </div>

      {/* Weather-based risk factors */}
      {assessment.riskFactors && assessment.riskFactors.length > 0 && (
        <div className="card risk-factors-card">
          <p className="risk-factors-title">🌡️ {t("results.weatherFactors")}</p>
          {assessment.riskFactors.map((factor, idx) => (
            <p key={idx} className="risk-factor-item">
              • {factor}
            </p>
          ))}
        </div>
      )}

      {/* Weather forecast summary */}
      {assessment.weatherForecast && assessment.weatherForecast.current && (
        <div className="card weather-summary-card">
          <p className="weather-title">{t("results.currentConditions")}</p>
          <div className="weather-grid">
            <div className="weather-item">
              <span className="weather-label">{t("results.temperature")}</span>
              <span className="weather-value">
                {assessment.weatherForecast.current.temperature.toFixed(1)}°C
              </span>
            </div>
            <div className="weather-item">
              <span className="weather-label">{t("results.humidity")}</span>
              <span className="weather-value">
                {assessment.weatherForecast.current.humidity}%
              </span>
            </div>
            <div className="weather-item">
              <span className="weather-label">{t("results.precipitation")}</span>
              <span className="weather-value">
                {assessment.weatherForecast.current.precipitation}mm
              </span>
            </div>
          </div>
        </div>
      )}

      {assessment.diseases.length === 0 ? (
        <p className="no-reports-note">{t("results.noReports", { radius: radiusKm })}</p>
      ) : (
        assessment.diseases.map((d) => {
          const color = LEVEL_COLOR[d.level];
          return (
            <div
              className="disease-card"
              key={`${d.crop}-${d.disease}`}
              style={{ "--level-color": color } as CSSProperties}
            >
              <div className="disease-card-top">
                <div>
                  <div className="crop-name">{d.crop}</div>
                  <h4>{d.disease}</h4>
                </div>
                <span className="level-pill">{t(`risk.${d.level}`)}</span>
              </div>

              {/* Weather boost indicator */}
              {d.weatherBoost && d.weatherBoost > 0 && (
                <div className="weather-boost-indicator">
                  🌡️ +{d.weatherBoost}% risk boost from weather conditions
                </div>
              )}

              <div className="disease-card-meta">
                <div>
                  {t("results.nearest")}:{" "}
                  <span className="value">{d.nearestKm} km</span>
                </div>
                <div>
                  {t("results.reportsPlural", { count: d.reportCount })}
                  {d.insideCount > 0 && (
                    <> · {t("results.insideField", { count: d.insideCount })}</>
                  )}
                </div>
                <div>
                  {t("results.lastSeen")}:{" "}
                  <span className="value">
                    {d.mostRecent ? new Date(d.mostRecent).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>

              {/* Epidemiological risks */}
              {d.epidemiologicalRisks && d.epidemiologicalRisks.length > 0 && (
                <div className="epidemiological-risks">
                  <p className="risks-title">{t("results.weatherRisks")}</p>
                  {d.epidemiologicalRisks.map((risk, idx) => (
                    <div key={idx} className="risk-item">
                      <div className="risk-name">{risk.name}</div>
                      <div className="risk-details">
                        <span className="risk-matching-days">
                          {risk.matchingDays} {t("results.daysOfFavorableConditions")}
                        </span>
                        <span className="risk-conditions">
                          {risk.conditions.idealTemperatureMin}–{risk.conditions.idealTemperatureMax}°C,{" "}
                          &gt;{risk.conditions.idealHumidityMin}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <p className="source-note">{t("results.sourceNote")}</p>
    </div>
  );
}