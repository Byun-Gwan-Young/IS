import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  FileSearch,
  Github,
  Globe2,
  LockKeyhole,
  MessageSquareText,
  SearchCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisReport, SavedAnalysis } from "@/lib/contracts";

interface HomeViewProps {
  saved: SavedAnalysis[];
  onNew: () => void;
  onOpen: (item: SavedAnalysis) => void;
  onSaved: () => void;
  onDiscover: () => void;
  onCommunity: () => void;
}

function titleFor(report: AnalysisReport) {
  return report.input.serviceName.trim() || report.input.description.trim().split(/[.!?\n]/)[0].slice(0, 48) || "아이디어 분석";
}

function dateFor(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "저장 날짜 없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

export function HomeView({ saved, onNew, onOpen, onSaved, onDiscover, onCommunity }: HomeViewProps) {
  return (
    <div className="home-view">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="hero-kicker"><Sparkles aria-hidden="true" />IDEA VALIDATION WORKSPACE</div>
          <h1 className="hero-title">아이디어를<br />만들기 전에,<br /><span>시장부터<br className="hero-mobile-break" /> 확인하세요.</span></h1>
          <p className="hero-description">
            아이디어를 입력하면 실제 웹 검색으로 유사 서비스를 찾고, 확인된 출처를 바탕으로 경쟁 포인트와 다음 개발 단계를 정리해 드립니다.
          </p>
          <div className="hero-actions">
            <Button onClick={onNew}>
              아이디어 분석 시작하기 <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <Button variant="secondary" onClick={onDiscover}><Github size={15} aria-hidden="true" />GitHub에서 발견</Button>
            {saved.length > 0 && (
              <Button variant="secondary" onClick={onSaved}>
                <Bookmark size={15} aria-hidden="true" />저장한 분석 {saved.length}개
              </Button>
            )}
          </div>
          <div className="hero-meta">
            <span><Check aria-hidden="true" />웹 검색 출처 표시</span>
            <span><LockKeyhole aria-hidden="true" />브라우저에만 저장</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-orbit" />
          <div className="visual-center"><SearchCheck /></div>
          <div className="visual-node visual-node--one"><Globe2 />실시간 검색</div>
          <div className="visual-node visual-node--two"><FileSearch />경쟁 비교</div>
          <div className="visual-node visual-node--three"><Target />차별화 전략</div>
          <div className="visual-node visual-node--four"><Bookmark />내 보고서</div>
          <span className="visual-dot visual-dot--one" />
          <span className="visual-dot visual-dot--two" />
        </div>
      </section>

      <section className="home-feature-grid" aria-label="주요 기능">
        <article className="feature-card">
          <div className="feature-icon"><Globe2 aria-hidden="true" /></div>
          <h3>실시간 웹 검색</h3>
          <p>Tavily 검색으로 찾은 출처와 검색 시점을 함께 보여줍니다.</p>
        </article>
        <article className="feature-card">
          <div className="feature-icon"><Target aria-hidden="true" /></div>
          <h3>근거 중심 분석</h3>
          <p>확인된 정보와 AI의 해석, 추가 검증 항목을 구분합니다.</p>
        </article>
        <article className="feature-card">
          <div className="feature-icon"><LockKeyhole aria-hidden="true" /></div>
          <h3>내 브라우저에 저장</h3>
          <p>계정 없이 저장하고 다시 열거나 Markdown으로 내려받으세요.</p>
        </article>
      </section>

      <section className="home-entry-grid" aria-label="아이디어 시작 방법">
        <button className="home-entry-card" onClick={onDiscover}><span className="feature-icon"><Github aria-hidden="true" /></span><span><strong>오픈소스에서 영감 찾기</strong><small>실제 GitHub 저장소를 살펴보고 확장 아이디어를 받아보세요.</small></span><ArrowRight aria-hidden="true" /></button>
        <button className="home-entry-card" onClick={onCommunity}><span className="feature-icon"><MessageSquareText aria-hidden="true" /></span><span><strong>사람들의 불편에서 시작하기</strong><small>필요한 서비스 제안을 확인하고 공감이나 시장 분석에 참여하세요.</small></span><ArrowRight aria-hidden="true" /></button>
      </section>

      <section className="home-lower-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>최근 분석</h2>
              <p>이 브라우저에 저장한 아이디어 보고서입니다.</p>
            </div>
            {saved.length > 0 && <button className="text-button" onClick={onSaved}>전체 보기<ArrowUpRight aria-hidden="true" /></button>}
          </div>
          {saved.length === 0 ? (
            <div className="empty-state">
              <div>
                <div className="empty-icon"><Bookmark aria-hidden="true" /></div>
                <h3>아직 저장한 분석이 없습니다</h3>
                <p>첫 아이디어를 분석한 뒤 저장하면 이곳에서 다시 확인할 수 있어요.</p>
              </div>
            </div>
          ) : (
            <div className="recent-list">
              {saved.slice(0, 4).map((item) => (
                <button className="recent-item" key={item.report.id} onClick={() => onOpen(item)}>
                  <span className="recent-item-icon"><FileSearch aria-hidden="true" /></span>
                  <span className="recent-item-copy">
                    <strong>{titleFor(item.report)}</strong>
                    <small>{dateFor(item.savedAt)} · 출처 {item.report.sources.length}개</small>
                  </span>
                  <ArrowRight className="recent-arrow" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><h2>분석은 이렇게 진행돼요</h2><p>검색 근거부터 MVP 방향까지 한 번에 살펴봅니다.</p></div>
          </div>
          <ol className="steps-list">
            <li><span className="step-number">01</span><div><strong>아이디어 입력</strong><small>문제, 핵심 기능, 예상 사용자를 적어요.</small></div></li>
            <li><span className="step-number">02</span><div><strong>시장 검색</strong><small>한국어와 영어 검색어로 웹 출처를 모아요.</small></div></li>
            <li><span className="step-number">03</span><div><strong>분석과 저장</strong><small>경쟁 서비스, 차별화와 MVP를 보고서로 확인해요.</small></div></li>
          </ol>
        </div>
      </section>

      <p className="report-footnote"><LockKeyhole aria-hidden="true" />분석 결과는 시장 조사 참고 자료입니다. 검색된 정보의 최신성·정확성을 출처에서 직접 확인하고, 실제 사용자 수요는 인터뷰나 테스트로 검증해 주세요.</p>
    </div>
  );
}
