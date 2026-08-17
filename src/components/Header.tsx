import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";

interface Props {
  credits?: number;
  farmerName?: string | null;
}

export default function Header({ credits, farmerName }: Props) {
  const { t } = useTranslation();

  return (
    <header className="app-header">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M6 24 L10 8 L24 7 L26 22 Z"
            fill="none"
            stroke="var(--color-green)"
            strokeWidth="1.6"
            strokeDasharray="2.2 2"
          />
          <circle cx="19" cy="16" r="4" fill="var(--color-red)" />
          <circle
            cx="19"
            cy="16"
            r="7"
            fill="none"
            stroke="var(--color-red)"
            strokeWidth="1"
            opacity="0.5"
          />
        </svg>
        <span className="brand-name">{t("app.name")}</span>
        <span className="brand-tagline">{t("app.tagline")}</span>
      </div>
      <div className="header-right">
        {farmerName && (
          <span className="header-farmer">👤 {farmerName}</span>
        )}
        {credits !== undefined && (
          <span className={`header-credits ${credits <= 3 ? "header-credits-low" : ""}`}>
            🔬 {credits} {t("credits.remaining")}
          </span>
        )}
        <LanguageToggle />
      </div>
    </header>
  );
}
