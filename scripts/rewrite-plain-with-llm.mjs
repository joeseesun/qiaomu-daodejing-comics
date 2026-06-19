import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import data from "../src/data/daodejing.generated.json" with { type: "json" };
import sourceEvidence from "../src/data/source-evidence.generated.json" with { type: "json" };

const REGISTRY_FILE = path.join(process.env.HOME || "", ".config", "qiaomu-llm", "registry.json");
const OUTPUT_FILE = path.join("src", "data", "plain-reviewed.generated.json");
const DEFAULT_PROVIDER = "aigocode-openai";
const DEFAULT_MODEL = "gpt-5.4";

function parseArgs() {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const current = process.argv[index];
    if (!current.startsWith("--")) continue;
    const [key, inline] = current.slice(2).split("=", 2);
    if (inline !== undefined) {
      args.set(key, inline);
    } else if (process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
      args.set(key, process.argv[index + 1]);
      index += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function chapterFilter(value) {
  if (!value || value === true || value === "all") return new Set(data.chapters.map((chapter) => chapter.chapter));
  const chapters = new Set();
  for (const part of String(value).split(",")) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((item) => Number(item));
      for (let chapter = start; chapter <= end; chapter += 1) chapters.add(chapter);
    } else {
      chapters.add(Number(part));
    }
  }
  return chapters;
}

async function loadRegistryProvider(providerId) {
  const registry = JSON.parse(await readFile(REGISTRY_FILE, "utf8"));
  const provider = registry.providers?.[providerId];
  if (!provider) throw new Error(`Unknown qiaomu-llm provider: ${providerId}`);
  if (provider.disabled) throw new Error(`Provider is disabled: ${providerId}`);
  return provider;
}

