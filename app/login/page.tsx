"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, role: "coach" },
          },
        });

        if (signUpError) throw signUpError;

        setMessage(
          "Trainer-Account erstellt. Prüfe jetzt dein E-Mail-Postfach und bestätige deine Adresse."
        );
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) throw signInError;

        router.push("/");
        router.refresh();
      }
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
          <span className="brand-mark" aria-hidden="true">⚽</span>
          <span>
            <strong>MATCHPLAN AI</strong>
            <small>Coach Workspace</small>
          </span>
        </a>

        <p className="eyebrow">Trainerbereich</p>
        <h1>{mode === "login" ? "Willkommen zurück" : "Trainerkonto erstellen"}</h1>
        <p className="auth-intro">
          {mode === "login"
            ? "Logge dich ein, um deine Trainingspläne zu verwalten."
            : "Erstelle dein Konto und speichere deine Trainingspläne dauerhaft."}
        </p>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
              setMessage(null);
            }}
          >
            Einloggen
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError(null);
              setMessage(null);
            }}
          >
            Registrieren
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="name">Dein Name</label>
              <input
                id="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. Max Mustermann"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="trainer@verein.de"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          {error && <div className="error-box auth-message">{error}</div>}
          {message && <div className="success-box auth-message">{message}</div>}

          <button className="generate-button" disabled={loading} type="submit">
            {loading && <span className="button-spinner" aria-hidden="true" />}
            {loading
              ? "Bitte warten..."
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
            Hinweis: Diese Registrierung ist nur für{" "}
            <strong>Trainer</strong>. Spieler registrieren sich über den
            Einladungs-Link ihres Trainers.
          </p>
        )}
      </section>
    </main>
  );
}
