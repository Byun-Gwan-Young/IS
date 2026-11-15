import {
  ArrowRight,
  Bookmark,
  FileSearch,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisReport, SavedAnalysis } from "@/lib/contracts";

interface SavedViewProps {
  saved: SavedAnalysis[];
  onOpen: (item: SavedAnalysis) => void;
  onDelete: (reportId: string) => void;
  onNew: () => void;
}

function titleFor(report: AnalysisReport) {
  return report.input.serviceName.trim() || report.input.description.trim().split(/[.!?\n]/)[0].slice(0, 48) || "아이디어 분석";
}

function dateFor(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "저장 날짜 없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const marketNames = { kr: "국내 시장", international: "해외 시장", global: "전체 시장" } as const;

export function SavedView({ saved, onOpen, onDelete, onNew }: SavedViewProps) {
  return (
    <div>
      <div className="saved-heading">
        <div>
          <div className="eyebrow"><Bookmark aria-hidden="true" />LOCAL REPORT LIBRARY</div>
          <h1 className="page-title">저장한 분석</h1>
          <p className="page-subtitle">이 브라우저에 보관된 보고서 {saved.length}개입니다. 다른 기기에서는 보이지 않으니 필요하면 파일로 내려받아 주세요.</p>
        </div>
        <Button onClick={onNew}><Plus size={16} aria-hidden="true" />새 분석</Button>
      </div>

      {saved.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div>
              <div className="empty-icon"><FileSearch aria-hidden="true" /></div>
              <h3>아직 저장된 분석이 없습니다</h3>
              <p>아이디어를 분석한 뒤 보고서 화면에서 저장을 눌러 보관할 수 있어요.</p>
              <Button className="mt-4" onClick={onNew}><Plus size={15} aria-hidden="true" />첫 분석 시작하기</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="saved-grid">
          {saved.map((item) => (
            <article className="saved-card" key={item.report.id}>
              <div className="saved-card-top">
                <div className="saved-card-heading">
                  <span className="recent-item-icon"><FileSearch aria-hidden="true" /></span>
                  <div className="saved-card-title">
                    <h3>{titleFor(item.report)}</h3>
                    <p>{marketNames[item.report.input.market]} · {dateFor(item.savedAt)}</p>
                  </div>
                </div>
                <button className="saved-delete" onClick={() => onDelete(item.report.id)} aria-label={`${titleFor(item.report)} 분석 삭제`}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
              <p className="saved-card-summary">{item.report.analysis.market.landscapeSummary || item.report.analysis.ideaSummary.valueProposition || "검색 출처를 바탕으로 만든 시장 조사 보고서입니다."}</p>
              <div className="saved-card-bottom">
                <span>출처 {item.report.sources.length}개 · 경쟁 서비스 {item.report.analysis.competitors.length}개</span>
                <button className="inline-link" onClick={() => onOpen(item)}>보고서 열기<ArrowRight aria-hidden="true" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
