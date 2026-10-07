"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "session" | "home";

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

function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return "Ein unbekannter Fehler ist aufgetreten.";
}

export default function HomePage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [homeWorkout, setHomeWorkout] = useState<HomeWorkout | null>(null);

  const [sessionLoading, setSessionLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const
