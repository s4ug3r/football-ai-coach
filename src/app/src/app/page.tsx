"use client";
import { useState } from "react";

type SessionPlan = {
  title: string;
  duration_min: number;
  frequency_per_week: number;
  phases: {
    name: string;
    duration_min: number;
    exercises: {
      name: string;
      duration_min: number;
      objective: string;
      organization: string;
      coaching_points: string;
      equipment: string;
    }[];
  }[];
};

type HomeWorkout = {
  title: string;
  duration_min: number;
  focus: string;
  blocks: {
    name: string;
    duration_min: number;
    exercises: {
      name: string;
      duration_min: number | null;
      sets_reps: string | null;
      objective: string;
      how_to: string;
      equipment: string;
      difficulty: string;
    }[];
  }[];
};

export default function Home() {
  const [tab, setTab] = useState<"session" | "home">("session");

  const [sDuration, setSDuration] = useState(90);
  const [sFreq, setSFreq] = useState(1);
  const [sFocus, setSFocus] = useState("Angriff");
  const [sLevel, setSLevel] = useState("U15+");
  const [sLocation, setSLocation] = useState("Platz");
  const [sEquipment, setSEquipment] = useState("Hütchen, Leibchen, Tore");
  const [sessionResult, setSessionResult] = useState<SessionPlan | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [hDuration, setHDuration] = useState(15);
  const [hFocus, setHFocus] = useState("Angriff");
  const [hLevel, setHLevel] = useState("Intermediate");
  const [hLocation, setHLocation] = useState("Zuhause");
  const [hEquipment, setHEquipment] = useState("Nur Ball");
  const [homeResult, setHomeResult] = useState<HomeWorkout | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  async function generateSession() {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const res = await fetch("/api/generate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: sDuration,
          frequency_per_week: sFreq,
          focus: sFocus,
          level: sLevel,
          location: sLocation,
          equipment: sEquipment,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setSessionResult(json.data);
    } catch (e: any) {
      setSessionError(e?.message || String(e));
    } finally {
      setSessionLoading(false);
    }
  }

  async function generateHome() {
    setHomeLoading(true);
    setHomeError(null);
    try {
      const res = await fetch("/api/generate-home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: hDuration,
          focus: hFocus,
          level: hLevel,
          location: hLocation,
          equipment: hEquipment,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setHomeResult(json.data);
    } catch (e: any) {
      setHomeError(e?.message || String(e));
    } finally {
      setHomeLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <h1 className="text-2xl font-bold mb-4">Football AI Coach (MVP)</h1>

      <div className="flex gap-2 mb-6">
        <button
          className={`px-3 py-1 rounded ${tab === "session" ? "bg-black text-white" : "bg-white border"}`}
          onClick={() => setTab("session")}
        >
          90‑Min‑Teamtraining
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "home" ? "bg-black text-white" : "bg-white border"}`}
          onClick={() => setTab("home")}
        >
          Mini‑Home‑Workouts
        </button>
      </div>

      {tab === "session" && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Parameter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
            <label className="flex flex-col">
              <span className="text-sm">Dauer (Min)</span>
              <input type="number" value={sDuration} onChange={(e) => setSDuration(Number(e.target.value))} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Häufigkeit (×/Woche)</span>
              <select value={sFreq} onChange={(e) => setSFreq(Number(e.target.value))} className="border rounded p-2">
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Fokus</span>
              <input value={sFocus} onChange={(e) => setSFocus(e.target.value)} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Level</span>
              <input value={sLevel} onChange={(e) => setSLevel(e.target.value)} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Ort</span>
              <input value={sLocation} onChange={(e) => setSLocation(e.target.value)} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Equipment</span>
              <input value={sEquipment} onChange={(e) => setSEquipment(e.target.value)} className="border rounded p-2" />
            </label>
          </div>

          <button
            onClick={generateSession}
            disabled={sessionLoading}
            className="mt-4 px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          >
            {sessionLoading ? "Generiere..." : "Trainingsplan generieren"}
          </button>

          {sessionError && <p className="text-red-600 mt-3">Fehler: {sessionError}</p>}

          {sessionResult && (
            <div className="mt-6 max-w-4xl">
              <h3 className="text-lg font-semibold mb-2">{sessionResult.title}</h3>
              <p className="text-sm text-gray-600 mb-4">
                Dauer: {sessionResult.duration_min} Min • {sessionResult.frequency_per_week}×/Woche
              </p>
              <div className="space-y-4">
                {sessionResult.phases.map((phase, i) => (
                  <div key={i} className="border rounded p-3 bg-white">
                    <h4 className="font-medium">
                      {phase.name} ({phase.duration_min} Min)
                    </h4>
                    <ul className="mt-2 list-disc pl-5 space-y-2">
                      {phase.exercises.map((ex, j) => (
                        <li key={j}>
                          <div className="font-medium">{ex.name} ({ex.duration_min} Min)</div>
                          <div className="text-sm text-gray-700"><b>Ziel:</b> {ex.objective}</div>
                          <div className="text-sm text-gray-700"><b>Organisation:</b> {ex.organization}</div>
                          <div className="text-sm text-gray-700"><b>Coaching:</b> {ex.coaching_points}</div>
                          <div className="text-sm text-gray-700"><b>Equipment:</b> {ex.equipment}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "home" && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Parameter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
            <label className="flex flex-col">
              <span className="text-sm">Dauer (Min)</span>
              <input type="number" value={hDuration} onChange={(e) => setHDuration(Number(e.target.value))} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Fokus</span>
              <input value={hFocus} onChange={(e) => setHFocus(e.target.value)} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Level</span>
              <input value={hLevel} onChange={(e) => setHLevel(e.target.value)} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Ort</span>
              <input value={hLocation} onChange={(e) => setHLocation(e.target.value)} className="border rounded p-2" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm">Equipment</span>
              <input value={hEquipment} onChange={(e) => setHEquipment(e.target.value)} className="border rounded p-2" />
            </label>
          </div>

          <button
            onClick={generateHome}
            disabled={homeLoading}
            className="mt-4 px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          >
            {homeLoading ? "Generiere..." : "Home‑Workout generieren"}
          </button>

          {homeError && <p className="text-red-600 mt-3">Fehler: {homeError}</p>}

          {homeResult && (
            <div className="mt-6 max-w-4xl">
              <h3 className="text-lg font-semibold mb-2">{homeResult.title}</h3>
              <p className="text-sm text-gray-600 mb-4">
                Dauer: {homeResult.duration_min} Min • Fokus: {homeResult.focus}
              </p>
              <div className="space-y-4">
                {homeResult.blocks.map((block, i) => (
                  <div key={i} className="border rounded p-3 bg-white">
                    <h4 className="font-medium">
                      {block.name} ({block.duration_min} Min)
                    </h4>
                    <ul className="mt-2 list-disc pl-5 space-y-2">
                      {block.exercises.map((ex, j) => (
                        <li key={j}>
                          <div className="font-medium">{ex.name} {ex.duration_min ? `(${ex.duration_min} Min)` : ex.sets_reps ? `(${ex.sets_reps})` : ""}</div>
                          <div className="text-sm text-gray-700"><b>Ziel:</b> {ex.objective}</div>
                          <div className="text-sm text-gray-700"><b>So:</b> {ex.how_to}</div>
                          <div className="text-sm text-gray-700"><b>Equipment:</b> {ex.equipment}</div>
                          <div className="text-sm text-gray-700"><b>Schwierigkeit:</b> {ex.difficulty}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
