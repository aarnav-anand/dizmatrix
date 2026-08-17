import { useTranslation } from "react-i18next";

export default function Legend() {
  const { t } = useTranslation();

  const rows: { key: string; color: string }[] = [
    { key: "critical", color: "var(--color-red-bright)" },
    { key: "high", color: "var(--color-red)" },
    { key: "moderate", color: "var(--color-amber)" },
    { key: "low", color: "var(--color-green)" },
  ];

  return (
    <div className="legend">
      <p className="legend-title">{t("legend.title")}</p>
      <div className="legend-row">
        <span className="legend-swatch polygon" />
        <span>{t("legend.farm")}</span>
      </div>
      {rows.map((r) => (
        <div className="legend-row" key={r.key}>
          <span className="legend-swatch" style={{ background: r.color }} />
          <span>{t(`legend.${r.key}`)}</span>
        </div>
      ))}
    </div>
  );
}
