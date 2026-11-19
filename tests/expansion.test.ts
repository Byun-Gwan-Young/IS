import assert from "node:assert/strict";
import test from "node:test";
import { filterCommunityIdeas } from "../lib/community-utils";
import { extractDocumentText, identifyDocument, readMultipartDocument, validateDocxContainer } from "../lib/server/documents";
import { buildGithubSearchQuery, mapGithubRepository, mapGithubSearchResponse } from "../lib/server/github";
import { communityIdeaInputSchema, repositorySearchSchema } from "../lib/contracts";

test("recognizes file extensions and validates real document signatures", () => {
  assert.equal(identifyDocument("idea.PDF", Buffer.from("%PDF-1.7\n")), "pdf");
  assert.equal(identifyDocument("idea.pdf", Buffer.from("not a pdf")), null);
  assert.equal(identifyDocument("ideas.txt", Buffer.from("A UTF-8 market idea for students")), "txt");
  assert.equal(identifyDocument("ideas.txt", Buffer.from([0xff, 0xfe, 0x00])), null);
  assert.equal(identifyDocument("notes.md", Buffer.from("# Service idea\nUseful markdown")), "md");
  assert.equal(identifyDocument("image.exe", Buffer.from("MZ")), null);
});

test("rejects invalid DOCX containers and extracts UTF-8 text", async () => {
  assert.equal(validateDocxContainer(Buffer.from("PK\u0003\u0004")), false);
  const extracted = await extractDocumentText("txt", Buffer.from("A service for students who need a faster way to review lecture notes.", "utf8"));
  assert.match(extracted.text, /students/);
  assert.equal(extracted.truncated, false);
});

test("reads exactly one streamed multipart document file", async () => {
  const form = new FormData();
  form.set("file", new Blob(["A text document for validating streamed multipart upload parsing."], { type: "text/plain" }), "idea.txt");
  const request = new Request("https://example.test/api/documents/extract", { method: "POST", body: form });
  const uploaded = await readMultipartDocument(request);

  assert.equal(uploaded.name, "idea.txt");
  assert.match(uploaded.buffer.toString("utf8"), /multipart upload/);
});

test("builds bounded GitHub Repository Search API filters", () => {
  const filters = repositorySearchSchema.parse({
    keyword: "AI <script> study assistant",
    category: "ai",
    language: "TypeScript",
    minStars: 500,
    createdWithin: "90d",
    updatedWithin: "7d",
    sort: "created",
  });
  const result = buildGithubSearchQuery(filters, Date.parse("2026-01-01T00:00:00Z"));

  assert.equal(result.apiSort, "stars");
  assert.match(result.query, /topic:artificial-intelligence/);
  assert.match(result.query, /stars:>=500/);
  assert.match(result.query, /language:TypeScript/);
  assert.match(result.query, /created:>=2025-10-03/);
  assert.match(result.query, /pushed:>=2025-12-25/);
  assert.doesNotMatch(result.query, /<script>/);
});

test("maps only GitHub fields and keeps unavailable metadata empty", () => {
  const repository = mapGithubRepository({
    id: 123,
    full_name: "example/study-helper",
    name: "study-helper",
    owner: { login: "example" },
    description: "Lecture notes helper",
    html_url: "https://github.com/example/study-helper",
    stargazers_count: 1234,
    language: "TypeScript",
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2025-12-01T00:00:00Z",
    license: null,
    topics: ["education"],
    default_branch: "main",
  });
  assert.equal(repository?.stars, 1234);
  assert.equal(repository?.license, null);
  assert.equal(mapGithubRepository({ id: 1 }), null);

  const search = mapGithubSearchResponse({ total_count: 2, incomplete_results: false, items: [
    { id: 1, full_name: "org/old", name: "old", owner: { login: "org" }, html_url: "https://github.com/org/old", stargazers_count: 99, created_at: "2024-01-01T00:00:00Z" },
    { id: 2, full_name: "org/new", name: "new", owner: { login: "org" }, html_url: "https://github.com/org/new", stargazers_count: 10, created_at: "2025-12-01T00:00:00Z" },
  ] }, "created");
  assert.equal(search?.totalCount, 2);
  assert.equal(search?.repositories[0].fullName, "org/new");
});

test("filters, searches, and sorts only visible community proposals", () => {
  const fields = {
    discomfort: "Lecture notes are hard to review",
    requestedFeature: "Summaries and quizzes from notes",
    targetUser: "Students",
  };
  const ideas = [
    { id: "public-old", ...fields, title: "Old public", category: "education" as const, isPublic: true, isMine: false, votes: 3, createdAt: "2025-01-01T00:00:00Z" },
    { id: "private-other", ...fields, title: "Secret", category: "education" as const, isPublic: false, isMine: false, votes: 100, createdAt: "2026-01-01T00:00:00Z" },
    { id: "private-mine", ...fields, title: "My private", category: "education" as const, isPublic: false, isMine: true, votes: 0, createdAt: "2024-01-01T00:00:00Z" },
    { id: "public-voted", ...fields, title: "Popular public", category: "work" as const, isPublic: true, isMine: false, votes: 8, createdAt: "2024-01-01T00:00:00Z" },
  ];

  assert.deepEqual(filterCommunityIdeas(ideas, { category: "education" }).map((idea) => idea.id), ["public-old", "private-mine"]);
  assert.deepEqual(filterCommunityIdeas(ideas, { query: "popular", sort: "votes" }).map((idea) => idea.id), ["public-voted"]);
  assert.deepEqual(filterCommunityIdeas(ideas, { sort: "votes" }).map((idea) => idea.id), ["public-voted", "public-old", "private-mine"]);
});

test("validates idea board content and prevents too-short requests", () => {
  assert.equal(communityIdeaInputSchema.safeParse({
    title: "Students need a study helper",
    discomfort: "Reviewing lecture notes takes too long during exam week.",
    requestedFeature: "Summarize the notes and generate practice questions.",
    targetUser: "University students",
    category: "education",
    isPublic: true,
  }).success, true);
  assert.equal(communityIdeaInputSchema.safeParse({ title: "x", discomfort: "bad", requestedFeature: "bad" }).success, false);
});
