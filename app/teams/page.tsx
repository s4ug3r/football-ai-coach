"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
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

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState("");

  const [newPlayerFullName, setNewPlayerFullName] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("");
  const [newPlayerShirtNumber, setNewPlayerShirtNumber] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedTeamForInvite, setSelectedTeamForInvite] = useState<Team | null>(null);
  const [invitationLink, setInvitationLink] = useState("");

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
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    if (userId) {
      void loadData();
    }
  }, [userId]);

  async function loadData() {
    if (!userId) return;

    setLoading(true);
    setError(null);

    const [teamsResult, playersResult, invitationsResult] = await Promise.all([
      supabase
        .from("teams")
        .select("id, coach_id, name, age_group, created_at")
        .eq("coach_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("players")
        .select("id, team_id, coach_id, full_name, position, shirt_number")
        .eq("coach_id", userId)
        .order("shirt_number", { ascending: true }),
      supabase
        .from("team_invitations")
        .select("id, team_id, created_by, created_at, expires_at, used")
        .eq("created_by", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (teamsResult.error) {
      setError(teamsResult.error.message);
      setLoading(false);
      return;
    }

    if (playersResult.error) {
      setError(playersResult.error.message);
      setLoading(false);
      return;
    }

    if (invitationsResult.error) {
      setError(invitationsResult.error.message);
      setLoading(false);
      return;
    }

    setTeams((teamsResult.data ?? []) as Team[]);
    setPlayers((playersResult.data ?? []) as Player[]);
    setInvitations((invitationsResult.data ?? []) as Invitation[]);
    setLoading(false);
  }

  async function createTeam() {
    if (!userId || !newTeamName.trim()) return;

    const { error } = await supabase.from("teams").insert({
      coach_id: userId,
      name: newTeamName.trim(),
      age_group: newTeamAgeGroup.trim() || null,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewTeamName("");
    setNewTeamAgeGroup("");
    await loadData();
  }

  async function createPlayer() {
    if (!userId || !selectedTeamId || !newPlayerFullName.trim()) return;

    const { error } = await supabase.from("players").insert({
      coach_id: userId,
      team_id: selectedTeamId,
      full_name: newPlayerFullName.trim(),
      position: newPlayerPosition.trim() || null,
      shirt_number: newPlayerShirtNumber ? Number(newPlayerShirtNumber) : null,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewPlayerFullName("");
    setNewPlayerPosition("");
    setNewPlayerShirtNumber("");
    await loadData();
  }

  async function createInvitation(team: Team) {
    if (!userId) return;

    const { data, error } = await supabase
      .from("team_invitations")
      .insert({
        team_id: team.id,
        created_by: userId,
        expires_at: null,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    const invitationId = (data as Invitation).id;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/signup-player?invite=${invitationId}`;

    setInvitationLink(link);
    setSelectedTeamForInvite(team);
    setShowInviteModal(true);
    await loadData();
  }

  async function copyInvitationLink() {
    try {
      await navigator.clipboard.writeText(invitationLink);
      alert("Link kopiert!");
    } catch {
      alert("Link konnte nicht kopiert werden.");
    }
  }

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Teams werden geladen …</p>
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
            ← Zurück
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
          Verwalte deine Mannschaften, füge Spieler hinzu und verschicke
          Einladungs-Links.
        </p>
      </section>

      <section className="workspace">
        <section className="panel no-print">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Neues Team</p>
              <h2>Team erstellen</h2>
            </div>
          </div>

          <div className="form-content">
            <div className="field-grid">
              <div className="field">
                <label htmlFor="team-name">Team-Name</label>
                <input
                  id="team-name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="z. B. U15 Blau"
                />
              </div>

              <div className="field">
                <label htmlFor="team-age">Altersgruppe</label>
                <input
                  id="team-age"
                  value={newTeamAgeGroup}
                  onChange={(e) => setNewTeamAgeGroup(e.target.value)}
                  placeholder="z. B. U15"
                />
              </div>
            </div>

            <button
              type="button"
              className="generate-button"
              onClick={createTeam}
              disabled={!newTeamName.trim()}
            >
              Team erstellen
            </button>
          </div>
        </section>

        <section className="panel no-print">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Spieler hinzufügen</p>
              <h2>Neuer Spieler</h2>
            </div>
          </div>

          <div className="form-content">
            <div className="field-grid">
              <div className="field">
                <label htmlFor="player-team">Team</label>
                <select
                  id="player-team"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
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
                <label htmlFor="player-name">Name</label>
                <input
                  id="player-name"
                  value={newPlayerFullName}
                  onChange={(e) => setNewPlayerFullName(e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="field">
                <label htmlFor="player-position">Position</label>
                <input
                  id="player-position"
                  value={newPlayerPosition}
                  onChange={(e) => setNewPlayerPosition(e.target.value)}
                  placeholder="z. B. Stürmer"
                />
              </div>

              <div className="field">
                <label htmlFor="player-number">Trikotnummer</label>
                <input
                  id="player-number"
                  type="number"
                  value={newPlayerShirtNumber}
                  onChange={(e) => setNewPlayerShirtNumber(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>

            <button
              type="button"
              className="generate-button"
              onClick={createPlayer}
              disabled={!selectedTeamId || !newPlayerFullName.trim()}
            >
              Spieler hinzufügen
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Deine Teams</p>
              <h2>Übersicht</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadData()}
              disabled={loading}
            >
              {loading ? "Lädt ..." : "↻ Aktualisieren"}
            </button>
          </div>

          {error && (
            <div className="error-box" role="alert">
              <strong>Fehler:</strong>
              <br />
              {error}
            </div>
          )}

          {teams.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-icon" aria-hidden="true">
                  ⚽
                </div>
                <h3>Noch keine Teams</h3>
                <p>Erstelle oben dein erstes Team.</p>
              </div>
            </div>
          ) : (
            <div className="teams-grid">
              {teams.map((team) => {
                const teamPlayers = players.filter((p) => p.team_id === team.id);
                const teamInvitation = invitations.find((inv) => inv.team_id === team.id && !inv.used);

                return (
                  <article className="team-card" key={team.id}>
                    <div className="team-card-header">
                      <div>
                        <h3>{team.name}</h3>
                        {team.age_group && (
                          <span className="team-age">{team.age_group}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="invite-button"
                        onClick={() => void createInvitation(team)}
                      >
                        ✉ Einladen
                      </button>
                    </div>

                    <div className="team-card-meta">
                      <span>👥 {teamPlayers.length} Spieler</span>
                      {teamInvitation && (
                        <span className="invite-active">✓ Einladungs-Link aktiv</span>
                      )}
                    </div>

                    {teamPlayers.length > 0 && (
                      <div className="team-players">
                        {teamPlayers.map((player) => (
                          <div className="player-row" key={player.id}>
                            <span className="player-number">
                              {player.shirt_number ?? "–"}
                            </span>
                            <span className="player-name">
                              <strong>{player.full_name}</strong>
                              <small>{player.position || "Position offen"}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {showInviteModal && selectedTeamForInvite && (
        <div
          className="modal-backdrop no-print"
          role="presentation"
          onMouseDown={() => setShowInviteModal(false)}
        >
          <section
            className="save-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="panel-kicker">Einladungs-Link</p>
            <h2>{selectedTeamForInvite.name}</h2>
            <p>
              Verschicke diesen Link an deine Spieler. Sie können sich darüber
              registrieren und werden automatisch diesem Team zugeordnet.
            </p>

            <div className="invite-link-box">
              <code>{invitationLink}</code>
              <button
                type="button"
                className="secondary-button"
                onClick={copyInvitationLink}
              >
                Kopieren
              </button>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowInviteModal(false)}
              >
                Schließen
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
