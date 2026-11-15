import { AnalysisError } from "@/lib/server/errors";

export interface LlmMessage {
  role: "system" | "user";
  content: string;
}

function getLlmEndpoint() {
  const base = (process.env.LLM_BASE_URL || "https://api.baze.co/v1/gateway").trim().replace(/\/+$/, "");
  return `${base.replace(/\/chat\/completions$/i, "")}/chat/completions`;
}

function contentText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .join("\n");
  }
  return "";
}

export async function callLlm(messages: LlmMessage[], timeoutMs: number, maxTokens: number) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new AnalysisError("API_NOT_CONFIGURED", "LLM_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해 주세요.");

  let response: Response;
  try {
    response = await fetch(getLlmEndpoint(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.LLM_MODEL?.trim() || "gemini-3.8-flash",
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AnalysisError("LLM_UPSTREAM", "LLM 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new AnalysisError("LLM_UPSTREAM", "LLM 서비스에 연결하지 못했습니다. API 주소와 네트워크를 확인해 주세요.");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AnalysisError("LLM_UPSTREAM", "LLM 인증에 실패했습니다. API 키가 유효한지 확인해 주세요.");
    }
    if (response.status === 404) {
      throw new AnalysisError("LLM_UPSTREAM", "LLM 모델 또는 API 주소를 찾지 못했습니다. LLM_BASE_URL과 LLM_MODEL을 확인해 주세요.");
    }
    if (response.status === 429) {
      throw new AnalysisError("LLM_UPSTREAM", "LLM 사용량 한도에 도달했습니다. 제공자 한도를 확인한 뒤 다시 시도해 주세요.");
    }
    throw new AnalysisError("LLM_UPSTREAM", `LLM 요청이 실패했습니다 (HTTP ${response.status}). 설정을 확인한 뒤 다시 시도해 주세요.`);
  }

  const payload: unknown = await response.json().catch(() => null);
  const choice = payload && typeof payload === "object" && "choices" in payload && Array.isArray(payload.choices)
    ? payload.choices[0]
    : null;
  const message = choice && typeof choice === "object" && "message" in choice ? choice.message : null;
  const text = message && typeof message === "object" && "content" in message ? contentText(message.content) : "";
  if (!text.trim()) throw new AnalysisError("ANALYSIS_INVALID", "LLM이 분석 내용을 반환하지 않았습니다. 다시 요청해 주세요.");
  return text;
}
