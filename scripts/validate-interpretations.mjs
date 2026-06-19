import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const INTERPRETATIONS_DIR = path.join("src", "data", "interpretations");
const errors = [];

const bannedPlainPatterns = [
  /王弼注/,
  /河上公/,
  /Legge/i,
  /这句是在说/,
  /背后的生活智慧/,
  /这一句讲/,
  /这一章/,
  /可以理解为/
];

const sentenceById = new Map();
for (const chapter of data.chapters) {
  for (const sentence of chapter.sentences) {
    sentenceById.set(sentence.id, { chapter: chapter.chapter, sentence: sentence.sentence });
  }
}

function ensure(condition, message) {
  if (!condition) errors.push(message);
}

function normalize(text) {
  return String(text || "")
    .replace(/[，。；！？、\s]/g, "")
    .replace(/衆/g, "众")
    .replace(/眾/g, "众");
}

let fileCount = 0;
let entryCount = 0;

try {
  const files = (await readdir(INTERPRETATIONS_DIR)).filter((file) => file.endsWith(".json")).sort();
  fileCount = files.length;

  for (const file of files) {
    const fullPath = path.join(INTERPRETATIONS_DIR, file);
    const review = JSON.parse(await readFile(fullPath, "utf8"));
    const sourceIds = new Set((review.sources || []).map((source) => source.id));

    ensure(Number.isInteger(review.chapter), `${file} missing numeric chapter`);
    ensure(review.title, `${file} missing title`);
    ensure((review.sources || []).length >= 3, `${file} needs at least 3 comparison sources`);
    ensure(review.method, `${file} missing method`);

    for (const source of review.sources || []) {
      ensure(source.id && source.label && source.url && source.role, `${file} has incomplete source ${JSON.stringify(source)}`);
    }

    for (const entry of review.entries || []) {
      entryCount += 1;
      const expected = sentenceById.get(entry.id);
      ensure(expected, `${file}/${entry.id} does not exist in generated data`);
      if (expected) {
        ensure(expected.chapter === review.chapter, `${file}/${entry.id} chapter mismatch`);
        ensure(
          normalize(expected.sentence) === normalize(entry.sentence),
          `${file}/${entry.id} sentence mismatch: ${entry.sentence} vs ${expected.sentence}`
        );
      }

      ensure(entry.plain && entry.plain.length >= 18, `${file}/${entry.id} plain text is too short`);
      ensure(!bannedPlainPatterns.some((pattern) => pattern.test(entry.plain)), `${file}/${entry.id} plain text is template/source-name flavored`);
      ensure(entry.decision && entry.decision.length >= 18, `${file}/${entry.id} missing decision`);
      ensure((entry.evidence || []).length >= 3, `${file}/${entry.id} needs at least 3 evidence notes`);

      for (const evidence of entry.evidence || []) {
        ensure(sourceIds.has(evidence.source), `${file}/${entry.id} references unknown source ${evidence.source}`);
        ensure(evidence.note && evidence.note.length >= 12, `${file}/${entry.id} has weak evidence note`);
      }

      const semantics = entry.imageSemantics || {};
      ensure((semantics.mustShow || []).length >= 2, `${file}/${entry.id} needs at least 2 mustShow visual anchors`);
      ensure((semantics.mustNotShow || []).length >= 2, `${file}/${entry.id} needs at least 2 mustNotShow items`);
      ensure(semantics.visualTest && semantics.visualTest.length >= 15, `${file}/${entry.id} missing visualTest`);
    }
  }
} catch (error) {
  if (error.code === "ENOENT") {
    errors.push(`Missing ${INTERPRETATIONS_DIR}`);
  } else {
    throw error;
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${entryCount} reviewed interpretation(s) from ${fileCount} file(s).`);
