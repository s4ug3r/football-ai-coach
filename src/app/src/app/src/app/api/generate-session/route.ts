import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const InputSchema = z.object({
  duration_min: z.number(),
  frequency_per_week: z.number().refine((n) => n === 1 || n === 2),
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

    const { system, user } = buildSessionPlanPrompt(input);
    const plan = await callOpenAIChatJSON<{
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
    }>({ system, user });

    return NextResponse.json({ ok: true, data: plan });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 400 });
  }
}

function buildSessionPlanPrompt(input: z.infer<typeof InputSchema>) {
  const { duration_min, frequency_per_week, focus, level, location, equipment } = input;
  return {
    system: SYSTEM_PROMPT,
    user: `Erzeuge einen ${duration_min}-Min-Trainingsplan für ${level}, Fokus "${focus}", Ort "${location}", Equipment "${equipment}", Häufigkeit ${frequency_per_week}×/Woche.
Gliederung: Warm-up, Technik/Thema, Possession/Small-Sided, Scrimmage, Cooldown.
Jede Übung als Objekt mit: name, duration_min, objective, organization, coaching_points, equipment.
Antworte NUR mit validem JSON im Schema:
{
  "title": string,
  "duration_min": number,
  "frequency_per_week": number,
  "phases": [
    {
      "name": string,
      "duration_min": number,
      "exercises": [
        {
          "name": string,
          "duration_min": number,
          "objective": string,
          "organization": string,
          "coaching_points": string,
          "equipment": string
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
