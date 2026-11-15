"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Heart,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
  Users,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  communityCategorySchema,
  communityIdeaInputSchema,
  communityIdeaSchema,
  communityNormalizationSchema,
  type CommunityCategory,
  type CommunityIdea,
  type CommunityIdeaInput,
  type CommunityNormalization,
  type IdeaRequest,
} from "@/lib/contracts";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { filterCommunityIdeas } from "@/lib/community-utils";

type StorageMode = "loading" | "demo" | "shared" | "error";
type CategoryFilter = CommunityCategory | "all";

interface BoardIdea extends CommunityIdea {
  isMine: boolean;
}

interface StoredDemoIdea extends CommunityIdea {
  ownerKey: string;
  voterKeys: string[];
}

const IDEA_KEY = "idea-scout:community:ideas:v1";
const OWNER_KEY = "idea-scout:community:owner:v1";

const categories: { id: CommunityCategory; label: string }[] = [
  { id: "education", label: "교육" },
  { id: "work", label: "업무" },
  { id: "daily-life", label: "일상" },
  { id: "health", label: "건강" },
  { id: "finance", label: "금융" },
  { id: "creators", label: "창작자" },
  { id: "accessibility", label: "접근성" },
  { id: "other", label: "기타" },
];

const blankIdea: CommunityIdeaInput = {
  title: "",
  discomfort: "",
  requestedFeature: "",
  targetUser: "",
  category: "other",
  isPublic: true,
};

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "날짜 정보 없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function marketIdea(idea: BoardIdea): IdeaRequest {
  const description = `${idea.requestedFeature} ${idea.discomfort ? `이 아이디어는 다음 불편을 해결하려 합니다: ${idea.discomfort}` : ""}`.trim();
  return {
    serviceName: idea.normalizedTitle || idea.title,
    description: description.length >= 20 ? description : `${description} 사용자가 겪는 문제를 편리하게 해결하는 서비스입니다.`,
    problem: idea.problemSummary || idea.discomfort,
    features: idea.refinedFeature || idea.requestedFeature,
    targetAudience: idea.audienceLabel || idea.targetUser,
    market: "kr",
    inputSource: "community",
    sourceLabel: idea.title,
  };
}

function toBoardIdea(raw: Record<string, unknown>, votes: number, votedIds: Set<string>, userId: string): BoardIdea | null {
  const parsed = communityIdeaSchema.safeParse({
    id: raw.id,
    title: raw.title,
    discomfort: raw.discomfort,
    requestedFeature: raw.requested_feature,
    targetUser: raw.target_user || "",
    category: raw.category_id,
    isPublic: raw.is_public,
    createdAt: raw.created_at,
    normalizedTitle: raw.normalized_title || "",
    problemSummary: raw.problem_summary || "",
    audienceLabel: raw.audience_label || "",
    refinedFeature: raw.refined_feature || "",
    aiAvailable: Boolean(raw.ai_available),
    votes,
    hasVoted: votedIds.has(String(raw.id)),
  });
  if (!parsed.success) return null;
  return { ...parsed.data, isMine: raw.user_id === userId };
}

function categoryName(value: CommunityCategory) {
  return categories.find((category) => category.id === value)?.label || "기타";
}

