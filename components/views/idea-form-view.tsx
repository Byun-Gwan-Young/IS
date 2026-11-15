"use client";

import { useRef, useState, type Dispatch, type DragEvent, type FormEvent, type SetStateAction } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Check,
  CircleHelp,
  FileText,
  Globe2,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Upload,
  Search,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentIdeaSchema, type IdeaRequest, type ProgressStep } from "@/lib/contracts";

interface IdeaFormViewProps {
  form: IdeaRequest;
  setForm: Dispatch<SetStateAction<IdeaRequest>>;
  onAnalyze: (input: IdeaRequest) => void;
  loading: boolean;
  online: boolean;
  error: string;
  progressStep: ProgressStep | null;
  progressMessage: string;
}

const examples: { label: string; values: Partial<IdeaRequest> }[] = [
  {
    label: "AI 과제 피드백",
    values: {
      serviceName: "AI 과제 피드백",
      description: "대학생이 과제 초안을 올리면 평가 기준에 맞춘 피드백과 개선 방향을 제안하는 학습 보조 서비스입니다.",
      problem: "학생은 과제 제출 전 자신의 글이 평가 기준에 맞는지 확인하기 어렵습니다.",
      features: "평가 기준별 초안 점검, 문장별 피드백, 수정 전후 비교",
      targetAudience: "대학 과제를 작성하는 학생",
      market: "kr",
    },
  },
  {
    label: "동네 공방 예약",
    values: {
      serviceName: "동네 공방 예약",
      description: "여러 지역 공방의 원데이 클래스와 남은 자리를 모아 일정과 위치에 맞춰 예약하게 돕는 서비스입니다.",
      problem: "작은 공방의 수업 정보를 한곳에서 찾고 예약하기 어렵습니다.",
      features: "지역·날짜 검색, 클래스 비교, 간편 예약과 일정 알림",
      targetAudience: "새로운 취미를 찾는 지역 주민",
      market: "kr",
    },
  },
  {
    label: "반려동물 건강 기록",
    values: {
      serviceName: "반려동물 건강 기록",
      description: "반려동물의 약 복용, 예방접종, 병원 방문 기록을 보호자가 함께 관리하는 모바일 서비스입니다.",
      problem: "여러 보호자가 돌봄을 나누면 건강 기록과 복약 일정을 놓치기 쉽습니다.",
      features: "복약 알림, 건강 타임라인, 가족 보호자 공유",
      targetAudience: "반려동물을 함께 돌보는 가족",
      market: "kr",
    },
  },
];

const markets = [
  { value: "kr", label: "국내", icon: MapPin },
  { value: "international", label: "해외", icon: Globe2 },
  { value: "global", label: "전체", icon: Search },
] as const;

const stepDetails: { id: ProgressStep; label: string; percent: number }[] = [
  { id: "keywords", label: "검색어 구성", percent: 25 },
  { id: "search", label: "웹 검색", percent: 58 },
  { id: "analysis", label: "근거 분석", percent: 86 },
];

