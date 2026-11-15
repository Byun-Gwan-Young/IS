import type { AnalysisErrorCode } from "@/lib/contracts";

export class AnalysisError extends Error {
  code: AnalysisErrorCode;

  constructor(code: AnalysisErrorCode, message: string) {
    super(message);
    this.name = "AnalysisError";
    this.code = code;
  }
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof AnalysisError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "INTERNAL_ERROR" as const,
    message: "분석 중 예상하지 못한 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
}
