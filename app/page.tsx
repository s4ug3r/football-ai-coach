"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
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

type Team = {
  id: string;
  coach_id: string;
  name: string;
  age_group: string | null;
};

type Player = {
  id: string;
  team_id: string;
  coach_id: string;
  full_name: string;
  position: string | null;
  shirt_number: number | null;
};

type SaveDraft = {
  plan: SessionPlan | HomeWorkout;
  planType: "team" | "home";
  focus: string;
};

type SelectOption = {
  value: string | number;
  label: string;
};

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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionPlan(
  value: SessionPlan | HomeWorkout
): value is SessionPlan {
  return "phases" in value;
}

function isValidGeneratedPlan(
  value: unknown,
  type: "team" | "home"
): boolean {
  if (
    !isRecord(value) ||
    typeof value.title !== "string" ||
    typeof value.duration_min !== "number"
  ) {
    return false;
  }

  const sections = type === "team" ? value.phases : value.blocks;

  return (
    Array.isArray(sections) &&
    sections.length > 0 &&
    sections.every(
      (section) =>
        isRecord(section) &&
        typeof section.name === "string" &&
        Array.isArray(section.exercises)
    )
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string | number;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Modal({
  titleId,
  onClose,
  busy,
  children,
  extraClass = "",
}: {
  titleId: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
  extraClass?: string;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose]);

  return (
    <div
      className="modal-backdrop no-print"
      onMouseDown={() => {
        if (!busy) onClose();
      }}
    >
      <section
        className={`save-modal ${extraClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          maxHeight: "calc(100dvh - 40px)",
          overflowY: "auto",
        }}
      >
        {children}
      </section>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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

  const [sessionPlan, setSessionPlan] =
    useState<SessionPlan | null>(null);
  const [homeWorkout, setHomeWorkout] =
    useState<HomeWorkout | null>(null);

  const [sessionPlanFocus, setSessionPlanFocus] =
    useState("Angriff");
  const [homePlanFocus, setHomePlanFocus] = useState("Angriff");

  const [sessionLoading, setSessionLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [sessionError, setSessionError] =
    useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savedPlansLoading, setSavedPlansLoading] =
    useState(false);
  const [savedPlansError, setSavedPlansError] =
    useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] =
    useState<string | null>(null);

  const [saveDraft, setSaveDraft] = useState<SaveDraft | null>(
    null
  );
  const [saveTitle, setSaveTitle] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [assignmentPlan, setAssignmentPlan] =
    useState<SavedPlan | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [assignmentTeamId, setAssignmentTeamId] = useState("");
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<
    string[]
  >([]);
  const [dueDate, setDueDate] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(
    null
  );
  const [assignmentSuccess, setAssignmentSuccess] =
    useState<string | null>(null);

  const isSessionTab = tab === "session";
  const currentPlan = isSessionTab ? sessionPlan : homeWorkout;
  const currentLoading = isSessionTab
    ? sessionLoading
    : homeLoading;
  const currentError = isSessionTab ? sessionError : homeError;

  useEffect(() => {
    let active = true;

    async function checkUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          router.replace("/login");
          return;
        }

        if (user.user_metadata?.role === "player") {
          router.replace("/meine-aufgaben");
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? null);
        setAuthLoading(false);
      } catch (error) {
        if (!active) return;

        setAuthError(getErrorMessage(error));
        setAuthLoading(false);
      }
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session?.user) {
        setUserId(null);
        setSavedPlans([]);
        router.replace("/login");
        return;
      }

      if (session.user.user_metadata?.role === "player") {
        router.replace("/meine-aufgaben");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const loadSavedPlans = useCallback(async () => {
    if (!userId) return;

    setSavedPlansLoading(true);
    setSavedPlansError(null);

    try {
      const { data, error } = await supabase
        .from("training_plans")
        .select(
          "id, user_id, title, plan_type, focus, duration_min, plan_data, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSavedPlans((data ?? []) as SavedPlan[]);
    } catch (error) {
      setSavedPlansError(getErrorMessage(error));
    } finally {
      setSavedPlansLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (tab === "saved" && userId) {
      void loadSavedPlans();
    }
  }, [tab, userId, loadSavedPlans]);

  useEffect(() => {
    if (!assignmentPlan || !userId) return;

    let active = true;

    async function loadTeams() {
      setTeamsLoading(true);
      setTeams([]);

      try {
        const { data, error } = await supabase
          .from("teams")
          .select("id, coach_id, name, age_group")
          .eq("coach_id", userId)
          .order("created_at", { ascending: true });

        if (!active) return;
        if (error) throw error;

        setTeams((data ?? []) as Team[]);
      } catch (error) {
        if (active) {
          setAssignError(getErrorMessage(error));
        }
      } finally {
        if (active) setTeamsLoading(false);
      }
    }

    void loadTeams();

    return () => {
      active = false;
    };
  }, [assignmentPlan, userId, supabase]);

  useEffect(() => {
    if (!assignmentPlan || !assignmentTeamId || !userId) {
      setTeamPlayers([]);
      setSelectedPlayerIds([]);
      setPlayersLoading(false);
      return;
    }

    let active = true;

    async function loadPlayers() {
      setPlayersLoading(true);
      setAssignError(null);
      setTeamPlayers([]);
      setSelectedPlayerIds([]);

      try {
        const { data, error } = await supabase
          .from("players")
          .select(
            "id, team_id, coach_id, full_name, position, shirt_number"
          )
          .eq("coach_id", userId)
          .eq("team_id", assignmentTeamId)
          .order("shirt_number", {
            ascending: true,
            nullsFirst: false,
          });

        if (!active) return;
        if (error) throw error;

        const loadedPlayers = (data ?? []) as Player[];

        setTeamPlayers(loadedPlayers);
        setSelectedPlayerIds(
          loadedPlayers.map((player) => player.id)
        );
      } catch (error) {
        if (active) {
          setAssignError(getErrorMessage(error));
        }
      } finally {
        if (active) setPlayersLoading(false);
      }
    }

    void loadPlayers();

    return () => {
      active = false;
    };
  }, [assignmentPlan, assignmentTeamId, userId, supabase]);

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setSigningOut(false);
    }
  }

  async function generatePlan(type: "team" | "home") {
    const isTeam = type === "team";

    if (isTeam ? sessionLoading : homeLoading) return;

    if (isTeam) {
      setSessionLoading(true);
      setSessionError(null);
    } else {
      setHomeLoading(true);
      setHomeError(null);
    }

    const requestedFocus = isTeam ? sessionFocus : homeFocus;

    const payload = isTeam
      ? {
          duration_min: sessionDuration,
          frequency_per_week: sessionFrequency,
          focus: sessionFocus,
          level: sessionLevel,
          location: sessionLocation,
          equipment: sessionEquipment,
        }
      : {
          duration_min: homeDuration,
          focus: homeFocus,
          level: homeLevel,
          location: homeLocation,
          equipment: homeEquipment,
        };

    try {
      const response = await fetch(
        isTeam ? "/api/generate-session" : "/api/generate-home",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json: unknown = await response.json();

      if (
        !response.ok ||
        !isRecord(json) ||
        json.ok !== true
      ) {
        throw new Error(
          isRecord(json) && typeof json.error === "string"
            ? json.error
            : "Der Plan konnte nicht erstellt werden."
        );
      }

      if (!isValidGeneratedPlan(json.data, type)) {
        throw new Error(
          "Die KI-Antwort enthält keinen gültigen Trainingsplan. Bitte erneut versuchen."
        );
      }

      if (isTeam) {
        setSessionPlan(json.data as SessionPlan);
        setSessionPlanFocus(requestedFocus);
      } else {
        setHomeWorkout(json.data as HomeWorkout);
        setHomePlanFocus(requestedFocus);
      }
    } catch (error) {
      if (isTeam) {
        setSessionError(getErrorMessage(error));
      } else {
        setHomeError(getErrorMessage(error));
      }
    } finally {
      if (isTeam) {
        setSessionLoading(false);
      } else {
        setHomeLoading(false);
      }
    }
  }

  function openSaveDialog() {
    if (!currentPlan || currentLoading) return;

    setSaveDraft({
      plan: currentPlan,
      planType: isSessionTab ? "team" : "home",
      focus: isSessionTab ? sessionPlanFocus : homePlanFocus,
    });
    setSaveTitle(currentPlan.title);
    setSaveError(null);
  }

  async function saveCurrentPlan() {
    if (!userId || !saveDraft || saveLoading) return;

    const title = saveTitle.trim();

    if (!title) {
      setSaveError("Bitte gib einen Namen für den Plan ein.");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);

    try {
      const { error } = await supabase
        .from("training_plans")
        .insert({
          user_id: userId,
          title,
          plan_type: saveDraft.planType,
          focus: saveDraft.focus,
          duration_min: saveDraft.plan.duration_min,
          plan_data: {
            ...saveDraft.plan,
            title,
          },
        });

      if (error) throw error;

      setSaveDraft(null);

      if (tab === "saved") {
        await loadSavedPlans();
      } else {
        setTab("saved");
      }
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaveLoading(false);
    }
  }

  async function deleteSavedPlan(plan: SavedPlan) {
    if (!userId || deleteLoadingId) return;

    const confirmed = window.confirm(
      `„${plan.title}“ wirklich löschen?\n\n` +
        "Zugehörige Zuweisungen und Rückmeldungen können durch die Datenbank-Verknüpfungen ebenfalls gelöscht werden."
    );

    if (!confirmed) return;

    setDeleteLoadingId(plan.id);
    setSavedPlansError(null);

    try {
      const { data, error } = await supabase
        .from("training_plans")
        .delete()
        .eq("id", plan.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Der Plan wurde nicht gelöscht. Bitte prüfe deine Berechtigung."
        );
      }

      setSavedPlans((current) =>
        current.filter((item) => item.id !== plan.id)
      );
    } catch (error) {
      setSavedPlansError(getErrorMessage(error));
    } finally {
      setDeleteLoadingId(null);
    }
  }

  function openSavedPlan(saved: SavedPlan) {
    if (saved.plan_type === "team") {
      if (!isSessionPlan(saved.plan_data)) {
        setSavedPlansError(
          "Dieser gespeicherte Teamplan hat ein ungültiges Format."
        );
        return;
      }

      setSessionPlan({
        ...saved.plan_data,
        title: saved.title,
      });
      setSessionFocus(saved.focus);
      setSessionPlanFocus(saved.focus);
      setSessionDuration(saved.duration_min);
      setSessionFrequency(
        saved.plan_data.frequency_per_week || 1
      );
      setSessionError(null);
      setTab("session");
      return;
    }

    if (isSessionPlan(saved.plan_data)) {
      setSavedPlansError(
        "Dieses gespeicherte Home-Workout hat ein ungültiges Format."
      );
      return;
    }

    setHomeWorkout({
      ...saved.plan_data,
      title: saved.title,
    });
    setHomeFocus(saved.focus);
    setHomePlanFocus(saved.focus);
    setHomeDuration(saved.duration_min);
    setHomeError(null);
    setTab("home");
  }

  function openAssignDialog(plan: SavedPlan) {
    setAssignmentTeamId("");
    setTeamPlayers([]);
    setSelectedPlayerIds([]);
    setDueDate("");
    setAssignError(null);
    setAssignmentSuccess(null);
    setTeams([]);
    setAssignmentPlan(plan);
  }

  function closeAssignDialog() {
    if (assignLoading) return;

    setAssignmentPlan(null);
    setAssignmentTeamId("");
    setTeamPlayers([]);
    setSelectedPlayerIds([]);
  }

  function changeAssignmentTeam(teamId: string) {
    setAssignmentTeamId(teamId);
    setTeamPlayers([]);
    setSelectedPlayerIds([]);
    setAssignError(null);
    setAssignmentSuccess(null);
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId]
    );
  }

  function toggleAllPlayers() {
    setSelectedPlayerIds((current) =>
      current.length === teamPlayers.length
        ? []
        : teamPlayers.map((player) => player.id)
    );
  }

  async function createAssignments() {
    if (
      !userId ||
      !assignmentPlan ||
      assignLoading ||
      playersLoading ||
      teamsLoading
    ) {
      return;
    }

    setAssignError(null);
    setAssignmentSuccess(null);

    if (!teams.some((team) => team.id === assignmentTeamId)) {
      setAssignError("Bitte wähle eines deiner Teams aus.");
      return;
    }

    const validPlayerIds = selectedPlayerIds.filter((id) =>
      teamPlayers.some(
        (player) =>
          player.id === id &&
          player.team_id === assignmentTeamId
      )
    );

    if (
      validPlayerIds.length === 0 ||
      validPlayerIds.length !== selectedPlayerIds.length
    ) {
      setAssignError(
        "Bitte wähle mindestens einen Spieler aus dem aktuellen Team."
      );
      return;
    }

    if (dueDate && dueDate < todayLocal()) {
      setAssignError(
        "Das Fälligkeitsdatum darf nicht in der Vergangenheit liegen."
      );
      return;
    }

    setAssignLoading(true);

    try {
      const rows = validPlayerIds.map((playerId) => ({
        coach_id: userId,
        team_id: assignmentTeamId,
        player_id: playerId,
        training_plan_id: assignmentPlan.id,
        due_date: dueDate || null,
      }));

      const { data, error } = await supabase
        .from("workout_assignments")
        .upsert(rows, {
          onConflict: "training_plan_id,player_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) throw error;

      const inserted = data?.length ?? 0;
      const skipped = validPlayerIds.length - inserted;

      setAssignmentSuccess(
        inserted === 0
          ? "Diese Spieler haben diesen Plan bereits zugewiesen bekommen. Bestehende Aufgaben und Bewertungen wurden nicht verändert."
          : `${inserted} neue ${
              inserted === 1 ? "Aufgabe wurde" : "Aufgaben wurden"
            } erstellt.${
              skipped > 0
                ? ` ${skipped} bereits vorhandene Zuweisungen wurden übersprungen.`
                : ""
            }`
      );
    } catch (error) {
      setAssignError(getErrorMessage(error));
    } finally {
      setAssignLoading(false);
    }
  }

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

  if (!userId) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Anmeldung erforderlich</h1>

          {authError && (
            <div className="error-box" role="alert">
              {authError}
            </div>
          )}

          <a href="/login" className="secondary-button">
            Zum Login
          </a>
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
            <span className="brand-caption">
              Coach Workspace
            </span>
          </div>
        </div>

        <div
          className="topbar-actions"
          style={{ flexWrap: "wrap" }}
        >
          <a className="status-pill link-pill" href="/teams">
            Teams
          </a>

          <a
            className="status-pill link-pill"
            href="/aufgaben-uebersicht"
          >
            Aufgaben & Feedback
          </a>

          {userEmail && (
            <span className="user-email" title={userEmail}>
              {userEmail}
            </span>
          )}

          <button
            type="button"
            className="status-pill logout-button"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <span className="status-dot" aria-hidden="true" />
            {signingOut ? "Meldet ab …" : "Ausloggen"}
          </button>
        </div>
      </header>

      {authError && (
        <div className="error-box no-print" role="alert">
          {authError}
        </div>
      )}

      <section className="hero no-print">
        <p className="eyebrow">
          Fußballtraining · Einfach geplant
        </p>

        <h1>
          Bessere Einheiten.
          <br />
          <span>Weniger Planung.</span>
        </h1>

        <p>
          Erstelle Trainingspläne, weise deinen Spielern Workouts
          zu und behalte ihre Rückmeldungen im Blick.
        </p>
      </section>

      <nav
        className="tab-list no-print"
        aria-label="Bereich auswählen"
      >
        {[
          {
            key: "session" as const,
            icon: "⚽",
            title: "Teamtraining",
            description: "Einheiten für deine Mannschaft",
          },
          {
            key: "home" as const,
            icon: "⌂",
            title: "Home-Workout",
            description: "Individuelle Aufgaben für zuhause",
          },
          {
            key: "saved" as const,
            icon: "▣",
            title: "Meine Pläne",
            description: "Speichern, öffnen und zuweisen",
          },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab ${
              tab === item.key ? "active" : ""
            }`}
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            <span className="tab-icon" aria-hidden="true">
              {item.icon}
            </span>

            <span>
              <span className="tab-title">{item.title}</span>
              <span className="tab-description">
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </nav>

      {tab === "saved" ? (
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
              {savedPlansLoading
                ? "Lädt …"
                : "↻ Aktualisieren"}
            </button>
          </div>

          <div
            className="assignment-info"
            style={{ marginBottom: 20 }}
          >
            Erledigte Aufgaben, Belastungsbewertungen und
            Kommentare findest du unter{" "}
            <a href="/aufgaben-uebersicht">
              Aufgaben & Feedback
            </a>
            .
          </div>

          {savedPlansError && (
            <div className="error-box saved-error" role="alert">
              {savedPlansError}
            </div>
          )}

          {savedPlansLoading ? (
            <div className="saved-empty">
              <span
                className="button-spinner"
                aria-hidden="true"
              />
              <p>Deine Pläne werden geladen …</p>
            </div>
          ) : savedPlans.length === 0 ? (
            !savedPlansError && (
              <div className="saved-empty">
                <div>
                  <div
                    className="empty-icon"
                    aria-hidden="true"
                  >
                    ▣
                  </div>
                  <h3>Noch keine gespeicherten Pläne</h3>
                  <p>
                    Erstelle ein Training oder Home-Workout und
                    speichere es anschließend.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="saved-plan-grid">
              {savedPlans.map((plan) => (
                <article
                  className="saved-plan-card"
                  key={plan.id}
                >
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

                  <div
                    className="saved-card-actions"
                    style={{ flexWrap: "wrap" }}
                  >
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openSavedPlan(plan)}
                    >
                      Öffnen
                    </button>

                    {plan.plan_type === "home" && (
                      <button
                        type="button"
                        className="assign-button"
                        onClick={() => openAssignDialog(plan)}
                      >
                        Zuweisen
                      </button>
                    )}

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        void deleteSavedPlan(plan)
                      }
                      disabled={deleteLoadingId !== null}
                    >
                      {deleteLoadingId === plan.id
                        ? "Löscht …"
                        : "Löschen"}
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
                <p className="panel-kicker">
                  Plan konfigurieren
                </p>

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

            <form
              className="form-content"
              onSubmit={(event) => {
                event.preventDefault();
                void generatePlan(
                  isSessionTab ? "team" : "home"
                );
              }}
            >
              <fieldset
                disabled={currentLoading}
                style={{
                  margin: 0,
                  padding: 0,
                  border: 0,
                  minWidth: 0,
                }}
              >
                <div className="field-grid">
                  {isSessionTab ? (
                    <>
                      <SelectField
                        id="session-duration"
                        label="Dauer"
                        value={sessionDuration}
                        onChange={(value) =>
                          setSessionDuration(Number(value))
                        }
                        options={[60, 75, 90, 105, 120].map(
                          (value) => ({
                            value,
                            label: `${value} Minuten`,
                          })
                        )}
                      />

                      <SelectField
                        id="session-frequency"
                        label="Training pro Woche"
                        value={sessionFrequency}
                        onChange={(value) =>
                          setSessionFrequency(Number(value))
                        }
                        options={[1, 2].map((value) => ({
                          value,
                          label: `${value}× pro Woche`,
                        }))}
                      />

                      <SelectField
                        id="session-focus"
                        label="Fokus"
                        value={sessionFocus}
                        onChange={setSessionFocus}
                        options={[
                          "Angriff",
                          "Verteidigung",
                          "Pressing",
                          "Ballbesitz",
                          "Umschaltspiel",
                          "Standards",
                          "Athletik",
                        ].map((value) => ({
                          value,
                          label: value,
                        }))}
                      />

                      <SelectField
                        id="session-level"
                        label="Altersgruppe / Level"
                        value={sessionLevel}
                        onChange={setSessionLevel}
                        options={[
                          "U11",
                          "U13",
                          "U15+",
                          "U17+",
                          "Senioren",
                        ].map((value) => ({
                          value,
                          label: value,
                        }))}
                      />

                      <SelectField
                        id="session-location"
                        label="Trainingsort"
                        value={sessionLocation}
                        onChange={setSessionLocation}
                        options={[
                          "Platz",
                          "Halle",
                          "Kleinfeld",
                        ].map((value) => ({
                          value,
                          label: value,
                        }))}
                      />

                      <div className="field">
                        <label htmlFor="session-equipment">
                          Equipment
                        </label>

                        <input
                          id="session-equipment"
                          value={sessionEquipment}
                          onChange={(event) =>
                            setSessionEquipment(
                              event.target.value
                            )
                          }
                          placeholder="Hütchen, Leibchen, Tore"
                          maxLength={500}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <SelectField
                        id="home-duration"
                        label="Dauer"
                        value={homeDuration}
                        onChange={(value) =>
                          setHomeDuration(Number(value))
                        }
                        options={[10, 15, 20, 25, 30].map(
                          (value) => ({
                            value,
                            label: `${value} Minuten`,
                          })
                        )}
                      />

                      <SelectField
                        id="home-focus"
                        label="Fokus"
                        value={homeFocus}
                        onChange={setHomeFocus}
                        options={[
                          "Angriff",
                          "Ballkontrolle",
                          "Dribbling",
                          "Passspiel",
                          "Koordination",
                          "Athletik",
                          "Stabilität",
                        ].map((value) => ({
                          value,
                          label: value,
                        }))}
                      />

                      <SelectField
                        id="home-level"
                        label="Level"
                        value={homeLevel}
                        onChange={setHomeLevel}
                        options={[
                          "Beginner",
                          "Intermediate",
                          "Advanced",
                        ].map((value) => ({
                          value,
                          label: value,
                        }))}
                      />

                      <SelectField
                        id="home-location"
                        label="Trainingsort"
                        value={homeLocation}
                        onChange={setHomeLocation}
                        options={[
                          "Zuhause",
                          "Garten",
                          "Platz",
                          "Halle",
                        ].map((value) => ({
                          value,
                          label: value,
                        }))}
                      />

                      <div className="field full">
                        <label htmlFor="home-equipment">
                          Verfügbares Equipment
                        </label>

                        <input
                          id="home-equipment"
                          value={homeEquipment}
                          onChange={(event) =>
                            setHomeEquipment(
                              event.target.value
                            )
                          }
                          placeholder="z. B. Ball und Hütchen"
                          maxLength={500}
                        />
                      </div>
                    </>
                  )}
                </div>

                <p className="helper">
                  {isSessionTab
                    ? "Erstelle eine strukturierte Einheit mit Übungen, Organisation und Coaching-Punkten."
                    : "Erstelle ein individuelles Workout für das Training zwischen den Mannschaftseinheiten."}
                </p>

                <button
                  type="submit"
                  className="generate-button"
                  disabled={currentLoading}
                >
                  {currentLoading && (
                    <span
                      className="button-spinner"
                      aria-hidden="true"
                    />
                  )}

                  {currentLoading
                    ? "Plan wird erstellt …"
                    : isSessionTab
                      ? "✦ Trainingsplan generieren"
                      : "✦ Home-Workout generieren"}
                </button>
              </fieldset>
            </form>

            {currentError && (
              <div className="error-box" role="alert">
                Das hat noch nicht geklappt:
                <br />
                {currentError}
              </div>
            )}
          </section>

          <section className="panel print-plan">
            <div className="panel-header no-print">
              <div>
                <p className="panel-kicker">Dein Ergebnis</p>
                <h2>
                  {isSessionTab
                    ? "Trainingsplan"
                    : "Home-Workout"}
                </h2>
              </div>

              {currentPlan && !currentLoading && (
                <div className="result-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={openSaveDialog}
                  >
                    ♡ <span>Speichern</span>
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => window.print()}
                    title="Drucken oder als PDF speichern"
                  >
                    ⎙ <span>Drucken</span>
                  </button>
                </div>
              )}
            </div>

            {currentLoading ? (
              <div className="empty-state">
                <div>
                  <div className="empty-icon">
                    <span
                      className="button-spinner"
                      aria-hidden="true"
                    />
                  </div>
                  <h3>Dein Plan entsteht</h3>
                  <p>
                    Übungen und Trainingsablauf werden
                    zusammengestellt.
                  </p>
                </div>
              </div>
            ) : currentPlan ? (
              <PlanView
                plan={currentPlan}
                focus={
                  isSessionTab
                    ? sessionPlanFocus
                    : homePlanFocus
                }
              />
            ) : (
              <div className="empty-state">
                <div>
                  <div
                    className="empty-icon"
                    aria-hidden="true"
                  >
                    ✦
                  </div>
                  <h3>Bereit für deinen Plan</h3>
                  <p>
                    Wähle deine Parameter und erstelle einen
                    Trainingsplan.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      )}

      {saveDraft && (
        <Modal
          titleId="save-dialog-title"
          busy={saveLoading}
          onClose={() => setSaveDraft(null)}
        >
          <p className="panel-kicker">Plan speichern</p>
          <h2 id="save-dialog-title">
            Gib deinem Plan einen Namen
          </h2>

          <p>
            Gespeicherte Home-Workouts kannst du anschließend
            deinen Spielern zuweisen.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveCurrentPlan();
            }}
          >
            <div className="field">
              <label htmlFor="save-plan-title">Planname</label>

              <input
                id="save-plan-title"
                value={saveTitle}
                onChange={(event) =>
                  setSaveTitle(event.target.value)
                }
                maxLength={120}
                disabled={saveLoading}
                autoFocus
                required
              />
            </div>

            {saveError && (
              <div
                className="error-box modal-error"
                role="alert"
              >
                {saveError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSaveDraft(null)}
                disabled={saveLoading}
              >
                Abbrechen
              </button>

              <button
                type="submit"
                className="generate-button modal-save-button"
                disabled={saveLoading || !saveTitle.trim()}
              >
                {saveLoading
                  ? "Speichert …"
                  : "Plan speichern"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {assignmentPlan && (
        <Modal
          titleId="assign-dialog-title"
          busy={assignLoading}
          onClose={closeAssignDialog}
          extraClass="assignment-modal"
        >
          <p className="panel-kicker">
            Home-Workout zuweisen
          </p>

          <h2 id="assign-dialog-title">
            {assignmentPlan.title}
          </h2>

          <p>
            Wähle ein Team, die Spieler und optional eine Frist.
            Bereits vorhandene Zuweisungen werden nicht
            überschrieben.
          </p>

          <SelectField
            id="assignment-team"
            label="Team"
            value={assignmentTeamId}
            onChange={changeAssignmentTeam}
            disabled={
              teamsLoading ||
              assignLoading ||
              Boolean(assignmentSuccess)
            }
            options={[
              {
                value: "",
                label: teamsLoading
                  ? "Teams werden geladen …"
                  : "Team auswählen …",
              },
              ...teams.map((team) => ({
                value: team.id,
                label: `${team.name}${
                  team.age_group
                    ? ` (${team.age_group})`
                    : ""
                }`,
              })),
            ]}
          />

          {!teamsLoading &&
            teams.length === 0 &&
            !assignError && (
              <div className="assignment-info">
                Noch kein Team vorhanden. Erstelle zuerst unter{" "}
                <a href="/teams">Teams</a> eine Mannschaft.
              </div>
            )}

          {assignmentTeamId && (
            <>
              <div className="field assignment-due-date">
                <label htmlFor="assignment-due-date">
                  Fälligkeitsdatum – optional
                </label>

                <input
                  id="assignment-due-date"
                  type="date"
                  min={todayLocal()}
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  disabled={
                    assignLoading ||
                    Boolean(assignmentSuccess)
                  }
                />
              </div>

              <div className="assignment-player-header">
                <div>
                  <p className="form-section-title">
                    Spieler auswählen
                  </p>
                  <span>
                    {selectedPlayerIds.length} von{" "}
                    {teamPlayers.length} ausgewählt
                  </span>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={toggleAllPlayers}
                  disabled={
                    playersLoading ||
                    assignLoading ||
                    teamPlayers.length === 0 ||
                    Boolean(assignmentSuccess)
                  }
                >
                  {teamPlayers.length > 0 &&
                  selectedPlayerIds.length ===
                    teamPlayers.length
                    ? "Alle abwählen"
                    : "Alle auswählen"}
                </button>
              </div>

              {playersLoading ? (
                <p className="helper">
                  Spieler werden geladen …
                </p>
              ) : teamPlayers.length === 0 ? (
                <div className="assignment-info">
                  Keine Spieler geladen. Prüfe den Kader unter
                  „Teams“ oder eine angezeigte Fehlermeldung.
                </div>
              ) : (
                <div className="assignment-player-list">
                  {teamPlayers.map((player) => {
                    const selected =
                      selectedPlayerIds.includes(player.id);

                    return (
                      <label
                        key={player.id}
                        className={`assignment-player ${
                          selected ? "selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            togglePlayer(player.id)
                          }
                          disabled={
                            assignLoading ||
                            Boolean(assignmentSuccess)
                          }
                        />

                        <span className="assignment-player-number">
                          {player.shirt_number ?? "–"}
                        </span>

                        <span className="assignment-player-name">
                          <strong>{player.full_name}</strong>
                          <small>
                            {player.position || "Position offen"}
                          </small>
                        </span>

                        <span
                          className="assignment-check"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {assignError && (
            <div className="error-box modal-error" role="alert">
              {assignError}
            </div>
          )}

          {assignmentSuccess && (
            <div
              className="success-box assignment-success"
              role="status"
            >
              {assignmentSuccess}
            </div>
          )}

          {assignmentSuccess && (
            <p className="helper">
              Status und Bewertungen findest du unter{" "}
              <a href="/aufgaben-uebersicht">
                Aufgaben & Feedback
              </a>
              .
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={closeAssignDialog}
              disabled={assignLoading}
            >
              {assignmentSuccess ? "Schließen" : "Abbrechen"}
            </button>

            {!assignmentSuccess && (
              <button
                type="button"
                className="generate-button modal-save-button"
                onClick={() => void createAssignments()}
                disabled={
                  assignLoading ||
                  teamsLoading ||
                  playersLoading ||
                  !assignmentTeamId ||
                  selectedPlayerIds.length === 0
                }
              >
                {assignLoading
                  ? "Weist zu …"
                  : `${selectedPlayerIds.length} Spieler zuweisen`}
              </button>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

function PlanView({
  plan,
  focus,
}: {
  plan: SessionPlan | HomeWorkout;
  focus: string;
}) {
  const isTeam = isSessionPlan(plan);

  return (
    <div className="result-content">
      <div className="result-heading">
        <h3>{plan.title}</h3>

        <div className="result-meta">
          <span className="meta-chip">
            ⏱ {plan.duration_min} Min
          </span>

          {isTeam && (
            <span className="meta-chip">
              ↻ {plan.frequency_per_week}× / Woche
            </span>
          )}

          <span className="meta-chip">
            ⚽ {isTeam ? focus : plan.focus || focus}
          </span>
        </div>
      </div>

      <div className="phase-list">
        {isTeam
          ? plan.phases.map((phase, phaseIndex) => (
              <article
                className="phase-card"
                key={`${phase.name}-${phaseIndex}`}
              >
                <div className="phase-header">
                  <div className="phase-title">
                    <span className="phase-index">
                      {phaseIndex + 1}
                    </span>
                    {phase.name}
                  </div>

                  <span className="time-chip">
                    {phase.duration_min} Min
                  </span>
                </div>

                <div className="exercise-list">
                  {phase.exercises.map(
                    (exercise, exerciseIndex) => (
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

                        <p>Ziel: {exercise.objective}</p>
                        <p>
                          Organisation:{" "}
                          {exercise.organization}
                        </p>
                        <p>
                          Coaching: {exercise.coaching_points}
                        </p>
                        <p>Material: {exercise.equipment}</p>
                      </div>
                    )
                  )}
                </div>
              </article>
            ))
          : plan.blocks.map((block, blockIndex) => (
              <article
                className="phase-card"
                key={`${block.name}-${blockIndex}`}
              >
                <div className="phase-header">
                  <div className="phase-title">
                    <span className="phase-index">
                      {blockIndex + 1}
                    </span>
                    {block.name}
                  </div>

                  <span className="time-chip">
                    {block.duration_min} Min
                  </span>
                </div>

                <div className="exercise-list">
                  {block.exercises.map(
                    (exercise, exerciseIndex) => (
                      <div
                        className="exercise"
                        key={`${exercise.name}-${exerciseIndex}`}
                      >
                        <div className="exercise-name">
                          <span>{exercise.name}</span>

                          <span className="exercise-time">
                            {exercise.duration_min != null
                              ? `${exercise.duration_min} Min`
                              : exercise.sets_reps || "Übung"}
                          </span>
                        </div>

                        {exercise.duration_min != null &&
                          exercise.sets_reps && (
                            <p>
                              Umfang: {exercise.sets_reps}
                            </p>
                          )}

                        <p>Ziel: {exercise.objective}</p>
                        <p>
                          Ausführung: {exercise.how_to}
                        </p>
                        <p>Material: {exercise.equipment}</p>
                        <p>Level: {exercise.difficulty}</p>
                      </div>
                    )
                  )}
                </div>
              </article>
            ))}
      </div>

      <p className="footer-note">
        KI-Vorschlag: Passe Übungen und Belastung an die
        Voraussetzungen deiner Spieler an.
      </p>
    </div>
  );
}