function keychainSecret(ref) {
  if (!ref?.startsWith("keychain:")) throw new Error(`Unsupported secret_ref: ${ref || "(empty)"}`);
  const payload = ref.slice("keychain:".length);
  const slash = payload.indexOf("/");
  const service = payload.slice(0, slash);
  const account = payload.slice(slash + 1);
  const result = spawnSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Missing Keychain secret for ${service}/${account}`);
  }
  return result.stdout.trim();
}

function providerEndpoint(provider, route) {
  let base = String(provider.base_url || "").replace(/\/$/, "");
  if (provider.append_v1 !== false && !base.endsWith("/v1")) base = `${base}/v1`;
  return `${base}/${route.replace(/^\//, "")}`;
}

function normalizeChinese(text) {
  return String(text || "")
    .replace(/衆/g, "众")
    .replace(/眾/g, "众")
    .replace(/\s+/g, "");
}

function comparable(text) {
  return normalizeChinese(text).replace(/[。；！？：，、,.;:!?“”"'‘’（）()\s]/g, "");
}

function summarizeEvidence(sentenceEvidence) {
  return (sentenceEvidence?.evidence || []).slice(0, 4).map((item) => ({
    source: item.source,
    quote: normalizeChinese(item.quote || "").slice(0, 120),
    notes: (item.notes || []).map((note) => normalizeChinese(note).slice(0, 120)).slice(0, 3)
  }));
}

function buildChapterInput(chapter) {
  const evidenceChapter = sourceEvidence.chapters.find((item) => item.chapter === chapter.chapter);
  return {
    chapter: chapter.chapter,
    title: chapter.title,
    fullText: chapter.text,
    entries: chapter.sentences.map((sentence) => {
      const evidence = evidenceChapter?.sentences.find((item) => item.id === sentence.id);
      return {
        id: sentence.id,
        sentence: sentence.sentence,
        currentPlain: sentence.plain,
        evidence: summarizeEvidence(evidence)
      };
    })
  };
}

function systemPrompt() {
  return [
    "你是《道德经》现代白话审校编辑，不是鸡汤文案作者。",
    "目标：把每一句改成可读性高、忠于原意、能接上本章上下文的现代中文。",
    "三审三校必须体现在每条结果里：",
    "一审 sourceCheck：核对原句、章内上下文、给出的王弼/河上公证据；没有证据时只取通行共识，不乱发挥。",
    "二审 plainnessCheck：必须是真白话，不能把古文换个标点照搬；遇到兕虎、甲兵、橐龠、司彻、什伯等词要解释为现代词。",
    "三审 contextCheck：说明这一句在本章前后论证里的作用，避免前后句互相割裂。",
    "页面 plain 写法规则：只写一句现代中文，通常 18-58 个汉字；可保留“道、德、圣人、无为、知足”等核心术语，但要让普通读者读懂；不要出现王弼、河上公、Legge、原文说、这一句等元话语；不要用模板腔；不要添加宗教化、玄学化、成功学化解释。",
    "不要只把古文替换成近义词。短句也要补足语境对象，例如“夫何故？”要写成“为什么会这样？因为人怎样对待生命很关键”；“明道若昧”要写成“真正清楚的道理，刚看时反而不耀眼”。",
    "避免“上等人、下等人、勤而行之、若存若亡、明道若昧、进道若退”这类半古半白表达；要改成今天人能顺口读懂的话。",
    "只返回 JSON 对象，不要 Markdown。"
  ].join("\n");
}

function userPrompt(chapterInput) {
  return JSON.stringify(
    {
      task:
        "请结合 fullText 全章上下文，为 entries 每一条重写 plain，并填写 sourceCheck/plainnessCheck/contextCheck。必须保持 id 完整、顺序一致、条数一致。",
      outputSchema: {
        chapter: chapterInput.chapter,
        entries: [
          {
            id: "cXX-sXX",
            plain: "页面使用的现代白话一句话",
            sourceCheck: "一句话说明语义取舍",
            plainnessCheck: "一句话说明已经把古文/术语转成白话",
            contextCheck: "一句话说明它和本章上下文的关系"
          }
        ]
      },
      chapter: chapterInput
    },
    null,
    2
  );
}

function extractJson(raw) {
  const text = String(raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Model did not return JSON: ${text.slice(0, 300)}`);
    try {
      return JSON.parse(match[0]);
    } catch {
      const repaired = match[0].replace(/("contextCheck":"[^"]*?)(?=},\{"id")/g, '$1"');
      return JSON.parse(repaired);
    }
  }
}

function validateChapterOutput(chapterInput, output) {
  const errors = [];
  const entries = output?.entries;
  if (!Array.isArray(entries)) errors.push("entries is not an array");
  if (Array.isArray(entries) && entries.length !== chapterInput.entries.length) {
    errors.push(`expected ${chapterInput.entries.length} entries, got ${entries.length}`);
  }
  const expectedIds = chapterInput.entries.map((entry) => entry.id);
  for (let index = 0; index < expectedIds.length; index += 1) {
    const entry = entries?.[index];
    if (!entry) continue;
    const source = chapterInput.entries[index];
    if (entry.id !== expectedIds[index]) errors.push(`entry ${index + 1} id mismatch: ${entry.id} vs ${expectedIds[index]}`);
    if (!entry.plain || String(entry.plain).length < 6) errors.push(`${entry.id} plain too short`);
    if (/王弼|河上公|Legge|这句|本句|原文|意思是|翻译/.test(entry.plain)) {
      errors.push(`${entry.id} plain contains meta/source wording: ${entry.plain}`);
    }
    if (/上等人|中等人|下等人|勤而行之|若存若亡|若昧|若退|若纇|若谷|若辱|若偷|若渝/.test(entry.plain)) {
      errors.push(`${entry.id} plain still looks half-classical: ${entry.plain}`);
    }
    if (comparable(source.sentence).length >= 6 && comparable(entry.plain).includes(comparable(source.sentence))) {
      errors.push(`${entry.id} plain repeats source sentence: ${entry.plain}`);
    }
    for (const key of ["sourceCheck", "plainnessCheck", "contextCheck"]) {
      if (!entry[key] || String(entry[key]).length < 8) errors.push(`${entry.id} missing ${key}`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

async function callOpenAICompatible(provider, secret, model, chapterInput, timeoutMs) {
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(chapterInput) }
    ],
    response_format: { type: "json_object" },
    temperature: 0.15,
    max_tokens: 9000
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(providerEndpoint(provider, "chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `${provider.auth_header === "x-api-key" ? "" : "Bearer "}${secret}`.trim(),
        ...(provider.auth_header === "x-api-key" ? { "x-api-key": secret } : {}),
        ...(provider.headers || {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}`);
    const json = JSON.parse(text);
    return extractJson(json.choices?.[0]?.message?.content || "");
  } finally {
    clearTimeout(timer);
  }
}

async function loadExisting() {
  try {
    const raw = await readFile(OUTPUT_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { generatedAt: "", provider: "", model: "", entries: [] };
  }
}

function mergeEntries(existing, chapterOutput) {
  const byId = new Map(existing.entries.map((entry) => [entry.id, entry]));
  for (const entry of chapterOutput.entries) byId.set(entry.id, entry);
  const ordered = data.chapters.flatMap((chapter) =>
    chapter.sentences.map((sentence) => byId.get(sentence.id)).filter(Boolean)
  );
  return ordered;
}

const args = parseArgs();
const providerId = String(args.get("provider") || DEFAULT_PROVIDER);
const model = String(args.get("model") || DEFAULT_MODEL);
const selectedChapters = chapterFilter(args.get("chapters") || "all");
const force = Boolean(args.get("force"));
const provider = await loadRegistryProvider(providerId);
const secret = keychainSecret(provider.secret_ref);
const existing = await loadExisting();
const existingIds = new Set(existing.entries.map((entry) => entry.id));

let payload = {
  generatedAt: new Date().toISOString(),
  provider: providerId,
  model,
  sources: [
    {
      id: "ctext-base",
      label: "中国哲学书电子化计划《道德经》原文",
      url: "https://ctext.org/dao-de-jing/zh"
    },
    ...sourceEvidence.sources
  ],
  reviewMethod: [
    "一审：原文与古注/译文证据对齐",
    "二审：改写成普通读者能读懂的现代白话",
    "三审：放回整章上下文检查承接关系"
  ],
  entries: existing.entries || []
};

for (const chapter of data.chapters) {
  if (!selectedChapters.has(chapter.chapter)) continue;
  const ids = chapter.sentences.map((sentence) => sentence.id);
  if (!force && ids.every((id) => existingIds.has(id))) {
    console.log(`skip chapter ${chapter.chapter}: already reviewed`);
    continue;
  }

  const input = buildChapterInput(chapter);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`rewrite chapter ${chapter.chapter} attempt ${attempt}`);
      const output = await callOpenAICompatible(provider, secret, model, input, 120000);
      validateChapterOutput(input, output);
      payload.entries = mergeEntries(payload, {
        chapter: chapter.chapter,
        entries: output.entries.map((entry, index) => ({
          id: entry.id,
          chapter: chapter.chapter,
          sentence: input.entries[index].sentence,
          plain: String(entry.plain).replace(/[。；！？]+$/g, ""),
          sourceCheck: entry.sourceCheck,
          plainnessCheck: entry.plainnessCheck,
          contextCheck: entry.contextCheck
        }))
      });
      payload.generatedAt = new Date().toISOString();
      await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(`wrote chapter ${chapter.chapter}`);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      console.error(`chapter ${chapter.chapter} attempt ${attempt} failed:\n${error.message}`);
    }
  }
  if (lastError) throw lastError;
}

payload.entries = mergeEntries(payload, { entries: [] });
await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Reviewed ${payload.entries.length}/${data.stats.sentences} sentences -> ${OUTPUT_FILE}`);
