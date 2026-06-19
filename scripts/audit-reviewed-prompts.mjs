import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import promptPlan from "../src/data/comic-prompts.json" with { type: "json" };

const INTERPRETATIONS_DIR = path.join("src", "data", "interpretations");
const errors = [];
const warnings = [];

const panelById = new Map();
for (const chapter of promptPlan.chapters || []) {
  for (const panel of chapter.panels || []) {
    panelById.set(panel.id, panel);
  }
}

const stopwords = new Set([
  "the",
  "and",
  "with",
  "while",
  "into",
  "from",
  "show",
  "showing",
  "must",
  "main",
  "subject",
  "ordinary",
  "generic",
  "clear",
  "simple",
  "calm",
  "true",
  "real",
  "thing",
  "things",
  "people",
  "person"
]);

function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopwords.has(token));
}

function tokenHits(anchor, haystack) {
  const haystackTokens = new Set(tokens(haystack));
  return [...new Set(tokens(anchor))].filter((token) => haystackTokens.has(token));
}

function short(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 120);
}

const files = (await readdir(INTERPRETATIONS_DIR)).filter((file) => file.endsWith(".json")).sort();
let reviewedPanels = 0;

for (const file of files) {
  const review = JSON.parse(await readFile(path.join(INTERPRETATIONS_DIR, file), "utf8"));
  for (const entry of review.entries || []) {
    reviewedPanels += 1;
    const panel = panelById.get(entry.id);
    if (!panel) {
      errors.push(`${entry.id} has reviewed interpretation but no comic prompt panel`);
      continue;
    }

    const promptText = [panel.scenePrompt, panel.prompt, panel.dreaminaPrompt].filter(Boolean).join(" ");
    const mustShow = entry.imageSemantics?.mustShow || [];
    const matchedAnchors = mustShow.filter((anchor) => tokenHits(anchor, promptText).length >= 2);
    if (matchedAnchors.length < Math.min(2, mustShow.length)) {
      errors.push(
        `${entry.id} prompt does not carry enough mustShow anchors. Matched ${matchedAnchors.length}/${mustShow.length}. Prompt: ${short(promptText)}`
      );
    }

    const mustNotShow = entry.imageSemantics?.mustNotShow || [];
    const conflicting = mustNotShow.filter((anchor) => tokenHits(anchor, promptText).length >= 3);
    if (conflicting.length) {
      warnings.push(`${entry.id} prompt may contain a mustNotShow idea: ${conflicting.join(" | ")}`);
    }

    if (!/no (text|readable writing|readable letters|captions)/i.test(promptText)) {
      errors.push(`${entry.id} prompt does not forbid readable text`);
    }
    if (!/16:9/i.test(promptText)) {
      errors.push(`${entry.id} prompt does not specify 16:9`);
    }
  }
}

if (warnings.length) {
  console.warn(warnings.join("\n"));
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Audited ${reviewedPanels} reviewed comic prompt panel(s).`);
