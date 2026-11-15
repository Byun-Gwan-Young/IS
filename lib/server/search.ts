import type { EvidenceSource } from "@/lib/contracts";

export interface RawSearchResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
}

export interface SearchResultWithQuery {
  result: RawSearchResult;
  query: string;
}

export function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    const normalized = url.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return null;
  }
}

export function dedupeSearchResults(results: SearchResultWithQuery[], limit = 18): EvidenceSource[] {
  const seen = new Set<string>();
  const sources: EvidenceSource[] = [];

  for (const item of results) {
    const title = typeof item.result.title === "string" ? item.result.title.trim() : "";
    const rawUrl = typeof item.result.url === "string" ? item.result.url.trim() : "";
    const url = normalizeUrl(rawUrl);
    const snippet = typeof item.result.content === "string" ? item.result.content.trim() : "";
    if (!url || !title || !snippet || seen.has(url)) continue;

    seen.add(url);
    sources.push({
      id: `S${sources.length + 1}`,
      title: title.slice(0, 220),
      url,
      snippet: snippet.slice(0, 900),
      query: item.query,
    });
    if (sources.length >= limit) break;
  }

  return sources;
}

function comparableText(value: string) {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function isLikelyServicePage(source: EvidenceSource) {
  const pathname = new URL(source.url).pathname.toLowerCase();
  if (/\.(pdf|docx?|pptx?)$/i.test(pathname)) return false;
  return !/(?:^|\/)(?:blog|news|article|articles|terms|glossary|journal|research|whitepapers?|insights)(?:\/|$)/i.test(pathname);
}

export function keepGroundedCompetitors<T extends { sourceIds: string[]; websiteUrl?: string | null }>(
  competitors: T[],
  sources: EvidenceSource[],
) {
  const sourceIds = new Set(sources.map((source) => source.id));
  const knownUrls = new Set(sources.map((source) => normalizeUrl(source.url)).filter(Boolean));

  return competitors.flatMap((competitor) => {
    const groundedIds = [...new Set(competitor.sourceIds)].filter((id) => {
      if (!sourceIds.has(id)) return false;
      const source = sources.find((item) => item.id === id);
      if (!source || !isLikelyServicePage(source)) return false;
      const name = comparableText("name" in competitor && typeof competitor.name === "string" ? competitor.name : "");
      const evidence = comparableText(`${source.title} ${source.url} ${source.snippet}`);
      return name.length >= 2 && evidence.includes(name);
    });
    if (!groundedIds.length) return [];

    const website = competitor.websiteUrl ? normalizeUrl(competitor.websiteUrl) : null;
    return [{
      ...competitor,
      sourceIds: groundedIds,
      websiteUrl: website && knownUrls.has(website) ? website : null,
    }];
  });
}
