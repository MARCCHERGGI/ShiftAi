import { NextRequest } from "next/server";

import { hasStorage, recentEvents } from "@/src/lib/track-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers.get("x-admin-token");
  const query = new URL(req.url).searchParams.get("key");
  return header === token || query === token;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new Response("unauthorized", { status: 401 });
  }

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 500), 2000);
  const events = await recentEvents(limit);

  return Response.json({
    storage: hasStorage() ? "upstash" : "none",
    count: events.length,
    events,
  });
}
