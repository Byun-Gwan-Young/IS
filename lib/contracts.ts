import { z } from "zod";

export const ideaRequestSchema = z.object({
  serviceName: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().min(20, "아이디어를 20자 이상 입력해 주세요.").max(2400),
  problem: z.string().trim().max(800).optional().default(""),
  features: z.string().trim().max(1200).optional().default(""),
  targetAudience: z.string().trim().max(500).optional().default(""),
  market: z.enum(["kr", "global", "international"]).default("kr"),
  inputSource: z.enum(["manual", "document", "github", "community"]).optional(),
  sourceLabel: z.string().trim().max(180).optional(),
});

export type IdeaRequest = z.infer<typeof ideaRequestSchema>;

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  query: z.string(),
});

export type EvidenceSource = z.infer<typeof sourceSchema>;

const confidenceSchema = z.enum(["evidence", "inference", "to_validate"]).catch("inference");

export const findingSchema = z.object({
  text: z.string().max(700).catch("").default(""),
  sourceIds: z.array(z.string()).max(12).catch([]).default([]),
  confidence: confidenceSchema.default("inference"),
});

const competitorSchema = z.object({
  name: z.string().trim().min(1).max(120).catch(""),
  websiteUrl: z.string().url().nullable().catch(null).default(null),
  overview: z.string().max(800).catch("").default(""),
  features: z.array(findingSchema).max(8).catch([]).default([]),
  strengths: z.array(findingSchema).max(6).catch([]).default([]),
  limitations: z.array(findingSchema).max(6).catch([]).default([]),
  similarity: z.string().max(600).catch("").default(""),
  differentiation: z.string().max(600).catch("").default(""),
  sourceIds: z.array(z.string()).max(12).catch([]).default([]),
});

const recommendationSchema = z.object({
  title: z.string().trim().min(1).max(160).catch(""),
  rationale: z.string().max(700).catch("").default(""),
  difficulty: z.enum(["low", "medium", "high"]).catch("medium").default("medium"),
  userValue: z.enum(["low", "medium", "high"]).catch("medium").default("medium"),
});

const reportAnalysisSchema = z.object({
  ideaSummary: z.object({
    problem: z.string().max(700).catch("").default(""),
    audience: z.string().max(500).catch("").default(""),
    valueProposition: z.string().max(700).catch("").default(""),
  }).default({ problem: "", audience: "", valueProposition: "" }).catch({ problem: "", audience: "", valueProposition: "" }),
  market: z.object({
    similarityLevel: z.enum(["high", "moderate", "limited", "undetermined"]).catch("undetermined").default("undetermined"),
    landscapeSummary: z.string().max(1000).catch("").default(""),
    observedSignals: z.array(findingSchema).max(8).catch([]).default([]),
    demandChecks: z.array(z.string().max(500)).max(8).catch([]).default([]),
  }).default({ similarityLevel: "undetermined", landscapeSummary: "", observedSignals: [], demandChecks: [] }).catch({ similarityLevel: "undetermined", landscapeSummary: "", observedSignals: [], demandChecks: [] }),
  overlap: z.object({
    summary: z.string().max(900).catch("").default(""),
    existingFeatures: z.array(findingSchema).max(8).catch([]).default([]),
    potentialGaps: z.array(findingSchema).max(8).catch([]).default([]),
  }).default({ summary: "", existingFeatures: [], potentialGaps: [] }).catch({ summary: "", existingFeatures: [], potentialGaps: [] }),
  competitors: z.array(competitorSchema).max(10).catch([]).default([]),
  differentiation: z.array(recommendationSchema).max(5).catch([]).default([]),
  mvp: z.object({
    firstFeature: z.string().max(700).catch("").default(""),
    laterFeatures: z.array(z.string().max(500)).max(8).catch([]).default([]),
    suggestedStack: z.array(z.string().max(120)).max(8).catch([]).default([]),
    implementationDirection: z.string().max(900).catch("").default(""),
  }).default({ firstFeature: "", laterFeatures: [], suggestedStack: [], implementationDirection: "" }).catch({ firstFeature: "", laterFeatures: [], suggestedStack: [], implementationDirection: "" }),
  analystNote: z.string().max(900).catch("").default(""),
});

export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;

export const analysisReportSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  input: ideaRequestSchema,
  keywords: z.array(z.string()),
  queries: z.array(z.string()),
  sources: z.array(sourceSchema),
  analysis: reportAnalysisSchema,
  warnings: z.array(z.string()),
});

export type AnalysisReport = z.infer<typeof analysisReportSchema>;

export const documentIdeaSchema = z.object({
  serviceName: z.string().max(100).catch(""),
  description: z.string().max(2400).catch(""),
  problem: z.string().max(800).catch(""),
  features: z.string().max(1200).catch(""),
  targetAudience: z.string().max(500).catch(""),
  market: z.enum(["kr", "global", "international"]).catch("kr"),
  extractionNote: z.string().max(300).catch(""),
});

export type DocumentIdea = z.infer<typeof documentIdeaSchema>;

