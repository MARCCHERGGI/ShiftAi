/**
 * POST /api/agents/resume
 *   { profile, analysis }                      → ResumeResponse (JSON)
 *   { profile, analysis, resume, format:"pdf" } → application/pdf bytes
 */

import { buildResume } from "@/src/lib/resume/build";
import { resumePdf } from "@/src/lib/resume/pdf";
import type { Profile, ResumeDoc, ResumeRequest, ResumeResponse } from "@/src/lib/agents/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ResumeBody extends ResumeRequest {
  format?: "json" | "pdf";
  resume?: ResumeDoc;
}

function json(body: ResumeResponse, status = 200): Response {
  return Response.json(body, { status });
}

function isProfile(p: unknown): p is Profile {
  return !!p && typeof p === "object" && typeof (p as Profile).name === "string";
}

export async function POST(req: Request): Promise<Response> {
  let body: ResumeBody;
  try {
    body = (await req.json()) as ResumeBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!isProfile(body.profile)) {
    return json({ ok: false, error: "Missing profile" }, 400);
  }

  /* PDF path: render an already-built ResumeDoc to bytes. */
  if (body.format === "pdf") {
    if (!body.resume || typeof body.resume !== "object") {
      return json({ ok: false, error: "format:\"pdf\" requires a resume document" }, 400);
    }
    try {
      const bytes = await resumePdf(body.resume, body.profile);
      const slug =
        (body.profile.name || "resume")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "resume";
      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${slug}-resume.pdf"`,
          "cache-control": "no-store",
        },
      });
    } catch (err) {
      console.error("[resume] pdf render failed:", err);
      return json({ ok: false, error: "PDF generation failed" }, 500);
    }
  }

  /* JSON path: build the ResumeDoc from profile (+ optional analysis). */
  try {
    const resume = await buildResume(body.profile, body.analysis ?? null);
    return json({ ok: true, resume });
  } catch (err) {
    console.error("[resume] build failed:", err);
    const message = err instanceof Error ? err.message : "Resume generation failed";
    return json({ ok: false, error: message }, 500);
  }
}
