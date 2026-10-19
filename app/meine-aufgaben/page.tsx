"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Assignment = {
  id: string;
  player_id: string;
  training_plan_id: string;
  due_date: string | null;
  status: "assigned" | "completed";
  completed_at: string | null;
  rpe: number | null;
  player_note: string | null;
  created_at: string;
};

type TrainingPlan = {
  id: string;
  title: string;
  focus: string | null;
  duration_min: number;
  plan_type: "team" | "home";
  plan_data: unknown;
};

type Exercise = {
  name?: string;
  duration_min?: number | null;
  sets_reps?: string | null;
  objective?: string;
  how_to?: string;
  organization?: string;
  coaching_points?: string;
  equipment?: string;
  difficulty?: string;
};

type WorkoutSection = {
  name: string;
  duration_min: number | null;
  exercises: Exercise[];
};

type Filter = "open" | "completed" | "all";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Ein unbekannter Fehler ist aufgetreten.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getSections(planData: unknown): WorkoutSection[] {
  if (!isRecord(planData)) return [];

  const rawSections = Array.isArray(planData.blocks)
    ? planData.blocks
    : Array.isArray(planData.phases)
      ? planData.phases
      : [];

  return rawSections.filter(isRecord).map((section) => ({
    name: getString(section.name) || "Trainingsblock",
    duration_min:
      typeof section.duration_min === "number"
        ? section.duration_min
        : null,
    exercises: Array.isArray(section.exercises)
      ? section.exercises.filter(isRecord).map((exercise) => ({
          name: getString(exercise.name),
          duration_min:
            typeof exercise.duration_min === "number"
              ? exercise.duration_min
              : null,
          sets_reps: getString(exercise.sets_reps),
          objective: getString(exercise.objective),
          how_to: getString(exercise.how_to),
          organization: getString(exercise.organization),
          coaching_points: getString(exercise.coaching_points),
          equipment: getString(exercise.equipment),
          difficulty: getString(exercise.difficulty),
        }))
      : [],
  }));
}

