import { writeFile } from "node:fs/promises";
import data from "../src/data/daodejing.generated.json" with { type: "json" };
import sourceEvidence from "../src/data/source-evidence.generated.json" with { type: "json" };

const OUTPUT_FILE = "src/data/daodejing.reader.draft.json";

const evidenceById = new Map();
for (const chapter of sourceEvidence.chapters || []) {
  for (const sentence of chapter.sentences || []) {
    evidenceById.set(sentence.id, sentence.evidence || []);
  }
}

function literalFromPlain(sentence, plain) {
  if (/^道可道/.test(sentence)) return "可以被说出、规定成路径或方法的道，并不是恒常之道。";
  if (/^名可名/.test(sentence)) return "可以被命名、被固定称呼的名，并不是恒常之名。";
  if (/^无名天地之始/.test(sentence)) return "无名的状态，是天地开始发生的源头。";
  if (/^有名万物之母/.test(sentence)) return "有名有形的状态，是万物生长成形的母体。";
  return plain.replace(/[。；！？]$/, "。");
}

function readingNoteFromReviewed(item) {
  if (item.interpretation?.plainReview?.contextCheck) return item.interpretation.plainReview.contextCheck;
  if (item.interpretation?.decision) return item.interpretation.decision;
  return "本句暂用现有白话作读者版草稿，尚未完成古注对照审稿。";
}

function compactEvidence(item) {
  if (item.interpretation?.plainReview) {
    const review = item.interpretation.plainReview;
    return [
      {
        source: "ctext-base",
        note: review.sourceCheck
      },
      {
        source: "wikisource-wangbi",
        note: review.plainnessCheck
      },
      {
        source: "wikisource-heshanggong",
        note: review.contextCheck
      }
    ];
  }

  if (item.interpretation?.evidence?.length) {
    return item.interpretation.evidence.map((evidence) => ({
      source: evidence.source,
      note: evidence.note
    }));
  }

  return (evidenceById.get(item.id) || []).slice(0, 3).map((evidence) => ({
    source: evidence.source,
    line: evidence.line,
    note: [evidence.quote, ...(evidence.notes || [])].filter(Boolean).join(" ")
  }));
}

function imageSemanticsFor(item) {
  if (item.interpretation?.imageSemantics) return item.interpretation.imageSemantics;
  return {
    coreMeaning: item.plain,
    mustShow: [],
    mustNotShow: [],
    visualTest: "草稿项：需要审定解释后再补充可验证画面锚点。"
  };
}

const chapters = data.chapters.map((chapter) => ({
  chapter: chapter.chapter,
  title: chapter.title,
  gist: chapter.gist,
  text: chapter.text,
  sourceUrl: chapter.sourceUrl,
  reviewStatus: chapter.sentences.every((item) => item.interpretation) ? "reviewed" : "draft",
  sentences: chapter.sentences.map((item) => {
    const reviewed = Boolean(item.interpretation);
    return {
      id: item.id,
      sentence: item.sentence,
      literal: reviewed ? literalFromPlain(item.sentence, item.plain) : "",
      plain: item.plain,
      readingNote: readingNoteFromReviewed(item),
      reviewStatus: reviewed ? "reviewed" : "draft",
      confidence: reviewed ? "medium-high" : "unchecked",
      sources: compactEvidence(item),
      variantNotes: [],
      image: item.image,
      imageSemantics: imageSemanticsFor(item)
    };
  })
}));

const reviewedSentences = chapters.reduce(
  (total, chapter) => total + chapter.sentences.filter((sentence) => sentence.reviewStatus === "reviewed").length,
  0
);

const payload = {
  meta: {
    title: "道德经配图版读者白话 JSON",
    generatedAt: new Date().toISOString(),
    baseText: data.source,
    purpose:
      "Reader-facing plain-language data. Reviewed entries are source-backed; draft entries are generated from existing site data and must not be treated as final.",
    schemaVersion: 1,
    stats: {
      chapters: chapters.length,
      sentences: data.stats.sentences,
      reviewedSentences,
      draftSentences: data.stats.sentences - reviewedSentences
    }
  },
  chapters
};

await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`Reviewed ${reviewedSentences}/${data.stats.sentences} sentence(s).`);
