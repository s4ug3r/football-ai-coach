import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const InputSchema = z.object({
  duration_min: z.number().min(30).max(180),
  frequency_per_week: z.union([z.literal(1), z.literal(2)]),
  focus: z.string().min(2).max(100),
  level: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  equipment: z.string().min(2).max(300),
});

const SYSTEM_PROMPT = `
Du bist ein erfahrener, sicherheitsbewusster Fußballtrainer.
Du erstellst konkrete, alters- und leistungsangemessene Trainingspläne auf Deutsch.

Wichtige Regeln:
- Antworte ausschließlich mit einem gültigen JSON-Objekt.
- Schreibe keinen Text vor oder nach dem JSON.
- Die Summe aller duration_min in den Phasen muss exakt der gewünschten Gesamtzeit entsprechen.
- Verwende eine sichere Belastungssteuerung mit Aktivierung und Cooldown.
- Nenne keine gefährlichen Übungen und keine medizinischen Diagnosen.
- Jeder Trainingsinhalt muss praktisch auf einem Fußballplatz umsetzbar sein.
`;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = InputSchema.parse(body);

    const userPrompt = `
Erstelle einen ${input.duration_min}-Minuten-Trainingsplan für eine Fußballmannschaft.

Parameter:
- Trainingshäufigkeit: ${input.frequency_per_week} mal pro Woche
- Fokus: ${input.focus}
- Level/Altersgruppe: ${input.level}
- Ort: ${input.location}
- Verfügbares Equipment: ${input.equipment}

Gliedere den Plan in diese fünf Phasen:
1. Warm-up und Aktivierung
2. Technik / Thema
3. Spielform oder Positionsspiel
4. Abschlussspielform
5. Cooldown und Reflexion

Antworte ausschließlich in diesem JSON-Format:
{
  "title": "string",
  "duration_min": ${input.duration_min},
  "frequency_per_week": ${input.frequency_per_week},
  "phases": [
    {
      "name": "string",
      "duration_min": 0,
      "exercises": [
        {
          "name": "string",
          "duration_min": 0,
          "objective": "string",
          "organization": "string",
          "coaching_points": "string",
          "equipment": "string"
        }
      ]
    }
  ]
}
`;

    const plan = await callOpenRouterJSON<SessionPlan>(
      SYSTEM_PROMPT,
      userPrompt
    );

    return NextResponse.json({ ok: true, data: plan });
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
    throw new Error("OpenRouter hat keinen Trainingsplan zurückgegeben.");
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
