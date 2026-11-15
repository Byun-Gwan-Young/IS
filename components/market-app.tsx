"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Bookmark,
  Check,
  Compass,
  Download,
  FileSearch,
  Github,
  House,
  LockKeyhole,
  MessageSquareText,
  Moon,
  Plus,
  Search,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import { HomeView } from "@/components/views/home-view";
import { IdeaFormView } from "@/components/views/idea-form-view";
import { ReportDashboard, type ReportSection } from "@/components/views/report-dashboard";
import { SavedView } from "@/components/views/saved-view";
import { GitHubExplorerView } from "@/components/views/github-explorer-view";
import { CommunityBoardView } from "@/components/views/community-board-view";
import { Button } from "@/components/ui/button";
import {
  analysisReportSchema,
  savedAnalysisSchema,
  type AnalysisReport,
  type IdeaRequest,
  type ProgressStep,
  type SavedAnalysis,
  type StreamEvent,
} from "@/lib/contracts";

type Screen = "home" | "new" | "report" | "saved" | "discover" | "community";
type Theme = "light" | "dark";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const SAVED_KEY = "idea-scout:reports:v1";
const THEME_KEY = "idea-scout:theme:v1";

const blankForm: IdeaRequest = {
  serviceName: "",
  description: "",
  problem: "",
  features: "",
  targetAudience: "",
  market: "kr",
};

function reportTitle(report: AnalysisReport) {
  return report.input.serviceName.trim() || report.input.description.trim().split(/[.!?\n]/)[0].slice(0, 48) || "아이디어 분석";
}

