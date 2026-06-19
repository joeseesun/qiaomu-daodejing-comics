import { writeFile } from "node:fs/promises";
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const OUTPUT_FILE = "src/data/source-evidence.generated.json";

const sources = [
  {
    id: "wikisource-wangbi",
    label: "维基文库《道德经（王弼本）》",
    url: "https://zh.wikisource.org/w/index.php?title=%E9%81%93%E5%BE%B7%E7%B6%93_(%E7%8E%8B%E5%BC%BC%E6%9C%AC)&action=raw"
  },
  {
    id: "wikisource-heshanggong-shang",
    label: "维基文库《老子河上公章句/上》",
    url: "https://zh.wikisource.org/w/index.php?title=%E8%80%81%E5%AD%90%E6%B2%B3%E4%B8%8A%E5%85%AC%E7%AB%A0%E5%8F%A5/%E4%B8%8A&action=raw"
  },
  {
    id: "wikisource-heshanggong-dejing",
    label: "维基文库《老子河上公章句/德经》",
    url: "https://zh.wikisource.org/w/index.php?title=%E8%80%81%E5%AD%90%E6%B2%B3%E4%B8%8A%E5%85%AC%E7%AB%A0%E5%8F%A5/%E5%BE%B7%E7%B6%93&action=raw"
  }
];

const traditionalMap = new Map(
  Object.entries({
    萬: "万",
    與: "与",
    為: "为",
    無: "无",
    觀: "观",
    聖: "圣",
    聲: "声",
    聾: "聋",
    馳: "驰",
    騁: "骋",
    獵: "猎",
    貨: "货",
    難: "难",
    發: "发",
    傷: "伤",
    養: "养",
    體: "体",
    見: "见",
    聽: "听",
    國: "国",
    兩: "两",
    異: "异",
    謂: "谓",
    門: "门",
    歸: "归",
    終: "终",
    民: "民",
    眾: "众",
    衆: "众",
    畋: "田"
  })
);

function normalize(text) {
  return String(text || "")
    .replace(/[，。；！？、：；,.!?;:\s"'“”‘’〈〉《》()\[\]{}|*_=#<>/\\-]/g, "")
    .split("")
    .map((char) => traditionalMap.get(char) || char)
    .join("");
}

function stripWikiMarkup(text) {
  return String(text || "")
    .replace(/^:?\{\{\*\|/, "")
    .replace(/\}\}$/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .trim();
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { "user-agent": "qiaomu-daodejing-source-audit/1.0" }
  });
  if (!response.ok) throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
  const raw = await response.text();
  return raw.split(/\r?\n/).map((line) => ({
    raw: line,
    text: stripWikiMarkup(line),
    isComment: /^:?\{\{\*\|/.test(line.trim())
  }));
}

function commentaryAfter(lines, index) {
  const notes = [];
  for (let cursor = index + 1; cursor < Math.min(lines.length, index + 6); cursor += 1) {
    if (!lines[cursor].isComment) {
      if (notes.length) break;
      continue;
    }
    const line = lines[cursor].text.trim();
    if (!line) continue;
    if (/^=/.test(line)) break;
    if (line.length > 180) break;
    if (line.includes("{{")) continue;
    notes.push(line);
  }
  return notes;
}

function findEvidence(lines, sentence) {
  const normalizedSentence = normalize(sentence);
  const compactSentence = normalizedSentence.slice(0, Math.min(12, normalizedSentence.length));
  const matches = [];

  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalize(lines[index].text);
    if (!normalizedLine) continue;
    const isExactish = normalizedLine.includes(normalizedSentence) || (compactSentence.length >= 5 && normalizedLine.includes(compactSentence));
    if (!isExactish) continue;
    const quote = lines[index].text.trim();
    const notes = commentaryAfter(lines, index);
    matches.push({
      line: index + 1,
      quote: quote.length > 160 ? `${quote.slice(0, 160)}...` : quote,
      notes
    });
    if (matches.length >= 3) break;
  }

  return matches;
}

const fetched = [];
for (const source of sources) {
  const lines = await fetchSource(source);
  fetched.push({ ...source, lines });
}

const chapters = data.chapters.map((chapter) => ({
  chapter: chapter.chapter,
  title: chapter.title,
  sentences: chapter.sentences.map((sentence) => ({
    id: sentence.id,
    sentence: sentence.sentence,
    sourceUrl: chapter.sourceUrl,
    evidence: fetched.flatMap((source) =>
      findEvidence(source.lines, sentence.sentence).map((match) => ({
        source: source.id,
        label: source.label,
        url: source.url.replace(/&action=raw$/, ""),
        ...match
      }))
    )
  }))
}));

const payload = {
  generatedAt: new Date().toISOString(),
  baseText: data.source,
  sources: sources.map(({ id, label, url }) => ({ id, label, url: url.replace(/&action=raw$/, "") })),
  chapters
};

await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);

const sentenceCount = chapters.reduce((total, chapter) => total + chapter.sentences.length, 0);
const covered = chapters.reduce(
  (total, chapter) => total + chapter.sentences.filter((sentence) => sentence.evidence.length > 0).length,
  0
);

console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`Matched source evidence for ${covered}/${sentenceCount} sentence(s).`);
