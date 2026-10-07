import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const InputSchema = z.object({
  duration_min: z.number(),
  focus: z.string(),
  level: z.string(),
  location: z.string(),
  equipment: z.string(),
});

const SYSTEM_PROMPT =
  "Du bist ein erfahrener Fußball-Trainer. Erstelle strukturierte JSON-Trainingspläne mit Phasen, Übungen, Zeiten/Sets, Zielen und Coaching-Points. Halte dich strikt an die vorgegebene Dauer und erlaubte Kategorien. Sprache: Deutsch.";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = InputSchema.parse(json);

    const { system, user } = buildHomeWorkoutPrompt(input);
    const workout = await callOpenAIChatJSON<{
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
    }>({ system, user });

    return NextResponse.json({ ok: true, data: workout });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 400 });
  }
}

function buildHomeWorkoutPrompt(input: z.infer<typeof InputSchema>) {
  const { duration_min, focus, level, location, equipment } = input;
  return {
    system: SYSTEM_PROMPT,
    user: `Erzeuge ein ${duration_min}-Min-Home-Workout für ${level}, Fokus "${focus}", Equipment "${equipment}", Ort "${location}".
Gliederung: Warm-up (3-5 Min), Hauptteil (8-12 Min), Finisher/Cooldown (2-5 Min).
Jede Übung als Objekt mit: name, duration_min oder sets_reps, objective, how_to, equipment, difficulty.
Antworte NUR mit validem JSON im Schema:
{
  "title": string,
  "duration_min": number,
  "focus": string,
  "blocks": [
    {
      "name": string,
      "duration_min": number,
      "exercises": [
        {
          "name": string,
          "duration_min": number | null,
          "sets_reps": string | null,
          "objective": string,
          "how_to": string,
          "equipment": string,
          "difficulty": string
        }
      ]
    }
  ]
}`,
  };
}

async function callOpenAIChatJSON<T>({
  system,
  user,
  temperature = 0,
}: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;
  if (!content) throw new Error("No content in OpenAI response");

  return JSON.parse(content) as T;
}
