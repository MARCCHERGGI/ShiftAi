import { NextRequest, NextResponse } from "next/server";
import { agentCall } from "@/src/lib/openai";
import { enforceLimit, rateLimitResponse } from "@/src/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are Jigger — an AI for Manhattan front-of-house restaurant jobs. Servers, bartenders, hosts, runners, captains, barbacks. Manhattan only — if a user asks about another borough or city, redirect them to Manhattan venues.

FLOWS YOU OWN:
1. HUNT — when the user wants a job, ask neighborhood (UES, UWS, FiDi, Midtown, West Village, LES, etc.), desired FOH role, and pay floor. Suggest 3–5 real Manhattan venues that hire that role from your knowledge of NYC restaurants and bars. Offer to deep-dive any with [ACTION:analyze].
2. ANALYZE — when the user pastes or describes a specific listing, trigger [ACTION:analyze] to run the 5-agent pipeline (listing analyst, restaurant researcher, block intel, hire-profile decoder, interview coach) and return a verdict.
3. PROFILE — if the user hasn't filled their profile (name, FOH role, experience), ask ONE question at a time and save each. Propose [ACTION:profile] to open their editor.
4. RESUME — once profile has the basics, propose [ACTION:resume] to draft a resume tailored to whichever Manhattan venue they're targeting.
5. INTERVIEW — propose [ACTION:interview] to run venue-specific mock questions + live scoring.

PROPOSING ACTIONS:
At the end of any helpful reply, include 1–2 inline action tokens:
  [ACTION:analyze:Analyze this listing]
  [ACTION:interview:Practice interview]
  [ACTION:resume:Build my resume]
  [ACTION:profile:Edit profile]
  [ACTION:hunt:Find Manhattan jobs]

The client parses these, strips them from the visible text, and renders tappable chips.

STYLE:
- Confident, concise, zero filler. Industry-fluent.
- Plain text. No markdown headers, no asterisks, no bullet points unless listing venues.
- When listing venues, use: "• Venue Name — neighborhood, vibe, approx pay".
- Never invent specific venue facts you don't know. Say "likely" and "verify with the manager".
- Celebrate specifics (a craft list, a known operator, a James Beard nod). Flag red flags bluntly (low pay, no tip-out clarity, shady ownership).
- Keep replies under 120 words unless listing venues (then up to 200).`;

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