function reportSummary(report: AnalysisReport) {
  return report.analysis.market.landscapeSummary || report.analysis.ideaSummary.valueProposition || "시장 조사 보고서";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function makeMarkdown(report: AnalysisReport) {
  const analysis = report.analysis;
  const lines = [
    `# ${reportTitle(report)}`,
    "",
    `분석 시각: ${formatDate(report.createdAt)}`,
    `검색 출처: ${report.sources.length}개`,
    "",
    "## 아이디어 요약",
    `- 해결 문제: ${analysis.ideaSummary.problem || "확인하지 못함"}`,
    `- 예상 사용자: ${analysis.ideaSummary.audience || "확인하지 못함"}`,
    `- 핵심 가치: ${analysis.ideaSummary.valueProposition || "확인하지 못함"}`,
    "",
    "## 시장 현황",
    analysis.market.landscapeSummary || "확인 가능한 시장 정보를 찾지 못했습니다.",
    "",
    "## 경쟁 서비스",
  ];

  if (!analysis.competitors.length) lines.push("출처로 확인 가능한 경쟁 서비스를 찾지 못했습니다.");
  for (const competitor of analysis.competitors) {
    lines.push(`### ${competitor.name}`);
    lines.push(competitor.overview || "개요 정보 없음");
    if (competitor.similarity) lines.push(`- 유사점: ${competitor.similarity}`);
    if (competitor.differentiation) lines.push(`- 차별화 관점: ${competitor.differentiation}`);
    lines.push(`- 근거: ${competitor.sourceIds.join(", ") || "없음"}`);
    lines.push("");
  }

  lines.push("## 차별화 제안");
  for (const item of analysis.differentiation) {
    lines.push(`- ${item.title}: ${item.rationale || "추천 근거가 충분하지 않습니다."} (난이도 ${item.difficulty}, 사용자 가치 ${item.userValue})`);
  }
  lines.push("", "## MVP 방향", analysis.mvp.firstFeature || "우선 기능을 확정할 근거가 부족합니다.", "", "## 참고 출처");
  for (const source of report.sources) lines.push(`- [${source.id}] ${source.title} — ${source.url}`);
  if (report.warnings.length) lines.push("", "## 참고 사항", ...report.warnings.map((warning) => `- ${warning}`));
  lines.push("", "이 보고서는 검색 결과를 바탕으로 한 참고 자료이며, 시장 수요나 성공을 보장하지 않습니다.");
  return lines.join("\n");
}

export function MarketApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [theme, setTheme] = useState<Theme>("light");
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [form, setForm] = useState<IdeaRequest>(blankForm);
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);
  const [progressStep, setProgressStep] = useState<ProgressStep | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState("");
  const [reportSection, setReportSection] = useState<ReportSection>("overview");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (Array.isArray(value)) {
          setSaved(value.flatMap((item) => {
            const parsed = savedAnalysisSchema.safeParse(item);
            return parsed.success ? [parsed.data] : [];
          }).slice(0, 20));
        }
      }
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
    } catch {
      setNotice("이 브라우저의 저장 공간을 읽지 못했습니다.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved, storageReady]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function notify(message: string) {
    setNotice(message);
  }

  function openNewAnalysis() {
    setAnalysisError("");
    setProgressStep(null);
    setScreen("new");
  }

  function openSaved(item: SavedAnalysis) {
    setActiveReport(item.report);
    setReportSection("overview");
    setScreen("report");
  }

  function saveCurrentReport() {
    if (!activeReport) return;
    setSaved((current) => [
      { savedAt: new Date().toISOString(), report: activeReport },
      ...current.filter((item) => item.report.id !== activeReport.id),
    ].slice(0, 20));
    notify("이 분석을 현재 브라우저에 저장했습니다.");
  }

  function deleteSaved(reportId: string) {
    setSaved((current) => current.filter((item) => item.report.id !== reportId));
    notify("저장된 분석을 삭제했습니다.");
  }

  async function copyCurrentReport() {
    if (!activeReport) return;
    try {
      await navigator.clipboard.writeText(makeMarkdown(activeReport));
      notify("보고서 내용을 클립보드에 복사했습니다.");
    } catch {
      notify("복사할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  function downloadCurrentReport() {
    if (!activeReport) return;
    const blob = new Blob([makeMarkdown(activeReport)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportTitle(activeReport).replace(/[^a-zA-Z0-9가-힣-]+/g, "-").slice(0, 48) || "idea-scout-report"}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("보고서를 Markdown 파일로 내려받았습니다.");
  }

  async function analyzeIdea(input: IdeaRequest) {
    if (!navigator.onLine) {
      setAnalysisError("오프라인 상태에서는 웹 검색과 AI 분석을 실행할 수 없습니다. 인터넷에 연결한 뒤 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setAnalysisError("");
    setProgressStep("keywords");
    setProgressMessage("분석 요청을 준비하고 있습니다.");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    let result: AnalysisReport | null = null;
    let streamError = "";

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = payload && typeof payload === "object" && "message" in payload
          ? String(payload.message)
          : `분석 요청이 실패했습니다 (HTTP ${response.status}).`;
        throw new Error(message);
      }
      if (!response.body) throw new Error("분석 결과 연결이 종료되었습니다. 다시 시도해 주세요.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consumeFrame = (frame: string) => {
        const dataLine = frame.split(/\r?\n/).find((line) => line.startsWith("data: "));
        if (!dataLine) return;
        let event: StreamEvent;
        try {
          event = JSON.parse(dataLine.slice(6)) as StreamEvent;
        } catch {
          streamError = "분석 서버에서 읽을 수 없는 응답을 받았습니다. 다시 시도해 주세요.";
          return;
        }

        if (event.type === "progress") {
          setProgressStep(event.step);
          setProgressMessage(event.message);
        } else if (event.type === "complete") {
          const parsed = analysisReportSchema.safeParse(event.report);
          if (parsed.success) result = parsed.data;
          else streamError = "분석 결과를 확인하지 못했습니다. 다시 요청해 주세요.";
        } else if (event.type === "error") {
          streamError = event.message;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          consumeFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeFrame(buffer);
      if (streamError) throw new Error(streamError);
      if (!result) throw new Error("분석 연결이 완료되기 전에 끊겼습니다. 다시 시도해 주세요.");

      setActiveReport(result);
      setReportSection("overview");
      setScreen("report");
      setProgressStep("analysis");
      setProgressMessage("보고서가 준비되었습니다.");
    } catch (error) {
      setAnalysisError(error instanceof Error && error.name === "AbortError"
        ? "분석 시간이 길어져 연결을 종료했습니다. 잠시 후 다시 시도해 주세요."
        : error instanceof Error ? error.message : "분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setProgressStep(null);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  function validateIdea(input: IdeaRequest) {
    setForm(input);
    setAnalysisError("");
    setProgressStep(null);
    setScreen("new");
    void analyzeIdea(input);
  }

  async function installApp() {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  }

  const screenTitle = screen === "home" ? "개요"
    : screen === "new" ? "아이디어 검증"
      : screen === "saved" ? "저장한 분석"
        : screen === "discover" ? "아이디어 발견"
          : screen === "community" ? "이런 거 필요해요"
            : "분석 보고서";

  return (
    <div className="app-root" data-theme={theme}>
      {!online && (
        <div className="offline-strip" role="status">
          <WifiOff size={15} aria-hidden="true" />
          오프라인 상태입니다. 저장한 분석은 볼 수 있지만 새 웹 검색은 사용할 수 없습니다.
        </div>
      )}
      <div className="app-layout">
        <aside className="sidebar" aria-label="주 메뉴">
          <button className="brand-button" onClick={() => setScreen("home")} aria-label="Idea Scout 개요로 이동">
            <span className="brand-mark"><Compass aria-hidden="true" /></span>
            <span className="brand-copy">
              <span className="brand-name">idea scout</span>
              <span className="brand-caption">MARKET VALIDATION</span>
            </span>
          </button>
          <p className="sidebar-label">WORKSPACE</p>
          <nav className="sidebar-nav">
            <button className={`sidebar-link ${screen === "home" ? "is-active" : ""}`} onClick={() => setScreen("home")}>
              <House aria-hidden="true" /><span>개요</span>
            </button>
            <button className={`sidebar-link ${screen === "new" || screen === "report" ? "is-active" : ""}`} onClick={openNewAnalysis}>
              <Search aria-hidden="true" /><span>아이디어 검증</span>
            </button>
            <button className={`sidebar-link ${screen === "discover" ? "is-active" : ""}`} onClick={() => setScreen("discover")}>
              <Github aria-hidden="true" /><span>아이디어 발견</span>
            </button>
            <button className={`sidebar-link ${screen === "community" ? "is-active" : ""}`} onClick={() => setScreen("community")}>
              <MessageSquareText aria-hidden="true" /><span>이런 거 필요해요</span>
            </button>
            <button className={`sidebar-link ${screen === "saved" ? "is-active" : ""}`} onClick={() => setScreen("saved")}>
              <Bookmark aria-hidden="true" /><span>저장한 분석</span>
              <span className="sidebar-count">{saved.length}</span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="workspace-note">
              <LockKeyhole aria-hidden="true" />
              <p>분석 보고서는 이 브라우저에 저장됩니다. 공개 아이디어 게시판은 설정된 경우 Supabase로 공유됩니다.</p>
            </div>
            <div className="sidebar-tools">
              <button className="sidebar-tool" onClick={installApp} aria-label="앱 설치 안내">
                <FileSearch aria-hidden="true" /><span>{isInstalled ? "앱 설치됨" : "앱 설치 안내"}</span>
              </button>
              <button className="sidebar-tool sidebar-tool--icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}>
                {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
              </button>
            </div>
          </div>
        </aside>

        <div className="app-main">
          <header className="topbar">
            <div className="breadcrumb">Idea Scout <span aria-hidden="true">/</span> <strong>{screenTitle}</strong></div>
            <div className="topbar-actions">
              <span className="connection-state"><span className="status-dot" />{online ? "연결됨" : "오프라인"}</span>
              <button className="topbar-icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}>
                {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
              </button>
              <Button className="topbar-install" variant="secondary" onClick={installApp}>
                <Plus size={15} aria-hidden="true" />{isInstalled ? "설치됨" : "앱 설치"}
              </Button>
            </div>
          </header>
          <header className="mobile-topbar">
            <button className="mobile-brand" onClick={() => setScreen("home")} aria-label="Idea Scout 개요로 이동">
              <span className="brand-mark"><Compass aria-hidden="true" /></span>
              <span className="brand-name">idea scout</span>
            </button>
            <div className="mobile-nav-actions">
              <button className="topbar-icon" onClick={() => setScreen("saved")} aria-label={`저장한 분석 ${saved.length}개`}><Bookmark aria-hidden="true" /></button>
              <button className="topbar-icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="테마 전환">
                {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
              </button>
              <button className="topbar-icon" onClick={installApp} aria-label={isInstalled ? "앱 설치됨" : "앱 설치 안내"}>
                {isInstalled ? <Check aria-hidden="true" /> : <Download aria-hidden="true" />}
              </button>
              <Button className="mobile-new-button" onClick={openNewAnalysis}><Plus size={15} aria-hidden="true" />새 분석</Button>
            </div>
          </header>
          <nav className="mobile-workspace-nav" aria-label="워크스페이스">
            <button className={screen === "new" || screen === "report" ? "is-active" : ""} onClick={openNewAnalysis}><Search aria-hidden="true" />검증</button>
            <button className={screen === "discover" ? "is-active" : ""} onClick={() => setScreen("discover")}><Github aria-hidden="true" />발견</button>
            <button className={screen === "community" ? "is-active" : ""} onClick={() => setScreen("community")}><MessageSquareText aria-hidden="true" />필요해요</button>
          </nav>

          <main className="main-content">
            {screen === "home" && (
              <HomeView
                saved={saved}
                onNew={openNewAnalysis}
                onOpen={openSaved}
                onSaved={() => setScreen("saved")}
                onDiscover={() => setScreen("discover")}
                onCommunity={() => setScreen("community")}
              />
            )}
            {screen === "new" && (
              <IdeaFormView
                form={form}
                setForm={setForm}
                onAnalyze={analyzeIdea}
                loading={loading}
                online={online}
                error={analysisError}
                progressStep={progressStep}
                progressMessage={progressMessage}
              />
            )}
            {screen === "saved" && (
              <SavedView saved={saved} onOpen={openSaved} onDelete={deleteSaved} onNew={openNewAnalysis} />
            )}
            {screen === "discover" && <GitHubExplorerView onValidate={validateIdea} />}
            {screen === "community" && <CommunityBoardView onAnalyze={validateIdea} />}
            {screen === "report" && activeReport && (
              <ReportDashboard
                report={activeReport}
                section={reportSection}
                setSection={setReportSection}
                isSaved={saved.some((item) => item.report.id === activeReport.id)}
                onSave={saveCurrentReport}
                onCopy={copyCurrentReport}
                onDownload={downloadCurrentReport}
                onNew={openNewAnalysis}
              />
            )}
          </main>
        </div>
      </div>

      {notice && <div className="notice-toast" role="status"><Check aria-hidden="true" />{notice}</div>}
      {showInstallHelp && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstallHelp(false); }}>
          <section className="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title">
            <div className="install-modal-head">
              <div>
                <h2 id="install-title">Idea Scout 설치하기</h2>
                <p>홈 화면에 추가하면 앱처럼 바로 열 수 있어요.</p>
              </div>
              <button className="modal-close" onClick={() => setShowInstallHelp(false)} aria-label="안내 닫기"><X aria-hidden="true" /></button>
            </div>
            <ol className="install-instructions">
              <li><span>1</span>브라우저 메뉴에서 '홈 화면에 추가' 또는 '앱 설치'를 선택하세요.</li>
              <li><span>2</span>설치가 보이지 않으면 HTTPS 주소에서 다시 열어 주세요.</li>
              <li><span>3</span>iPhone에서는 Safari의 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하세요.</li>
            </ol>
            <Button onClick={() => setShowInstallHelp(false)}>확인</Button>
          </section>
        </div>
      )}
    </div>
  );
}
