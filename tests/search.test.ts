import assert from "node:assert/strict";
import test from "node:test";
import { dedupeSearchResults, keepGroundedCompetitors, normalizeUrl } from "../lib/server/search";
import { readJsonObject } from "../lib/server/json";

test("normalizes tracking parameters and fragments", () => {
  assert.equal(normalizeUrl("https://Example.com/product/?utm_source=test#pricing"), "https://example.com/product");
});

test("keeps only unique valid search results", () => {
  const sources = dedupeSearchResults([
    { query: "first", result: { title: "One", url: "https://example.com/?utm_source=a", content: "Evidence A" } },
    { query: "second", result: { title: "Duplicate", url: "https://example.com/", content: "Evidence B" } },
    { query: "second", result: { title: "Two", url: "javascript:alert(1)", content: "Ignored" } },
    { query: "third", result: { title: "Three", url: "https://other.example/page", content: "Evidence C" } },
  ]);

  assert.equal(sources.length, 2);
  assert.equal(sources[0].id, "S1");
  assert.equal(sources[1].title, "Three");
});

test("drops competitors without valid evidence and rejects unverified links", () => {
  const sources = [{ id: "S1", title: "Supported", url: "https://example.com/about", snippet: "Supported service", query: "query" }];
  const result = keepGroundedCompetitors([
    { name: "Supported", sourceIds: ["S1", "S99"], websiteUrl: "https://invented.example" },
    { name: "Unsupported", sourceIds: ["S99"], websiteUrl: null },
  ], sources);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].sourceIds, ["S1"]);
  assert.equal(result[0].websiteUrl, null);
});

test("drops a cited competitor when its name is absent from the cited evidence", () => {
  const sources = [{ id: "S1", title: "A different product", url: "https://example.com/about", snippet: "A market overview", query: "query" }];
  const result = keepGroundedCompetitors([
    { name: "Invented Product", sourceIds: ["S1"], websiteUrl: null },
  ], sources);

  assert.equal(result.length, 0);
});

test("does not count glossary pages as competitor product evidence", () => {
  const sources = [{ id: "S1", title: "AI student feedback | FlowHunt", url: "https://flowhunt.io/ko/terms/ai-based-student-feedback", snippet: "FlowHunt explains AI-based student feedback as a category.", query: "query" }];
  const result = keepGroundedCompetitors([
    { name: "FlowHunt", sourceIds: ["S1"], websiteUrl: "https://flowhunt.io/ko/terms/ai-based-student-feedback" },
  ], sources);

  assert.equal(result.length, 0);
});

test("extracts JSON wrapped in a markdown fence", () => {
  assert.deepEqual(readJsonObject("```json\n{\"ready\":true}\n```"), { ready: true });
});

test("repairs a truncated model JSON response", () => {
  assert.deepEqual(readJsonObject('{"title":"Idea","items":["one"'), { title: "Idea", items: ["one"] });
});
