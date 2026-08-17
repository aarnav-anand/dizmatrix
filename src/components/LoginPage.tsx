import { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import { loginWithDifCode, type Farmer } from "../lib/supabaseClient";

interface Props {
  onLogin: (farmer: Farmer) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError(t("login.invalidLength"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const farmer = await loginWithDifCode(trimmed);
      if (!farmer) {
        setError(t("login.invalidCode"));
      } else {
        onLogin(farmer);
      }
    } catch {
      setError(t("login.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-lang-bar">
        <LanguageToggle />
      </div>
      <div className="login-card">
        <svg className="login-brand-mark" viewBox="0 0 32 32" aria-hidden="true">
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
        <h1 className="login-title">{t("app.name")}</h1>
        <p className="login-tagline">{t("app.tagline")}</p>

        <label className="login-label" htmlFor="dif-code">
          {t("login.enterCode")}
        </label>
        <input
          id="dif-code"
          className="login-input"
          type="text"
          maxLength={4}
          value={code}
          placeholder="XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setError(null);
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={loading}
        />

        {error && <p className="login-error">{error}</p>}

        <button
          className="btn btn-primary login-btn"
          onClick={handleSubmit}
          disabled={loading || code.trim().length === 0}
        >
          {loading ? t("login.verifying") : t("login.submit")}
        </button>

        <p className="login-footer">{t("login.hint")}</p>
      </div>
    </div>
  );
}