export const repositoryCategorySchema = z.enum([
  "all",
  "ai",
  "web",
  "mobile",
  "developer",
  "automation",
  "productivity",
]);

export type RepositoryCategory = z.infer<typeof repositoryCategorySchema>;

export const repositorySearchSchema = z.object({
  keyword: z.string().trim().max(80).default(""),
  category: repositoryCategorySchema.default("all"),
  language: z.string().trim().max(40).default(""),
  minStars: z.coerce.number().int().min(0).max(1_000_000).default(100),
  createdWithin: z.enum(["any", "year", "90d", "30d"]).default("any"),
  updatedWithin: z.enum(["any", "30d", "7d"]).default("any"),
  sort: z.enum(["stars", "updated", "created"]).default("stars"),
});

export type RepositorySearch = z.infer<typeof repositorySearchSchema>;

export const githubRepositorySchema = z.object({
  id: z.number().int(),
  fullName: z.string(),
  name: z.string(),
  owner: z.string(),
  description: z.string().nullable(),
  htmlUrl: z.string().url(),
  stars: z.number().int().nonnegative(),
  language: z.string().nullable(),
  updatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime().nullable(),
  license: z.string().nullable(),
  topics: z.array(z.string()),
  defaultBranch: z.string().nullable(),
});

export type GithubRepository = z.infer<typeof githubRepositorySchema>;

export const generatedIdeaSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(20).max(800),
  problem: z.string().max(700).default(""),
  features: z.array(z.string().max(220)).max(6).default([]),
  targetAudience: z.string().max(300).default(""),
  differentiation: z.string().max(500).default(""),
  mvp: z.string().max(600).default(""),
  suggestedStack: z.array(z.string().max(80)).max(8).default([]),
});

export type GeneratedIdea = z.infer<typeof generatedIdeaSchema>;

export const githubIdeaPackSchema = z.object({
  repositorySummary: z.string().max(800),
  problemSolved: z.string().max(700),
  coreTechnology: z.array(z.string().max(180)).max(6).default([]),
  serviceAreas: z.array(z.string().max(160)).max(6).default([]),
  ideas: z.array(generatedIdeaSchema).length(3),
  openSourceNote: z.string().max(500),
});

export type GithubIdeaPack = z.infer<typeof githubIdeaPackSchema>;

export const communityCategorySchema = z.enum([
  "education",
  "work",
  "daily-life",
  "health",
  "finance",
  "creators",
  "accessibility",
  "other",
]);

export type CommunityCategory = z.infer<typeof communityCategorySchema>;

export const communityIdeaInputSchema = z.object({
  title: z.string().trim().min(4, "제목을 4자 이상 입력해 주세요.").max(100),
  discomfort: z.string().trim().min(8, "겪는 불편을 8자 이상 입력해 주세요.").max(1200),
  requestedFeature: z.string().trim().min(8, "원하는 서비스 기능을 8자 이상 입력해 주세요.").max(1200),
  targetUser: z.string().trim().max(300).default(""),
  category: communityCategorySchema.default("other"),
  isPublic: z.boolean().default(true),
});

export type CommunityIdeaInput = z.infer<typeof communityIdeaInputSchema>;

export const communityDuplicateSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(100),
  reason: z.string().max(300),
});

export const communityNormalizationSchema = z.object({
  normalizedTitle: z.string().min(1).max(100),
  problemSummary: z.string().max(500),
  audienceLabel: z.string().max(200),
  refinedFeature: z.string().max(500),
  similarIdeas: z.array(communityDuplicateSchema).max(5).default([]),
});

export type CommunityNormalization = z.infer<typeof communityNormalizationSchema>;

export const communityIdeaSchema = communityIdeaInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  normalizedTitle: z.string().optional().default(""),
  problemSummary: z.string().optional().default(""),
  audienceLabel: z.string().optional().default(""),
  refinedFeature: z.string().optional().default(""),
  aiAvailable: z.boolean().default(false),
  votes: z.number().int().nonnegative().default(0),
  hasVoted: z.boolean().default(false),
});

export type CommunityIdea = z.infer<typeof communityIdeaSchema>;

export const savedAnalysisSchema = z.object({
  savedAt: z.string(),
  report: analysisReportSchema,
});

export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>;

export const errorCodeSchema = z.enum([
  "INVALID_INPUT",
  "API_NOT_CONFIGURED",
  "RATE_LIMITED",
  "LLM_UPSTREAM",
  "TAVILY_UPSTREAM",
  "NO_RESULTS",
  "ANALYSIS_INVALID",
  "INTERNAL_ERROR",
]);

export type AnalysisErrorCode = z.infer<typeof errorCodeSchema>;

export const progressSteps = ["keywords", "search", "analysis"] as const;
export type ProgressStep = (typeof progressSteps)[number];

export type StreamEvent =
  | { type: "progress"; step: ProgressStep; message: string }
  | { type: "complete"; report: AnalysisReport }
  | { type: "error"; code: AnalysisErrorCode; message: string };

export function parseReportAnalysis(value: unknown) {
  return reportAnalysisSchema.safeParse(value);
}
