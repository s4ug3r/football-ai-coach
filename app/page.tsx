"use client";

import { useState } from "react";

type SessionPlan = {
  title: string;
  duration_min: number;
  frequency_per_week: number;
  phases: {
    name: string;
    duration_min: number;
    exercises: {
      name: string;
      duration_min: number;
      objective: string;
      organization: string;
      coaching_points: string;
      equipment: string;
    }[];
  }[];
};

type HomeWorkout = {
  title: string;
  duration_min: number;
  focus: string;
  blocks: {
    name: string;
    duration_min: number;
    exercises: {
      name: string;
      duration_min: number | null;
      sets_reps: string | null;
      objective: string;
      how_to: string;
      equipment: string;
      difficulty: string;
    }[];
  }[];
};

type Tab = "session" | "home";

export default function Home() {
  const [tab, setTab] = useState<Tab>("session");

  const [sDuration, setSDuration] = useState(90);
  const [sFreq, setSFreq] = useState(1);
  const [sFocus, setSFocus] = useState("Angriff");
  const [sLevel, setSLevel] = useState("U15+");
  const [sLocation, setSLocation] = useState("Platz");
  const [sEquipment, setSEquipment] = useState("Hütchen, Leibchen, Tore");
  const [sessionResult, setSessionResult] = useState<SessionPlan | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [hDuration, setHDuration] = useState(15);
  const [hFocus, setHFocus] = useState("Angriff");
  const [hLevel, setHLevel] = useState("Intermediate");
  const [hLocation, setHLocation] = useState("Zuhause");
  const [hEquipment, setHEquipment] = useState("Nur Ball");
  const [homeResult, setHomeResult] = useState<HomeWorkout | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  async function generateSession() {
    setSessionLoading(true);
    setSessionError(null);

    try {
      const response = await fetch("/api/generate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: sDuration,
          frequency_per_week: sFreq,
          focus: sFocus,
          level: sLevel,
          location: sLocation,
          equipment: sEquipment,
        }),
      });

      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || "Der Trainingsplan konnte nicht erstellt werden.");
      }

      setSessionResult(json.data);
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Unbekannter Fehler"
      );
    } finally {
      setSessionLoading(false);
    }
  }

  async function generateHome() {
    setHomeLoading(true);
    setHomeError(null);

    try {
      const response = await fetch("/api/generate-home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: hDuration,
          focus: hFocus,
          level: hLevel,
          location: hLocation,
          equipment: hEquipment,
        }),
      });

      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || "Das Home-Workout konnte nicht erstellt werden.");
      }

      setHomeResult(json.data);
    } catch (error) {
      setHomeError(
        error instanceof Error ? error.message : "Unbekannter Fehler"
      );
    } finally {
      setHomeLoading(false);
    }
  }

  const isSession = tab === "session";
  const currentResult = isSession ? sessionResult : homeResult;
  const currentLoading = isSession ? sessionLoading : homeLoading;
  const currentError = isSession ? sessionError : homeError;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">⚽</div>
          <div>
            <span className="brand-name">MATCHPLAN AI</span>
            <span className="brand-caption">Coach Workspace</span>
          </div>
        </div>

        <div className="status-pill" title="KI-System bereit">
          <span className="status-dot" aria-hidden="true" />
          KI bereit
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Fußballtraining · Einfach geplant</p>
        <h1>
          Bessere Einheiten.
          <br />
          <span>Weniger Planung.</span>
        </h1>
        <p>
          Erstelle in Sekunden strukturierte Teamtrainings und individuelle
          Home-Workouts für deine Spieler.
        </p>
      </section>

      <nav className="tab-list" aria-label="Trainingsart auswählen">
        <button
          type="button"
          className={`tab ${isSession ? "active" : ""}`}
          onClick={() => setTab("session")}
          aria-pressed={isSession}
        >
          <span className="tab-icon" aria-hidden="true">♟</span>
          <span>
            <span className="tab-title">Teamtraining</span>
            <span className="tab-description">90 Minuten für dein Team</span>
          </span>
        </button>

        <button
          type="button"
          className={`tab ${!isSession ? "active" : ""}`}
          onClick={() => setTab("home")}
          aria-pressed={!isSession}
        >
          <span className="tab-icon" aria-hidden="true">⌂</span>
          <span>
            <span className="tab-title">Home-Workout</span>
            <span className="tab-description">Individuell für zuhause</span>
          </span>
        </button>
      </nav>

      <section className="workspace">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Plan konfigurieren</p>
              <h2>{isSession ? "Teamtraining erstellen" : "Workout erstellen"}</h2>
            </div>
            <span className="plan-badge">
              {isSession ? "TEAM" : "SOLO"}
            </span>
          </div>

          {isSession ? (
            <div className="form-content">
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="session-duration">Dauer</label>
                  <select
                    id="session-duration"
                    value={sDuration}
                    onChange={(event) => setSDuration(Number(event.target.value))}
                  >
                    <option value={60}>60 Minuten</option>
                    <option value={75}>75 Minuten</option>
                    <option value={90}>90 Minuten</option>
                    <option value={105}>105 Minuten</option>
                    <option value={120}>120 Minuten</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="session-frequency">Training pro Woche</label>
                  <select
                    id="session-frequency"
                    value={sFreq}
                    onChange={(event) => setSFreq(Number(event.target.value))}
                  >
                    <option value={1}>1× pro Woche</option>
                    <option value={2}>2× pro Woche</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="session-focus">Fokus</label>
                  <select
                    id="session-focus"
                    value={sFocus}
                    onChange={(event) => setSFocus(event.target.value)}
                  >
                    <option>Angriff</option>
                    <option>Verteidigung</option>
                    <option>Pressing</option>
                    <option>Ballbesitz</option>
                    <option>Umschaltspiel</option>
                    <option>Standards</option>
                    <option>Athletik</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="session-level">Altersgruppe / Level</label>
                  <select
                    id="session-level"
                    value={sLevel}
                    onChange={(event) => setSLevel(event.target.value)}
                  >
                    <option>U11</option>
                    <option>U13</option>
                    <option>U15+</option>
                    <option>U17+</option>
                    <option>Senioren</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="session-location">Trainingsort</label>
                  <select
                    id="session-location"
                    value={sLocation}
                    onChange={(event) => setSLocation(event.target.value)}
                  >
                    <option>Platz</option>
                    <option>Halle</option>
                    <option>Kleinfeld</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="session-equipment">Equipment</label>
                  <input
                    id="session-equipment"
                    value={sEquipment}
                    onChange={(event) => setSEquipment(event.target.value)}
                    placeholder="z. B. Hütchen, Leibchen, Tore"
                  />
                </div>
              </div>

              <p className="helper">
                Die KI erstellt Warm-up, Schwerpunkt, Spielformen, Abschlussspiel
                und Cooldown passend zu deinem Thema.
              </p>

              <button
                type="button"
                className="generate-button"
                onClick={generateSession}
                disabled={sessionLoading}
                aria-busy={sessionLoading}
              >
                {sessionLoading && <span className="button-spinner" aria-hidden="true" />}
                {sessionLoading ? "Plan wird erstellt..." : "✦ Trainingsplan generieren"}
              </button>
            </div>
          ) : (
            <div className="form-content">
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="home-duration">Dauer</label>
                  <select
                    id="home-duration"
                    value={hDuration}
                    onChange={(event) => setHDuration(Number(event.target.value))}
                  >
                    <option value={10}>10 Minuten</option>
                    <option value={15}>15 Minuten</option>
                    <option value={20}>20 Minuten</option>
                    <option value={25}>25 Minuten</option>
                    <option value={30}>30 Minuten</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="home-focus">Fokus</label>
                  <select
                    id="home-focus"
                    value={hFocus}
                    onChange={(event) => setHFocus(event.target.value)}
                  >
                    <option>Angriff</option>
                    <option>Ballkontrolle</option>
                    <option>Dribbling</option>
                    <option>Passspiel</option>
                    <option>Koordination</option>
                    <option>Athletik</option>
                    <option>Stabilität</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="home-level">Level</label>
                  <select
                    id="home-level"
                    value={hLevel}
                    onChange={(event) => setHLevel(event.target.value)}
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="home-location">Ort</label>
                  <select
                    id="home-location"
                    value={hLocation}
                    onChange={(event) => setHLocation(event.target.value)}
                  >
                    <option>Zuhause</option>
                    <option>Garten</option>
                    <option>Platz</option>
                    <option>Halle</option>
                  </select>
                </div>

                <div className="field full">
                  <label htmlFor="home-equipment">Verfügbares Equipment</label>
                  <input
                    id="home-equipment"
                    value={hEquipment}
                    onChange={(event) => setHEquipment(event.target.value)}
                    placeholder="z. B. Nur Ball, Ball und Hütchen"
                  />
                </div>
              </div>

              <p className="helper">
                Ideal als kleine Trainingsaufgabe zwischen zwei Teamtrainings.
                Warm-up, Hauptteil und Finisher sind bereits eingeplant.
              </p>

              <button
                type="button"
                className="generate-button"
                onClick={generateHome}
                disabled={homeLoading}
                aria-busy={homeLoading}
              >
                {homeLoading && <span className="button-spinner" aria-hidden="true" />}
                {homeLoading ? "Workout wird erstellt..." : "✦ Home-Workout generieren"}
              </button>
            </div>
          )}

          {currentError && (
            <div className="error-box" role="alert">
              <strong>Das hat noch nicht geklappt:</strong><br />
              {currentError}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Dein Ergebnis</p>
              <h2>{isSession ? "Trainingsplan" : "Home-Workout"}</h2>
            </div>
            {currentResult && <span className="plan-badge">FERTIG</span>}
          </div>

          {!currentResult && !currentLoading && (
            <div className="empty-state">
              <div>
                <div className="empty-icon" aria-hidden="true">✦</div>
                <h3>Bereit für deinen Plan</h3>
                <p>
                  Wähle links die Parameter und lass dir einen strukturierten
                  Trainingsplan erstellen.
                </p>
              </div>
            </div>
          )}

          {currentLoading && (
            <div className="empty-state">
              <div>
                <div className="empty-icon">
                  <span className="button-spinner" aria-hidden="true" />
                </div>
                <h3>Dein Plan entsteht</h3>
                <p>
                  Die KI sortiert Übungen, Dauer und Coaching-Punkte für deine
                  Einheit.
                </p>
              </div>
            </div>
          )}

          {isSession && sessionResult && (
            <div className="result-content">
              <div className="result-heading">
                <h3>{sessionResult.title}</h3>
                <div className="result-meta">
                  <span className="meta-chip">⏱ {sessionResult.duration_min} Min</span>
                  <span className="meta-chip">↻ {sessionResult.frequency_per_week}× / Woche</span>
                  <span className="meta-chip">⚽ {sFocus}</span>
                </div>
              </div>

              <div className="phase-list">
                {sessionResult.phases.map((phase, phaseIndex) => (
                  <article className="phase-card" key={`${phase.name}-${phaseIndex}`}>
                    <div className="phase-header">
                      <div className="phase-title">
                        <span className="phase-index">{phaseIndex + 1}</span>
                        {phase.name}
                      </div>
                      <span className="time-chip">{phase.duration_min} Min</span>
                    </div>

                    <div className="exercise-list">
                      {phase.exercises.map((exercise, exerciseIndex) => (
                        <div className="exercise" key={`${exercise.name}-${exerciseIndex}`}>
                          <div className="exercise-name">
                            <span>{exercise.name}</span>
                            <span className="exercise-time">{exercise.duration_min} Min</span>
                          </div>
                          <p><strong>Ziel:</strong> {exercise.objective}</p>
                          <p><strong>Organisation:</strong> {exercise.organization}</p>
                          <p><strong>Coaching:</strong> {exercise.coaching_points}</p>
                          <p><strong>Material:</strong> {exercise.equipment}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <p className="footer-note">
                KI‑Vorschlag: Passe Belastung, Gruppengröße und Übungen stets an
                deine Mannschaft und die Tagesform an.
              </p>
            </div>
          )}

          {!isSession && homeResult && (
            <div className="result-content">
              <div className="result-heading">
                <h3>{homeResult.title}</h3>
                <div className="result-meta">
                  <span className="meta-chip">⏱ {homeResult.duration_min} Min</span>
                  <span className="meta-chip">⚽ {homeResult.focus}</span>
                  <span className="meta-chip">⌂ {hLocation}</span>
                </div>
              </div>

              <div className="phase-list">
                {homeResult.blocks.map((block, blockIndex) => (
                  <article className="phase-card" key={`${block.name}-${blockIndex}`}>
                    <div className="phase-header">
                      <div className="phase-title">
                        <span className="phase-index">{blockIndex + 1}</span>
                        {block.name}
                      </div>
                      <span className="time-chip">{block.duration_min} Min</span>
                    </div>

                    <div className="exercise-list">
                      {block.exercises.map((exercise, exerciseIndex) => (
                        <div className="exercise" key={`${exercise.name}-${exerciseIndex}`}>
                          <div className="exercise-name">
                            <span>{exercise.name}</span>
                            <span className="exercise-time">
                              {exercise.duration_min
                                ? `${exercise.duration_min} Min`
                                : exercise.sets_reps || "Übung"}
                            </span>
                          </div>
                          <p><strong>Ziel:</strong> {exercise.objective}</p>
                          <p><strong>Ausführung:</strong> {exercise.how_to}</p>
                          <p><strong>Material:</strong> {exercise.equipment}</p>
                          <p><strong>Level:</strong> {exercise.difficulty}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <p className="footer-note">
                KI‑Vorschlag: Bei Schmerzen, Schwindel oder Verletzung die Einheit
                abbrechen und fachlichen Rat einholen.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
