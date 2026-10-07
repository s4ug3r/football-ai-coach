"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type UserRole = "coach" | "player" | null;

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) {
          throw new Error("Bitte gib deinen Namen ein.");
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: {
              full_name: name.trim(),
              role: "coach",
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        setMessage(
          "Trainer-Account erstellt. Prüfe jetzt dein E-Mail-Postfach und bestätige deine Adresse. Danach kannst du dich einloggen."
        );

        return;
      }

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        throw signInError;
      }

      const role = (signInData.user.user_metadata?.role ??
        null) as UserRole;

      if (role === "player") {
        router.push("/meine-aufgaben");
      } else {
        router.push("/");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Der Login konnte nicht durchgeführt werden."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="auth-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            ⚽
          </span>

          <span>
            <strong>MATCHPLAN AI</strong>
            <small>Coach Workspace</small>
          </span>
        </a>

        <p className="eyebrow">Trainerbereich</p>

        <h1>
          {mode === "login" ? "Willkommen zurück" : "Trainerkonto erstellen"}
        </h1>

        <p className="auth-intro">
          {mode === "login"
            ? "Logge dich ein, um deine Trainingspläne, Teams und Aufgaben zu verwalten."
            : "Erstelle dein Trainerkonto und speichere deine Trainingspläne dauerhaft."}
        </p>

        <div className="auth-switch" aria-label="Anmelde-Modus">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Einloggen
          </button>

          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => switchMode("signup")}
          >
            Als Trainer registrieren
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="coach-name">Dein Name</label>
              <input
                id="coach-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. Max Mustermann"
                autoComplete="name"
                disabled={loading}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="login-email">E-Mail-Adresse</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="trainer@verein.de"
              disabled={loading}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Passwort</label>
            <input
              id="login-password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindestens 8 Zeichen"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-box auth-message" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="success-box auth-message" role="status">
              {message}
            </div>
          )}

          <button
            className="generate-button"
            disabled={
              loading ||
              !email.trim() ||
              password.length < 8 ||
              (mode === "signup" && !name.trim())
            }
            type="submit"
          >
            {loading && (
              <span className="button-spinner" aria-hidden="true" />
            )}

            {loading
              ? "Bitte warten ..."
              : mode === "login"
                ? "Einloggen"
                : "Trainerkonto erstellen"}
          </button>
        </form>

        {mode === "login" && (
          <p className="auth-footnote">
            Du bist Spieler? Bitte registriere dich über den{" "}
            <strong>Einladungs-Link deines Trainers</strong>.
          </p>
        )}

        {mode === "signup" && (
          <p className="auth-footnote">
            Diese Registrierung ist nur für <strong>Trainer</strong>. Spieler
            registrieren sich ausschließlich über den Einladungs-Link ihres
            Trainers.
          </p>
        )}
      </section>
    </main>
  );
}