export function IdeaFormView({ form, setForm, onAnalyze, loading, online, error, progressStep, progressMessage }: IdeaFormViewProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadNote, setUploadNote] = useState("");

  function update<K extends keyof IdeaRequest>(key: K, value: IdeaRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAnalyze(form);
  }

  function useExample(values: Partial<IdeaRequest>) {
    setForm({ ...{ serviceName: "", description: "", problem: "", features: "", targetAudience: "", market: "kr" }, ...values } as IdeaRequest);
    setUploadNote("");
    setUploadError("");
  }

  async function uploadDocument(file?: File) {
    if (!file) return;
    setUploadError("");
    setUploadNote("");
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("파일은 10MB 이하로 업로드해 주세요.");
      return;
    }
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) {
      setUploadError("PDF, DOCX, TXT, MD 파일만 지원합니다.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/documents/extract", { method: "POST", body });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result && typeof result === "object" && "message" in result ? String(result.message) : "문서를 분석하지 못했습니다.";
        throw new Error(message);
      }
      if (!result || typeof result !== "object" || !("extracted" in result)) throw new Error("문서 분석 응답이 올바르지 않습니다.");
      const extracted = documentIdeaSchema.safeParse(result.extracted);
      if (!extracted.success) throw new Error("문서에서 입력 항목을 확인하지 못했습니다. 다시 시도해 주세요.");
      setForm((current) => ({
        ...current,
        serviceName: extracted.data.serviceName || current.serviceName,
        description: extracted.data.description,
        problem: extracted.data.problem,
        features: extracted.data.features,
        targetAudience: extracted.data.targetAudience,
        market: extracted.data.market,
        inputSource: "document",
        sourceLabel: file.name.slice(0, 180),
      }));
      setUploadNote("문서에서 초안을 가져왔습니다. 내용을 검토하고 필요한 부분을 직접 수정해 주세요." + ("note" in result && typeof result.note === "string" && result.note ? ` ${result.note}` : ""));
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "문서 분석 중 문제가 발생했습니다.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void uploadDocument(event.dataTransfer.files[0]);
  }

  const currentStepIndex = stepDetails.findIndex((step) => step.id === progressStep);
  const progressPercent = stepDetails[currentStepIndex]?.percent ?? 10;

  return (
    <div>
      <div className="form-heading">
        <div className="eyebrow"><Sparkles aria-hidden="true" />NEW MARKET SCAN</div>
        <h1 className="page-title">아이디어를 들려주세요</h1>
        <p className="page-subtitle">핵심 설명 하나만 있어도 시작할 수 있어요. 나머지 항목은 더 나은 검색을 위한 선택 정보입니다.</p>
      </div>

      <div className="form-layout">
        <form className="form-panel" onSubmit={submit}>
          {error && (
            <div className="form-error" role="alert">
              <CircleHelp aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {!online && (
            <div className="form-error" role="status">
              <WifiOff aria-hidden="true" />
              <span>현재 오프라인입니다. 인터넷에 연결되면 웹 검색을 시작할 수 있어요.</span>
            </div>
          )}

          <section
            className={`document-dropzone ${isDragging ? "is-dragging" : ""} ${uploading ? "is-uploading" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            aria-label="문서에서 아이디어 가져오기"
          >
            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              onChange={(event) => void uploadDocument(event.target.files?.[0])}
              disabled={loading || uploading}
              tabIndex={-1}
            />
            <span className="document-drop-icon">{uploading ? <LoaderCircle className="spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />}</span>
            <div className="document-drop-copy">
              <strong>{uploading ? "문서 내용을 읽고 있어요" : "기획 문서에서 아이디어 가져오기"}</strong>
              <span>PDF · DOCX · TXT · MD, 최대 10MB</span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={loading || uploading}>
              {uploading ? "추출 중" : "파일 선택"}
            </Button>
            {uploadNote && <div className="document-upload-note" role="status"><CheckCircle2 aria-hidden="true" />{uploadNote}</div>}
            {uploadError && <div className="document-upload-error" role="alert"><CircleHelp aria-hidden="true" />{uploadError}</div>}
            {form.inputSource === "document" && !uploadNote && <div className="document-upload-note" role="status"><FileText aria-hidden="true" />{form.sourceLabel || "문서"}에서 가져온 항목입니다. 아래 내용을 확인해 주세요.</div>}
          </section>

          <div className="form-grid">
            <div className="form-field form-field--wide">
              <label className="form-label" htmlFor="service-name">서비스 이름 <small>선택</small></label>
              <input
                id="service-name"
                className="form-control"
                value={form.serviceName}
                onChange={(event) => update("serviceName", event.target.value)}
                maxLength={100}
                placeholder="예: 팀 프로젝트 일정 조율 도우미"
                disabled={loading}
              />
            </div>

            <div className="form-field form-field--wide">
              <label className="form-label" htmlFor="idea-description">아이디어 설명 <em>필수 · 20자 이상</em>{form.inputSource === "document" && <small>문서 추출 · 수정 가능</small>}</label>
              <textarea
                id="idea-description"
                className="form-control"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                minLength={20}
                maxLength={2400}
                required
                placeholder="누구를 위한 서비스인지, 무엇을 해결하는지 편하게 적어 주세요."
                disabled={loading}
              />
              <p className="field-hint">아이디어를 구체적으로 적을수록 관련 있는 검색어를 만들 수 있어요. {form.description.length}/2400</p>
              <div className="example-list" aria-label="예시 아이디어">
                {examples.map((example) => (
                  <button className="example-chip" type="button" key={example.label} onClick={() => useExample(example.values)} disabled={loading}>
                    <Lightbulb aria-hidden="true" />{example.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="problem">해결하려는 문제 <small>선택</small></label>
              <textarea
                id="problem"
                className="form-control form-control--short"
                value={form.problem}
                onChange={(event) => update("problem", event.target.value)}
                maxLength={800}
                placeholder="사용자가 지금 겪는 불편은 무엇인가요?"
                disabled={loading}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="features">주요 기능 <small>선택</small></label>
              <textarea
                id="features"
                className="form-control form-control--short"
                value={form.features}
                onChange={(event) => update("features", event.target.value)}
                maxLength={1200}
                placeholder="예: 일정 공유, 자동 알림, 팀별 현황 보기"
                disabled={loading}
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="form-label" htmlFor="target-audience">예상 사용자 <small>선택</small></label>
              <input
                id="target-audience"
                className="form-control"
                value={form.targetAudience}
                onChange={(event) => update("targetAudience", event.target.value)}
                maxLength={500}
                placeholder="예: 소규모 팀에서 프로젝트를 진행하는 대학생"
                disabled={loading}
              />
            </div>
            <div className="form-field form-field--wide">
              <span className="form-label" id="market-label">목표 시장 <small>선택</small></span>
              <div className="market-select" role="radiogroup" aria-labelledby="market-label">
                {markets.map(({ value, label, icon: Icon }) => (
                  <button
                    className="market-option"
                    type="button"
                    role="radio"
                    aria-checked={form.market === value}
                    key={value}
                    onClick={() => update("market", value)}
                    disabled={loading}
                  >
                    <Icon aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
              <p className="field-hint">국내 시장은 한국어 검색을 우선하고, 해외·전체 시장은 영어 검색을 함께 사용합니다.</p>
            </div>
          </div>

          {loading && (
            <div className="progress-card" role="status" aria-live="polite">
              <div className="progress-topline">
                <strong>{progressMessage || "분석 준비 중"}</strong>
                <span><LoaderCircle className="spinner" size={15} aria-hidden="true" /> 잠시만 기다려 주세요</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
              <div className="progress-steps">
                {stepDetails.map((step, index) => (
                  <span className={`progress-step ${currentStepIndex > index ? "is-done" : ""} ${currentStepIndex === index ? "is-current" : ""}`} key={step.id}>
                    {currentStepIndex > index ? <Check aria-hidden="true" /> : currentStepIndex === index ? <LoaderCircle className="spinner" aria-hidden="true" /> : <span aria-hidden="true">{index + 1}.</span>}
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="form-footer">
            <p><LockKeyhole aria-hidden="true" />API 키는 서버에서만 사용합니다.</p>
            <Button className="form-submit" type="submit" disabled={loading || !online || form.description.trim().length < 20}>
              {loading ? <><LoaderCircle className="spinner" size={16} aria-hidden="true" />분석 중</> : <>실시간 시장 조사 시작<ArrowRight size={16} aria-hidden="true" /></>}
            </Button>
          </div>
        </form>

        <aside className="form-side">
          <section className="guide-card guide-card--accent">
            <div className="guide-heading"><Sparkles aria-hidden="true" /><strong>좋은 검색을 위한 팁</strong></div>
            <p>한 문장으로 누구의 어떤 문제를 해결하는지 적어 보세요. 기능이 떠오르지 않아도 괜찮습니다.</p>
            <ul className="guide-checks">
              <li><Check aria-hidden="true" />예상 사용자를 구체적으로 적기</li>
              <li><Check aria-hidden="true" />현재 불편한 상황을 한 가지 설명하기</li>
              <li><Check aria-hidden="true" />핵심 기능은 동사 중심으로 적기</li>
            </ul>
          </section>
          <section className="guide-card">
            <div className="guide-heading"><Search aria-hidden="true" /><strong>분석에는 실제 검색이 필요해요</strong></div>
            <p>웹 검색과 AI 분석은 인터넷 연결이 필요합니다. 결과는 현재 찾을 수 있는 출처에 한정되며, 시장 수요를 확정적으로 예측하지 않습니다.</p>
          </section>
          <div className="privacy-card"><LockKeyhole aria-hidden="true" /><span>저장하지 않은 아이디어는 브라우저에 보관되지 않습니다. 저장한 보고서는 현재 기기의 브라우저에만 남습니다.</span></div>
          <div className="privacy-card"><Users aria-hidden="true" /><span>서비스 이름을 적지 않아도 괜찮아요. 아이디어 설명만으로 검색을 시작할 수 있습니다.</span></div>
        </aside>
      </div>
    </div>
  );
}
