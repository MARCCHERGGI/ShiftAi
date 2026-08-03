import { NextRequest } from "next/server";

import { pushEvent } from "@/src/lib/track-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
  intent?: "save_list" | "resume_pdf";
  content?: string;
  runId?: string;
  profile?: Record<string, unknown>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: "invalid email" }, { status: 400 });
  }

  const intent = body.intent === "resume_pdf" ? "resume_pdf" : "save_list";
  const content = typeof body.content === "string" ? body.content.slice(0, 12_000) : "";
  const runId = typeof body.runId === "string" ? body.runId : "";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const country = req.headers.get("x-vercel-ip-country") || undefined;
  const city = req.headers.get("x-vercel-ip-city") || undefined;
  const ua = req.headers.get("user-agent") ?? "";

  await pushEvent({
    name: intent === "resume_pdf" ? "lead_resume_pdf" : "lead_save_list",
    props: {
      email,
      intent,
      runId,
      content_length: content.length,
      content_preview: content.slice(0, 800),
      profile_sample: body.profile ?? null,
    },
    ts: Date.now(),
    ua: ua.slice(0, 300),
    ip,
    country,
    city,
  });

  console.log(
    `[LEAD] ${intent} ${email} (${country || "?"}/${city || "?"}) — ${content.length} chars`,
  );

  // Optional Telegram alert (uses env vars if Marco wires them)
  await maybeTelegramAlert(intent, email, content);

  // For resume intent, return the Stripe URL (env-configured) so the client can redirect.
  const stripeBase = process.env.NEXT_PUBLIC_RESUME_CHECKOUT_URL || process.env.RESUME_CHECKOUT_URL;
  let checkoutUrl: string | undefined;
  if (intent === "resume_pdf" && stripeBase) {
    const url = new URL(stripeBase);
    url.searchParams.set("prefilled_email", email);
    checkoutUrl = url.toString();
  }

  return Response.json({ ok: true, intent, checkoutUrl: checkoutUrl ?? null });
}

async function maybeTelegramAlert(intent: string, email: string, content: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = [
    `🟢 *ShiftAI lead* — \`${intent}\``,
    `Email: ${email}`,
    ``,
    content ? "```\n" + content.slice(0, 1500) + "\n```" : "(no content)",
  ].join("\n");
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[telegram] failed", err);
  }
}

export async function GET() {
  return new Response("save-list endpoint", { status: 200 });
}
