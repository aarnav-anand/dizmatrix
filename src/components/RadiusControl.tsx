import { useTranslation } from "react-i18next";

interface Props {
  radiusKm: number;
  onChange: (km: number) => void;
  disabled?: boolean;
}

export default function RadiusControl({ radiusKm, onChange, disabled }: Props) {
  const { t } = useTranslation();

  return (
    <div className="card">
      <p className="panel-label">{t("controls.searchRadius")}</p>
      <div className="control-row">
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={radiusKm}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t("controls.searchRadius")}
        />
        <span className="radius-value">
          {radiusKm} {t("controls.km")}
        </span>
      </div>
    </div>
  );
}
