"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleHelp,
  Code2,
  ExternalLink,
  GitFork,
  Github,
  LoaderCircle,
  Search,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generatedIdeaSchema,
  githubIdeaPackSchema,
  githubRepositorySchema,
  type GithubIdeaPack,
  type GithubRepository,
  type GeneratedIdea,
  type IdeaRequest,
  type RepositorySearch,
} from "@/lib/contracts";

interface GitHubExplorerViewProps {
  onValidate: (idea: IdeaRequest) => void;
}

const categories: { value: RepositorySearch["category"]; label: string }[] = [
  { value: "all", label: "전체 인기" },
  { value: "ai", label: "AI · 머신러닝" },
  { value: "web", label: "웹 서비스" },
  { value: "mobile", label: "모바일 앱" },
  { value: "developer", label: "개발 도구" },
  { value: "automation", label: "자동화" },
  { value: "productivity", label: "생산성" },
];

const blankFilters: RepositorySearch = {
  keyword: "",
  category: "all",
  language: "",
  minStars: 100,
  createdWithin: "any",
  updatedWithin: "any",
  sort: "stars",
};

function shortDate(value: string | null) {
  if (!value) return "정보 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "정보 없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function count(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function marketIdea(idea: GeneratedIdea, repository: GithubRepository): IdeaRequest {
  return {
    serviceName: idea.title,
    description: idea.description,
    problem: idea.problem,
    features: idea.features.join(", "),
    targetAudience: idea.targetAudience,
    market: "global",
    inputSource: "github",
    sourceLabel: repository.fullName,
  };
}

export function GitHubExplorerView({ onValidate }: GitHubExplorerViewProps) {
  const [filters, setFilters] = useState<RepositorySearch>(blankFilters);
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [selected, setSelected] = useState<GithubRepository | null>(null);
  const [proposal, setProposal] = useState<GithubIdeaPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [methodology, setMethodology] = useState("");
  const [incomplete, setIncomplete] = useState(false);

  async function searchRepositories(nextFilters = filters) {
    setLoading(true);
    setError("");
    setSelected(null);
    setProposal(null);
    try {
      const params = new URLSearchParams(Object.entries(nextFilters).map(([key, value]) => [key, String(value)]));
      const response = await fetch(`/api/github/repos?${params.toString()}`);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "GitHub 검색에 실패했습니다.");
      }
      if (!payload || typeof payload !== "object" || !("repositories" in payload) || !Array.isArray(payload.repositories)) {
        throw new Error("GitHub 검색 결과를 읽지 못했습니다.");
      }
      const result = payload as Record<string, unknown>;
      setRepositories((result.repositories as unknown[]).flatMap((item) => {
        const parsed = githubRepositorySchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }));
      setTotalCount(typeof result.totalCount === "number" ? result.totalCount : 0);
      setMethodology(typeof result.methodology === "string" ? result.methodology : "");
      setIncomplete(Boolean(result.incompleteResults));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GitHub 검색 중 문제가 발생했습니다.");
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void searchRepositories(blankFilters);
  }, []);

  async function generateIdeas(repository: GithubRepository) {
    setSelected(repository);
    setProposal(null);
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/github/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repository),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "AI 아이디어 생성에 실패했습니다.");
      }
      const parsed = githubIdeaPackSchema.safeParse(payload && typeof payload === "object" && "proposal" in payload ? payload.proposal : null);
      if (!parsed.success) throw new Error("AI가 읽을 수 있는 아이디어 결과를 반환하지 않았습니다.");
      setProposal(parsed.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 아이디어 생성 중 문제가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  function updateFilter<K extends keyof RepositorySearch>(key: K, value: RepositorySearch[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="discovery-view">
      <div className="discovery-heading">
        <div>
          <div className="eyebrow"><Github aria-hidden="true" />OPEN SOURCE DISCOVERY</div>
          <h1 className="page-title">만들 아이디어를 발견하세요</h1>
          <p className="page-subtitle">GitHub 공개 저장소를 실제로 검색합니다. 프로젝트의 개발자 관심도는 사용자 수요나 사업 성공의 증거가 아닙니다.</p>
        </div>
        <Badge className="github-live-badge"><span className="status-dot" />GitHub API 연결</Badge>
      </div>

      <section className="github-search-panel">
        <form className="github-filters" onSubmit={(event) => { event.preventDefault(); void searchRepositories(); }}>
          <div className="github-filter-row">
            <label className="github-keyword-field">
              <span className="sr-only">저장소 검색어</span>
              <Search aria-hidden="true" />
              <input value={filters.keyword} maxLength={80} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="저장소 키워드 검색" />
            </label>
            <select className="filter-select" aria-label="주제 카테고리" value={filters.category} onChange={(event) => updateFilter("category", event.target.value as RepositorySearch["category"])}>
              {categories.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
            </select>
            <label className="language-input"><Code2 aria-hidden="true" /><input value={filters.language} maxLength={40} onChange={(event) => updateFilter("language", event.target.value)} placeholder="언어" list="github-languages" /><datalist id="github-languages"><option>TypeScript</option><option>JavaScript</option><option>Python</option><option>Go</option><option>Rust</option><option>Swift</option><option>Kotlin</option></datalist></label>
            <Button type="submit" disabled={loading}>{loading ? <LoaderCircle className="spinner" size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}검색</Button>
          </div>
          <div className="github-filter-row github-filter-row--secondary">
            <label className="filter-control"><span>최소 Stars</span><select value={filters.minStars} onChange={(event) => updateFilter("minStars", Number(event.target.value))}><option value={0}>제한 없음</option><option value={100}>100+</option><option value={500}>500+</option><option value={1000}>1,000+</option><option value={5000}>5,000+</option><option value={10000}>10,000+</option></select></label>
            <label className="filter-control"><span>생성 기간</span><select value={filters.createdWithin} onChange={(event) => updateFilter("createdWithin", event.target.value as RepositorySearch["createdWithin"])}><option value="any">전체 기간</option><option value="year">최근 1년</option><option value="90d">최근 90일</option><option value="30d">최근 30일</option></select></label>
            <label className="filter-control"><span>최근 활동</span><select value={filters.updatedWithin} onChange={(event) => updateFilter("updatedWithin", event.target.value as RepositorySearch["updatedWithin"])}><option value="any">언제든</option><option value="30d">최근 30일 업데이트</option><option value="7d">최근 7일 업데이트</option></select></label>
            <label className="filter-control"><span>정렬</span><select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value as RepositorySearch["sort"])}><option value="stars">Stars 높은 순</option><option value="updated">최근 업데이트 순</option><option value="created">최근 생성 순</option></select></label>
          </div>
        </form>
      </section>

      <div className="github-methodology"><CircleHelp aria-hidden="true" /><span>{methodology || "GitHub REST API의 Stars·생성일·최근 활동 조건으로 검색합니다."} 공식 Trending 순위가 아니라 자체 필터 검색입니다.</span></div>
      {incomplete && <div className="form-error" role="status"><CircleHelp aria-hidden="true" />GitHub가 일부 결과만 반환했습니다. 표시된 수는 현재 검색 응답 기준입니다.</div>}
      {error && <div className="form-error" role="alert"><CircleHelp aria-hidden="true" />{error}</div>}

      <div className="github-results-heading">
        <div><h2>오픈소스 프로젝트</h2><p>{loading ? "GitHub에서 최신 결과를 찾고 있어요." : `현재 검색에서 ${count(totalCount)}개 중 ${repositories.length}개를 불러왔습니다.`}</p></div>
        <Badge><ArrowDownWideNarrow size={12} aria-hidden="true" />{filters.sort === "stars" ? "Stars 기준" : filters.sort === "updated" ? "최근 업데이트" : "최근 생성"}</Badge>
      </div>

      {loading ? (
        <div className="github-loading"><LoaderCircle className="spinner" aria-hidden="true" /><span>공개 저장소를 검색하고 있습니다.</span></div>
      ) : repositories.length ? (
        <div className="github-layout">
          <div className="github-repo-grid">
            {repositories.map((repository) => (
              <article className={`github-repo-card ${selected?.id === repository.id ? "is-selected" : ""}`} key={repository.id}>
                <div className="github-repo-topline"><span className="github-repo-mark"><Github aria-hidden="true" /></span><Badge>{repository.language || "언어 정보 없음"}</Badge></div>
                <a className="github-repo-name" href={repository.htmlUrl} target="_blank" rel="noreferrer">{repository.fullName}<ExternalLink aria-hidden="true" /></a>
                <p className="github-repo-description">{repository.description || "GitHub에서 프로젝트 설명을 제공하지 않았습니다."}</p>
                <p className="github-source-label">GitHub 저장소 설명 원문</p>
                <div className="github-repo-stats">
                  <span><Star aria-hidden="true" />{count(repository.stars)}</span>
                  <span><CalendarDays aria-hidden="true" />업데이트 {shortDate(repository.updatedAt)}</span>
                </div>
                <div className="github-repo-license"><span>라이선스</span><strong>{repository.license || "정보 없음"}</strong></div>
                <Button className="github-analyze-button" variant={selected?.id === repository.id ? "primary" : "secondary"} onClick={() => void generateIdeas(repository)} disabled={generating}>
                  {generating && selected?.id === repository.id ? <LoaderCircle className="spinner" size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
                  {selected?.id === repository.id && proposal ? "아이디어 제안 보기" : "이 프로젝트로 아이디어 만들기"}
                </Button>
              </article>
            ))}
          </div>

          {selected && (
            <aside className="github-idea-panel" aria-live="polite">
              <div className="github-idea-panel-heading">
                <span className="feature-icon"><WandSparkles aria-hidden="true" /></span>
                <div><span>AI IDEA LAB</span><h2>{selected.fullName}</h2></div>
              </div>
              {generating ? (
                <div className="github-loading github-loading--compact"><LoaderCircle className="spinner" aria-hidden="true" /><span>저장소 설명을 바탕으로 아이디어를 만들고 있습니다.</span></div>
              ) : proposal ? (
                <>
                  <div className="github-ai-summary"><strong>문제와 핵심 기능</strong><p>{proposal.problemSolved}</p><p>{proposal.repositorySummary}</p></div>
                  <div className="github-technology-list">{proposal.coreTechnology.map((item) => <Badge key={item}><Code2 size={11} aria-hidden="true" />{item}</Badge>)}</div>
                  <p className="github-license-note"><CircleHelp aria-hidden="true" />{proposal.openSourceNote || "오픈소스 재사용 전 라이선스와 저장소 정책을 확인하세요."}</p>
                  <div className="generated-idea-list">
                    {proposal.ideas.map((idea, index) => (
                      <article className="generated-idea-card" key={`${idea.title}-${index}`}>
                        <span className="generated-idea-number">0{index + 1}</span>
                        <h3>{idea.title}</h3>
                        <p>{idea.description}</p>
                        <div className="generated-idea-detail"><strong>예상 사용자</strong><span>{idea.targetAudience || "추가 정의 필요"}</span></div>
                        {idea.differentiation && <div className="generated-idea-detail"><strong>차별화</strong><span>{idea.differentiation}</span></div>}
                        <div className="generated-idea-detail"><strong>MVP</strong><span>{idea.mvp || "최소 기능을 사용자와 검증하세요."}</span></div>
                        {idea.suggestedStack.length > 0 && <div className="github-technology-list">{idea.suggestedStack.map((stack) => <Badge key={stack}>{stack}</Badge>)}</div>}
                        <Button className="generated-idea-action" size="sm" onClick={() => onValidate(marketIdea(idea, selected))}><Check size={14} aria-hidden="true" />이 아이디어 검증하기<ArrowRight size={14} aria-hidden="true" /></Button>
                      </article>
                    ))}
                  </div>
                  <p className="report-footnote"><GitFork aria-hidden="true" />GitHub Stars는 개발자 관심 지표일 뿐 사용자 수요나 사업 성공 가능성을 뜻하지 않습니다. 실제 저장소 페이지에서 최신 라이선스를 확인하세요.</p>
                </>
              ) : (
                <div className="section-empty">저장소의 실제 설명과 기술 정보를 바탕으로 새로운 서비스 방향을 제안합니다. GitHub 설명이 비어 있으면 제안 범위가 제한될 수 있어요.</div>
              )}
            </aside>
          )}
        </div>
      ) : (
        <div className="empty-state github-empty"><div><div className="empty-icon"><Github aria-hidden="true" /></div><h3>검색 결과가 없습니다</h3><p>Stars 기준을 낮추거나 카테고리·검색어를 바꿔 다시 시도해 보세요.</p><Button variant="secondary" className="mt-4" onClick={() => { setFilters(blankFilters); void searchRepositories(blankFilters); }}>전체 인기 프로젝트 보기<ArrowUpRight size={14} aria-hidden="true" /></Button></div></div>
      )}
      <div className="github-bottom-note"><CircleHelp aria-hidden="true" />GitHub Repository Search API를 사용합니다. 무인증 API는 분당 검색 요청 한도가 있으므로 검색을 반복하면 잠시 대기해야 할 수 있습니다.</div>
    </div>
  );
}
