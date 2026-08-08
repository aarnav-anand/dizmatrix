import { useTranslation } from "react-i18next";

const LANGS: { code: "en" | "hi"; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
];

export default function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("hi") ? "hi" : "en";

  return (
    <div className="lang-toggle" role="group" aria-label={t("controls.language")}>
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          type="button"
          aria-pressed={current === lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
