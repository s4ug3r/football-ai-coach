"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type Tab = "session" | "home" | "saved";

type SessionExercise = {
  name: string;
  duration_min: number;
  objective: string;
  organization: string;
  coaching_points: string;
  equipment: string;
};

type SessionPhase = {
  name: string;
  duration_min: number;
  exercises: SessionExercise[];
};

type SessionPlan = {
  title: string;
  duration_min: number;
  frequency_per_week: number;
  phases: SessionPhase[];
};

type HomeExercise = {
  name: string;
  duration_min: number | null;
  sets_reps: string | null;
  objective: string;
  how_to: string;
  equipment: string;
  difficulty: string;
};

type HomeBlock = {
  name: string;
  duration_min: number;
  exercises: HomeExercise[];
};

type HomeWorkout = {
  title: string;
  duration_min: number;
  focus: string;
  blocks: HomeBlock[];
};

type SavedPlan = {
  id: string;
  user_id: string;
  title: string;
  plan_type: "team" | "home";
  focus: string;
  duration_min: number;
  plan_data: SessionPlan | HomeWorkout;
  created_at: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Ein unbekannter Fehler ist aufgetreten.";
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function isSessionPlan(plan: SessionPlan | HomeWorkout): plan is SessionPlan {
  return "phases" in plan;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("session");

  const [sessionDuration, setSessionDuration] = useState(90);
  const [sessionFrequency, setSessionFrequency] = useState(1);
  const [sessionFocus, setSessionFocus] = useState("Angriff");
  const [sessionLevel, setSessionLevel] = useState("U15+");
  const [sessionLocation, setSessionLocation] = useState("Platz");
  const [sessionEquipment, setSessionEquipment] = useState(
    "Hütchen, Leibchen, Tore"
  );

  const [homeDuration, setHomeDuration] = useState(15);
  const [homeFocus, setHomeFocus] = useState("Angriff");
  const [homeLevel, setHomeLevel] = useState("Intermediate");
  const [homeLocation, setHomeLocation] = useState("Zuhause");
  const [homeEquipment, setHomeEquipment] = useState("Nur Ball");

  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [homeWorkout, setHomeWorkout] = useState<HomeWorkout | null>(null);

  const [sessionLoading, setSessionLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savedPlansLoading, setSavedPlansLoading] = useState(false);
  const [savedPlansError, setSavedPlansError] = useState<string | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const isSessionTab = tab === "session";
  const isSavedTab = tab === "saved";

  useEffect(() => {
    let mounted = true;

    async function loadAuthenticatedUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);
      setAuthLoading(false);
    }

    void loadAuthenticatedUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    if (tab === "saved" && userId) {
      void loadSavedPlans();
    }
  }, [tab, userId]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function loadSavedPlans() {
    setSavedPlansLoading(true);
    setSavedPlansError(null);

    const { data, error } = await supabase
      .from("training_plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setSavedPlansError(error.message);
      setSavedPlansLoading(false);
      return;
    }

    setSavedPlans((data ?? []) as SavedPlan[]);
    setSavedPlansLoading(false);
  }

  async function generateSessionPlan() {
    setSessionLoading(true);
    setSessionError(null);

    try {
      const response = await fetch("/api/generate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: sessionDuration,
          frequency_per_week: sessionFrequency,
          focus: sessionFocus,
          level: sessionLevel,
          location: sessionLocation,
          equipment: sessionEquipment,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(
          json.error || "Der Trainingsplan konnte nicht erstellt werden."
        );
      }

      setSessionPlan(json.data as SessionPlan);
    } catch (error) {
      setSessionError(getErrorMessage(error));
    } finally {
      setSessionLoading(false);
    }
  }

  async function generateHomeWorkout() {
    setHomeLoading(true);
    setHomeError(null);

    try {
      const response = await fetch("/api/generate-home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: homeDuration,
          focus: homeFocus,
          level: homeLevel,
          location: homeLocation,
          equipment: homeEquipment,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(
          json.error || "Das Home-Workout konnte nicht erstellt werden."
        );
      }

      setHomeWorkout(json.data as HomeWorkout);
    } catch (error) {
      setHomeError(getErrorMessage(error));
    } finally {
      setHomeLoading(false);
    }
  }

  function openSaveDialog() {
    const plan = isSessionTab ? sessionPlan : homeWorkout;

    if (!plan) return;

    setSaveTitle(plan.title);
    setSaveError(null);
    setSaveDialogOpen(true);
  }

  async function saveCurrentPlan() {
    const plan = isSessionTab ? sessionPlan : homeWorkout;
    const title = saveTitle.trim();

    if (!userId || !plan) {
      setSaveError("Bitte erstelle zuerst einen Plan.");
      return;
    }

    if (!title) {
      setSaveError("Bitte gib einen Namen für den Plan ein.");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);

    const { error } = await supabase.from("training_plans").insert({
      user_id: userId,
      title,
      plan_type: isSessionTab ? "team" : "home",
      focus: isSessionTab ? sessionFocus : homeFocus,
      duration_min: plan.duration_min,
      plan_data: plan,
    });

    if (error) {
      setSaveError(error.message);
      setSaveLoading(false);
      return;
    }

    setSaveDialogOpen(false);
    setSaveLoading(false);
    setTab("saved");
    await loadSavedPlans();
  }

  async function deleteSavedPlan(planId: string) {
    const confirmed = window.confirm(
      "Möchtest du diesen gespeicherten Plan wirklich löschen?"
    );

    if (!confirmed) return;

    setDeleteLoadingId(planId);
    setSavedPlansError(null);

    const { error } = await supabase
      .from("training_plans")
      .delete()
      .eq("id", planId);

    if (error) {
      setSavedPlansError(error.message);
      setDeleteLoadingId(null);
      return;
    }

    setSavedPlans((current) => current.filter((plan) => plan.id !== planId));
    setDeleteLoadingId(null);
  }

  function openSavedPlan(plan: SavedPlan) {
    if (plan.plan_type === "team" && isSessionPlan(plan.plan_data)) {
      setSessionPlan(plan.plan_data);
      setSessionFocus(plan.focus);
      setTab("session");
      return;
    }

    if (plan.plan_type === "home" && !isSessionPlan(plan.plan_data)) {
      setHomeWorkout(plan.plan_data);
      setHomeFocus(plan.focus);
      setTab("home");
    }
  }

  function printPlan() {
    window.print();
  }

  const currentPlan = isSessionTab ? sessionPlan : homeWorkout;
  const currentLoading = isSessionTab ? sessionLoading : homeLoading;
  const currentError = isSessionTab ? sessionError : homeError;
  const hasCurrentPlan = Boolean(currentPlan);

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Trainerbereich wird geladen …</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar no-print">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ⚽
          </div>
          <div>
            <span className="brand-name">MATCHPLAN AI</span>
            <span className="brand-caption">Coach Workspace</span>
          </div>
        </div>

        <div className="topbar-actions">
          <a className="status-pill link-pill" href="/teams">
            Teams
          </a>

          {userEmail && (
            <span className="user-email" title={userEmail}>
              {userEmail}
            </span>
          )}

          <button
            type="button"
            className="status-pill logout-button"
            onClick={signOut}
          >
            <span className="status-dot" aria-hidden="true" />
            Ausloggen
          </button>
        </div>
      </header>

      <section className="hero no-print">
        <p className="eyebrow">Fußballtraining · Einfach geplant</p>
        <h1>
          Bessere Einheiten.
          <br />
          <span>Weniger Planung.</span>
        </h1>
        <p>
          Erstelle strukturierte Teamtrainings und individuelle Home-Workouts
          für deine Spieler – in wenigen Sekunden.
        </p>
      </section>

      <nav className="tab-list no-print" aria-label="Bereich auswählen">
        <button
          type="button"
          className={`tab ${tab === "session" ? "active" : ""}`}
          onClick={() => setTab("session")}
        >
          <span className="tab-icon" aria-hidden="true">
            ⚽
          </span>
          <span>
            <span className="tab-title">Teamtraining</span>
            <span className="tab-description">
              Strukturierte Einheit für die Mannschaft
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`tab ${tab === "home" ? "active" : ""}`}
          onClick={() => setTab("home")}
        >
          <span className="tab-icon" aria-hidden="true">
            ⌂
          </span>
          <span>
            <span className="tab-title">Home-Workout</span>
            <span className="tab-description">
              Individuelle Aufgabe für zuhause
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`tab ${tab === "saved" ? "active" : ""}`}
          onClick={() => setTab("saved")}
        >
          <span className="tab-icon" aria-hidden="true">
            ▣
          </span>
          <span>
            <span className="tab-title">Meine Pläne</span>
            <span className="tab-description">
              Speichern, öffnen und wiederverwenden
            </span>
          </span>
        </button>
      </nav>

      {isSavedTab ? (
        <section className="saved-page">
          <div className="saved-page-header">
            <div>
              <p className="panel-kicker">Deine Bibliothek</p>
              <h2>Meine gespeicherten Pläne</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadSavedPlans()}
              disabled={savedPlansLoading}
            >
              {savedPlansLoading ? "Lädt ..." : "↻ Aktualisieren"}
            </button>
          </div>

          {savedPlansError && (
            <div className="error-box saved-error" role="alert">
              <strong>Pläne konnten nicht geladen werden:</strong>
              <br />
              {savedPlansError}
            </div>
          )}

          {savedPlansLoading && (
            <div className="saved-empty">
              <span className="button-spinner" aria-hidden="true" />
              <p>Deine Pläne werden geladen …</p>
            </div>
          )}

          {!savedPlansLoading &&
            !savedPlansError &&
            savedPlans.length === 0 && (
              <div className="saved-empty">
                <div>
                  <div className="empty-icon" aria-hidden="true">
                    ▣
                  </div>
                  <h3>Noch keine gespeicherten Pläne</h3>
                  <p>
                    Generiere einen Trainingsplan oder ein Home-Workout und
                    speichere ihn anschließend hier.
                  </p>
                </div>
              </div>
            )}

          {!savedPlansLoading && savedPlans.length > 0 && (
            <div className="saved-plan-grid">
              {savedPlans.map((plan) => (
                <article className="saved-plan-card" key={plan.id}>
                  <div className="saved-card-top">
                    <span className="saved-type">
                      {plan.plan_type === "team"
                        ? "TEAMTRAINING"
                        : "HOME-WORKOUT"}
                    </span>
                    <span className="saved-date">
                      {formatDate(plan.created_at)}
                    </span>
                  </div>

                  <h3>{plan.title}</h3>

                  <div className="saved-card-meta">
                    <span>⚽ {plan.focus}</span>
                    <span>⏱ {plan.duration_min} Min</span>
                  </div>

                  <div className="saved-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openSavedPlan(plan)}
                    >
                      Öffnen
                    </button>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void deleteSavedPlan(plan.id)}
                      disabled={deleteLoadingId === plan.id}
                    >
                      {deleteLoadingId === plan.id ? "Löscht ..." : "Löschen"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="workspace">
          <section className="panel no-print">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Plan konfigurieren</p>
                <h2>
                  {isSessionTab
                    ? "Teamtraining erstellen"
                    : "Home-Workout erstellen"}
                </h2>
              </div>

              <span className="plan-badge">
                {isSessionTab ? "TEAM" : "SOLO"}
              </span>
            </div>

            {isSessionTab ? (
              <div className="form-content">
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="session-duration">Dauer</label>
                    <select
                      id="session-duration"
                      value={sessionDuration}
                      onChange={(event) =>
                        setSessionDuration(Number(event.target.value))
                      }
                    >
                      <option value={60}>60 Minuten</option>
                      <option value={75}>75 Minuten</option>
                      <option value={90}>90 Minuten</option>
                      <option value={105}>105 Minuten</option>
                      <option value={120}>120 Minuten</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="session-frequency">
                      Training pro Woche
                    </label>
                    <select
                      id="session-frequency"
                      value={sessionFrequency}
                      onChange={(event) =>
                        setSessionFrequency(Number(event.target.value))
                      }
                    >
                      <option value={1}>1× pro Woche</option>
                      <option value={2}>2× pro Woche</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="session-focus">Fokus</label>
                    <select
                      id="session-focus"
                      value={sessionFocus}
                      onChange={(event) =>
                        setSessionFocus(event.target.value)
                      }
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
                    <label htmlFor="session-level">
                      Altersgruppe / Level
                    </label>
                    <select
                      id="session-level"
                      value={sessionLevel}
                      onChange={(event) =>
                        setSessionLevel(event.target.value)
                      }
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
                      value={sessionLocation}
                      onChange={(event) =>
                        setSessionLocation(event.target.value)
                      }
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
                      value={sessionEquipment}
                      onChange={(event) =>
                        setSessionEquipment(event.target.value)
                      }
                      placeholder="Hütchen, Leibchen, Tore"
                    />
                  </div>
                </div>

                <p className="helper">
                  Die KI erstellt Warm-up, Schwerpunkt, Spielformen,
                  Abschlussspiel und Cooldown passend zu deinem Thema.
                </p>

                <button
                  type="button"
                  className="generate-button"
                  onClick={generateSessionPlan}
                  disabled={sessionLoading}
                >
                  {sessionLoading && (
                    <span className="button-spinner" aria-hidden="true" />
                  )}
                  {sessionLoading
                    ? "Plan wird erstellt ..."
                    : "✦ Trainingsplan generieren"}
                </button>
              </div>
            ) : (
              <div className="form-content">
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="home-duration">Dauer</label>
                    <select
                      id="home-duration"
                      value={homeDuration}
                      onChange={(event) =>
                        setHomeDuration(Number(event.target.value))
                      }
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
                      value={homeFocus}
                      onChange={(event) => setHomeFocus(event.target.value)}
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
                      value={homeLevel}
                      onChange={(event) => setHomeLevel(event.target.value)}
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
                      value={homeLocation}
                      onChange={(event) =>
                        setHomeLocation(event.target.value)
                      }
                    >
                      <option>Zuhause</option>
                      <option>Garten</option>
                      <option>Platz</option>
                      <option>Halle</option>
                    </select>
                  </div>

                  <div className="field full">
                    <label htmlFor="home-equipment">
                      Verfügbares Equipment
                    </label>
                    <input
                      id="home-equipment"
                      value={homeEquipment}
                      onChange={(event) =>
                        setHomeEquipment(event.target.value)
                      }
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
                  onClick={generateHomeWorkout}
                  disabled={homeLoading}
                >
                  {homeLoading && (
                    <span className="button-spinner" aria-hidden="true" />
                  )}
                  {homeLoading
                    ? "Workout wird erstellt ..."
                    : "✦ Home-Workout generieren"}
                </button>
              </div>
            )}

            {currentError && (
              <div className="error-box" role="alert">
                <strong>Das hat noch nicht geklappt:</strong>
                <br />
                {currentError}
              </div>
            )}
          </section>

          <section className="panel print-plan">
            <div className="panel-header no-print">
              <div>
                <p className="panel-kicker">Dein Ergebnis</p>
                <h2>{isSessionTab ? "Trainingsplan" : "Home-Workout"}</h2>
              </div>

              {hasCurrentPlan && (
                <div className="result-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={openSaveDialog}
                    title="Plan speichern"
                  >
                    ♡ <span>Speichern</span>
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={printPlan}
                    title="Plan drucken oder als PDF speichern"
                  >
                    ⎙ <span>Drucken</span>
                  </button>
                </div>
              )}
            </div>

            {!hasCurrentPlan && !currentLoading && (
              <div className="empty-state">
                <div>
                  <div className="empty-icon" aria-hidden="true">
                    ✦
                  </div>
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

            {isSessionTab && sessionPlan && !currentLoading && (
              <PlanView
                plan={sessionPlan}
                focus={sessionFocus}
                planType="team"
              />
            )}

            {!isSessionTab && homeWorkout && !currentLoading && (
              <PlanView
                plan={homeWorkout}
                focus={homeFocus}
                planType="home"
              />
            )}
          </section>
        </section>
      )}

      {saveDialogOpen && (
        <div
          className="modal-backdrop no-print"
          role="presentation"
          onMouseDown={() => {
            if (!saveLoading) setSaveDialogOpen(false);
          }}
        >
          <section
            className="save-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="panel-kicker">Plan speichern</p>
            <h2 id="save-dialog-title">Gib deinem Plan einen Namen</h2>
            <p>
              Du kannst ihn später unter „Meine Pläne“ öffnen, drucken oder
              erneut verwenden.
            </p>

            <div className="field">
              <label htmlFor="save-plan-title">Planname</label>
              <input
                id="save-plan-title"
                value={saveTitle}
                maxLength={120}
                autoFocus
                onChange={(event) => setSaveTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void saveCurrentPlan();
                  }
                }}
              />
            </div>

            {saveError && (
              <div className="error-box modal-error" role="alert">
                {saveError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSaveDialogOpen(false)}
                disabled={saveLoading}
              >
                Abbrechen
              </button>

              <button
                type="button"
                className="generate-button modal-save-button"
                onClick={() => void saveCurrentPlan()}
                disabled={saveLoading}
              >
                {saveLoading && (
                  <span className="button-spinner" aria-hidden="true" />
                )}
                {saveLoading ? "Speichert ..." : "Plan speichern"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function PlanView({
  plan,
  focus,
  planType,
}: {
  plan: SessionPlan | HomeWorkout;
  focus: string;
  planType: "team" | "home";
}) {
  if (planType === "team" && isSessionPlan(plan)) {
    return (
      <div className="result-content">
        <div className="result-heading">
          <h3>{plan.title}</h3>
          <div className="result-meta">
            <span className="meta-chip">⏱ {plan.duration_min} Min</span>
            <span className="meta-chip">
              ↻ {plan.frequency_per_week}× / Woche
            </span>
            <span className="meta-chip">⚽ {focus}</span>
          </div>
        </div>

        <div className="phase-list">
          {plan.phases.map((phase, phaseIndex) => (
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
                  <div
                    className="exercise"
                    key={`${exercise.name}-${exerciseIndex}`}
                  >
                    <div className="exercise-name">
                      <span>{exercise.name}</span>
                      <span className="exercise-time">
                        {exercise.duration_min} Min
                      </span>
                    </div>

                    <p>
                      <strong>Ziel:</strong> {exercise.objective}
                    </p>
                    <p>
                      <strong>Organisation:</strong> {exercise.organization}
                    </p>
                    <p>
                      <strong>Coaching:</strong> {exercise.coaching_points}
                    </p>
                    <p>
                      <strong>Material:</strong> {exercise.equipment}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <p className="footer-note">
          KI-Vorschlag: Passe Belastung, Gruppengröße und Übungen stets an deine
          Mannschaft und die Tagesform an.
        </p>
      </div>
    );
  }

  if (planType === "home" && !isSessionPlan(plan)) {
    return (
      <div className="result-content">
        <div className="result-heading">
          <h3>{plan.title}</h3>
          <div className="result-meta">
            <span className="meta-chip">⏱ {plan.duration_min} Min</span>
            <span className="meta-chip">⚽ {plan.focus || focus}</span>
          </div>
        </div>

        <div className="phase-list">
          {plan.blocks.map((block, blockIndex) => (
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
                  <div
                    className="exercise"
                    key={`${exercise.name}-${exerciseIndex}`}
                  >
                    <div className="exercise-name">
                      <span>{exercise.name}</span>
                      <span className="exercise-time">
                        {exercise.duration_min
                          ? `${exercise.duration_min} Min`
                          : exercise.sets_reps || "Übung"}
                      </span>
                    </div>

                    <p>
                      <strong>Ziel:</strong> {exercise.objective}
                    </p>
                    <p>
                      <strong>Ausführung:</strong> {exercise.how_to}
                    </p>
                    <p>
                      <strong>Material:</strong> {exercise.equipment}
                    </p>
                    <p>
                      <strong>Level:</strong> {exercise.difficulty}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <p className="footer-note">
          KI-Vorschlag: Bei Schmerzen, Schwindel oder Verletzung die Einheit
          abbrechen und fachlichen Rat einholen.
        </p>
      </div>
    );
  }

  return null;
}
