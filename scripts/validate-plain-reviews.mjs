import data from "../src/data/daodejing.generated.json" with { type: "json" };
import reviews from "../src/data/plain-reviewed.generated.json" with { type: "json" };

const errors = [];
const entries = reviews.entries || [];
const byId = new Map(entries.map((entry) => [entry.id, entry]));
const expected = data.chapters.flatMap((chapter) =>
  chapter.sentences.map((sentence, index) => ({
    id: sentence.id,
    chapter: chapter.chapter,
    index,
    sentence: sentence.sentence,
    chapterText: chapter.text
  }))
);

function normalize(text) {
  return String(text || "")
    .replace(/衆/g, "众")
    .replace(/眾/g, "众")
    .replace(/[。；！？：，、,.;:!?“”"'‘’（）()\s]/g, "");
}

function lcs(a, b) {
  let best = "";
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] !== b[j - 1]) continue;
      dp[i][j] = dp[i - 1][j - 1] + 1;
      if (dp[i][j] > best.length) best = a.slice(i - dp[i][j], i);
    }
  }
  return best;
}

const allowedShared = [
  "道",
  "德",
  "圣人",
  "无为",
  "自然",
  "天下",
  "万物",
  "百姓",
  "天道",
  "知足",
  "柔弱",
  "刚强",
  "大国",
  "小国",
  "生死"
];

function sourceResidue(sentence, plain) {
  const source = normalize(sentence);
  const target = normalize(plain);
  if (source.length >= 6 && target.includes(source)) return source;
  const shared = lcs(source, target);
  if (shared.length < 9) return "";
  if (allowedShared.some((term) => shared.includes(term))) return "";
  return shared;
}

const ancientResidue = [
  /兕(?!牛|犀牛)/,
  /(?<!老)虎(?!豹|狼|猛兽)/,
  /甲兵(?!器|兵器|武器|军队)/,
  /橐龠/,
  /刍狗(?!祭祀|草扎|草狗)/,
  /玄牝(?!母性|生养|源头)/,
  /牝(?!牛|马|雌|阴|母性)/,
  /牡(?!牛|马|雄|阳)/,
  /畋猎/,
  /辎重(?!车|装备|根本)/,
  /琭琭/,
  /珞珞/,
  /纇/,
  /繟/,
  /什伯(?!器|工具|倍)/,
  /司彻(?!税|征收|收税)/,
  /拱璧(?!玉|礼物|宝物)/,
  /驷马(?!马车|礼物|厚礼)/,
  /契(?!约|凭据|债|账)/
];

const metaOrTemplate = [
  /王弼|河上公|Legge|译文|翻译|原文|这一句|这句话|本句/,
  /背后的生活智慧/,
  /抓住的重点/,
  /^所以建言/,
  /建言有/,
  /上等人|中等人|下等人/,
  /勤而行之|若存若亡/,
  /若昧|若退|若纇|若谷|若辱|若偷|若渝|无隅/,
  /陆行不遇兕虎|入军不被甲兵/,
  /知不知上|不知知病/,
  /没有什么作用和价值/
];

if (entries.length !== expected.length) {
  errors.push(`Expected ${expected.length} reviewed entries, got ${entries.length}`);
}

for (const item of expected) {
  const entry = byId.get(item.id);
  if (!entry) {
    errors.push(`${item.id} missing review entry`);
    continue;
  }
  if (entry.chapter !== item.chapter) errors.push(`${item.id} chapter mismatch`);
  if (entry.sentence !== item.sentence) errors.push(`${item.id} sentence mismatch`);
  if (!entry.plain || entry.plain.length < 6) errors.push(`${item.id} plain too short`);
  if (entry.plain && entry.plain.length > 90) errors.push(`${item.id} plain too long: ${entry.plain}`);
  const residue = sourceResidue(item.sentence, entry.plain);
  if (residue) errors.push(`${item.id} looks copied from source: ${residue}; ${entry.plain}`);
  for (const pattern of ancientResidue) {
    if (pattern.test(entry.plain)) errors.push(`${item.id} keeps unexplained ancient term ${pattern}: ${entry.plain}`);
  }
  for (const pattern of metaOrTemplate) {
    if (pattern.test(entry.plain)) errors.push(`${item.id} has meta/template wording ${pattern}: ${entry.plain}`);
  }
  for (const key of ["sourceCheck", "plainnessCheck", "contextCheck"]) {
    if (!entry[key] || String(entry[key]).length < 8) errors.push(`${item.id} missing ${key}`);
  }
}

const plainCounts = new Map();
for (const entry of entries) {
  const key = normalize(entry.plain);
  if (!key) continue;
  if (!plainCounts.has(key)) plainCounts.set(key, []);
  plainCounts.get(key).push(entry.id);
}
for (const [plain, ids] of plainCounts) {
  if (ids.length > 1) errors.push(`Duplicate plain in ${ids.join(", ")}: ${plain}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${entries.length} reviewed plain entries with source/plainness/context checks.`);
