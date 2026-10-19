"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Assignment = {
  id: string;
  team_id: string;
  player_id: string;
  training_plan_id: string;
  due_date: string | null;
  status: "assigned" | "completed";
  completed_at: string | null;
  rpe: number | null;
  player_note: string | null;
  created_at: string;
};

type Player = {
  id: string;
  full_name: string;
  shirt_number: number | null;
};

type Team = {
  id: string;
  name: string;
};

type TrainingPlan = {
  id: string;
  title: string;
  duration_min: number;
  focus: string | null;
};

type Filter = "all" | "open" | "completed";

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

  return "Die Daten konnten nicht geladen werden.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";

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

function todayLocal(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function AufgabenUebersichtPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  const [filter, setFilter] = useState<Filter>("all");
  const [teamFilter, setTeamFilter] = useState("");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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

        if (user.user_metadata?.role === "player") {
          router.replace("/meine-aufgaben");
          return;
        }

        setUserId(user.id);
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
        setPlayers([]);
        setTeams([]);
        setPlans([]);
        router.replace("/login");
      } else if (session.user.user_metadata?.role === "player") {
        router.replace("/meine-aufgaben");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const loadData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const [
        assignmentsResult,
        playersResult,
        teamsResult,
        plansResult,
      ] = await Promise.all([
        supabase
          .from("workout_assignments")
          .select(
            "id, team_id, player_id, training_plan_id, due_date, status, completed_at, rpe, player_note, created_at"
          )
          .eq("coach_id", userId)
          .order("created_at", { ascending: false }),

        supabase
          .from("players")
          .select("id, full_name, shirt_number")
          .eq("coach_id", userId),

        supabase
          .from("teams")
          .select("id, name")
          .eq("coach_id", userId)
          .order("name", { ascending: true }),

        supabase
          .from("training_plans")
          .select("id, title, duration_min, focus")
          .eq("user_id", userId),
      ]);

      if (assignmentsResult.error) {
        throw assignmentsResult.error;
      }

      if (playersResult.error) {
        throw playersResult.error;
      }

      if (teamsResult.error) {
        throw teamsResult.error;
      }

      if (plansResult.error) {
        throw plansResult.error;
      }

      setAssignments(
        (assignmentsResult.data ?? []) as Assignment[]
      );
      setPlayers((playersResult.data ?? []) as Player[]);
      setTeams((teamsResult.data ?? []) as Team[]);
      setPlans((plansResult.data ?? []) as TrainingPlan[]);

      setLastUpdated(
        new Intl.DateTimeFormat("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) {
      void loadData();
    }
  }, [userId, loadData]);

  const playersById = new Map(
    players.map((player) => [player.id, player])
  );

  const teamsById = new Map(
    teams.map((team) => [team.id, team])
  );

  const plansById = new Map(
    plans.map((plan) => [plan.id, plan])
  );

  const matchingAssignments = assignments.filter((assignment) => {
    if (teamFilter && assignment.team_id !== teamFilter) {
      return false;
    }

    const query = search.trim().toLocaleLowerCase("de");

    if (!query) return true;

    const player = playersById.get(assignment.player_id);
    const plan = plansById.get(assignment.training_plan_id);

    return (
      player?.full_name.toLocaleLowerCase("de").includes(query) ||
      plan?.title.toLocaleLowerCase("de").includes(query) ||
      false
    );
  });

  const completedCount = matchingAssignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  const openCount =
    matchingAssignments.length - completedCount;

  const visibleAssignments = matchingAssignments.filter(
    (assignment) => {
      if (filter === "all") return true;

      return filter === "completed"
        ? assignment.status === "completed"
        : assignment.status !== "completed";
    }
  );

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Trainerübersicht wird geladen …</p>
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
              Trainer · Aufgaben & Feedback
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <a className="status-pill link-pill" href="/teams">
            Teams
          </a>

          <a className="status-pill link-pill" href="/">
            ← Dashboard
          </a>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Trainingsfortschritt</p>

        <h1>
          Deine Spieler.
          <br />
          <span>Ihr Feedback.</span>
        </h1>

        <p>
          Sieh, wer sein Workout erledigt hat, wie anstrengend es
          war und welche Rückmeldung deine Spieler gegeben haben.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Trainerübersicht</p>
            <h2>Aufgaben & Bewertungen</h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={() => void loadData()}
          >
            {loading ? "Lädt …" : "↻ Aktualisieren"}
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="feedback-team">Team</label>

              <select
                id="feedback-team"
                value={teamFilter}
                onChange={(event) =>
                  setTeamFilter(event.target.value)
                }
              >
                <option value="">Alle Teams</option>

                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-search">
                Spieler oder Workout suchen
              </label>

              <input
                id="feedback-search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="z. B. Sepp"
                type="search"
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 20,
              marginBottom: 12,
            }}
          >
            {[
              {
                key: "all" as const,
                label: `Alle (${matchingAssignments.length})`,
              },
              {
                key: "open" as const,
                label: `Offen (${openCount})`,
              },
              {
                key: "completed" as const,
                label: `Erledigt (${completedCount})`,
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

          {lastUpdated && (
            <p className="helper">
              Zuletzt geladen: {lastUpdated}. Neue Rückmeldungen
              über „Aktualisieren“ laden.
            </p>
          )}

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <div>
                <span
                  className="button-spinner"
                  aria-hidden="true"
                />
                <p>Aufgaben und Rückmeldungen werden geladen …</p>
              </div>
            </div>
          ) : error ? (
            <p className="helper">
              Bitte versuche es erneut über „Aktualisieren“.
            </p>
          ) : visibleAssignments.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-icon" aria-hidden="true">
                  ⚽
                </div>

                <h3>Keine passenden Aufgaben</h3>

                <p>
                  Prüfe die Filter oder weise deinen Spielern
                  ein Workout zu.
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 16,
                marginTop: 20,
              }}
            >
              {visibleAssignments.map((assignment) => {
                const player = playersById.get(
                  assignment.player_id
                );

                const team = teamsById.get(
                  assignment.team_id
                );

                const plan = plansById.get(
                  assignment.training_plan_id
                );

                const completed =
                  assignment.status === "completed";

                const overdue =
                  !completed &&
                  assignment.due_date !== null &&
                  assignment.due_date < todayLocal();

                return (
                  <article
                    key={assignment.id}
                    style={{
                      padding: 20,
                      border:
                        "1px solid rgba(187,255,205,0.16)",
                      borderRadius: 16,
                      background: "rgba(4,17,10,0.4)",
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
                          {team?.name || "Team nicht verfügbar"}
                        </p>

                        <h3 style={{ margin: "6px 0" }}>
                          {player?.shirt_number != null
                            ? `#${player.shirt_number} · `
                            : ""}
                          {player?.full_name ||
                            "Spieler nicht verfügbar"}
                        </h3>

                        <p style={{ margin: "8px 0 14px" }}>
                          {plan?.title ||
                            "Trainingsplan nicht verfügbar"}
                        </p>
                      </div>

                      <span className="meta-chip">
                        {completed
                          ? "✓ Erledigt"
                          : overdue
                            ? "Frist überschritten"
                            : "Offen"}
                      </span>
                    </div>

                    <div className="result-meta">
                      {plan && (
                        <span className="meta-chip">
                          ⏱ {plan.duration_min} Min
                        </span>
                      )}

                      {plan?.focus && (
                        <span className="meta-chip">
                          {plan.focus}
                        </span>
                      )}

                      <span className="meta-chip">
                        Fällig:{" "}
                        {assignment.due_date
                          ? formatDate(assignment.due_date)
                          : "Ohne Frist"}
                      </span>

                      {completed && (
                        <span className="meta-chip">
                          Erledigt:{" "}
                          {formatDate(assignment.completed_at)}
                        </span>
                      )}
                    </div>

                    {completed ? (
                      <div
                        style={{
                          marginTop: 18,
                          padding: 16,
                          borderRadius: 12,
                          border:
                            "1px solid rgba(100,255,150,0.18)",
                          background:
                            "rgba(100,255,150,0.08)",
                        }}
                      >
                        <p className="panel-kicker">
                          Spielerrückmeldung
                        </p>

                        <p
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            margin: "8px 0",
                          }}
                        >
                          Belastung:{" "}
                          {assignment.rpe !== null
                            ? `${assignment.rpe}/10`
                            : "Nicht angegeben"}
                        </p>

                        <p
                          className="helper"
                          style={{ marginTop: 4 }}
                        >
                          Selbsteinschätzung des Spielers:
                          1 = sehr leicht, 10 = maximal
                          anstrengend.
                        </p>

                        <p
                          style={{
                            marginBottom: 0,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {assignment.player_note
                            ? `Kommentar: ${assignment.player_note}`
                            : "Kein Kommentar abgegeben."}
                        </p>
                      </div>
                    ) : (
                      <p
                        className="helper"
                        style={{ marginTop: 16 }}
                      >
                        Noch nicht als erledigt markiert.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
