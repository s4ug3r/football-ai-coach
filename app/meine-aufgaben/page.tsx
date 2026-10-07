"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function MeineAufgabenPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState("Spieler");

  useEffect(() => {
    let mounted = true;

    async function loadPlayer() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const role = user.user_metadata?.role;

      if (role !== "player") {
        router.replace("/");
        return;
      }

      const fullName = user.user_metadata?.full_name;

      if (typeof fullName === "string" && fullName.trim()) {
        setPlayerName(fullName.trim());
      }

      setLoading(false);
    }

    void loadPlayer();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Spielerbereich wird geladen …</p>
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
            <span className="brand-caption">Spielerbereich</span>
          </div>
        </div>

        <button
          type="button"
          className="status-pill logout-button"
          onClick={() => void signOut()}
        >
          <span className="status-dot" aria-hidden="true" />
          Ausloggen
        </button>
      </header>

      <section className="hero">
        <p className="eyebrow">Willkommen zurück</p>
        <h1>
          Hallo,
          <br />
          <span>{playerName}</span>
        </h1>
        <p>
          Hier findest du deine Home-Workouts, die dir dein Trainer zugewiesen
          hat.
        </p>
      </section>

      <section className="workspace">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Deine Aufgaben</p>
              <h2>Home-Workouts</h2>
            </div>
          </div>

          <div className="empty-state">
            <div>
              <div className="empty-icon" aria-hidden="true">
                ⚽
              </div>
              <h3>Noch keine Aufgaben</h3>
              <p>
                Sobald dein Trainer dir ein Home-Workout zuweist, erscheint es
                hier.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
