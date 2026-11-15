import { NextResponse } from "next/server";
import { ideaRequestSchema, type StreamEvent } from "@/lib/contracts";
import { analyzeIdea } from "@/lib/server/analyze";
import { AnalysisError, safeErrorMessage } from "@/lib/server/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestsByAddress = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(address: string) {
  const now = Date.now();
  const bucket = requestsByAddress.get(address);
  if (!bucket || bucket.resetAt <= now) {
    requestsByAddress.set(address, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 24_000) return jsonError(413, "INVALID_INPUT", "요청 내용이 너무 깁니다. 입력을 줄인 뒤 다시 시도해 주세요.");

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(address)) {
    return jsonError(429, "RATE_LIMITED", "요청이 잠시 많습니다. 1분 뒤 다시 시도해 주세요.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "INVALID_INPUT", "요청 내용을 읽지 못했습니다. 입력을 다시 확인해 주세요.");
  }

  const parsed = ideaRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "아이디어 입력 내용을 확인해 주세요.";
    return jsonError(400, "INVALID_INPUT", message);
  }

  if (!process.env.TAVILY_API_KEY || !process.env.LLM_API_KEY) {
    const missing = [
      !process.env.TAVILY_API_KEY && "TAVILY_API_KEY",
      !process.env.LLM_API_KEY && "LLM_API_KEY",
    ].filter(Boolean).join(" 및 ");
    return jsonError(503, "API_NOT_CONFIGURED", `${missing}가 설정되지 않았습니다. 서버 환경변수를 확인해 주세요.`);
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: StreamEvent) => {
        if (cancelled) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      void analyzeIdea(parsed.data, (step, message) => emit({ type: "progress", step, message }))
        .then((report) => emit({ type: "complete", report }))
        .catch((error: unknown) => {
          const result = safeErrorMessage(error);
          emit({ type: "error", ...result });
        })
        .finally(() => {
          if (!cancelled) controller.close();
        });
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
