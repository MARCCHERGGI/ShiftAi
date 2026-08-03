/**
 * POST /api/agents/analyze
 *
 * Body: { url?: string, text?: string }
 * Response: SSE stream of CrewEvent — `data: <JSON>\n\n` per event.
 *
 * Per-agent errors degrade gracefully inside the pipeline; a scout
 * failure (or invalid input) ends the run with {agent:"crew",
 * status:"error", message} and closes the stream. On success the final
 * event is {agent:"crew", status:"complete", data: AnalyzeResult}.
 *
 * No server-side analytics — tracking is client-side only.
 */

import type { CrewEvent } from "@/src/lib/agents/types";
import { runCrewPipeline, type CrewInput } from "@/src/lib/agents/crew";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let input: CrewInput = {};
  try {
    const body = (await req.json()) as { url?: unknown; text?: unknown };
    input = {
      url: typeof body.url === "string" ? body.url : undefined,
      text: typeof body.text === "string" ? body.text : undefined,
    };
  } catch {
    // Malformed JSON — report through the same SSE protocol the client speaks.
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (evt: CrewEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          closed = true; // client went away — stop writing
        }
      };

      try {
        if (!input.url?.trim() && !input.text?.trim()) {
          send({
            agent: "crew",
            status: "error",
            message: "Paste a job link or the listing text to run the crew.",
          });
          return;
        }

        const result = await runCrewPipeline(input, send);
        send({ agent: "crew", status: "complete", data: result });
      } catch (err) {
        send({
          agent: "crew",
          status: "error",
          message:
            err instanceof Error ? err.message : "The crew hit an unexpected error. Try again.",
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
