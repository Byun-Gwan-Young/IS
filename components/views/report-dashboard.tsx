"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Bookmark,
  Check,
  CircleHelp,
  ClipboardCopy,
  ExternalLink,
  FileSearch,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WandSparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnalysisReport, ReportAnalysis } from "@/lib/contracts";

export type ReportSection = "overview" | "competitors" | "strategy" | "sources";

interface ReportDashboardProps {
  report: AnalysisReport;
  section: ReportSection;
  setSection: (section: ReportSection) => void;
  isSaved: boolean;
  onSave: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onNew: () => void;
}

type Finding = ReportAnalysis["market"]["observedSignals"][number];

const sectionOptions: { id: ReportSection; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "요약", icon: BarChart3 },
  { id: "competitors", label: "경쟁 서비스", icon: FileSearch },
  { id: "strategy", label: "차별화 전략", icon: Lightbulb },
  { id: "sources", label: "참고 출처", icon: Link2 },
];

const confidenceNames = {
  evidence: "출처 확인",
  inference: "AI 분석 의견",
  to_validate: "추가 검증",
} as const;

const difficultyNames = { low: "낮음", medium: "보통", high: "높음" } as const;
const valueNames = { low: "보통", medium: "높음", high: "매우 높음" } as const;
const levelNames = { high: "유사 서비스 다수 확인", moderate: "일부 유사 서비스 확인", limited: "직접 유사성 제한적", undetermined: "판단할 근거 부족" } as const;

function titleFor(report: AnalysisReport) {
  return report.input.serviceName.trim() || report.input.description.trim().split(/[.!?\n]/)[0].slice(0, 48) || "아이디어 분석";
}

function sourceLabel(report: AnalysisReport) {
  if (report.input.inputSource === "document") return `문서 추출${report.input.sourceLabel ? ` · ${report.input.sourceLabel}` : ""}`;
  if (report.input.inputSource === "github") return `GitHub 아이디어${report.input.sourceLabel ? ` · ${report.input.sourceLabel}` : ""}`;
  if (report.input.inputSource === "community") return `커뮤니티 제안${report.input.sourceLabel ? ` · ${report.input.sourceLabel}` : ""}`;
  return "직접 입력";
}