function formatDate(value: string | null): string {
  if (!value) return "Ohne Frist";

  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T12:00:00`
      : value
  );

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function localToday(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function WorkoutDetails({ plan }: { plan: TrainingPlan }) {
  const sections = getSections(plan.plan_data);

  if (sections.length === 0) {
    return (
      <p className="helper">
        Für diesen Plan konnten keine Übungsdetails geladen werden.
        Bitte frage deinen Trainer.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
      {sections.map((section, sectionIndex) => (
        <article
          className="phase-card"
          key={`${section.name}-${sectionIndex}`}
        >
          <div className="phase-header">
            <div className="phase-title">
              <span className="phase-index">
                {sectionIndex + 1}
              </span>
              {section.name}
            </div>

            {section.duration_min !== null && (
              <span className="time-chip">
                {section.duration_min} Min
              </span>
            )}
          </div>

          <div className="exercise-list">
            {section.exercises.map((exercise, exerciseIndex) => (
              <div
                className="exercise"
                key={`${exercise.name}-${exerciseIndex}`}
              >
                <div className="exercise-name">
                  <span>{exercise.name || "Übung"}</span>

                  <span className="exercise-time">
                    {exercise.duration_min != null
                      ? `${exercise.duration_min} Min`
                      : exercise.sets_reps || ""}
                  </span>
                </div>

                {exercise.duration_min != null &&
                  exercise.sets_reps && (
                    <p>Umfang: {exercise.sets_reps}</p>
                  )}

                {exercise.objective && (
                  <p>Ziel: {exercise.objective}</p>
                )}

                {exercise.how_to && (
                  <p>Ausführung: {exercise.how_to}</p>
                )}

                {exercise.organization && (
                  <p>Organisation: {exercise.organization}</p>
                )}

                {exercise.coaching_points && (
                  <p>Hinweise: {exercise.coaching_points}</p>
                )}

                {exercise.equipment && (
                  <p>Material: {exercise.equipment}</p>
                )}

                {exercise.difficulty && (
                  <p>Level: {exercise.difficulty}</p>
                )}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function MeineAufgabenPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("Spieler");
  const [authLoading, setAuthLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [filter, setFilter] = useState<Filter>("open");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [rpe, setRpe] = useState(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(
    null
  );

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkUser() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        if (user.user_metadata?.role !== "player") {
          router.replace("/");
          return;
        }

        setUserId(user.id);

        const name = user.user_metadata?.full_name;

        if (typeof name === "string" && name.trim()) {
          setPlayerName(name.trim());
        }

        setAuthLoading(false);
      } catch (err) {
        if (!active) return;

        setError(getErrorMessage(err));
        setAuthLoading(false);
        setLoading(false);
      }
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session?.user) {
        setUserId(null);
        setAssignments([]);
        setPlans([]);
        router.replace("/login");
      } else if (session.user.user_metadata?.role !== "player") {
        router.replace("/");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const loadAssignments = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } =
        await supabase
          .from("players")
          .select("id")
          .eq("auth_user_id", userId);

      if (profileError) throw profileError;

      const profiles = profileData ?? [];

      setHasProfile(profiles.length > 0);

      if (profiles.length === 0) {
        setAssignments([]);
        setPlans([]);
        return;
      }

      const { data: assignmentData, error: assignmentError } =
        await supabase
          .from("workout_assignments")
          .select(
            "id, player_id, training_plan_id, due_date, status, completed_at, rpe, player_note, created_at"
          )
          .in(
            "player_id",
            profiles.map((profile) => profile.id)
          )
          .order("due_date", {
            ascending: true,
            nullsFirst: false,
          })
          .order("created_at", { ascending: false });

      if (assignmentError) throw assignmentError;

      const loadedAssignments =
        (assignmentData ?? []) as Assignment[];

      const planIds = [
        ...new Set(
          loadedAssignments.map(
            (assignment) => assignment.training_plan_id
          )
        ),
      ];

      let loadedPlans: TrainingPlan[] = [];

      if (planIds.length > 0) {
        const { data: planData, error: planError } =
          await supabase
            .from("training_plans")
            .select(
              "id, title, focus, duration_min, plan_type, plan_data"
            )
            .in("id", planIds);

        if (planError) throw planError;

        loadedPlans = (planData ?? []) as TrainingPlan[];
      }

      setAssignments(loadedAssignments);
      setPlans(loadedPlans);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) {
      void loadAssignments();
    }
  }, [userId, loadAssignments]);

  function openFeedback(assignment: Assignment) {
    setSelectedAssignment(assignment);
    setRpe(assignment.rpe ?? 5);
    setNote(assignment.player_note ?? "");
    setFeedbackError(null);
    setMessage(null);
  }

  function closeFeedback() {
    if (saving) return;

    setSelectedAssignment(null);
    setFeedbackError(null);
  }

  async function saveFeedback(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedAssignment || saving) return;

    setSaving(true);
    setFeedbackError(null);

    try {
      if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
        throw new Error(
          "Bitte wähle eine Belastung zwischen 1 und 10."
        );
      }

      const { error: saveError } = await supabase.rpc(
        "complete_player_workout",
        {
          p_assignment_id: selectedAssignment.id,
          p_rpe: rpe,
          p_note: note.trim() || null,
        }
      );

      if (saveError) throw saveError;

      setSelectedAssignment(null);
      setMessage(
        "Gespeichert! Dein Trainer kann deinen Erledigt-Status und dein Feedback jetzt sehen."
      );
      setFilter("completed");

      await loadAssignments();
    } catch (err) {
      setFeedbackError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);

    try {
      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) throw signOutError;

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSigningOut(false);
    }
  }

  const plansById = new Map(
    plans.map((plan) => [plan.id, plan])
  );

  const openCount = assignments.filter(
    (assignment) => assignment.status !== "completed"
  ).length;

  const completedCount = assignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  const visibleAssignments = assignments.filter((assignment) => {
    if (filter === "all") return true;

    return filter === "completed"
      ? assignment.status === "completed"
      : assignment.status !== "completed";
  });

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Spielerbereich wird geladen …</p>
        </section>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Anmeldung erforderlich</h1>

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          <a className="secondary-button" href="/login">
            Zum Login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ⚽
          </div>

          <div>
            <span className="brand-name">MATCHPLAN AI</span>
            <span className="brand-caption">
              Spielerbereich
            </span>
          </div>
        </div>

        <button
          type="button"
          className="status-pill logout-button"
          onClick={() => void signOut()}
          disabled={signingOut || saving}
        >
          {signingOut ? "Meldet ab …" : "Ausloggen"}
        </button>
      </header>

      <section className="hero">
        <p className="eyebrow">Dein Training</p>

        <h1>
          Hallo,
          <br />
          <span>{playerName}</span>
        </h1>

        <p>
          Öffne deine Workouts, führe die Übungen durch und gib
          deinem Trainer anschließend eine Rückmeldung.
        </p>
      </section>

      {error && (
        <div
          className="error-box"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          Aufgaben konnten nicht vollständig geladen werden:{" "}
          {error}
        </div>
      )}

      {message && (
        <div
          className="success-box"
          role="status"
          style={{ marginBottom: 20 }}
        >
          {message}
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Deine Aufgaben</p>
            <h2>Meine Workouts</h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadAssignments()}
            disabled={loading || saving}
          >
            {loading ? "Lädt …" : "↻ Aktualisieren"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            padding: "16px 20px",
          }}
        >
          {[
            {
              key: "open" as const,
              label: `Offen (${openCount})`,
            },
            {
              key: "completed" as const,
              label: `Erledigt (${completedCount})`,
            },
            {
              key: "all" as const,
              label: `Alle (${assignments.length})`,
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                filter === item.key
                  ? "assign-button"
                  : "secondary-button"
              }
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">
            <div>
              <span
                className="button-spinner"
                aria-hidden="true"
              />
              <p>Deine Aufgaben werden geladen …</p>
            </div>
          </div>
        ) : error ? (
          <p className="helper" style={{ padding: 20 }}>
            Bitte versuche es über „Aktualisieren“ erneut.
          </p>
        ) : !hasProfile ? (
          <div className="empty-state">
            <div>
              <h3>Teamzuordnung fehlt</h3>
              <p>
                Dein Login funktioniert, ist aber noch nicht mit
                einem Spielerprofil verbunden. Bitte kontaktiere
                deinen Trainer.
              </p>
            </div>
          </div>
        ) : visibleAssignments.length === 0 ? (
          <div className="empty-state">
            <div>
              <div className="empty-icon" aria-hidden="true">
                ⚽
              </div>

              <h3>
                {filter === "completed"
                  ? "Noch keine erledigten Workouts"
                  : filter === "open"
                    ? "Keine offenen Workouts"
                    : "Noch keine zugewiesenen Workouts"}
              </h3>

              <p>
                Neue Zuweisungen kannst du über „Aktualisieren“
                laden.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
              padding: 20,
            }}
          >
            {visibleAssignments.map((assignment) => {
              const plan = plansById.get(
                assignment.training_plan_id
              );

              const completed =
                assignment.status === "completed";

              const overdue =
                !completed &&
                assignment.due_date !== null &&
                assignment.due_date < localToday();

              return (
                <article
                  key={assignment.id}
                  style={{
                    padding: 20,
                    border:
                      "1px solid rgba(187,255,205,0.16)",
                    borderRadius: 16,
                    background: "rgba(4,17,10,0.38)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <p className="panel-kicker">
                        {plan?.plan_type === "team"
                          ? "Teamtraining"
                          : "Home-Workout"}
                      </p>

                      <h3 style={{ margin: "4px 0 12px" }}>
                        {plan?.title ||
                          "Trainingsplan nicht verfügbar"}
                      </h3>
                    </div>

                    <span className="meta-chip">
                      {completed
                        ? "✓ Erledigt"
                        : overdue
                          ? "Frist überschritten"
                          : "Offen"}
                    </span>
                  </div>

                  <div
                    className="result-meta"
                    style={{ marginBottom: 16 }}
                  >
                    {plan && (
                      <span className="meta-chip">
                        ⏱ {plan.duration_min} Min
                      </span>
                    )}

                    {plan?.focus && (
                      <span className="meta-chip">
                        ⚽ {plan.focus}
                      </span>
                    )}

                    <span className="meta-chip">
                      Fällig: {formatDate(assignment.due_date)}
                    </span>
                  </div>

                  {plan ? (
                    <details style={{ marginBottom: 18 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          fontWeight: 700,
                          padding: "8px 0",
                        }}
                      >
                        Übungen und Anleitung anzeigen
                      </summary>

                      <WorkoutDetails plan={plan} />
                    </details>
                  ) : (
                    <p className="helper">
                      Der Plan fehlt oder ist für deinen Account
                      nicht lesbar. Bitte informiere deinen
                      Trainer.
                    </p>
                  )}

                  {completed && (
                    <div
                      style={{
                        marginBottom: 14,
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(100,255,150,0.08)",
                        border:
                          "1px solid rgba(100,255,150,0.18)",
                      }}
                    >
                      <p style={{ margin: "0 0 8px" }}>
                        Erledigt am:{" "}
                        {formatDate(assignment.completed_at)}
                      </p>

                      <p style={{ margin: 0 }}>
                        Belastung:{" "}
                        {assignment.rpe !== null
                          ? `${assignment.rpe}/10`
                          : "Noch nicht bewertet"}
                      </p>

                      {assignment.player_note && (
                        <p
                          style={{
                            margin: "10px 0 0",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          Kommentar: {assignment.player_note}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className={
                      completed
                        ? "secondary-button"
                        : "assign-button"
                    }
                    onClick={() => openFeedback(assignment)}
                    disabled={!plan}
                  >
                    {completed
                      ? "Feedback bearbeiten"
                      : "✓ Erledigt und bewerten"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedAssignment && (
        <div
          className="modal-backdrop no-print"
          onMouseDown={closeFeedback}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeFeedback();
          }}
        >
          <section
            className="save-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              maxHeight: "calc(100dvh - 40px)",
              overflowY: "auto",
            }}
          >
            <p className="panel-kicker">
              Trainingsrückmeldung
            </p>

            <h2 id="feedback-title">
              Wie war dein Workout?
            </h2>

            <p>
              Bewerte deine empfundene Belastung:
              1 = sehr leicht, 10 = maximal anstrengend.
            </p>

            <form onSubmit={saveFeedback}>
              <div className="field">
                <label htmlFor="workout-rpe">
                  Belastung: {rpe}/10
                </label>

                <select
                  id="workout-rpe"
                  value={rpe}
                  onChange={(event) =>
                    setRpe(Number(event.target.value))
                  }
                  disabled={saving}
                  autoFocus
                >
                  {Array.from(
                    { length: 10 },
                    (_, index) => index + 1
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value} / 10
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="field"
                style={{ marginTop: 16 }}
              >
                <label htmlFor="workout-note">
                  Kommentar – optional
                </label>

                <textarea
                  id="workout-note"
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  rows={4}
                  maxLength={1000}
                  disabled={saving}
                  placeholder="Was lief gut? Gab es Schwierigkeiten?"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 10,
                    border:
                      "1px solid rgba(187,255,205,0.2)",
                    background: "rgba(4,17,10,0.6)",
                    color: "inherit",
                    font: "inherit",
                    resize: "vertical",
                  }}
                />

                <small>{note.length}/1000 Zeichen</small>
              </div>

              {feedbackError && (
                <div
                  className="error-box"
                  role="alert"
                  style={{ marginTop: 14 }}
                >
                  {feedbackError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeFeedback}
                  disabled={saving}
                >
                  Abbrechen
                </button>

                <button
                  type="submit"
                  className="assign-button"
                  disabled={saving}
                >
                  {saving
                    ? "Speichert …"
                    : "Erledigt und Feedback speichern"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
