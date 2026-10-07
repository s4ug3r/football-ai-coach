"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

function SignUpPlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    const inviteParam = searchParams.get("invite");
    if (inviteParam) {
      setInvitationId(inviteParam);
      void loadInvitation(inviteParam);
    }
  }, [searchParams]);

  async function loadInvitation(id: string) {
    const { data, error } = await supabase
      .from("team_invitations")
      .select(
        `
        id,
        team_id,
        team:team_id (
          name
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      setError("Ungültiger oder abgelaufener Einladungs-Link.");
      return;
    }

    const teamData = data.team as unknown as { name: string } | null;
    setTeamName(teamData?.name ?? null);
  }

  async function handleSignUp() {
    setLoading(true);
    setError(null);

    if (!invitationId) {
      setError("Bitte registriere dich über einen Einladungs-Link deines Trainers.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Registrierung fehlgeschlagen.");
      setLoading(false);
      return;
    }

    const { data: invitationData } = await supabase
      .from("team_invitations")
      .select("team_id")
      .eq("id", invitationId)
      .single();

    if (!invitationData) {
      setError("Einladungs-Link ungültig.");
      setLoading(false);
      return;
    }

    const { error: playerError } = await supabase.from("players").insert({
      coach_id: userId,
      team_id: (invitationData as { team_id: string }).team_id,
      full_name: fullName,
      position: null,
      shirt_number: null,
    });

    if (playerError) {
      setError(playerError.message);
      setLoading(false);
      return;
    }

    await supabase
      .from("team_invitations")
      .update({
        used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <a className="auth-brand" href="/">
            <span className="brand-mark" aria-hidden="true">⚽</span>
            <span>
              <strong>MATCHPLAN AI</strong>
              <small>Spieler</small>
            </span>
          </a>

          <h1>Fast geschafft!</h1>
          <p>
            Du hast dich erfolgreich registriert. Bitte bestätige deine
            E-Mail-Adresse, bevor du dich einloggst.
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

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="auth-brand" href="/">
          <span className="brand-mark" aria-hidden="true">⚽</span>
          <span>
            <strong>MATCHPLAN AI</strong>
            <small>Spieler</small>
          </span>
        </a>

        <p className="eyebrow">Spieler-Registrierung</p>
        <h1>Team beitreten</h1>
        
        {teamName ? (
          <p className="auth-intro">
            Du wurdest eingeladen, dem Team <strong>{teamName}</strong> beizutreten.
          </p>
        ) : (
          <p className="auth-intro">
            Bitte registriere dich über den Einladungs-Link deines Trainers.
          </p>
        )}

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        {!invitationId && (
          <div className="error-box" role="alert">
            Kein gültiger Einladungs-Link gefunden.
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); void handleSignUp(); }}>
          <div className="field">
            <label htmlFor="signup-name">Vollständiger Name</label>
            <input
              id="signup-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Max Mustermann"
              disabled={!invitationId}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signup-email">E-Mail</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@beispiel.de"
              disabled={!invitationId}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signup-password">Passwort</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mind. 6 Zeichen"
              minLength={6}
              disabled={!invitationId}
              required
            />
          </div>

          <button
            className="generate-button"
            disabled={loading || !invitationId || !email || !password || !fullName}
            type="submit"
          >
            {loading && <span className="button-spinner" aria-hidden="true" />}
            {loading ? "Wird erstellt ..." : "Account erstellen"}
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
    <Suspense fallback={
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Wird geladen …</p>
        </section>
      </main>
    }>
      <SignUpPlayerContent />
    </Suspense>
  );
}
