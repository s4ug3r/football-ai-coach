import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const InputSchema = z.object({
  duration_min: z.number().min(5).max(45),
  focus: z.string().min(2).max(100),
  level: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  equipment: z.string().min(2).max(300),
});

const SYSTEM_PROMPT = `
Du bist ein erfahrener, sicherheitsbewusster Fußballtrainer.
Du erstellst kurze, allein umsetzbare Fußball-Home-Workouts auf Deutsch.

Wichtige Regeln:
- Antworte ausschließlich mit einem gültigen JSON-Objekt.
- Schreibe keinen Text vor oder nach dem JSON.
- Die Summe aller duration_min in den Blöcken muss exakt der gewünschten Gesamtzeit entsprechen.
- Verwende nur Übungen, die mit dem genannten Ort und Equipment umsetzbar sind.
- Berücksichtige sichere Bewegungsausführung, Warm-up und Cooldown.
- Stelle keine medizinischen Diagnosen und gib keine Heilversprechen.
`;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = InputSchema.parse(body);

    const userPrompt = `
Erstelle ein ${input.duration_min}-Minuten-Home-Workout für eine einzelne Fußballspielerin oder einen einzelnen Fußballspieler.

Parameter:
- Fokus: ${input.focus}
- Level: ${input.level}
- Ort: ${input.location}
- Verfügbares Equipment: ${input.equipment}

Der Trainingsplan soll diese drei Blöcke enthalten:
1. Warm-up
2. Hauptteil
3. Finisher oder Cooldown

Antworte ausschließlich in diesem JSON-Format:
{
  "title": "string",
  "duration_min": ${input.duration_min},
  "focus": "${input.focus}",
  "blocks": [
    {
      "name": "string",
      "duration_min": 0,
      "exercises": [
        {
          "name": "string",
          "duration_min": 0,
          "sets_reps": null,
          "objective": "string",
          "how_to": "string",
          "equipment": "string",
          "difficulty": "string"
        }
      ]
    }
  ]
}
`;

    const workout = await callOpenRouterJSON<HomeWorkout>(
      SYSTEM_PROMPT,
      userPrompt
    );

    return NextResponse.json({ ok: true, data: workout });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}

async function callOpenRouterJSON<T>(
  system: string,
  user: string
): Promise<T> {
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY fehlt. Bitte in Vercel unter Settings → Environment Variables eintragen."
    );
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://football-ai-coach.vercel.app",
        "X-Title": "Football AI Coach",
      },
      body: JSON.stringify({
        model: "inclusionai/ling-3.0-flash-sante:free",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter Fehler ${response.status}: ${details}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter hat kein Home-Workout zurückgegeben.");
  }

  return parseJsonFromModel<T>(content);
}

function parseJsonFromModel<T>(content: string): T {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`KI-Antwort enthält kein JSON: ${cleaned}`);
  }

  const jsonOnly = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonOnly) as T;
  } catch {
    throw new Error(
      "Die KI hat ungültiges JSON erzeugt. Bitte den Button erneut drücken."
    );
  }
}
