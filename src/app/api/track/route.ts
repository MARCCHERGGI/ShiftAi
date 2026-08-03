import { NextRequest } from "next/server";

import { pushEvent } from "@/src/lib/track-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let payload: { name?: string; props?: Record<string, unknown>; ts?: number; ua?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.slice(0, 80) : "unknown";
  const props = payload.props && typeof payload.props === "object" ? payload.props : {};
  const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
  const ua = typeof payload.ua === "string" ? payload.ua.slice(0, 300) : req.headers.get("user-agent") ?? "";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const country = req.headers.get("x-vercel-ip-country") || undefined;
  const city = req.headers.get("x-vercel-ip-city") || undefined;

  const stored = { name, props, ts, ua, ip, country, city };

  console.log(`[EVENT] ${name}`, JSON.stringify({ ...props, ip, country, city }));

  await pushEvent(stored);

  return new Response(null, { status: 204 });
}

export async function GET() {
  return new Response("track endpoint", { status: 200 });
}
