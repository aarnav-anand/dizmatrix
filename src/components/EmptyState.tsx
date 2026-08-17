import { useTranslation } from "react-i18next";

export default function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M10 36 L15 12 L36 10 L38 34 Z"
          stroke="var(--color-text-faint)"
          strokeWidth="1.6"
          strokeDasharray="3 3"
        />
        <circle cx="24" cy="24" r="2.5" fill="var(--color-text-faint)" />
      </svg>
      <h3>{t("empty.title")}</h3>
      <p>{t("empty.body")}</p>
    </div>
  );
}
