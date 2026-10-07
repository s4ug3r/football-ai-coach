"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Invitation = {
  id: string;
  team_id: string;
  created_by: string;
  used: boolean;
  expires_at: string | null;
};

type Team = {
  id: string;
  name: string;
};

function SignUpPlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const inviteParam = searchParams.get("invite");

    if (!inviteParam) {
      setError("Kein gültiger Einladungs-Link gefunden.");
      setPageLoading(false);
      return;
    }

    setInvitationId(inviteParam);
    void loadInvitation(inviteParam);
  }, [searchParams]);

  async function loadInvitation(id: string) {
    setPageLoading(true);
    setError(null);

    const { data, error: invitationError } = await supabase
      .from("team_invitations")
      .select("id, team_id, created_by, used, expires_at")
      .eq("id", id)
      .maybeSingle();

    if (invitationError) {
      setError("Die Einladung konnte nicht geladen werden.");
      setPageLoading(false);
      return;
    }

    if (!data) {
      setError("Diese Einladung wurde nicht gefunden.");
      setPageLoading(false);
      return;
    }

    const loadedInvitation = data as Invitation;

    if (loadedInvitation.used) {
      setError("Diese Einladung wurde bereits verwendet.");
      setPageLoading(false);
      return;
    }

    if (
      loadedInvitation.expires_at &&
      new Date(loadedInvitation.expires_at) <= new Date()
    ) {
      setError("Diese Einladung ist abgelaufen.");
      setPageLoading(false);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", loadedInvitation.team_id)
      .maybeSingle();

    if (teamError || !teamData) {
      setError("Das Team zu dieser Einladung wurde nicht gefunden.");
      setPageLoading(false);
      return;
    }

    const team = teamData as Team;

    setInvitation(loadedInvitation);
    setTeamName(team.name);
    setPageLoading(false);
  }

  async function handleSignUp() {
    setError(null);

    if (!invitationId || !invitation) {
      setError("Diese Einladung ist nicht gültig.");
      return;
    }

    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError(
        "Bitte gib deinen Namen, eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein."
      );
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName.trim(),
            role: "player",
            invitation_id: invitationId,
            invited_team_id: invitation.team_id,
            invited_by: invitation.created_by,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user?.id) {
        throw new Error(
          "Der Spieler-Account konnte nicht erstellt werden. Bitte versuche es später erneut."
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Der Spieler-Account konnte nicht erstellt werden."
      );
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Einladung wird geprüft …</p>
        </section>
      </main>
    );
  }

  if (success) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <a className="auth-brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              ⚽
            </span>
            <span>
              <strong>MATCHPLAN AI</strong>
              <small>Spieler</small>
            </span>
          </a>

          <p className="eyebrow">Spieler-Account erstellt</p>
          <h1>Fast geschafft!</h1>

          <p className="auth-intro">
            Dein Spieler-Account wurde erstellt. Bitte bestätige jetzt deine
            E-Mail-Adresse über den Link in deinem Postfach. Danach kannst du
            dich einloggen.
          </p>

          <p className="auth-footnote">
            Team: <strong>{teamName}</strong>
          </p>

          <button
            type="button"
            className="generate-button"
            onClick={() => router.push("/login")}
          >
            Zum Login
          </button>
        </section>
      </main>
    );
  }

  const invitationIsValid = Boolean(invitation && teamName);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="auth-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            ⚽
          </span>
          <span>
            <strong>MATCHPLAN AI</strong>
            <small>Spieler</small>
          </span>
        </a>

        <p className="eyebrow">Spieler-Registrierung</p>
        <h1>Team beitreten</h1>

        {invitationIsValid ? (
          <p className="auth-intro">
            Du wurdest eingeladen, dem Team <strong>{teamName}</strong>{" "}
            beizutreten. Erstelle jetzt deinen Spieler-Account.
          </p>
        ) : (
          <p className="auth-intro">
            Bitte registriere dich über einen gültigen Einladungs-Link deines
            Trainers.
          </p>
        )}

        {error && (
          <div className="error-box auth-message" role="alert">
            {error}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSignUp();
          }}
        >
          <div className="field">
            <label htmlFor="signup-player-name">Vollständiger Name</label>
            <input
              id="signup-player-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Max Mustermann"
              autoComplete="name"
              disabled={!invitationIsValid || loading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signup-player-email">E-Mail-Adresse</label>
            <input
              id="signup-player-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="max@beispiel.de"
              autoComplete="email"
              disabled={!invitationIsValid || loading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signup-player-password">Passwort</label>
            <input
              id="signup-player-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindestens 8 Zeichen"
              minLength={8}
              autoComplete="new-password"
              disabled={!invitationIsValid || loading}
              required
            />
          </div>

          <button
            className="generate-button"
            disabled={
              loading ||
              !invitationIsValid ||
              !fullName.trim() ||
              !email.trim() ||
              password.length < 8
            }
            type="submit"
          >
            {loading && (
              <span className="button-spinner" aria-hidden="true" />
            )}
            {loading ? "Account wird erstellt ..." : "Account erstellen"}
          </button>
        </form>

        <p className="auth-footnote">
          Du hast bereits einen Account? <a href="/login">Hier einloggen</a>
        </p>
      </section>
    </main>
  );
}

export default function SignUpPlayerPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-shell">
          <section className="auth-card auth-loading">
            <span className="button-spinner" aria-hidden="true" />
            <p>Spieler-Registrierung wird geladen …</p>
          </section>
        </main>
      }
    >
      <SignUpPlayerContent />
    </Suspense>
  );
}
