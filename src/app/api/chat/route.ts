import { NextRequest, NextResponse } from "next/server";
import { agentCall } from "@/src/lib/openai";
import { enforceLimit, rateLimitResponse } from "@/src/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are Jigger — an AI for bartender jobs in NYC. You serve bartenders first; servers, barbacks, hosts, runners, captains adjacent. Manhattan-focused — redirect outer-borough/other-city asks to Manhattan venues.

THE APP DOES TWO THINGS — that's it:
1. CHAT — answer anything about bar jobs in NYC: where to apply, what to expect, pay norms, neighborhoods, prep, the industry.
2. RESUME — there's a "Build my resume" button always visible. The user taps it themselves when ready. Don't push it.

STYLE:
- Confident, concise, zero filler. Industry-fluent. Talk like a working bartender, not a recruiter.
- Plain text. No markdown headers, no asterisks, no bullet points unless listing venues.
- When listing venues: "• Venue Name — neighborhood, vibe, approx pay".
- Never invent specific venue facts. Say "likely" and "verify with the manager".
- Flag red flags bluntly (low pay, no tip-out clarity, shady ownership).
- Keep replies under 120 words unless listing venues (then up to 200).
- No [ACTION:...] tokens. Don't propose actions. The user has one button — they'll find it.`;

export async function POST(req: NextRequest) {
  const rl = await enforceLimit(req, "interview");
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const { messages, profile } = (await req.json()) as {
      messages: Msg[];
      profile?: { name?: string; role?: string; experience?: string };
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages" }, { status: 400 });
    }

    const last = messages.slice(-14);
    const transcript = last
      .map((m) => `${m.role === "user" ? "User" : "Jigger"}: ${m.content}`)
      .join("\n\n");

    const profileLine =
      profile?.name || profile?.role || profile?.experience
        ? `\n\nUser profile: ${[
            profile.name && `name=${profile.name}`,
            profile.role && `role=${profile.role}`,
            profile.experience && `experience=${profile.experience}`,
          ]
            .filter(Boolean)
            .join(", ")}`
        : "\n\nUser profile: (not set yet — ask for one detail at a time if relevant)";

    const reply = await agentCall(
      SYSTEM + profileLine,
      transcript + "\n\nJigger:",
      { maxTokens: 500, temperature: 0.7 }
    );

    return NextResponse.json({ reply: reply.trim() });
  } catch (err: unknown) {
    console.error("chat error", err);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
