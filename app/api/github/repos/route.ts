import { NextResponse } from "next/server";
import { repositorySearchSchema } from "@/lib/contracts";
import { buildGithubSearchQuery, mapGithubSearchResponse } from "@/lib/server/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestWindows = new Map<string, { count: number; resetAt: number }>();

function takeRequest(address: string) {
  const now = Date.now();
  const window = requestWindows.get(address);
  if (!window || window.resetAt <= now) {
    requestWindows.set(address, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (window.count >= 8) return false;
  window.count += 1;
  return true;
}

export async function GET(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!takeRequest(address)) {
    return NextResponse.json({ message: "GitHub 검색 요청이 잠시 많습니다. 1분 뒤 다시 시도해 주세요." }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const parsed = repositorySearchSchema.safeParse(Object.fromEntries(params.entries()));
  if (!parsed.success) {
    return NextResponse.json({ message: "검색 필터를 확인해 주세요." }, { status: 400 });
  }

  const filters = parsed.data;
  const { query, apiSort } = buildGithubSearchQuery(filters);

  const search = new URLSearchParams({ q: query, sort: apiSort, order: "desc", per_page: filters.sort === "created" ? "100" : "24" });
  try {
    const response = await fetch(`https://api.github.com/search/repositories?${search.toString()}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = response.status === 403 || response.status === 429
        ? "GitHub 검색 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : `GitHub 검색이 실패했습니다 (HTTP ${response.status}). 다시 시도해 주세요.`;
      return NextResponse.json({ message }, { status: response.status === 403 || response.status === 429 ? 429 : 502 });
    }

    const payload: unknown = await response.json();
    const mapped = mapGithubSearchResponse(payload, filters.sort);
    if (!mapped) {
      return NextResponse.json({ message: "GitHub가 예상하지 못한 응답을 반환했습니다." }, { status: 502 });
    }

    return NextResponse.json({
      repositories: mapped.repositories.slice(0, 24),
      totalCount: mapped.totalCount,
      incompleteResults: mapped.incompleteResults,
      query,
      methodology: filters.sort === "created"
        ? "GitHub Repository Search API에서 인기순 상위 결과를 가져온 뒤, 가져온 결과 안에서 생성일 최신순으로 다시 정렬했습니다. 전체 저장소의 생성일 순위나 공식 Trending 순위는 아닙니다."
        : "GitHub Repository Search API 결과를 Stars 또는 최근 업데이트 기준으로 정렬한 목록입니다. 공식 Trending 순위가 아닙니다.",
      authenticated: Boolean(process.env.GITHUB_TOKEN),
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (cause) {
    const message = cause instanceof Error && cause.name === "TimeoutError"
      ? "GitHub 검색 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
      : "GitHub 검색 서비스에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