export function CommunityBoardView({ onAnalyze }: { onAnalyze: (idea: IdeaRequest) => void }) {
  const [mode, setMode] = useState<StorageMode>("loading");
  const [ideas, setIdeas] = useState<BoardIdea[]>([]);
  const [userId, setUserId] = useState("");
  const [clientError, setClientError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CommunityIdeaInput>(blankIdea);
  const [formError, setFormError] = useState("");
  const [normalization, setNormalization] = useState<CommunityNormalization | null>(null);
  const [normalizationFailure, setNormalizationFailure] = useState("");
  const [allowRawPost, setAllowRawPost] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<"recent" | "votes">("recent");
  const [expandedId, setExpandedId] = useState("");

  async function loadShared(client: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>, currentUserId: string) {
    setLoading(true);
    setClientError("");
    const { data, error } = await client
      .from("ideas")
      .select("id,user_id,title,discomfort,requested_feature,target_user,category_id,is_public,normalized_title,problem_summary,audience_label,refined_feature,ai_available,created_at")
      .or(`is_public.eq.true,user_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setClientError(`게시판 테이블을 불러오지 못했습니다. Supabase 설정과 schema.sql 적용을 확인해 주세요. (${error.message})`);
      setLoading(false);
      setMode("error");
      return;
    }

    const rows = (data || []) as Record<string, unknown>[];
    const ids = rows.flatMap((row) => typeof row.id === "string" ? [row.id] : []);
    let counts = new Map<string, number>();
    let votedIds = new Set<string>();
    if (ids.length) {
      const [voteResult, myVoteResult] = await Promise.all([
        client.from("idea_votes").select("idea_id").in("idea_id", ids),
        client.from("idea_votes").select("idea_id").eq("user_id", currentUserId).in("idea_id", ids),
      ]);
      if (voteResult.error || myVoteResult.error) {
        setClientError("공감 수를 읽지 못했습니다. Supabase의 idea_votes RLS와 테이블 권한을 확인해 주세요.");
        setLoading(false);
        setMode("error");
        return;
      }
      counts = new Map<string, number>();
      for (const vote of voteResult.data || []) counts.set(vote.idea_id, (counts.get(vote.idea_id) || 0) + 1);
      votedIds = new Set((myVoteResult.data || []).map((vote) => vote.idea_id));
    }

    setIdeas(rows.flatMap((row) => {
      const idea = toBoardIdea(row, counts.get(String(row.id)) || 0, votedIds, currentUserId);
      return idea ? [idea] : [];
    }));
    setMode("shared");
    setLoading(false);
  }

  function loadDemo(ownerKey: string) {
    try {
      const raw = localStorage.getItem(IDEA_KEY);
      const stored: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(stored)) {
        setIdeas(stored.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as StoredDemoIdea;
          const parsed = communityIdeaSchema.safeParse(row);
          if (!parsed.success || (!parsed.data.isPublic && row.ownerKey !== ownerKey)) return [];
          return [{ ...parsed.data, hasVoted: row.voterKeys?.includes(ownerKey) || false, isMine: row.ownerKey === ownerKey }];
        }));
      }
    } catch {
      setClientError("이 브라우저의 게시판 저장 공간을 읽지 못했습니다.");
    }
    setUserId(ownerKey);
    setMode("demo");
  }

  async function connect() {
    if (!hasSupabaseConfig()) {
      let ownerKey = localStorage.getItem(OWNER_KEY);
      if (!ownerKey) {
        ownerKey = crypto.randomUUID();
        localStorage.setItem(OWNER_KEY, ownerKey);
      }
      loadDemo(ownerKey);
      return;
    }

    setMode("loading");
    const client = getSupabaseBrowserClient();
    if (!client) {
      setClientError("Supabase 설정을 읽지 못했습니다.");
      setMode("error");
      return;
    }
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      setClientError("Supabase 익명 세션을 읽지 못했습니다. 페이지를 새로고침해 주세요.");
      setMode("error");
      return;
    }
    let currentUserId = sessionData.session?.user.id || "";
    if (!currentUserId) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error || !data.user) {
        setClientError("공유 게시판에 연결하지 못했습니다. Supabase에서 Anonymous Sign-Ins를 켜고 anon 키와 RLS 설정을 확인해 주세요.");
        setMode("error");
        return;
      }
      currentUserId = data.user.id;
    }
    setUserId(currentUserId);
    await loadShared(client, currentUserId);
  }

  useEffect(() => {
    void connect();
  }, []);

  useEffect(() => {
    if (mode !== "demo") return;
    try {
      const raw = localStorage.getItem(IDEA_KEY);
      const stored: unknown = raw ? JSON.parse(raw) : [];
      const normalized = ideas.map((idea) => {
        const previous = Array.isArray(stored)
          ? (stored as StoredDemoIdea[]).find((item) => item.id === idea.id)
          : null;
        const previousVoters = previous?.voterKeys || [];
        const voterKeys = idea.hasVoted
          ? [...new Set([...previousVoters, userId])]
          : previousVoters.filter((key) => key !== userId);
        return { ...idea, ownerKey: previous?.ownerKey || (idea.isMine ? userId : ""), voterKeys };
      });
      localStorage.setItem(IDEA_KEY, JSON.stringify(normalized));
    } catch {
      setClientError("게시판을 이 브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.");
    }
  }, [ideas, mode, userId]);

  const visibleIdeas = useMemo(() => {
    return filterCommunityIdeas(ideas, { query, category: categoryFilter, sort });
  }, [ideas, categoryFilter, query, sort]);

  function updateForm<K extends keyof CommunityIdeaInput>(key: K, value: CommunityIdeaInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNormalization(null);
    setNormalizationFailure("");
    setAllowRawPost(false);
    setFormError("");
  }

  function openForm() {
    setForm(blankIdea);
    setNormalization(null);
    setNormalizationFailure("");
    setAllowRawPost(false);
    setFormError("");
    setFormOpen(true);
  }

  async function prepareAndPublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const parsedInput = communityIdeaInputSchema.safeParse(form);
    if (!parsedInput.success) {
      setFormError(parsedInput.error.issues[0]?.message || "입력 내용을 확인해 주세요.");
      return;
    }

    if (!normalization && !allowRawPost) {
      setSubmitting(true);
      try {
        const existingPublicIdeas = ideas.filter((idea) => idea.isPublic).slice(0, 20).map((idea) => ({
          id: idea.id,
          title: idea.normalizedTitle || idea.title,
          discomfort: idea.discomfort.slice(0, 300),
          requestedFeature: idea.requestedFeature.slice(0, 300),
        }));
        const client = mode === "shared" ? getSupabaseBrowserClient() : null;
        const { data: currentSession } = client ? await client.auth.getSession() : { data: { session: null } };
        const response = await fetch("/api/community/normalize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentSession.session?.access_token ? { Authorization: `Bearer ${currentSession.session.access_token}` } : {}),
          },
          body: JSON.stringify({ idea: parsedInput.data, existingPublicIdeas }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "AI 정리 요청이 실패했습니다.";
          throw new Error(message);
        }
        const result = communityNormalizationSchema.safeParse(payload && typeof payload === "object" && "normalization" in payload ? payload.normalization : null);
        if (!result.success) throw new Error("AI 정리 응답을 읽지 못했습니다.");
        setNormalization(result.data);
        setSubmitting(false);
        return;
      } catch (cause) {
        setNormalizationFailure(cause instanceof Error ? cause.message : "AI 중복 확인을 완료하지 못했습니다.");
        setAllowRawPost(true);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const normalizedFields = {
        normalizedTitle: normalization?.normalizedTitle || parsedInput.data.title,
        problemSummary: normalization?.problemSummary || "",
        audienceLabel: normalization?.audienceLabel || parsedInput.data.targetUser,
        refinedFeature: normalization?.refinedFeature || parsedInput.data.requestedFeature,
        aiAvailable: Boolean(normalization),
      };

      if (mode === "demo") {
        const idea: BoardIdea = {
          ...parsedInput.data,
          id,
          createdAt,
          ...normalizedFields,
          votes: 0,
          hasVoted: false,
          isMine: true,
        };
        setIdeas((current) => [idea, ...current]);
        setNormalization(null);
        setNormalizationFailure("");
        setAllowRawPost(false);
        setForm(blankIdea);
        setFormOpen(false);
        setExpandedId(idea.id);
        setSubmitting(false);
        return;
      }

      const client = getSupabaseBrowserClient();
      if (mode !== "shared" || !client || !userId) throw new Error("공유 게시판 연결을 먼저 확인해 주세요.");
      const { error } = await client.from("ideas").insert({
        user_id: userId,
        title: parsedInput.data.title,
        discomfort: parsedInput.data.discomfort,
        requested_feature: parsedInput.data.requestedFeature,
        target_user: parsedInput.data.targetUser,
        category_id: parsedInput.data.category,
        is_public: parsedInput.data.isPublic,
        normalized_title: normalizedFields.normalizedTitle,
        problem_summary: normalizedFields.problemSummary,
        audience_label: normalizedFields.audienceLabel,
        refined_feature: normalizedFields.refinedFeature,
        ai_available: normalizedFields.aiAvailable,
      });
      if (error) throw new Error("게시하지 못했습니다. Supabase RLS와 ideas 테이블 권한을 확인해 주세요.");
      await loadShared(client, userId);
      setForm(blankIdea);
      setNormalization(null);
      setNormalizationFailure("");
      setAllowRawPost(false);
      setFormOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "아이디어를 게시하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleVote(idea: BoardIdea) {
    if (!idea.isPublic || votingId) return;
    setVotingId(idea.id);
    try {
      if (mode === "demo") {
        setIdeas((current) => current.map((item) => item.id !== idea.id ? item : {
          ...item,
          votes: Math.max(0, item.votes + (item.hasVoted ? -1 : 1)),
          hasVoted: !item.hasVoted,
        }));
      } else {
        const client = getSupabaseBrowserClient();
        if (!client || !userId) throw new Error("공유 게시판 연결을 확인해 주세요.");
        const result = idea.hasVoted
          ? await client.from("idea_votes").delete().eq("idea_id", idea.id).eq("user_id", userId)
          : await client.from("idea_votes").insert({ idea_id: idea.id, user_id: userId });
        if (result.error) throw new Error("공감을 저장하지 못했습니다. 중복 공감이나 RLS 설정을 확인해 주세요.");
        await loadShared(client, userId);
      }
    } catch (cause) {
      setClientError(cause instanceof Error ? cause.message : "공감을 저장하지 못했습니다.");
    } finally {
      setVotingId("");
    }
  }

  const modeLabel = mode === "shared" ? "공유 게시판" : mode === "demo" ? "이 브라우저 시연 모드" : mode === "error" ? "공유 저장소 연결 오류" : "게시판 연결 중";

  return (
    <div className="community-view">
      <div className="community-heading">
        <div>
          <div className="eyebrow"><MessageSquareText aria-hidden="true" />NEEDS BOARD</div>
          <h1 className="page-title">이런 거 필요해요</h1>
          <p className="page-subtitle">생활 속 불편을 공유하고, 다른 사람이 남긴 문제에서 다음 서비스 아이디어를 발견해 보세요.</p>
        </div>
        <Button onClick={openForm}><Plus size={16} aria-hidden="true" />불편 제안하기</Button>
      </div>

      <div className={`community-mode-banner ${mode === "demo" ? "is-demo" : mode === "error" ? "is-error" : ""}`} role="status">
        {mode === "shared" ? <Wifi aria-hidden="true" /> : mode === "demo" ? <CircleHelp aria-hidden="true" /> : mode === "error" ? <CircleHelp aria-hidden="true" /> : <RefreshCw className="spinner" aria-hidden="true" />}
        <div><strong>{modeLabel}</strong><span>{mode === "shared"
          ? "공개 제안은 다른 사용자에게 보이고, 비공개 제안은 이 익명 계정에만 보입니다."
          : mode === "demo"
            ? "현재 게시물과 공감은 이 브라우저에만 저장됩니다. 다른 사용자와 공유되지 않으며, 비공개 보호도 계정 기반이 아닙니다."
            : mode === "error"
              ? clientError || "공유 게시판 설정을 확인해 주세요."
              : "게시판 저장소를 연결하고 있습니다."}</span></div>
        {mode === "error" && <Button variant="secondary" size="sm" onClick={() => void connect()}>다시 연결</Button>}
      </div>

      {clientError && mode !== "error" && <div className="form-error" role="status"><CircleHelp aria-hidden="true" />{clientError}</div>}

      {formOpen && (
        <section className="community-form-panel">
          <div className="panel-heading">
            <div><h2>필요한 서비스를 제안해 주세요</h2><p>불편과 원하는 기능을 구체적으로 적으면 비슷한 제안을 찾는 데 도움이 됩니다.</p></div>
            <button className="modal-close" onClick={() => { setFormOpen(false); setFormError(""); }} aria-label="제안 양식 닫기"><ChevronDown aria-hidden="true" /></button>
          </div>
          <form className="community-form" onSubmit={prepareAndPublish}>
            <div className="form-field form-field--wide"><label className="form-label" htmlFor="community-title">제목 <em>필수</em></label><input id="community-title" className="form-control" value={form.title} maxLength={100} onChange={(event) => updateForm("title", event.target.value)} placeholder="예: 강의자료를 자동으로 요약하고 퀴즈를 만들어줘요" required /></div>
            <div className="form-field"><label className="form-label" htmlFor="community-discomfort">겪고 있는 불편함 <em>필수</em></label><textarea id="community-discomfort" className="form-control form-control--short" value={form.discomfort} maxLength={1200} onChange={(event) => updateForm("discomfort", event.target.value)} placeholder="언제, 어떤 점이 특히 불편한가요?" required /></div>
            <div className="form-field"><label className="form-label" htmlFor="community-feature">원하는 서비스 또는 기능 <em>필수</em></label><textarea id="community-feature" className="form-control form-control--short" value={form.requestedFeature} maxLength={1200} onChange={(event) => updateForm("requestedFeature", event.target.value)} placeholder="어떤 기능이 있으면 도움이 될까요?" required /></div>
            <div className="form-field"><label className="form-label" htmlFor="community-audience">사용 대상 <small>선택</small></label><input id="community-audience" className="form-control" value={form.targetUser} maxLength={300} onChange={(event) => updateForm("targetUser", event.target.value)} placeholder="예: 대학생" /></div>
            <div className="form-field"><label className="form-label" htmlFor="community-category">카테고리</label><select id="community-category" className="form-control" value={form.category} onChange={(event) => updateForm("category", communityCategorySchema.parse(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}</select></div>
            <label className="community-public-toggle"><input type="checkbox" checked={form.isPublic} onChange={(event) => updateForm("isPublic", event.target.checked)} /><span><strong>{form.isPublic ? "공개 제안" : "비공개 제안"}</strong><small>{mode === "shared" ? form.isPublic ? "게시판의 모든 방문자가 볼 수 있어요." : "이 익명 계정만 볼 수 있어요. 이 브라우저 데이터를 지우면 복구되지 않을 수 있습니다." : "시연 모드에서는 현재 브라우저 안에만 저장됩니다."}</small></span></label>

            {formError && <div className="form-error" role="alert"><CircleHelp aria-hidden="true" />{formError}</div>}
            {normalizationFailure && <div className="form-error" role="status"><CircleHelp aria-hidden="true" /><span>AI 정리/중복 확인을 완료하지 못했습니다. 실제 사용자 수요나 중복 여부를 확인한 것처럼 표시하지 않습니다. 원문 그대로 게시할 수 있습니다. {normalizationFailure}</span></div>}
            {normalization && (
              <div className="community-ai-review">
                <div className="community-ai-review-title"><Sparkles aria-hidden="true" /><div><strong>AI가 정리한 내용</strong><small>게시 전 내용을 확인해 주세요. 중복 판단은 참고 제안입니다.</small></div></div>
                <div className="community-ai-grid"><div><small>정리한 제목</small><strong>{normalization.normalizedTitle}</strong></div><div><small>핵심 문제</small><span>{normalization.problemSummary || "추가 정리 정보 없음"}</span></div><div><small>예상 사용자 분류</small><span>{normalization.audienceLabel || "확인되지 않음"}</span></div><div><small>원하는 기능 정리</small><span>{normalization.refinedFeature || "확인되지 않음"}</span></div></div>
                {normalization.similarIdeas.length > 0 && <div className="community-duplicate-box"><strong>비슷할 수 있는 공개 제안</strong><span>AI가 일부 공개 제안에서 비슷한 표현을 찾았습니다. 같은 문제인지 직접 확인해 주세요.</span>{normalization.similarIdeas.map((match) => <button type="button" className="community-duplicate-link" key={match.id} onClick={() => { setFormOpen(false); setExpandedId(match.id); document.getElementById(`community-${match.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><span>{match.title}</span><small>{match.reason}</small><ArrowUpRight aria-hidden="true" /></button>)}</div>}
              </div>
            )}
            <div className="community-form-footer"><span><LockKeyhole aria-hidden="true" />비공개 제안은 공유 게시판에서 소유자 RLS로 보호됩니다.</span><Button type="submit" disabled={submitting || mode === "loading" || mode === "error"}>{submitting ? <><RefreshCw className="spinner" size={15} aria-hidden="true" />처리 중</> : normalization || allowRawPost ? <><Send size={15} aria-hidden="true" />{normalization ? "확인 후 게시" : "원문 그대로 게시"}</> : <><Sparkles size={15} aria-hidden="true" />AI 정리 및 유사 제안 확인</>}</Button></div>
          </form>
        </section>
      )}

      <section className="community-list-panel">
        <div className="community-list-heading"><div><h2>사람들이 필요하다고 말한 것</h2><p>{loading ? "목록을 불러오고 있습니다." : `${visibleIdeas.length}개 제안`}{mode === "shared" ? " · 공개 제안 및 내 비공개 제안" : " · 이 기기에서 작성한 제안"}</p></div><Badge><Users size={12} aria-hidden="true" />제안 목록</Badge></div>
        <div className="community-filters">
          <label className="community-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="키워드로 제안 찾기" aria-label="제안 키워드 검색" /></label>
          <select className="filter-select" aria-label="카테고리 필터" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}><option value="all">모든 카테고리</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}</select>
          <select className="filter-select" aria-label="정렬" value={sort} onChange={(event) => setSort(event.target.value as "recent" | "votes")}><option value="recent">최신순</option><option value="votes">공감순</option></select>
        </div>

        {loading ? <div className="github-loading"><RefreshCw className="spinner" aria-hidden="true" /><span>아이디어를 불러오고 있습니다.</span></div> : visibleIdeas.length ? (
          <div className="community-idea-list">
            {visibleIdeas.map((idea) => (
              <article className="community-idea-card" id={`community-${idea.id}`} key={idea.id}>
                <div className="community-idea-main">
                  <div className="community-idea-tags"><Badge>{categoryName(idea.category)}</Badge>{idea.isPublic ? <Badge className="community-public-badge">공개</Badge> : <Badge><LockKeyhole size={11} aria-hidden="true" />비공개</Badge>}{idea.aiAvailable && <Badge className="community-ai-badge"><Sparkles size={11} aria-hidden="true" />AI 정리</Badge>}{idea.isMine && <Badge>내 제안</Badge>}</div>
                  <h3>{idea.normalizedTitle || idea.title}</h3>
                  {idea.problemSummary && <p className="community-problem-summary">{idea.problemSummary}</p>}
                  <div className="community-idea-pair"><span><strong>불편함</strong>{idea.discomfort}</span><span><strong>원하는 기능</strong>{idea.refinedFeature || idea.requestedFeature}</span></div>
                  {(idea.audienceLabel || idea.targetUser) && <p className="community-audience"><Users aria-hidden="true" />예상 사용자 · {idea.audienceLabel || idea.targetUser}</p>}
                  <div className="community-idea-meta"><span><Clock3 aria-hidden="true" />{shortDate(idea.createdAt)}</span><span><Heart aria-hidden="true" />{idea.votes} 공감</span></div>
                </div>
                <div className="community-idea-actions">
                  {idea.isPublic && <Button variant={idea.hasVoted ? "primary" : "secondary"} size="sm" onClick={() => void toggleVote(idea)} disabled={Boolean(votingId)}><ThumbsUp size={14} aria-hidden="true" />{idea.hasVoted ? "공감 취소" : "공감"}</Button>}
                  <Button variant="secondary" size="sm" onClick={() => setExpandedId(expandedId === idea.id ? "" : idea.id)}><ChevronDown size={14} aria-hidden="true" />{expandedId === idea.id ? "접기" : "자세히"}</Button>
                  <Button size="sm" onClick={() => onAnalyze(marketIdea(idea))}><Sparkles size={14} aria-hidden="true" />시장성 분석하기</Button>
                </div>
                {expandedId === idea.id && <div className="community-idea-expanded"><div><strong>등록 내용</strong><p>{idea.discomfort}</p></div><div><strong>원하는 서비스</strong><p>{idea.requestedFeature}</p></div><div><strong>시장 수요 단서</strong><p>공감 {idea.votes}개는 게시판 안의 반응일 뿐 실제 시장 수요를 측정한 값은 아닙니다. 사용자 인터뷰나 사용성 테스트로 검증해 주세요.</p></div><Button variant="secondary" size="sm" onClick={() => { const url = `${window.location.origin}${window.location.pathname}#community-${idea.id}`; void navigator.clipboard.writeText(url).catch(() => undefined); }}><Share2 size={14} aria-hidden="true" />링크 복사</Button></div>}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state community-empty"><div><div className="empty-icon"><MessageSquareText aria-hidden="true" /></div><h3>{ideas.length ? "조건에 맞는 제안이 없습니다" : "아직 제안이 없습니다"}</h3><p>{ideas.length ? "검색어나 카테고리를 바꿔 다시 살펴보세요." : "먼저 겪은 불편을 적고, 어떤 기능이 필요한지 제안해 보세요."}</p><Button className="mt-4" onClick={openForm}><Plus size={15} aria-hidden="true" />불편 제안하기</Button></div></div>
        )}
      </section>

      <p className="community-caveat"><CircleHelp aria-hidden="true" />공감은 커뮤니티 반응 수입니다. 검증된 사용자 수요나 매출 가능성을 뜻하지 않습니다. 실명·연락처 등 민감한 정보는 제안에 적지 마세요.</p>
    </div>
  );
}
