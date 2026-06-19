import fs from "node:fs";
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const file = process.argv[2] || "src/data/comic-prompts.json";
const plan = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];

const requiredPanelFields = [
  "id",
  "sentence",
  "beat",
  "currentMeaning",
  "primarySubject",
  "setting",
  "action",
  "foregroundObject",
  "camera",
  "colorAccent",
  "scenePrompt",
  "prompt"
];

const cjkPattern = /[\u3400-\u9fff]/;

const stopwords = new Set([
  "the",
  "and",
  "with",
  "into",
  "from",
  "that",
  "this",
  "while",
  "where",
  "panel",
  "scene",
  "young",
  "seeker",
  "elder",
  "guide",
  "warm",
  "ink",
  "watercolor",
  "comic",
  "style",
  "visual",
  "anchor",
  "sentence",
  "ancient",
  "chinese",
  "world",
  "modern",
  "objects"
]);

function tokens(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stopwords.has(token))
  );
}

function jaccard(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
}

function findChapter(number) {
  return data.chapters.find((chapter) => chapter.chapter === number);
}

function assertUnique(chapter, field) {
  const seen = new Map();
  for (const panel of chapter.panels) {
    const value = panel[field];
    if (!seen.has(value)) seen.set(value, []);
    seen.get(value).push(panel.id);
  }
  for (const [value, ids] of seen) {
    if (ids.length > 1) errors.push(`Chapter ${chapter.chapter} repeats ${field} in ${ids.join(", ")}: ${value}`);
  }
}

for (const chapterPlan of plan.chapters || []) {
  const chapter = findChapter(chapterPlan.chapter);
  if (!chapter) {
    errors.push(`Unknown chapter ${chapterPlan.chapter}`);
    continue;
  }

  if (chapterPlan.panels.length !== chapter.sentences.length) {
    errors.push(`Chapter ${chapterPlan.chapter} panel count mismatch: ${chapterPlan.panels.length} vs ${chapter.sentences.length}`);
  }

  assertUnique(chapterPlan, "primarySubject");
  assertUnique(chapterPlan, "setting");
  assertUnique(chapterPlan, "foregroundObject");
  assertUnique(chapterPlan, "camera");
  assertUnique(chapterPlan, "colorAccent");

  chapterPlan.panels.forEach((panel, index) => {
    for (const field of requiredPanelFields) {
      if (!panel[field]) errors.push(`${panel.id || `chapter ${chapterPlan.chapter} panel ${index + 1}`} missing ${field}`);
    }

    const expected = chapter.sentences[index];
    if (!expected) return;
    if (panel.id !== expected.id) errors.push(`Panel order mismatch at chapter ${chapterPlan.chapter} #${index + 1}: ${panel.id} vs ${expected.id}`);
    if (panel.sentence !== expected.sentence) errors.push(`${panel.id} sentence mismatch: ${panel.sentence} vs ${expected.sentence}`);

    if (/text|letters|Chinese characters|calligraphy/i.test(panel.scenePrompt)) {
      errors.push(`${panel.id} scenePrompt asks for text-like content: ${panel.scenePrompt}`);
    }
    if (!/Original sentence:/.test(panel.prompt)) errors.push(`${panel.id} prompt must include original sentence context`);
    if (!/Story beat:/.test(panel.prompt)) errors.push(`${panel.id} prompt must include story beat`);
    if (!/Strict negative instruction:/.test(panel.prompt)) errors.push(`${panel.id} prompt must include negative instruction`);

    if (panel.dreaminaPrompt) {
      if (panel.dreaminaPrompt.length > 1150) {
        errors.push(`${panel.id} dreaminaPrompt is too long: ${panel.dreaminaPrompt.length}`);
      }
      if (cjkPattern.test(panel.dreaminaPrompt)) {
        errors.push(`${panel.id} dreaminaPrompt should not contain Chinese text`);
      }
      if (!/16:9/i.test(panel.dreaminaPrompt)) errors.push(`${panel.id} dreaminaPrompt must include 16:9`);
      if (!/ink-and-watercolor/i.test(panel.dreaminaPrompt)) {
        errors.push(`${panel.id} dreaminaPrompt must include the locked ink-and-watercolor style`);
      }
      if (!/no (text|readable writing|readable letters|captions)/i.test(panel.dreaminaPrompt)) {
        errors.push(`${panel.id} dreaminaPrompt must forbid text`);
      }
    }
  });

  for (let index = 1; index < chapterPlan.panels.length; index += 1) {
    const prev = chapterPlan.panels[index - 1];
    const current = chapterPlan.panels[index];
    const score = jaccard(prev.scenePrompt, current.scenePrompt);
    if (score > 0.28) {
      errors.push(`${prev.id}/${current.id} scene prompts are too similar: ${score.toFixed(2)}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const panelCount = (plan.chapters || []).reduce((sum, chapter) => sum + chapter.panels.length, 0);
console.log(`Validated ${panelCount} comic prompt panel(s) from ${file}.`);
