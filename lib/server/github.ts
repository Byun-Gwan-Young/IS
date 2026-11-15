import { githubRepositorySchema, type GithubRepository, type RepositorySearch } from "@/lib/contracts";

export interface MappedGithubSearch {
  repositories: GithubRepository[];
  totalCount: number;
  incompleteResults: boolean;
}

export function dateDaysAgo(days: number, now = Date.now()) {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function safeKeyword(value: string) {
  return value.replace(/[^\p{L}\p{N}\s._+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function categoryQualifier(category: RepositorySearch["category"]) {
  switch (category) {
    case "ai": return "(topic:artificial-intelligence OR topic:machine-learning)";
    case "web": return "(topic:webapp OR topic:web-application)";
    case "mobile": return "(topic:mobile OR topic:android OR topic:ios)";
    case "developer": return "topic:developer-tools";
    case "automation": return "topic:automation";
    case "productivity": return "topic:productivity";
    default: return "";
  }
}

export function buildGithubSearchQuery(filters: RepositorySearch, now = Date.now()) {
  const queryParts = [safeKeyword(filters.keyword), categoryQualifier(filters.category), `stars:>=${filters.minStars}`, "is:public", "fork:false"]
    .filter(Boolean);
  if (filters.language) {
    const language = filters.language.replace(/[^\p{L}\p{N}+#.-]/gu, "").slice(0, 40);
    if (language) queryParts.push(`language:${language}`);
  }
  if (filters.createdWithin === "year") queryParts.push(`created:>=${dateDaysAgo(365, now)}`);
  if (filters.createdWithin === "90d") queryParts.push(`created:>=${dateDaysAgo(90, now)}`);
  if (filters.createdWithin === "30d") queryParts.push(`created:>=${dateDaysAgo(30, now)}`);
  if (filters.updatedWithin === "30d") queryParts.push(`pushed:>=${dateDaysAgo(30, now)}`);
  if (filters.updatedWithin === "7d") queryParts.push(`pushed:>=${dateDaysAgo(7, now)}`);

  // Search/repositories does not offer a created sort; re-sort its star-ranked result page locally.
  const apiSort = filters.sort === "created" ? "stars" : filters.sort;
  return { query: queryParts.join(" "), apiSort };
}

export function mapGithubRepository(item: unknown): GithubRepository | null {
  if (!item || typeof item !== "object") return null;
  const repo = item as Record<string, unknown>;
  const owner = repo.owner && typeof repo.owner === "object" && "login" in repo.owner ? String(repo.owner.login) : "";
  const license = repo.license && typeof repo.license === "object" ? repo.license as Record<string, unknown> : null;
  const mapped = githubRepositorySchema.safeParse({
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    owner,
    description: typeof repo.description === "string" ? repo.description : null,
    htmlUrl: repo.html_url,
    stars: repo.stargazers_count,
    language: typeof repo.language === "string" ? repo.language : null,
    updatedAt: typeof repo.updated_at === "string" ? repo.updated_at : null,
    createdAt: typeof repo.created_at === "string" ? repo.created_at : null,
    license: typeof license?.spdx_id === "string" && license.spdx_id !== "NOASSERTION"
      ? license.spdx_id
      : typeof license?.name === "string" ? license.name : null,
    topics: Array.isArray(repo.topics) ? repo.topics.filter((topic): topic is string => typeof topic === "string") : [],
    defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : null,
  });
  return mapped.success ? mapped.data : null;
}

export function mapGithubSearchResponse(payload: unknown, sort: RepositorySearch["sort"]): MappedGithubSearch | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.items)) return null;
  let repositories = body.items.flatMap((item) => {
    const repository = mapGithubRepository(item);
    return repository ? [repository] : [];
  });
  if (sort === "created") {
    repositories = repositories.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  return {
    repositories,
    totalCount: typeof body.total_count === "number" ? body.total_count : repositories.length,
    incompleteResults: Boolean(body.incomplete_results),
  };
}
