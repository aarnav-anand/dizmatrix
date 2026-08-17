import { useTranslation } from "react-i18next";

interface Props {
  credits: number;
}

export default function CreditBadge({ credits }: Props) {
  const { t } = useTranslation();

  if (credits <= 0) {
    return (
      <div className="credit-exhausted">
        <span>⚠️ {t("credits.exhausted")}</span>
        <a
          href="https://agrifusion-web.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="credit-link"
        >
          {t("credits.purchase")}
        </a>
      </div>
    );
  }

  return (
    <div className={`credit-badge ${credits <= 3 ? "credit-low" : ""}`}>
      <span className="credit-icon">🔬</span>
      <span className="credit-count">{credits}</span>
      <span className="credit-label">{t("credits.remaining")}</span>
    </div>
  );
}
