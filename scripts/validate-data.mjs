import data from "../src/data/daodejing.generated.json" with { type: "json" };

const errors = [];
const sentenceIds = new Set();
const bannedPlainPatterns = [
  /王弼注/,
  /这句是在说/,
  /背后的生活智慧/,
  /本章论证链条/,
  /它先抛出/,
  /能无[^？。]{1,8}吗/,
  /的用/,
  /知道不知道/,
  /不知道知道/,
  /不强行干预而无以为/,
  /不占功其/,
  /字的曰/,
  /强为的/,
  /勤而行的/,
  /吾亦[^。；，]*的/,
  /道生的/,
  /德行畜/,
  /物形的/,
  /势成的/,
  /为的人败/,
  /执的人失/,
  /高的人抑/,
  /下的人举/,
  /有馀的人损/,
  /不足的人补/,
  /人的所恶/,
  /福的所倚/,
  /祸的所伏/,
  /长生久视的道/,
  /善人的宝/,
  /不善人的所保/,
  /古的所以/,
  /复众人的所过/,
  /天的所恶/,
  /什伯的器/,
  /的后/,
  /的所处/,
  /的衆/,
  /没有谁的/,
  /不被欲望望/,
  /为的而/,
  /而有以为/,
  /而无以为/
];
const bannedSourcePatterns = [/衆/, /眾/];
const repeatedPlainParts = new Map();
const allowedSharedFragments = [
  "天道",
  "天下",
  "世间",
  "万物",
  "万事万物",
  "圣人",
  "百姓",
  "自然",
  "无为",
  "不争",
  "柔弱",
  "刚强",
  "知足",
  "知止",
  "有余",
  "不足",
  "道德",
  "治理",
  "生命",
  "生死",
  "天地",
  "德行"
];
const unexplainedAncientTerms = [
  /兕/,
  /蜂虿/,
  /虺蛇/,
  /橐龠/,
  /牝(?!牛|马|雌|阴)/,
  /牡(?!牛|马|雄|阳)/,
  /琭琭/,
  /珞珞/,
  /𥡴/,
  /繟/,
  /什伯/,
  /拱璧/,
  /驷马/,
  /善贷/,
  /司彻/,
  /踈/
];
const awkwardLiteralPatterns = [
  /建言有/,
  /明道若昧/,
  /进道若退/,
  /夷道若纇/,
  /强梁的人不得其死/,
  /莫大于不知道/,
  /没有谁大于不知道/,
  /能成器长/,
  /建言有的/,
  /吾言甚易知道/,
  /知道足不辱/,
  /知道止不殆/,
  /有德行司契/,
  /司彻/,
  /重死而不远徙/,
  /其人们/,
  /故[^意]建言/
];

function plainParts(text) {
  return text
    .split(/[。；！？]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 14);
}

function comparableText(text) {
  return text.replace(/[。；！？：，、,.;:!?“”"'‘’（）()\s]/g, "");
}

function longestCommonSubstring(a, b) {
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

function isAllowedSharedFragment(fragment) {
  if (fragment.length < 8) return true;
  return allowedSharedFragments.some((allowed) => fragment === allowed || fragment.includes(allowed));
}

function untranslatedReason(sentence, plain) {
  const normalizedSentence = comparableText(sentence);
  const normalizedPlain = comparableText(plain);
  if (
    normalizedSentence.length >= 6 &&
    (normalizedPlain === normalizedSentence || normalizedPlain.includes(normalizedSentence))
  ) {
    return "plain text repeats the whole source sentence";
  }

  const repeated = longestCommonSubstring(normalizedSentence, normalizedPlain);
  if (repeated.length >= 8 && !isAllowedSharedFragment(repeated)) {
    return `plain text keeps a long source fragment: ${repeated}`;
  }

  const ancient = unexplainedAncientTerms.find((pattern) => pattern.test(plain));
  if (ancient) return `plain text keeps unexplained classical wording: ${ancient}`;

  const awkward = awkwardLiteralPatterns.find((pattern) => pattern.test(plain));
  if (awkward) return `plain text keeps awkward literal wording: ${awkward}`;

  return "";
}

if (data.stats.chapters !== 81) {
  errors.push(`Expected 81 chapters, got ${data.stats.chapters}`);
}

const actualSentences = data.chapters.reduce((total, chapter) => total + chapter.sentences.length, 0);
if (actualSentences !== data.stats.sentences) {
  errors.push(`Stats sentence count mismatch: ${data.stats.sentences} vs ${actualSentences}`);
}

for (const chapter of data.chapters) {
  if (!chapter.text || !chapter.title || !chapter.sourceUrl) {
    errors.push(`Chapter ${chapter.chapter} is missing required metadata`);
  }
  for (const item of chapter.sentences) {
    if (sentenceIds.has(item.id)) errors.push(`Duplicate sentence id ${item.id}`);
    sentenceIds.add(item.id);
    if (!/[。；！？]$/.test(item.sentence)) errors.push(`${item.id} does not end with target punctuation`);
    if (bannedSourcePatterns.some((pattern) => pattern.test(item.sentence))) {
      errors.push(`${item.id} source text contains non-simplified variant: ${item.sentence}`);
    }
    if (!item.plain || item.plain.length < 10) errors.push(`${item.id} explanation is too short`);
    if (bannedPlainPatterns.some((pattern) => pattern.test(item.plain))) {
      errors.push(`${item.id} explanation still looks literal/template-like: ${item.plain}`);
    }
    const untranslated = untranslatedReason(item.sentence, item.plain);
    if (untranslated) {
      errors.push(`${item.id} explanation looks untranslated: ${untranslated}; ${item.plain}`);
    }
    for (const part of plainParts(item.plain)) {
      if (!repeatedPlainParts.has(part)) repeatedPlainParts.set(part, []);
      repeatedPlainParts.get(part).push(item.id);
    }
    if (!item.image || !item.imagePrompt) errors.push(`${item.id} is missing image fields`);
  }

  for (let index = 1; index < chapter.sentences.length; index += 1) {
    const prev = chapter.sentences[index - 1];
    const current = chapter.sentences[index];
    if (prev.sentence === current.sentence) continue;
    const prevParts = new Set(plainParts(prev.plain));
    const repeated = plainParts(current.plain).find((part) => prevParts.has(part));
    if (repeated) {
      errors.push(`${prev.id}/${current.id} adjacent explanations share repeated wording: ${repeated}`);
    }
  }
}

for (const [part, ids] of repeatedPlainParts) {
  if (ids.length > 1) {
    errors.push(`Repeated long explanation wording in ${ids.join(", ")}: ${part}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${data.stats.chapters} chapters and ${data.stats.sentences} sentence cards.`);