function dateFor(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시각 정보 없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SourceChips({ ids, onSources }: { ids: string[]; onSources: () => void }) {
  if (!ids.length) return null;
  return (
    <>
      {ids.map((id) => <button type="button" className="source-chip" key={id} onClick={onSources}>{id}</button>)}
    </>
  );
}

function FindingList({ items, onSources, emptyText }: { items: Finding[]; onSources: () => void; emptyText: string }) {
  if (!items.length) return <div className="section-empty">{emptyText}</div>;
  return (
    <ul className="finding-list">
      {items.map((item, index) => (
        <li className="finding-item" key={`${item.text}-${index}`}>
          <span className="finding-bullet"><Check aria-hidden="true" /></span>
          <span className="finding-text">
            {item.text || "내용을 확인할 수 없습니다."}
            <span className="finding-foot">
              <span className={`claim-label claim-label--${item.confidence}`}>{confidenceNames[item.confidence]}</span>
              <SourceChips ids={item.sourceIds} onSources={onSources} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return <div className="section-empty">{children}</div>;
}

function OverviewSection({ report, onSection }: { report: AnalysisReport; onSection: (section: ReportSection) => void }) {
  const analysis = report.analysis;
  return (
    <div className="report-content">
      {report.warnings.map((warning) => (
        <div className="report-alert" role="note" key={warning}><CircleHelp aria-hidden="true" /><span>{warning}</span></div>
      ))}

      <section className="report-grid report-grid--three" aria-label="아이디어 요약">
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><Target aria-hidden="true" />해결하려는 문제</h2></div>
          <p className="summary-value">{analysis.ideaSummary.problem || report.input.problem || "입력한 설명에서 문제를 더 구체화할 필요가 있습니다."}</p>
        </article>
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><Users aria-hidden="true" />예상 사용자</h2></div>
          <p className="summary-value">{analysis.ideaSummary.audience || report.input.targetAudience || "예상 사용자를 추가로 정의해 보세요."}</p>
        </article>
        <article className="report-card report-card--tinted">
          <div className="report-card-head"><h2 className="report-card-title"><Sparkles aria-hidden="true" />핵심 가치 제안</h2></div>
          <p className="summary-value">{analysis.ideaSummary.valueProposition || "핵심 가치를 확정하기에는 입력 정보가 부족합니다."}</p>
        </article>
      </section>

      <section className="report-grid report-grid--two">
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><TrendingUp aria-hidden="true" />시장 현황</h2><Badge className="level-chip">{levelNames[analysis.market.similarityLevel]}</Badge></div>
          <p className="snapshot-summary">{analysis.market.landscapeSummary || "검색 출처만으로 시장 현황을 요약할 근거가 충분하지 않습니다."}</p>
          <div className="snapshot-stats">
            <span className="snapshot-chip"><FileSearch aria-hidden="true" />경쟁 서비스 {analysis.competitors.length}개</span>
            <span className="snapshot-chip"><Link2 aria-hidden="true" />검색 출처 {report.sources.length}개</span>
            <span className="snapshot-chip"><Search aria-hidden="true" />검색어 {report.queries.length}개</span>
          </div>
          <p className="report-footnote"><CircleHelp aria-hidden="true" />검색 결과는 공개 웹 페이지 기준입니다. 발견 수가 시장 규모나 실제 수요를 뜻하지 않습니다.</p>
        </article>
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><BarChart3 aria-hidden="true" />관찰 가능한 신호</h2></div>
          <FindingList
            items={analysis.market.observedSignals}
            onSources={() => onSection("sources")}
            emptyText="검색한 출처에서 시장 동향을 확인할 근거가 부족합니다. 직접 사용자 인터뷰와 검색량 확인이 필요합니다."
          />
        </article>
      </section>

      <section className="report-card">
        <div className="report-card-head">
          <div><h2 className="report-card-title"><FileSearch aria-hidden="true" />찾은 경쟁 서비스</h2><p className="field-hint">출처로 확인 가능한 서비스만 표시합니다.</p></div>
          {analysis.competitors.length > 0 && <button className="inline-link" onClick={() => onSection("competitors")}>비교 상세 보기<ArrowRight aria-hidden="true" /></button>}
        </div>
        {analysis.competitors.length === 0 ? (
          <EmptyCard>출처로 확인할 수 있는 경쟁 서비스가 없습니다. 검색 결과가 없다고 해서 시장에 서비스가 없다는 뜻은 아닙니다.</EmptyCard>
        ) : (
          <div className="preview-competitors">
            {analysis.competitors.slice(0, 3).map((competitor) => (
              <article className="preview-competitor" key={competitor.name}>
                <strong>{competitor.name}</strong>
                <p>{competitor.similarity || competitor.overview || "유사성을 더 검토할 근거가 필요합니다."}</p>
                <button className="inline-link" onClick={() => onSection("competitors")}>근거 {competitor.sourceIds.join(", ") || "확인"}<ArrowRight aria-hidden="true" /></button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="strategy-grid">
        <article className="mvp-highlight">
          <div className="report-card-head"><h2 className="report-card-title"><WandSparkles aria-hidden="true" />추천 MVP 첫 기능</h2></div>
          {analysis.mvp.firstFeature ? (
            <div className="mvp-feature"><span className="mvp-feature-mark"><Check aria-hidden="true" /></span><p>{analysis.mvp.firstFeature}</p></div>
          ) : <p>초기 기능을 추천할 근거가 충분하지 않습니다. 사용자 인터뷰를 통해 가장 큰 불편부터 확인해 보세요.</p>}
        </article>
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><ListChecks aria-hidden="true" />추가 검증 항목</h2></div>
          {analysis.market.demandChecks.length ? (
            <ul className="finding-list">
              {analysis.market.demandChecks.slice(0, 3).map((check, index) => <li className="finding-item" key={`${check}-${index}`}><span className="finding-bullet"><CircleHelp aria-hidden="true" /></span><span className="finding-text">{check}<span className="finding-foot"><span className="claim-label claim-label--to_validate">추가 검증 필요</span></span></span></li>)}
            </ul>
          ) : <EmptyCard>실제 수요는 검색만으로 확정할 수 없습니다. 잠재 사용자 인터뷰나 랜딩 페이지 테스트로 검증해 보세요.</EmptyCard>}
        </article>
      </section>
    </div>
  );
}

function CompetitorSection({ report, onSources }: { report: AnalysisReport; onSources: () => void }) {
  const competitors = report.analysis.competitors;
  if (!competitors.length) {
    return <div className="panel"><div className="empty-state"><div><div className="empty-icon"><FileSearch aria-hidden="true" /></div><h3>확인된 경쟁 서비스가 없습니다</h3><p>검색 결과가 없다는 이유만으로 시장에 유사 서비스가 없다고 판단할 수는 없습니다. 검색어를 바꾸거나 범위를 넓혀 다시 조사해 보세요.</p></div></div></div>;
  }

  return (
    <div className="report-content">
      <div className="competitor-intro">
        <p>각 서비스의 설명과 기능은 검색 근거에 기반합니다. 강점·한계 중 직접 확인되지 않은 내용은 'AI 분석 의견'으로 구분했습니다.</p>
        <span className="competitor-count">{competitors.length}개 확인</span>
      </div>
      <div className="comparison-desktop">
        <table className="comparison-table">
          <thead><tr><th>서비스</th><th>아이디어와 유사점</th><th>확인된 기능</th><th>차별화 관점</th><th>근거</th></tr></thead>
          <tbody>
            {competitors.map((competitor) => (
              <tr key={competitor.name}>
                <td>{competitor.name}<span className="table-subtext">{competitor.websiteUrl ? "공식 페이지 후보 확인" : "공식 사이트 확인 필요"}</span></td>
                <td>{competitor.similarity || "비교 근거가 부족합니다."}</td>
                <td>{competitor.features.length ? competitor.features.slice(0, 3).map((item) => item.text).filter(Boolean).join(" · ") : "확인된 기능 정보 없음"}</td>
                <td>{competitor.differentiation || "추가 분석이 필요합니다."}</td>
                <td><SourceChips ids={competitor.sourceIds} onSources={onSources} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="comparison-mobile">
        {competitors.map((competitor) => (
          <article className="comparison-mobile-card" key={competitor.name}>
            <h3>{competitor.name}</h3>
            <div className="comparison-mobile-row"><strong>유사점</strong><span>{competitor.similarity || "비교 근거가 부족합니다."}</span></div>
            <div className="comparison-mobile-row"><strong>확인된 기능</strong><span>{competitor.features.length ? competitor.features.slice(0, 3).map((item) => item.text).filter(Boolean).join(" · ") : "확인된 기능 정보 없음"}</span></div>
            <div className="comparison-mobile-row"><strong>차별화</strong><span>{competitor.differentiation || "추가 분석이 필요합니다."}</span></div>
          </article>
        ))}
      </div>
      <div className="competitor-stack">
        {competitors.map((competitor) => (
          <article className="competitor-card" key={`detail-${competitor.name}`}>
            <div className="competitor-card-head">
              <span className="competitor-avatar" aria-hidden="true">{competitor.name.trim().slice(0, 1).toUpperCase() || "?"}</span>
              <div className="competitor-main">
                <div className="competitor-name-row"><h3>{competitor.name}</h3><Badge><ShieldCheck size={12} aria-hidden="true" />검색 출처 {competitor.sourceIds.length}개</Badge></div>
                <p className="competitor-overview">{competitor.overview || "출처에 서비스 개요가 충분히 설명되어 있지 않습니다."}</p>
              </div>
              {competitor.websiteUrl && (
                <a className="competitor-web" href={competitor.websiteUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />사이트 보기</a>
              )}
            </div>
            <div className="competitor-details">
              <div className="competitor-detail"><h4><Check aria-hidden="true" />확인 가능한 기능</h4><FindingList items={competitor.features} onSources={onSources} emptyText="검색 출처에서 확인 가능한 기능 정보가 없습니다." /></div>
              <div className="competitor-detail"><h4><TrendingUp aria-hidden="true" />강점</h4><FindingList items={competitor.strengths} onSources={onSources} emptyText="강점을 판단할 근거가 부족합니다." /></div>
              <div className="competitor-detail"><h4><CircleHelp aria-hidden="true" />한계 또는 확인할 점</h4><FindingList items={competitor.limitations} onSources={onSources} emptyText="한계를 직접 확인할 근거가 없습니다. 사용성 테스트가 필요합니다." /></div>
              <div className="competitor-detail"><h4><Target aria-hidden="true" />아이디어와의 차이</h4><p>{competitor.differentiation || "현재 자료에서 구분되는 차별점을 확인하지 못했습니다."}</p></div>
            </div>
            <div className="competitor-similarity">
              <div className="similarity-note"><small>공통점</small><p>{competitor.similarity || "비교할 정보가 더 필요합니다."}</p></div>
              <div className="similarity-note"><small>근거 출처</small><p><SourceChips ids={competitor.sourceIds} onSources={onSources} /></p></div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StrategySection({ report, onSources }: { report: AnalysisReport; onSources: () => void }) {
  const analysis = report.analysis;
  return (
    <div className="report-content">
      <div className="report-card">
        <div className="report-card-head"><h2 className="report-card-title"><Target aria-hidden="true" />기존 서비스와 겹치는 부분</h2></div>
        <p className="snapshot-summary">{analysis.overlap.summary || "검색 결과만으로 공통 기능을 확정하기 어렵습니다."}</p>
        <div className="report-grid report-grid--two" style={{ marginTop: 15 }}>
          <div className="competitor-detail"><h4><Check aria-hidden="true" />이미 제공되는 기능</h4><FindingList items={analysis.overlap.existingFeatures} onSources={onSources} emptyText="확인된 중복 기능이 없습니다. 기능 부재를 뜻하는 것은 아닙니다." /></div>
          <div className="competitor-detail"><h4><Sparkles aria-hidden="true" />기회로 추정되는 부분</h4><FindingList items={analysis.overlap.potentialGaps} onSources={onSources} emptyText="차별화 공백을 추정할 근거가 부족합니다." /></div>
        </div>
      </div>

      <div>
        <div className="panel-heading"><div><h2>추천 차별화 기능</h2><p>가치는 가설이므로 잠재 사용자에게 먼저 확인해 보세요.</p></div></div>
        {analysis.differentiation.length ? (
          <div className="recommendation-grid">
            {analysis.differentiation.map((item, index) => (
              <article className="recommendation-card" key={`${item.title}-${index}`}>
                <span className="recommendation-number">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.rationale || "추천 이유를 판단할 구체적인 근거가 부족합니다."}</p>
                <div className="recommendation-meta">
                  <span><ListChecks aria-hidden="true" />난이도 {difficultyNames[item.difficulty]}</span>
                  <span><Target aria-hidden="true" />예상 가치 {valueNames[item.userValue]}</span>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="section-empty">차별화 기능을 추천할 근거가 부족합니다. 고객 인터뷰에서 불편한 지점을 먼저 확인해 보세요.</div>}
      </div>

      <div className="strategy-grid">
        <article className="mvp-highlight">
          <div className="report-card-head"><h2 className="report-card-title"><WandSparkles aria-hidden="true" />가장 먼저 만들 기능</h2></div>
          {analysis.mvp.firstFeature ? <div className="mvp-feature"><span className="mvp-feature-mark"><Check aria-hidden="true" /></span><p>{analysis.mvp.firstFeature}</p></div> : <p>우선 개발 기능을 정할 근거가 충분하지 않습니다.</p>}
          {analysis.mvp.implementationDirection && <p style={{ marginTop: 14 }}>{analysis.mvp.implementationDirection}</p>}
        </article>
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><ListChecks aria-hidden="true" />후순위 기능</h2></div>
          {analysis.mvp.laterFeatures.length ? (
            <ul className="finding-list">{analysis.mvp.laterFeatures.map((feature, index) => <li className="finding-item" key={`${feature}-${index}`}><span className="finding-bullet">{index + 1}</span><span className="finding-text">{feature}</span></li>)}</ul>
          ) : <EmptyCard>후순위 기능은 아직 정리되지 않았습니다.</EmptyCard>}
        </article>
      </div>

      <div className="report-grid report-grid--two">
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><FileText aria-hidden="true" />기술 제안</h2></div>
          {analysis.mvp.suggestedStack.length ? <div className="query-list">{analysis.mvp.suggestedStack.map((item) => <span className="query-item" key={item}>{item}</span>)}</div> : <EmptyCard>기술 스택을 정할 자료가 없습니다. 우선 기능 검증 후 결정해도 괜찮습니다.</EmptyCard>}
        </article>
        <article className="report-card">
          <div className="report-card-head"><h2 className="report-card-title"><CircleHelp aria-hidden="true" />수요 검증 체크리스트</h2></div>
          {analysis.market.demandChecks.length ? <ul className="finding-list">{analysis.market.demandChecks.map((item, index) => <li className="finding-item" key={`${item}-${index}`}><span className="finding-bullet"><CircleHelp aria-hidden="true" /></span><span className="finding-text">{item}<span className="finding-foot"><span className="claim-label claim-label--to_validate">가설 · 직접 확인 필요</span></span></span></li>)}</ul> : <EmptyCard>수요는 검색만으로 확인되지 않습니다. 잠재 사용자와의 대화나 간단한 사용성 테스트를 권장합니다.</EmptyCard>}
        </article>
      </div>
    </div>
  );
}

function SourcesSection({ report }: { report: AnalysisReport }) {
  return (
    <div className="report-content">
      <article className="report-card">
        <div className="report-card-head"><div><h2 className="report-card-title"><Link2 aria-hidden="true" />검색 출처</h2><p className="field-hint">분석 시각: {dateFor(report.createdAt)} · 검색된 페이지에서 근거를 직접 확인해 주세요.</p></div><Badge>{report.sources.length}개</Badge></div>
        {report.sources.length ? (
          <div className="source-list">
            {report.sources.map((source) => (
              <article className="source-item" key={source.id}>
                <span className="source-id">{source.id}</span>
                <div className="source-main">
                  <a href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink aria-hidden="true" /></a>
                  <p>{source.snippet || "검색 결과에 요약 문장이 없습니다."}</p>
                  <div className="source-meta"><span>검색어: {source.query}</span><span>{new URL(source.url).hostname}</span></div>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyCard>표시할 검색 출처가 없습니다.</EmptyCard>}
      </article>

      <article className="report-card">
        <div className="report-card-head"><h2 className="report-card-title"><Search aria-hidden="true" />사용한 검색어</h2></div>
        {report.queries.length ? <div className="query-list">{report.queries.map((query) => <span className="query-item" key={query}>{query}</span>)}</div> : <EmptyCard>검색어 정보가 없습니다.</EmptyCard>}
        <p className="report-footnote"><ShieldCheck aria-hidden="true" />웹 검색 결과는 전체 시장을 모두 보여주지 않을 수 있습니다. 검색 결과에 없는 서비스가 존재하지 않는다고 결론 내리지 마세요.</p>
      </article>
    </div>
  );
}

export function ReportDashboard({ report, section, setSection, isSaved, onSave, onCopy, onDownload, onNew }: ReportDashboardProps) {
  return (
    <div>
      <div className="report-head">
        <div className="report-head-copy">
          <div className="eyebrow"><Check aria-hidden="true" />MARKET SCAN COMPLETE</div>
          <h1>{titleFor(report)}</h1>
          <div className="report-meta">
            <span><FileSearch aria-hidden="true" />실제 웹 검색 기반</span>
            <span><Link2 aria-hidden="true" />출처 {report.sources.length}개</span>
            <span><FileText aria-hidden="true" />{sourceLabel(report)}</span>
            <span>{dateFor(report.createdAt)}</span>
          </div>
        </div>
        <div className="report-head-actions">
          <Button variant="secondary" size="sm" onClick={onSave} disabled={isSaved}><Bookmark size={14} aria-hidden="true" />{isSaved ? "저장됨" : "저장"}</Button>
          <Button variant="secondary" size="sm" onClick={onCopy}><ClipboardCopy size={14} aria-hidden="true" />복사</Button>
          <Button variant="secondary" size="sm" onClick={onDownload}><ArrowDownToLine size={14} aria-hidden="true" />다운로드</Button>
          <Button size="sm" onClick={onNew}><Sparkles size={14} aria-hidden="true" />새 분석</Button>
        </div>
      </div>

      <nav className="report-tabs" role="tablist" aria-label="분석 보고서 섹션">
        {sectionOptions.map(({ id, label, icon: Icon }) => (
          <button className={`report-tab ${section === id ? "is-active" : ""}`} type="button" role="tab" aria-selected={section === id} key={id} onClick={() => setSection(id)}>
            <Icon aria-hidden="true" />{label}
          </button>
        ))}
      </nav>

      {section === "overview" && <OverviewSection report={report} onSection={setSection} />}
      {section === "competitors" && <CompetitorSection report={report} onSources={() => setSection("sources")} />}
      {section === "strategy" && <StrategySection report={report} onSources={() => setSection("sources")} />}
      {section === "sources" && <SourcesSection report={report} />}

      {report.analysis.analystNote && <p className="report-footnote"><CircleHelp aria-hidden="true" />{report.analysis.analystNote}</p>}
    </div>
  );
}
