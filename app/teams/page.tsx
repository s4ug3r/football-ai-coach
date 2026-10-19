"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Team = {
  id: string;
  coach_id: string;
  name: string;
  age_group: string | null;
  created_at: string;
};

type Player = {
  id: string;
  team_id: string;
  coach_id: string;
  full_name: string;
  position: string | null;
  shirt_number: number | null;
};

type Invitation = {
  id: string;
  team_id: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  used: boolean;
};

type InviteDialog = {
  teamName: string;
  link: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

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

function parseShirtNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const number = Number(trimmed);

  if (!Number.isInteger(number) || number < 1 || number > 99) {
    throw new Error(
      "Die Trikotnummer muss eine ganze Zahl zwischen 1 und 99 sein. Du kannst das Feld auch leer lassen."
    );
  }

  return number;
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) =>
      (a.shirt_number ?? 999) - (b.shirt_number ?? 999) ||
      a.full_name.localeCompare(b.full_name, "de")
  );
}

export default function TeamsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newPlayerFullName, setNewPlayerFullName] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("");
  const [newPlayerShirtNumber, setNewPlayerShirtNumber] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPosition, setEditPosition] = useState("");
  const [editShirtNumber, setEditShirtNumber] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);

  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);

  const [creatingInviteTeamId, setCreatingInviteTeamId] =
    useState<string | null>(null);
  const [inviteDialog, setInviteDialog] = useState<InviteDialog | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const playerActionBusy = savingPlayer || deletingPlayerId !== null;

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
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
      }
    }

    void checkAuthentication();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session?.user) {
        setUserId(null);
        setTeams([]);
        setPlayers([]);
        setInvitations([]);
        router.replace("/login");
        return;
      }

      if (session.user.user_metadata?.role === "player") {
        router.replace("/meine-aufgaben");
        return;
      }

      setUserId(session.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [teamsResult, playersResult, invitationsResult] =
          await Promise.all([
            supabase
              .from("teams")
              .select("id, coach_id, name, age_group, created_at")
              .eq("coach_id", userId)
              .order("created_at", { ascending: true }),

            supabase
              .from("players")
              .select(
                "id, team_id, coach_id, full_name, position, shirt_number"
              )
              .eq("coach_id", userId),

            supabase
              .from("team_invitations")
              .select(
                "id, team_id, created_by, created_at, expires_at, used"
              )
              .eq("created_by", userId)
              .order("created_at", { ascending: false }),
          ]);

        if (!active) return;

        if (teamsResult.error) {
          throw teamsResult.error;
        }

        if (playersResult.error) {
          throw playersResult.error;
        }

        setTeams((teamsResult.data ?? []) as Team[]);
        setPlayers(sortPlayers((playersResult.data ?? []) as Player[]));

        if (invitationsResult.error) {
          setInvitations([]);
          setError(
            `Teams und Spieler wurden geladen. Einladungen konnten nicht geladen werden: ${invitationsResult.error.message}`
          );
        } else {
          setInvitations(
            (invitationsResult.data ?? []) as Invitation[]
          );
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [userId, supabase]);

  async function refreshData() {
    if (!userId || loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const [teamsResult, playersResult, invitationsResult] =
        await Promise.all([
          supabase
            .from("teams")
            .select("id, coach_id, name, age_group, created_at")
            .eq("coach_id", userId)
            .order("created_at", { ascending: true }),

          supabase
            .from("players")
            .select(
              "id, team_id, coach_id, full_name, position, shirt_number"
            )
            .eq("coach_id", userId),

          supabase
            .from("team_invitations")
            .select(
              "id, team_id, created_by, created_at, expires_at, used"
            )
            .eq("created_by", userId)
            .order("created_at", { ascending: false }),
        ]);

      if (teamsResult.error) throw teamsResult.error;
      if (playersResult.error) throw playersResult.error;

      setTeams((teamsResult.data ?? []) as Team[]);
      setPlayers(sortPlayers((playersResult.data ?? []) as Player[]));

      if (invitationsResult.error) {
        setInvitations([]);
        setError(
          `Einladungen konnten nicht geladen werden: ${invitationsResult.error.message}`
        );
      } else {
        setInvitations((invitationsResult.data ?? []) as Invitation[]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || creatingTeam) return;

    const name = newTeamName.trim();

    if (!name) return;

    setCreatingTeam(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: createError } = await supabase
        .from("teams")
        .insert({
          coach_id: userId,
          name,
          age_group: newTeamAgeGroup.trim() || null,
        })
        .select("id, coach_id, name, age_group, created_at")
        .single();

      if (createError) throw createError;

      const createdTeam = data as Team;

      setTeams((current) => [...current, createdTeam]);
      setSelectedTeamId((current) => current || createdTeam.id);
      setNewTeamName("");
      setNewTeamAgeGroup("");
      setMessage(`Team „${createdTeam.name}“ wurde erstellt.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingTeam(false);
    }
  }

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || creatingPlayer) return;

    setError(null);
    setMessage(null);

    try {
      if (!selectedTeamId || !newPlayerFullName.trim()) {
        throw new Error("Bitte wähle ein Team und gib einen Namen ein.");
      }

      if (!teams.some((team) => team.id === selectedTeamId)) {
        throw new Error("Bitte wähle eines deiner Teams aus.");
      }

      const shirtNumber = parseShirtNumber(newPlayerShirtNumber);

      setCreatingPlayer(true);

      const { data, error: createError } = await supabase
        .from("players")
        .insert({
          coach_id: userId,
          team_id: selectedTeamId,
          full_name: newPlayerFullName.trim(),
          position: newPlayerPosition.trim() || null,
          shirt_number: shirtNumber,
        })
        .select(
          "id, team_id, coach_id, full_name, position, shirt_number"
        )
        .single();

      if (createError) throw createError;

      const createdPlayer = data as Player;

      setPlayers((current) => sortPlayers([...current, createdPlayer]));
      setNewPlayerFullName("");
      setNewPlayerPosition("");
      setNewPlayerShirtNumber("");
      setMessage(`${createdPlayer.full_name} wurde hinzugefügt.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingPlayer(false);
    }
  }

  function startEditing(player: Player) {
    if (playerActionBusy) return;

    setEditingPlayerId(player.id);
    setEditPosition(player.position ?? "");
    setEditShirtNumber(
      player.shirt_number === null ? "" : String(player.shirt_number)
    );
    setEditError(null);
    setMessage(null);
  }

  function cancelEditing() {
    if (savingPlayer) return;

    setEditingPlayerId(null);
    setEditPosition("");
    setEditShirtNumber("");
    setEditError(null);
  }

  async function savePlayer(
    event: FormEvent<HTMLFormElement>,
    player: Player
  ) {
    event.preventDefault();

    if (!userId || savingPlayer) return;

    setEditError(null);
    setMessage(null);

    try {
      const shirtNumber = parseShirtNumber(editShirtNumber);
      const position = editPosition.trim();

      if (position.length > 80) {
        throw new Error(
          "Die Position darf höchstens 80 Zeichen enthalten."
        );
      }

      setSavingPlayer(true);

      const { data, error: updateError } = await supabase
        .from("players")
        .update({
          position: position || null,
          shirt_number: shirtNumber,
        })
        .eq("id", player.id)
        .eq("coach_id", userId)
        .eq("team_id", player.team_id)
        .select(
          "id, team_id, coach_id, full_name, position, shirt_number"
        )
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          "Keine Änderung gespeichert. Der Spieler wurde nicht gefunden oder die Berechtigung fehlt."
        );
      }

      const updatedPlayer = data as Player;

      setPlayers((current) =>
        sortPlayers(
          current.map((item) =>
            item.id === updatedPlayer.id ? updatedPlayer : item
          )
        )
      );

      setEditingPlayerId(null);
      setMessage(
        `Nummer und Position von ${updatedPlayer.full_name} wurden gespeichert.`
      );
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setSavingPlayer(false);
    }
  }

  async function removePlayer(player: Player, team: Team) {
    if (!userId || playerActionBusy) return;

    const confirmed = window.confirm(
      `${player.full_name} wirklich aus „${team.name}“ entfernen?\n\n` +
        "Damit wird das Spielerprofil gelöscht. Je nach Datenbank-Verknüpfung werden auch zugehörige Aufgaben und Rückmeldungen gelöscht.\n\n" +
        "Der Login-Account wird nicht gelöscht."
    );

    if (!confirmed) return;

    setDeletingPlayerId(player.id);
    setError(null);
    setMessage(null);

    try {
      const { data, error: deleteError } = await supabase
        .from("players")
        .delete()
        .eq("id", player.id)
        .eq("coach_id", userId)
        .eq("team_id", team.id)
        .select("id")
        .maybeSingle();

      if (deleteError) throw deleteError;

      if (!data) {
        throw new Error(
          "Der Spieler wurde nicht entfernt. Prüfe die Lese- und Löschberechtigungen."
        );
      }

      setPlayers((current) =>
        current.filter((item) => item.id !== player.id)
      );

      if (editingPlayerId === player.id) {
        setEditingPlayerId(null);
        setEditError(null);
      }

      setMessage(`${player.full_name} wurde aus dem Team entfernt.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingPlayerId(null);
    }
  }

  async function createInvitation(team: Team) {
    if (!userId || creatingInviteTeamId) return;

    setCreatingInviteTeamId(team.id);
    setError(null);
    setMessage(null);
    setCopyMessage(null);

    try {
      const { data, error: invitationError } = await supabase
        .from("team_invitations")
        .insert({
          team_id: team.id,
          created_by: userId,
          expires_at: null,
        })
        .select(
          "id, team_id, created_by, created_at, expires_at, used"
        )
        .single();

      if (invitationError) throw invitationError;

      const invitation = data as Invitation;
      const link =
        `${window.location.origin}/signup-player?invite=` +
        encodeURIComponent(invitation.id);

      setInvitations((current) => [invitation, ...current]);
      setInviteDialog({
        teamName: team.name,
        link,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingInviteTeamId(null);
    }
  }

  async function copyInvitationLink() {
    if (!inviteDialog) return;

    try {
      await navigator.clipboard.writeText(inviteDialog.link);
      setCopyMessage("Link kopiert.");
    } catch {
      setCopyMessage(
        "Automatisches Kopieren nicht möglich. Bitte den Link im Feld markieren und kopieren."
      );
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
      <header className="topbar no-print">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ⚽
          </div>

          <div>
            <span className="brand-name">MATCHPLAN AI</span>
            <span className="brand-caption">Teams verwalten</span>
          </div>
        </div>

        <div className="topbar-actions">
          <a className="status-pill link-pill" href="/">
            ← Zum Dashboard
          </a>
        </div>
      </header>

      <section className="hero no-print">
        <p className="eyebrow">Mannschaften & Spieler</p>

        <h1>
          Deine
          <br />
          <span>Teams</span>
        </h1>

        <p>
          Verwalte deine Mannschaften, bearbeite Nummern und Positionen
          und erstelle Einladungs-Links für deine Spieler.
        </p>
      </section>

      {error && (
        <div
          className="error-box"
          role="alert"
          style={{ marginBottom: 20 }}
        >
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

      <section className="workspace">
        <section className="panel no-print">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Neue Mannschaft</p>
              <h2>Team erstellen</h2>
            </div>
          </div>

          <form className="form-content" onSubmit={createTeam}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="team-name">Teamname</label>
                <input
                  id="team-name"
                  value={newTeamName}
                  onChange={(event) =>
                    setNewTeamName(event.target.value)
                  }
                  placeholder="z. B. ASV Eggstätt"
                  maxLength={120}
                  disabled={creatingTeam}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="team-age-group">
                  Altersgruppe
                </label>
                <input
                  id="team-age-group"
                  value={newTeamAgeGroup}
                  onChange={(event) =>
                    setNewTeamAgeGroup(event.target.value)
                  }
                  placeholder="z. B. Senioren"
                  maxLength={60}
                  disabled={creatingTeam}
                />
              </div>
            </div>

            <button
              type="submit"
              className="generate-button"
              disabled={creatingTeam || !newTeamName.trim()}
            >
              {creatingTeam ? "Wird erstellt …" : "Team erstellen"}
            </button>
          </form>
        </section>

        <section className="panel no-print">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Kader erweitern</p>
              <h2>Spieler hinzufügen</h2>
            </div>
          </div>

          <form className="form-content" onSubmit={createPlayer}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="player-team">Team</label>
                <select
                  id="player-team"
                  value={selectedTeamId}
                  onChange={(event) =>
                    setSelectedTeamId(event.target.value)
                  }
                  disabled={creatingPlayer || loading}
                  required
                >
                  <option value="">Team auswählen …</option>

                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="player-name">Spielername</label>
                <input
                  id="player-name"
                  value={newPlayerFullName}
                  onChange={(event) =>
                    setNewPlayerFullName(event.target.value)
                  }
                  placeholder="Vorname Nachname"
                  maxLength={120}
                  disabled={creatingPlayer}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="player-position">Position</label>
                <input
                  id="player-position"
                  value={newPlayerPosition}
                  onChange={(event) =>
                    setNewPlayerPosition(event.target.value)
                  }
                  placeholder="z. B. Flügel"
                  maxLength={80}
                  disabled={creatingPlayer}
                />
              </div>

              <div className="field">
                <label htmlFor="player-number">
                  Trikotnummer
                </label>
                <input
                  id="player-number"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={newPlayerShirtNumber}
                  onChange={(event) =>
                    setNewPlayerShirtNumber(event.target.value)
                  }
                  placeholder="Optional"
                  disabled={creatingPlayer}
                />
              </div>
            </div>

            <p className="helper">
              Ein manueller Spielereintrag erstellt noch keinen
              Login-Account. Bereits registrierte Spieler nicht
              erneut hinzufügen.
            </p>

            <button
              type="submit"
              className="generate-button"
              disabled={
                creatingPlayer ||
                !selectedTeamId ||
                !newPlayerFullName.trim()
              }
            >
              {creatingPlayer
                ? "Wird hinzugefügt …"
                : "Spieler hinzufügen"}
            </button>
          </form>
        </section>

        <section
          className="panel"
          style={{ gridColumn: "1 / -1" }}
        >
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Deine Teams</p>
              <h2>Übersicht</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void refreshData()}
              disabled={
                loading ||
                playerActionBusy ||
                creatingPlayer ||
                creatingTeam ||
                creatingInviteTeamId !== null
              }
            >
              {loading ? "Lädt …" : "↻ Aktualisieren"}
            </button>
          </div>

          {loading && teams.length === 0 ? (
            <div className="empty-state">
              <div>
                <span
                  className="button-spinner"
                  aria-hidden="true"
                />
                <p>Teams und Spieler werden geladen …</p>
              </div>
            </div>
          ) : teams.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-icon" aria-hidden="true">
                  ⚽
                </div>
                <h3>Noch keine Teams geladen</h3>
                <p>
                  Erstelle dein erstes Team oder prüfe eine
                  eventuell angezeigte Fehlermeldung.
                </p>
              </div>
            </div>
          ) : (
            <div className="teams-grid">
              {teams.map((team) => {
                const teamPlayers = players.filter(
                  (player) => player.team_id === team.id
                );

                const hasActiveInvitation = invitations.some(
                  (invitation) =>
                    invitation.team_id === team.id &&
                    !invitation.used &&
                    (!invitation.expires_at ||
                      new Date(invitation.expires_at).getTime() >
                        Date.now())
                );

                return (
                  <article className="team-card" key={team.id}>
                    <div className="team-card-header">
                      <div>
                        <h3>{team.name}</h3>

                        {team.age_group && (
                          <span className="team-age">
                            {team.age_group}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="invite-button"
                        onClick={() =>
                          void createInvitation(team)
                        }
                        disabled={creatingInviteTeamId !== null}
                      >
                        {creatingInviteTeamId === team.id
                          ? "Erstellt …"
                          : "✉ Einladen"}
                      </button>
                    </div>

                    <div className="team-card-meta">
                      <span>👥 {teamPlayers.length} Spieler</span>

                      {hasActiveInvitation && (
                        <span className="invite-active">
                          ✓ Einladungs-Link aktiv
                        </span>
                      )}
                    </div>

                    {teamPlayers.length === 0 ? (
                      <p className="helper">
                        In diesem Team sind noch keine Spieler
                        hinterlegt.
                      </p>
                    ) : (
                      <div className="team-players">
                        {teamPlayers.map((player) => {
                          const isEditing =
                            editingPlayerId === player.id;
                          const isDeleting =
                            deletingPlayerId === player.id;

                          return (
                            <div
                              key={player.id}
                              style={{
                                padding: "12px 0",
                                borderBottom:
                                  "1px solid rgba(187,255,205,0.08)",
                              }}
                            >
                              <div
                                className="player-row"
                                style={{
                                  flexWrap: "wrap",
                                  gap: 12,
                                }}
                              >
                                <span className="player-number">
                                  {player.shirt_number ?? "–"}
                                </span>

                                <span
                                  className="player-name"
                                  style={{ flex: 1, minWidth: 120 }}
                                >
                                  <strong>
                                    {player.full_name}
                                  </strong>
                                  <small>
                                    {player.position ||
                                      "Position offen"}
                                  </small>
                                </span>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() =>
                                        startEditing(player)
                                      }
                                      disabled={playerActionBusy}
                                      aria-label={`${player.full_name} bearbeiten`}
                                    >
                                      Bearbeiten
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="danger-button"
                                    onClick={() =>
                                      void removePlayer(
                                        player,
                                        team
                                      )
                                    }
                                    disabled={playerActionBusy}
                                    aria-label={`${player.full_name} aus dem Team entfernen`}
                                  >
                                    {isDeleting
                                      ? "Entfernt …"
                                      : "Entfernen"}
                                  </button>
                                </div>
                              </div>

                              {isEditing && (
                                <form
                                  onSubmit={(event) =>
                                    void savePlayer(event, player)
                                  }
                                  style={{
                                    marginTop: 12,
                                    padding: 16,
                                    border:
                                      "1px solid rgba(187,255,205,0.16)",
                                    borderRadius: 12,
                                    background:
                                      "rgba(4,17,10,0.45)",
                                  }}
                                >
                                  <div className="field-grid">
                                    <div className="field">
                                      <label
                                        htmlFor={`edit-number-${player.id}`}
                                      >
                                        Trikotnummer
                                      </label>

                                      <input
                                        id={`edit-number-${player.id}`}
                                        type="number"
                                        min={1}
                                        max={99}
                                        step={1}
                                        value={editShirtNumber}
                                        onChange={(event) =>
                                          setEditShirtNumber(
                                            event.target.value
                                          )
                                        }
                                        placeholder="Keine Nummer"
                                        disabled={savingPlayer}
                                      />
                                    </div>

                                    <div className="field">
                                      <label
                                        htmlFor={`edit-position-${player.id}`}
                                      >
                                        Position
                                      </label>

                                      <input
                                        id={`edit-position-${player.id}`}
                                        value={editPosition}
                                        onChange={(event) =>
                                          setEditPosition(
                                            event.target.value
                                          )
                                        }
                                        maxLength={80}
                                        placeholder="z. B. Stürmer"
                                        disabled={savingPlayer}
                                      />
                                    </div>
                                  </div>

                                  {editError && (
                                    <div
                                      className="error-box"
                                      role="alert"
                                      style={{ marginTop: 12 }}
                                    >
                                      {editError}
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                      flexWrap: "wrap",
                                      gap: 10,
                                      marginTop: 16,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={cancelEditing}
                                      disabled={savingPlayer}
                                    >
                                      Abbrechen
                                    </button>

                                    <button
                                      type="submit"
                                      className="assign-button"
                                      disabled={savingPlayer}
                                    >
                                      {savingPlayer
                                        ? "Speichert …"
                                        : "Speichern"}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {inviteDialog && (
        <div
          className="modal-backdrop no-print"
          onMouseDown={() => setInviteDialog(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setInviteDialog(null);
            }
          }}
        >
          <section
            className="save-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="panel-kicker">Einladungs-Link</p>

            <h2 id="invite-dialog-title">
              {inviteDialog.teamName}
            </h2>

            <p>
              Über diesen Link kann sich ein Spieler registrieren.
              Die automatische Verbindung neuer Accounts mit dem
              Team ist in unserem bisherigen Signup-Code noch
              nicht fertiggestellt.
            </p>

            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="team-invite-link">
                Link zum Kopieren
              </label>

              <input
                id="team-invite-link"
                type="text"
                value={inviteDialog.link}
                readOnly
                autoFocus
                onFocus={(event) =>
                  event.currentTarget.select()
                }
              />
            </div>

            {copyMessage && (
              <p className="helper" role="status">
                {copyMessage}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setInviteDialog(null)}
              >
                Schließen
              </button>

              <button
                type="button"
                className="assign-button"
                onClick={() => void copyInvitationLink()}
              >
                Link kopieren
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
