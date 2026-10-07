"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  created_at: string;
};

const POSITIONS = [
  "Torwart",
  "Innenverteidigung",
  "Außenverteidigung",
  "Defensives Mittelfeld",
  "Zentrales Mittelfeld",
  "Offensives Mittelfeld",
  "Flügel",
  "Sturm",
];

export default function TeamsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const [teamName, setTeamName] = useState("");
  const [ageGroup, setAgeGroup] = useState("U15");
  const [playerName, setPlayerName] = useState("");
  const [playerPosition, setPlayerPosition] = useState("Sturm");
  const [shirtNumber, setShirtNumber] = useState("");

  const [teamsLoading, setTeamsLoading] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [playerSaving, setPlayerSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  useEffect(() => {
    let active = true;

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setAuthLoading(false);
      await loadTeams();
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (selectedTeamId) {
      void loadPlayers(selectedTeamId);
    } else {
      setPlayers([]);
    }
  }, [selectedTeamId]);

  async function loadTeams() {
    setTeamsLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setTeamsLoading(false);
      return;
    }

    const loadedTeams = (data ?? []) as Team[];
    setTeams(loadedTeams);

    if (!selectedTeamId && loadedTeams.length > 0) {
      setSelectedTeamId(loadedTeams[0].id);
    }

    setTeamsLoading(false);
  }

  async function loadPlayers(teamId: string) {
    setPlayersLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .order("shirt_number", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setPlayersLoading(false);
      return;
    }

    setPlayers((data ?? []) as Player[]);
    setPlayersLoading(false);
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !teamName.trim()) return;

    setTeamSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("teams")
      .insert({
        coach_id: userId,
        name: teamName.trim(),
        age_group: ageGroup.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setTeamSaving(false);
      return;
    }

    const newTeam = data as Team;
    setTeams((current) => [...current, newTeam]);
    setSelectedTeamId(newTeam.id);
    setTeamName("");
    setAgeGroup("U15");
    setTeamSaving(false);
  }

  async function deleteTeam(teamId: string) {
    const team = teams.find((item) => item.id === teamId);

    const confirmed = window.confirm(
      `Team "${team?.name ?? "dieses Team"}" inklusive aller Spieler löschen?`
    );

    if (!confirmed) return;

    setError(null);

    const { error: deleteError } = await supabase
      .from("teams")
      .delete()
      .eq("id", teamId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const remainingTeams = teams.filter((team) => team.id !== teamId);
    setTeams(remainingTeams);
    setSelectedTeamId(remainingTeams[0]?.id ?? null);
    setPlayers([]);
  }

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !selectedTeamId || !playerName.trim()) return;

    setPlayerSaving(true);
    setError(null);

    const parsedNumber = shirtNumber.trim()
      ? Number.parseInt(shirtNumber, 10)
      : null;

    const { data, error: insertError } = await supabase
      .from("players")
      .insert({
        team_id: selectedTeamId,
        coach_id: userId,
        full_name: playerName.trim(),
        position: playerPosition || null,
        shirt_number:
          parsedNumber !== null && Number.isFinite(parsedNumber)
            ? parsedNumber
            : null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setPlayerSaving(false);
      return;
    }

    const newPlayer = data as Player;
    setPlayers((current) =>
      [...current, newPlayer].sort(
        (a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999)
      )
    );

    setPlayerName("");
    setPlayerPosition("Sturm");
    setShirtNumber("");
    setPlayerSaving(false);
  }

  async function deletePlayer(playerId: string) {
    const player = players.find((item) => item.id === playerId);

    const confirmed = window.confirm(
      `Spieler "${player?.full_name ?? "diesen Spieler"}" löschen?`
    );

    if (!confirmed) return;

    setError(null);

    const { error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("id", playerId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPlayers((current) => current.filter((player) => player.id !== playerId));
  }

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Teamverwaltung wird geladen …</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <div className="brand-mark" aria-hidden="true">⚽</div>
          <div>
            <span className="brand-name">MATCHPLAN AI</span>
            <span className="brand-caption">Teamverwaltung</span>
          </div>
        </a>

        <div className="topbar-actions">
          <a className="status-pill link-pill" href="/">
            ← Dashboard
          </a>
          <button
            type="button"
            className="status-pill logout-button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
          >
            Ausloggen
          </button>
        </div>
      </header>

      <section className="hero team-hero">
        <p className="eyebrow">Trainerbereich · Kader</p>
        <h1>
          Dein Team.
          <br />
          <span>Deine Spieler.</span>
        </h1>
        <p>
          Lege Mannschaften an und verwalte deinen Kader. Im nächsten Schritt
          kannst du Home-Workouts direkt an Spieler zuweisen.
        </p>
      </section>

      {error && (
        <div className="error-box team-error" role="alert">
          <strong>Das hat nicht geklappt:</strong>
          <br />
          {error}
        </div>
      )}

      <section className="team-layout">
        <aside className="panel team-sidebar">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Mannschaften</p>
              <h2>Meine Teams</h2>
            </div>
            <span className="plan-badge">{teams.length}</span>
          </div>

          <div className="team-list">
            {teamsLoading && (
              <p className="small-loading">Teams werden geladen …</p>
            )}

            {!teamsLoading && teams.length === 0 && (
              <p className="small-empty">
                Lege rechts dein erstes Team an.
              </p>
            )}

            {teams.map((team) => (
              <button
                type="button"
                key={team.id}
                className={`team-item ${
                  team.id === selectedTeamId ? "active" : ""
                }`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <span className="team-item-icon">⚽</span>
                <span className="team-item-info">
                  <strong>{team.name}</strong>
                  <small>{team.age_group || "Ohne Altersgruppe"}</small>
                </span>
                <span className="team-item-arrow">›</span>
              </button>
            ))}
          </div>

          <form className="add-team-form" onSubmit={createTeam}>
            <p className="form-section-title">Neues Team</p>

            <div className="field">
              <label htmlFor="team-name">Teamname</label>
              <input
                id="team-name"
                value={teamName}
                required
                maxLength={100}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="z. B. FC Musterstadt U15"
              />
            </div>

            <div className="field">
              <label htmlFor="age-group">Altersgruppe</label>
              <select
                id="age-group"
                value={ageGroup}
                onChange={(event) => setAgeGroup(event.target.value)}
              >
                <option>U9</option>
                <option>U11</option>
                <option>U13</option>
                <option>U15</option>
                <option>U17</option>
                <option>U19</option>
                <option>Senioren</option>
              </select>
            </div>

            <button
              className="generate-button compact-button"
              type="submit"
              disabled={teamSaving}
            >
              {teamSaving && <span className="button-spinner" />}
              {teamSaving ? "Erstellt ..." : "+ Team anlegen"}
            </button>
          </form>
        </aside>

        <section className="panel team-main">
          {!selectedTeam ? (
            <div className="empty-state team-empty">
              <div>
                <div className="empty-icon" aria-hidden="true">⚽</div>
                <h3>Noch kein Team ausgewählt</h3>
                <p>
                  Lege links ein Team an. Danach kannst du Spieler zu deinem
                  Kader hinzufügen.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="panel-header team-main-header">
                <div>
                  <p className="panel-kicker">
                    {selectedTeam.age_group || "Mannschaft"}
                  </p>
                  <h2>{selectedTeam.name}</h2>
                </div>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void deleteTeam(selectedTeam.id)}
                >
                  Team löschen
                </button>
              </div>

              <div className="team-stats">
                <div className="team-stat">
                  <strong>{players.length}</strong>
                  <span>Spieler im Kader</span>
                </div>
                <div className="team-stat">
                  <strong>{selectedTeam.age_group || "–"}</strong>
                  <span>Altersgruppe</span>
                </div>
                <div className="team-stat">
                  <strong>0</strong>
                  <span>Offene Aufgaben</span>
                </div>
              </div>

              <div className="roster-section">
                <div className="roster-heading">
                  <div>
                    <p className="panel-kicker">Kader</p>
                    <h3>Spieler</h3>
                  </div>
                  <span className="roster-count">{players.length} gesamt</span>
                </div>

                {playersLoading && (
                  <p className="small-loading">Spieler werden geladen …</p>
                )}

                {!playersLoading && players.length === 0 && (
                  <div className="roster-empty">
                    <span>👟</span>
                    <p>Noch keine Spieler angelegt.</p>
                  </div>
                )}

                {!playersLoading && players.length > 0 && (
                  <div className="player-list">
                    {players.map((player) => (
                      <article className="player-row" key={player.id}>
                        <div className="player-number">
                          {player.shirt_number ?? "–"}
                        </div>
                        <div className="player-info">
                          <strong>{player.full_name}</strong>
                          <span>{player.position || "Position offen"}</span>
                        </div>
                        <button
                          type="button"
                          className="player-delete"
                          title={`${player.full_name} löschen`}
                          onClick={() => void deletePlayer(player.id)}
                        >
                          ×
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <form className="add-player-form" onSubmit={createPlayer}>
                <div className="add-player-heading">
                  <div>
                    <p className="panel-kicker">Kader erweitern</p>
                    <h3>Spieler hinzufügen</h3>
                  </div>
                </div>

                <div className="player-form-grid">
                  <div className="field player-name-field">
                    <label htmlFor="player-name">Name</label>
                    <input
                      id="player-name"
                      value={playerName}
                      required
                      maxLength={100}
                      onChange={(event) => setPlayerName(event.target.value)}
                      placeholder="Vor- und Nachname"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="player-position">Position</label>
                    <select
                      id="player-position"
                      value={playerPosition}
                      onChange={(event) =>
                        setPlayerPosition(event.target.value)
                      }
                    >
                      {POSITIONS.map((position) => (
                        <option key={position}>{position}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field shirt-field">
                    <label htmlFor="shirt-number">Nr.</label>
                    <input
                      id="shirt-number"
                      type="number"
                      min="0"
                      max="99"
                      value={shirtNumber}
                      onChange={(event) => setShirtNumber(event.target.value)}
                      placeholder="10"
                    />
                  </div>

                  <button
                    className="generate-button add-player-button"
                    type="submit"
                    disabled={playerSaving}
                  >
                    {playerSaving && <span className="button-spinner" />}
                    {playerSaving ? "..." : "+ Hinzufügen"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
