import reader from "../src/data/daodejing.reader.draft.json" with { type: "json" };
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const errors = [];
const ids = new Set();

function ensure(condition, message) {
  if (!condition) errors.push(message);
}

ensure(reader.meta?.schemaVersion === 1, "reader JSON schemaVersion must be 1");
ensure(reader.chapters?.length === data.stats.chapters, `chapter count mismatch: ${reader.chapters?.length}`);

let sentenceCount = 0;
let reviewedCount = 0;

for (const [chapterIndex, chapter] of (reader.chapters || []).entries()) {
  const sourceChapter = data.chapters[chapterIndex];
  ensure(chapter.chapter === sourceChapter.chapter, `chapter order mismatch at ${chapterIndex + 1}`);
  ensure(chapter.sentences.length === sourceChapter.sentences.length, `chapter ${chapter.chapter} sentence count mismatch`);

  const allReviewed = chapter.sentences.every((sentence) => sentence.reviewStatus === "reviewed");
  ensure(chapter.reviewStatus === (allReviewed ? "reviewed" : "draft"), `chapter ${chapter.chapter} reviewStatus mismatch`);

  for (const [sentenceIndex, sentence] of chapter.sentences.entries()) {
    sentenceCount += 1;
    if (sentence.reviewStatus === "reviewed") reviewedCount += 1;

    const sourceSentence = sourceChapter.sentences[sentenceIndex];
    ensure(sentence.id === sourceSentence.id, `${sentence.id} id order mismatch`);
    ensure(sentence.sentence === sourceSentence.sentence, `${sentence.id} sentence mismatch`);
    ensure(!ids.has(sentence.id), `duplicate id ${sentence.id}`);
    ids.add(sentence.id);

    ensure(sentence.plain && sentence.plain.length >= 8, `${sentence.id} missing plain`);
    ensure(["reviewed", "draft"].includes(sentence.reviewStatus), `${sentence.id} invalid reviewStatus`);
    ensure(sentence.readingNote && sentence.readingNote.length >= 12, `${sentence.id} missing readingNote`);
    ensure(sentence.imageSemantics?.visualTest, `${sentence.id} missing imageSemantics.visualTest`);

    if (sentence.reviewStatus === "reviewed") {
      ensure(sentence.literal && sentence.literal.length >= 8, `${sentence.id} reviewed sentence missing literal`);
      ensure((sentence.sources || []).length >= 3, `${sentence.id} reviewed sentence needs at least 3 sources`);
      ensure(sentence.confidence !== "unchecked", `${sentence.id} reviewed sentence has unchecked confidence`);
    }
  }
}

ensure(sentenceCount === data.stats.sentences, `sentence count mismatch: ${sentenceCount}`);
ensure(reader.meta.stats.reviewedSentences === reviewedCount, "reviewed count mismatch");
ensure(reader.meta.stats.draftSentences === sentenceCount - reviewedCount, "draft count mismatch");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated reader JSON: ${reader.chapters.length} chapters, ${sentenceCount} sentences, ${reviewedCount} reviewed.`);
